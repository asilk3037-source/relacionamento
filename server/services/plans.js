'use strict';
const crypto = require('crypto');
const { bad, forbidden, notFound, HttpError } = require('../lib/errors');
const { DAY, MIN } = require('../lib/time');

const RANK = { free: 0, plus: 1, premium: 2 };
const LIVE = ['active', 'renewal_cancelled', 'grace'];

module.exports = (ctx) => {
  const { db, config } = ctx;
  const limits = () => ({ ...config.dailyLikes, ...(ctx.param('dailyLikes', {}) || {}) });
  const limitFor = (plan) => limits()[plan];

  /** Direito efetivo do usuário. Compra pendente NÃO libera benefício. */
  function entitlement(userId) {
    const now = ctx.now();
    const subs = db.all(`SELECT * FROM subscriptions WHERE user_id = ? AND state IN ('active','renewal_cancelled','grace') ORDER BY id DESC`, userId);
    let best = null;
    for (const s of subs) {
      const end = s.current_period_end + (s.state === 'grace' ? config.graceDays * DAY : 0);
      if (end > now && (!best || RANK[s.plan] > RANK[best.plan])) best = s;
    }
    return { plan: best ? best.plan : 'free', sub: best };
  }
  const planOf = (userId) => entitlement(userId).plan;
  const requirePlan = (userId, min, feature) => {
    if (RANK[planOf(userId)] < RANK[min]) throw forbidden('plan_required', `${feature} faz parte de um plano pago.`, { requires: min });
  };

  function catalog() {
    const out = [{ id: 'free', name: 'Elo Free', month: 0, year: 0, dailyLikes: limitFor('free') }];
    for (const [id, p] of Object.entries(config.plans)) out.push({ id, name: p.name, month: p.month, year: p.year, yearMonthlyEquivalent: Math.round((p.year / 12) * 100) / 100, dailyLikes: limitFor(id) });
    return out;
  }

  function current(userId) {
    const { plan, sub } = entitlement(userId);
    const pending = db.get(`SELECT id, plan, cycle FROM subscriptions WHERE user_id = ? AND state = 'pending' ORDER BY id DESC LIMIT 1`, userId);
    const boost = activeBoost(userId);
    const usedBoosts = db.get('SELECT started_at FROM boosts WHERE user_id = ? AND started_at > ? ORDER BY started_at DESC LIMIT 1', userId, ctx.now() - config.boost.windowDays * DAY);
    return {
      plan,
      cycle: sub ? sub.cycle : null,
      state: sub ? sub.state : 'free',
      renews: sub ? sub.state === 'active' : false,
      periodEnd: sub ? sub.current_period_end : null,
      pending: pending || null,
      dailyLikes: limitFor(plan),
      boost: plan === 'premium' ? { active: !!boost, endsAt: boost ? boost.ends_at : null, availableAt: usedBoosts ? usedBoosts.started_at + config.boost.windowDays * DAY : null } : null,
      discreet: isDiscreet(userId),
    };
  }

  // ---- Compra: loja (Google Play) e simulação de desenvolvimento ----
  function startCheckout(userId, plan, cycle) {
    if (!config.plans[plan]) throw bad('invalid_plan', 'Plano inválido.');
    if (!['month', 'year'].includes(cycle)) throw bad('invalid_cycle', 'Período inválido.');
    const now = ctx.now();
    db.run(`UPDATE subscriptions SET state = 'expired', updated_at = ? WHERE user_id = ? AND state = 'pending'`, now, userId);
    const ref = 'mock_' + crypto.randomBytes(8).toString('hex');
    const r = db.run('INSERT INTO subscriptions(user_id, plan, cycle, state, provider, provider_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', userId, plan, cycle, 'pending', ctx.googleVerifier ? 'google' : 'mock', ref, now, now);
    const price = config.plans[plan][cycle];
    return { subscriptionId: Number(r.lastInsertRowid), plan, cycle, price, provider: ctx.googleVerifier ? 'google' : 'mock' };
  }
  function activate(sub, periodEnd) {
    db.tx(() => {
      // Troca de plano: encerra as demais assinaturas vigentes (ajuste definitivo vem da loja).
      db.run(`UPDATE subscriptions SET state = 'expired', updated_at = ? WHERE user_id = ? AND id != ? AND state IN ('active','renewal_cancelled','grace')`, ctx.now(), sub.user_id, sub.id);
      db.run(`UPDATE subscriptions SET state = 'active', started_at = COALESCE(started_at, ?), current_period_end = ?, updated_at = ? WHERE id = ?`, ctx.now(), periodEnd, ctx.now(), sub.id);
    });
  }
  /** Somente desenvolvimento: conclui a compra simulada. */
  function confirmMock(userId, subscriptionId) {
    if (config.prod) throw new HttpError(404, 'not_found', 'Não encontrado.');
    const sub = db.get(`SELECT * FROM subscriptions WHERE id = ? AND user_id = ? AND provider = 'mock' AND state = 'pending'`, subscriptionId, userId);
    if (!sub) throw notFound('Compra pendente não encontrada.');
    activate(sub, ctx.now() + (sub.cycle === 'year' ? 365 : 30) * DAY);
    ctx.audit(userId, 'billing.mock_confirmed', 'subscription', sub.id);
    return current(userId);
  }
  /** Produção: valida o token da compra no Google Play e reconcilia o estado, de forma idempotente. */
  async function verifyGoogle(userId, { productId, purchaseToken }) {
    if (!ctx.googleVerifier) throw new HttpError(501, 'billing_not_configured', 'Cobrança pela loja ainda não está configurada.');
    const m = /^elo_(plus|premium)_(month|year)$/.exec(String(productId || ''));
    if (!m || !purchaseToken) throw bad('invalid_product', 'Produto inválido.');
    const info = await ctx.googleVerifier.verify({ productId, purchaseToken });
    const ref = ctx.sha256('gp:' + purchaseToken);
    const now = ctx.now();
    let sub = db.get('SELECT * FROM subscriptions WHERE provider_ref = ?', ref);
    if (sub && sub.user_id !== userId) throw forbidden('purchase_belongs_to_other', 'Esta compra pertence a outra conta.');
    if (!sub) { db.run('INSERT INTO subscriptions(user_id, plan, cycle, state, provider, provider_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', userId, m[1], m[2], 'pending', 'google', ref, now, now); sub = db.get('SELECT * FROM subscriptions WHERE provider_ref = ?', ref); }
    applyProviderState(sub, info);
    return current(userId);
  }
  /** info: { state: 'pending'|'active'|'renewal_cancelled'|'grace'|'expired'|'refunded'|'revoked', expiresAt } */
  function applyProviderState(sub, info) {
    if (info.state === 'active') return activate(sub, info.expiresAt);
    const allowed = ['pending', 'renewal_cancelled', 'grace', 'expired', 'refunded', 'revoked'];
    if (!allowed.includes(info.state)) throw bad('invalid_state', 'Estado de compra desconhecido.');
    db.run('UPDATE subscriptions SET state = ?, current_period_end = COALESCE(?, current_period_end), updated_at = ? WHERE id = ?', info.state, info.expiresAt || null, ctx.now(), sub.id);
  }
  /** Notificações em tempo real da loja: processadas uma única vez por event_id. */
  async function handleWebhook(provider, eventId, purchaseToken) {
    if (!eventId) throw bad('invalid_event', 'Evento inválido.');
    const done = db.run('INSERT OR IGNORE INTO purchase_events(provider, event_id, payload, processed_at) VALUES (?,?,?,?)', provider, eventId, null, ctx.now());
    if (!done.changes) return { duplicate: true };
    const sub = db.get('SELECT * FROM subscriptions WHERE provider_ref = ?', ctx.sha256('gp:' + purchaseToken));
    if (!sub || !ctx.googleVerifier) return { ignored: true };
    const info = await ctx.googleVerifier.verify({ productId: `elo_${sub.plan}_${sub.cycle}`, purchaseToken });
    applyProviderState(sub, info);
    return { ok: true };
  }
  function cancelRenewal(userId) {
    const { sub } = entitlement(userId);
    if (!sub || sub.state !== 'active') throw bad('nothing_to_cancel', 'Não há renovação ativa para cancelar.');
    if (sub.provider === 'google') throw bad('manage_in_store', 'Gerencie sua assinatura pelo Google Play.');
    db.run(`UPDATE subscriptions SET state = 'renewal_cancelled', updated_at = ? WHERE id = ?`, ctx.now(), sub.id);
    return current(userId); // benefícios continuam até o fim do período pago
  }
  /** Simulação de reembolso (dev/admin): revoga na hora. */
  function revoke(userId, state = 'revoked') {
    db.run(`UPDATE subscriptions SET state = ?, updated_at = ? WHERE user_id = ? AND state IN ('active','renewal_cancelled','grace')`, state, ctx.now(), userId);
  }

  // ---- Benefícios ----
  function isDiscreet(userId) {
    const s = db.get('SELECT discreet FROM settings WHERE user_id = ?', userId);
    return !!(s && s.discreet && planOf(userId) === 'premium');
  }
  function setDiscreet(userId, on) {
    requirePlan(userId, 'premium', 'O modo discreto');
    db.run('UPDATE settings SET discreet = ? WHERE user_id = ?', on ? 1 : 0, userId);
    return current(userId);
  }
  function activeBoost(userId) { return db.get('SELECT * FROM boosts WHERE user_id = ? AND ends_at > ? ORDER BY id DESC LIMIT 1', userId, ctx.now()); }
  function startBoost(userId) {
    requirePlan(userId, 'premium', 'O destaque');
    return db.tx(() => {
      const now = ctx.now();
      const last = db.get('SELECT * FROM boosts WHERE user_id = ? AND started_at > ? ORDER BY started_at DESC LIMIT 1', userId, now - config.boost.windowDays * DAY);
      if (last) throw new HttpError(429, 'boost_unavailable', 'Você já usou o destaque desta semana.', { availableAt: last.started_at + config.boost.windowDays * DAY });
      db.run('INSERT INTO boosts(user_id, started_at, ends_at) VALUES (?,?,?)', userId, now, now + config.boost.durationMin * MIN);
      return current(userId);
    });
  }

  /** Rotina: expira assinaturas vencidas e simula renovação das compras simuladas (apenas dev). */
  function sweep() {
    const now = ctx.now();
    for (const s of db.all(`SELECT * FROM subscriptions WHERE state IN ('active','renewal_cancelled','grace') AND current_period_end <= ?`, now)) {
      if (s.state === 'active' && s.provider === 'mock' && !config.prod) { db.run('UPDATE subscriptions SET current_period_end = ?, updated_at = ? WHERE id = ?', s.current_period_end + (s.cycle === 'year' ? 365 : 30) * DAY, now, s.id); continue; }
      if (s.state === 'active' && s.provider === 'google') { db.run(`UPDATE subscriptions SET state = 'grace', updated_at = ? WHERE id = ?`, now, s.id); continue; }
      if (s.state === 'grace' && s.current_period_end + config.graceDays * DAY > now) continue;
      db.run(`UPDATE subscriptions SET state = 'expired', updated_at = ? WHERE id = ?`, now, s.id);
    }
  }

  return { RANK, limits, limitFor, entitlement, planOf, requirePlan, catalog, current, startCheckout, confirmMock, verifyGoogle, handleWebhook, applyProviderState, cancelRenewal, revoke, isDiscreet, setDiscreet, activeBoost, startBoost, sweep };
};
