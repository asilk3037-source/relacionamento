'use strict';
const fs = require('fs');
const path = require('path');
const { bad, forbidden, notFound } = require('../lib/errors');
const { DAY } = require('../lib/time');

const ROLES = ['user', 'support', 'moderator', 'admin'];
// Parâmetros que o admin pode ajustar (com justificativa e auditoria).
const PARAMS = { dailyLikes: 'objeto {free, plus, premium}' };

module.exports = (ctx, { profiles, plans, accounts }) => {
  const { db, config } = ctx;

  const need = (actor, ...roles) => { if (!roles.includes(actor.role)) throw forbidden('staff_only', 'Seu perfil interno não permite esta ação.'); };
  const just = (j) => { const t = String(j ?? '').trim(); if (t.length < 8) throw bad('justification_required', 'Informe uma justificativa (mínimo 8 caracteres).'); return t; };
  /** Ações sensíveis exigem justificativa e nova confirmação de senha do operador. */
  async function sensitive(actor, body) { const j = just(body.justification); await accounts.reauth(actor.id, body.password); return j; }

  // Suporte vê situação mínima da conta; nunca conversas ou localização.
  function accountView(u, detail) {
    const base = { id: u.id, publicId: u.public_id, email: u.email, status: u.status, role: u.role, createdAt: u.created_at, plan: plans.planOf(u.id), isDemo: !!u.is_demo };
    if (!detail) return base;
    const p = profiles.getProfile(u.id);
    return {
      ...base, name: p.display_name, emailVerified: !!u.email_verified_at,
      photos: db.all('SELECT public_id id, status FROM photos WHERE user_id = ?', u.id),
      reports: db.get('SELECT COUNT(*) n FROM reports WHERE target_id = ?', u.id).n,
      sanctions: db.all('SELECT id, kind, reason, created_at, lifted_at, appeal_status FROM sanctions WHERE user_id = ? ORDER BY id DESC', u.id),
    };
  }
  function searchUsers(actor, q) {
    need(actor, 'support', 'moderator', 'admin');
    const s = `%${String(q || '').trim().toLowerCase()}%`;
    ctx.audit(actor.id, 'admin.search_users', 'query', String(q || '').slice(0, 40));
    return db.all(`SELECT u.* FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE lower(u.email) LIKE ? OR lower(p.display_name) LIKE ? OR u.public_id = ? ORDER BY u.id DESC LIMIT 30`, s, s, String(q || '')).map((u) => accountView(u, false));
  }
  function getUser(actor, id) {
    need(actor, 'support', 'moderator', 'admin');
    const u = profiles.getUser(Number(id));
    if (!u) throw notFound();
    ctx.audit(actor.id, 'admin.view_user', 'user', u.id);
    return accountView(u, true);
  }

  // ---- Fotos ----
  function pendingPhotos(actor) {
    need(actor, 'moderator', 'admin');
    return db.all(`SELECT ph.public_id id, ph.user_id, ph.created_at, p.display_name name FROM photos ph JOIN profiles p ON p.user_id = ph.user_id JOIN users u ON u.id = ph.user_id WHERE ph.status = 'pending' AND u.status = 'active' ORDER BY ph.created_at LIMIT 50`)
      .map((r) => ({ ...r, url: profiles.mediaUrl(r.id, actor.id) }));
  }
  function reviewPhoto(actor, pid, approve, reason) {
    need(actor, 'moderator', 'admin');
    const ph = db.get('SELECT * FROM photos WHERE public_id = ?', pid);
    if (!ph) throw notFound();
    if (!approve && String(reason ?? '').trim().length < 3) throw bad('reason_required', 'Informe o motivo da recusa.');
    db.run('UPDATE photos SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?', approve ? 'approved' : 'rejected', approve ? null : String(reason).slice(0, 200), actor.id, ctx.now(), ph.id);
    ctx.audit(actor.id, approve ? 'photo.approve' : 'photo.reject', 'photo', pid, reason);
    ctx.notify(ph.user_id, 'ops', approve ? 'Foto aprovada' : 'Foto não aprovada', approve ? 'Sua foto já pode aparecer no seu perfil.' : 'Uma de suas fotos não segue as regras da comunidade. Envie outra.', null);
    return { ok: true };
  }

  // ---- Denúncias e sanções ----
  function listReports(actor, status = 'open') {
    need(actor, 'moderator', 'admin');
    const st = ['open', 'in_review', 'resolved', 'dismissed'].includes(status) ? status : 'open';
    return db.all(`SELECT r.id, r.protocol, r.category, r.severity, r.status, r.details, r.created_at, r.target_id, tp.display_name target_name, r.assigned_to FROM reports r LEFT JOIN profiles tp ON tp.user_id = r.target_id WHERE r.status = ? ORDER BY r.severity, r.created_at LIMIT 100`, st);
  }
  function getReport(actor, id) {
    need(actor, 'moderator', 'admin');
    const r = db.get('SELECT * FROM reports WHERE id = ?', Number(id));
    if (!r) throw notFound();
    ctx.audit(actor.id, 'report.view', 'report', r.id); // leitura de evidências fica registrada
    return { ...r, evidence: profiles.json(r.evidence, []), reporter_id: undefined };
  }
  function assignReport(actor, id) {
    need(actor, 'moderator', 'admin');
    db.run(`UPDATE reports SET status = 'in_review', assigned_to = ? WHERE id = ? AND status = 'open'`, actor.id, Number(id));
    ctx.audit(actor.id, 'report.assign', 'report', id);
    return { ok: true };
  }
  function suspend(userId, kind, reason, byId, reportId) {
    db.tx(() => {
      db.run('UPDATE users SET status = ? WHERE id = ? AND status IN (?, ?)', 'suspended', userId, 'active', 'pending_verification');
      db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', ctx.now(), userId);
      db.run('INSERT INTO sanctions(user_id, kind, reason, report_id, by_user, created_at) VALUES (?,?,?,?,?,?)', userId, kind, reason, reportId || null, byId, ctx.now());
    });
  }
  async function resolveReport(actor, id, body) {
    need(actor, 'moderator', 'admin');
    const r = db.get('SELECT * FROM reports WHERE id = ?', Number(id));
    if (!r) throw notFound();
    const action = body.action;
    if (!['dismiss', 'warn', 'suspend', 'ban'].includes(action)) throw bad('invalid_action', 'Ação inválida.');
    const j = await sensitive(actor, body);
    db.tx(() => {
      if (action === 'warn') db.run('INSERT INTO sanctions(user_id, kind, reason, report_id, by_user, created_at) VALUES (?,?,?,?,?,?)', r.target_id, 'warning', j, r.id, actor.id, ctx.now());
      if (action === 'suspend') suspend(r.target_id, 'suspension', j, actor.id, r.id);
      if (action === 'ban') suspend(r.target_id, 'ban', j, actor.id, r.id);
      db.run('UPDATE reports SET status = ?, decision = ?, resolved_at = ?, assigned_to = ? WHERE id = ?', action === 'dismiss' ? 'dismissed' : 'resolved', `${action}: ${j}`, ctx.now(), actor.id, r.id);
    });
    ctx.audit(actor.id, `report.${action}`, 'report', r.id, j);
    return { ok: true };
  }
  async function setUserStatus(actor, id, body) {
    need(actor, 'moderator', 'admin');
    const u = profiles.getUser(Number(id));
    if (!u) throw notFound();
    if (u.role !== 'user' && actor.role !== 'admin') throw forbidden('staff_protected', 'Somente administradores alteram contas internas.');
    const j = await sensitive(actor, body);
    if (body.action === 'suspend') suspend(u.id, 'suspension', j, actor.id);
    else if (body.action === 'restore') {
      if (u.status !== 'suspended') throw bad('not_suspended', 'A conta não está suspensa.');
      db.run("UPDATE users SET status = 'active' WHERE id = ?", u.id);
      db.run('UPDATE sanctions SET lifted_at = ? WHERE user_id = ? AND lifted_at IS NULL', ctx.now(), u.id);
    } else throw bad('invalid_action', 'Ação inválida.');
    ctx.audit(actor.id, `user.${body.action}`, 'user', u.id, j);
    return { ok: true };
  }
  function listAppeals(actor) {
    need(actor, 'moderator', 'admin');
    return db.all(`SELECT s.id, s.user_id, s.kind, s.reason, s.appeal_text, s.appeal_at FROM sanctions s WHERE s.appeal_status = 'open' ORDER BY s.appeal_at LIMIT 100`);
  }
  async function decideAppeal(actor, id, body) {
    need(actor, 'moderator', 'admin');
    const s = db.get(`SELECT * FROM sanctions WHERE id = ? AND appeal_status = 'open'`, Number(id));
    if (!s) throw notFound();
    const j = await sensitive(actor, body);
    const grant = body.decision === 'grant';
    db.tx(() => {
      db.run('UPDATE sanctions SET appeal_status = ?, appeal_decision = ?, appeal_by = ? WHERE id = ?', grant ? 'granted' : 'denied', j, actor.id, s.id);
      if (grant) { db.run('UPDATE sanctions SET lifted_at = ? WHERE id = ?', ctx.now(), s.id); db.run("UPDATE users SET status = 'active' WHERE id = ? AND status = 'suspended'", s.user_id); }
    });
    ctx.audit(actor.id, grant ? 'appeal.grant' : 'appeal.deny', 'sanction', s.id, j);
    return { ok: true };
  }

  // ---- Conta, nascimento, papéis, parâmetros ----
  async function changeBirthDate(actor, id, body) {
    need(actor, 'admin');
    const u = profiles.getUser(Number(id));
    if (!u) throw notFound();
    const j = await sensitive(actor, body);
    const nd = accounts.parseBirth(body.birthDate);
    db.run('UPDATE users SET birth_date = ? WHERE id = ?', nd, u.id);
    ctx.audit(actor.id, 'user.birthdate_change', 'user', u.id, j);
    return { ok: true };
  }
  async function setRole(actor, id, body) {
    need(actor, 'admin');
    if (!ROLES.includes(body.role)) throw bad('invalid_role', 'Papel inválido.');
    const u = profiles.getUser(Number(id));
    if (!u) throw notFound();
    if (u.id === actor.id) throw forbidden('self_role', 'Você não pode alterar o próprio papel.');
    const j = await sensitive(actor, body);
    db.run('UPDATE users SET role = ? WHERE id = ?', body.role, u.id);
    db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', ctx.now(), u.id);
    ctx.audit(actor.id, 'user.role_change', 'user', u.id, j, { role: body.role });
    return { ok: true };
  }
  function getParams(actor) {
    need(actor, 'admin');
    return { dailyLikes: plans.limits(), definitions: PARAMS };
  }
  async function setParam(actor, key, body) {
    need(actor, 'admin');
    if (key !== 'dailyLikes') throw bad('unknown_param', 'Parâmetro desconhecido.');
    const v = body.value || {};
    for (const k of ['free', 'plus', 'premium']) if (!Number.isInteger(v[k]) || v[k] < 0 || v[k] > 1000) throw bad('invalid_value', 'Informe inteiros entre 0 e 1000 para free, plus e premium.');
    const j = await sensitive(actor, body);
    db.run('INSERT INTO parameters(key, value, updated_by, updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at', key, JSON.stringify({ free: v.free, plus: v.plus, premium: v.premium }), actor.id, ctx.now());
    ctx.audit(actor.id, 'param.set', 'parameter', key, j, v);
    return getParams(actor);
  }
  function listDeletions(actor) {
    need(actor, 'support', 'admin');
    return db.all(`SELECT id, public_id, deleted_at, purge_at, status FROM users WHERE status = 'deleting' ORDER BY purge_at LIMIT 100`);
  }
  function audit(actor) {
    need(actor, 'admin');
    return db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200');
  }
  /** Métricas agregadas; sem texto de conversa, localização ou preferências sensíveis. */
  function metrics(actor) {
    need(actor, 'support', 'moderator', 'admin');
    const n = (sql, ...p) => db.get(sql, ...p).n;
    const now = ctx.now();
    return {
      accounts: n("SELECT COUNT(*) n FROM users WHERE role = 'user' AND status != 'deleted'"),
      active: n("SELECT COUNT(*) n FROM users WHERE status = 'active' AND role = 'user'"),
      approvedProfiles: n("SELECT COUNT(DISTINCT user_id) n FROM photos WHERE status = 'approved'"),
      matches: n('SELECT COUNT(*) n FROM matches'),
      matchesWithMessage: n('SELECT COUNT(*) n FROM matches WHERE last_message_at IS NOT NULL'),
      openReports: n("SELECT COUNT(*) n FROM reports WHERE status IN ('open','in_review')"),
      pendingPhotos: n("SELECT COUNT(*) n FROM photos WHERE status = 'pending'"),
      paidSubscriptions: n("SELECT COUNT(*) n FROM subscriptions WHERE state IN ('active','renewal_cancelled','grace') AND current_period_end > ?", now),
      newLast7d: n("SELECT COUNT(*) n FROM users WHERE created_at > ? AND role = 'user'", now - 7 * DAY),
    };
  }
  return { searchUsers, getUser, pendingPhotos, reviewPhoto, listReports, getReport, assignReport, resolveReport, setUserStatus, listAppeals, decideAppeal, changeBirthDate, setRole, getParams, setParam, listDeletions, audit, metrics, suspend };
};
