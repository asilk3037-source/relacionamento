'use strict';
const crypto = require('crypto');
const { bad, notFound, HttpError } = require('../lib/errors');
const { createLimiter } = require('../lib/ratelimit');

const CATEGORIES = {
  menor: 1, ameaca: 1, midia_intima: 1, assedio: 2, fraude: 2, discriminacao: 2, perfil_falso: 3, outro: 3,
};

module.exports = (ctx, { profiles }) => {
  const { db } = ctx;
  const reportLimiter = createLimiter({ windowMs: 24 * 3600000, max: 20 });

  /** Bloquear: remove descoberta, caminhos e contato nos dois sentidos, sem avisar a pessoa bloqueada. */
  function block(userId, pid) {
    const t = profiles.getUserByPublic(pid);
    if (!t || t.id === userId) throw notFound('Perfil não encontrado.');
    db.tx(() => {
      db.run('INSERT OR IGNORE INTO blocks(blocker_id, blocked_id, created_at) VALUES (?,?,?)', userId, t.id, ctx.now());
      const lo = Math.min(userId, t.id), hi = Math.max(userId, t.id);
      db.run(`UPDATE matches SET status = 'ended', ended_at = ?, ended_by = ?, ended_reason = 'block' WHERE user_a = ? AND user_b = ? AND status = 'active'`, ctx.now(), userId, lo, hi);
      db.run('UPDATE likes SET active = 0 WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', userId, t.id, t.id, userId);
      db.run('DELETE FROM crossings WHERE user_a = ? AND user_b = ?', lo, hi);
      db.run(`UPDATE invites SET status = 'cancelled', updated_at = ? WHERE status IN ('proposed','accepted') AND match_id IN (SELECT id FROM matches WHERE user_a = ? AND user_b = ?)`, ctx.now(), lo, hi);
    });
    return { ok: true };
  }
  function unblock(userId, pid) {
    const t = profiles.getUserByPublic(pid);
    if (!t) throw notFound('Perfil não encontrado.');
    db.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', userId, t.id);
    return { ok: true };
  }
  function listBlocks(userId) {
    return db.all('SELECT u.public_id id, p.display_name name FROM blocks b JOIN users u ON u.id = b.blocked_id JOIN profiles p ON p.user_id = u.id WHERE b.blocker_id = ? ORDER BY b.created_at DESC', userId);
  }

  function report(userId, { targetId, category, details, matchId, alsoBlock }) {
    if (!reportLimiter.take(String(userId))) throw new HttpError(429, 'too_many_reports', 'Você atingiu o limite de denúncias de hoje.');
    const t = profiles.getUserByPublic(targetId);
    if (!t || t.id === userId) throw notFound('Perfil não encontrado.');
    if (!(category in CATEGORIES)) throw bad('invalid_category', 'Escolha uma categoria de denúncia.');
    const text = String(details ?? '').trim().slice(0, 1000);
    let evidence = [];
    if (matchId != null) {
      const m = db.get('SELECT * FROM matches WHERE id = ?', Number(matchId));
      if (m && [m.user_a, m.user_b].includes(userId) && [m.user_a, m.user_b].includes(t.id)) {
        evidence = db.all('SELECT sender_id, kind, body, created_at FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 20', m.id).reverse()
          .map((x) => ({ from: x.sender_id === userId ? 'denunciante' : 'denunciado', kind: x.kind, body: x.body, at: x.created_at }));
      }
    }
    const protocol = `ELO-${new Date(ctx.now()).toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const severity = CATEGORIES[category];
    const r = db.tx(() => {
      const ins = db.run('INSERT INTO reports(protocol, reporter_id, target_id, category, severity, details, evidence, created_at) VALUES (?,?,?,?,?,?,?,?)', protocol, userId, t.id, category, severity, text, JSON.stringify(evidence), ctx.now());
      // Suspeita de menor: restrição preventiva a partir de duas denúncias de pessoas distintas.
      if (category === 'menor') {
        const n = db.get(`SELECT COUNT(DISTINCT reporter_id) n FROM reports WHERE target_id = ? AND category = 'menor' AND status IN ('open','in_review')`, t.id).n;
        if (n >= 2 && t.status === 'active') {
          db.run("UPDATE users SET status = 'suspended' WHERE id = ?", t.id);
          db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', ctx.now(), t.id);
          db.run(`INSERT INTO sanctions(user_id, kind, reason, report_id, created_at) VALUES (?,?,?,?,?)`, t.id, 'preventive', 'Restrição preventiva: suspeita de menor de idade (aguardando revisão).', Number(ins.lastInsertRowid), ctx.now());
          ctx.audit(null, 'sanction.preventive_auto', 'user', t.id, 'suspeita de menor (2 denúncias)');
        }
      }
      if (alsoBlock) block(userId, targetId);
      return ins;
    });
    return { protocol, reportId: Number(r.lastInsertRowid) };
  }

  /** Recurso de usuário suspenso: registra o pedido para revisão humana. */
  function appeal(userId, text) {
    const t = String(text ?? '').trim().slice(0, 1500);
    if (t.length < 10) throw bad('appeal_too_short', 'Explique com um pouco mais de detalhes.');
    const s = db.get(`SELECT * FROM sanctions WHERE user_id = ? AND lifted_at IS NULL AND kind != 'warning' ORDER BY id DESC LIMIT 1`, userId);
    if (!s) throw notFound('Não há restrição ativa na sua conta.');
    db.run(`UPDATE sanctions SET appeal_text = ?, appeal_at = ?, appeal_status = 'open' WHERE id = ?`, t, ctx.now(), s.id);
    return { ok: true };
  }

  return { CATEGORIES, block, unblock, listBlocks, report, appeal };
};
