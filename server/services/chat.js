'use strict';
const { bad, forbidden, notFound, HttpError } = require('../lib/errors');
const { createLimiter } = require('../lib/ratelimit');
const { DAY } = require('../lib/time');

module.exports = (ctx, { profiles }) => {
  const { db, config } = ctx;
  const sendLimiter = createLimiter({ windowMs: 60000, max: 40 });

  /** Só participantes de um match ativo, com conta ativa e sem bloqueio, acessam a conversa. */
  function accessMatch(userId, matchId) {
    const m = db.get('SELECT * FROM matches WHERE id = ?', Number(matchId));
    if (!m || (m.user_a !== userId && m.user_b !== userId)) throw notFound('Conversa não encontrada.');
    const otherId = m.user_a === userId ? m.user_b : m.user_a;
    const me = profiles.getUser(userId), other = profiles.getUser(otherId);
    if (!me || me.status !== 'active') throw forbidden('account_unavailable', 'Sua conta não está disponível para essa ação.');
    if (m.status !== 'active' || !other || other.status !== 'active' || profiles.isBlocked(userId, otherId)) throw new HttpError(403, 'match_ended', 'Esta conversa foi encerrada.');
    return { m, other };
  }

  function lastMessage(matchId) {
    return db.get('SELECT id, sender_id, kind, body, created_at FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 1', matchId);
  }
  function listMatches(userId) {
    const rows = db.all(`SELECT * FROM matches WHERE (user_a = ?1 OR user_b = ?1) AND status = 'active' ORDER BY COALESCE(last_message_at, created_at) DESC`, userId);
    const out = [];
    for (const m of rows) {
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      const other = profiles.getUser(otherId);
      if (!other || other.status !== 'active' || profiles.isBlocked(userId, otherId)) continue;
      const lm = lastMessage(m.id);
      const readRow = db.get('SELECT last_read_id FROM match_reads WHERE match_id = ? AND user_id = ?', m.id, userId);
      const unread = db.get('SELECT COUNT(*) n FROM messages WHERE match_id = ? AND sender_id != ? AND id > ?', m.id, userId, readRow ? readRow.last_read_id : 0).n;
      out.push({ id: m.id, createdAt: m.created_at, user: profiles.publicCard(userId, other), last: lm ? { mine: lm.sender_id === userId, kind: lm.kind, body: lm.kind === 'invite' ? 'Convite para um café' : lm.body.slice(0, 120), at: lm.created_at } : null, unread });
    }
    return out;
  }

  function serialize(userId, msg) {
    const o = { id: msg.id, mine: msg.sender_id === userId, kind: msg.kind, body: msg.body, at: msg.created_at, clientId: msg.sender_id === userId ? msg.client_id : undefined };
    if (msg.invite_id) {
      const iv = db.get('SELECT * FROM invites WHERE id = ?', msg.invite_id);
      if (iv) o.invite = { id: iv.id, place: iv.place, when: iv.scheduled_at, status: iv.status, mine: iv.proposer_id === userId };
    }
    return o;
  }
  function messages(userId, matchId, { after = 0, limit = 100 } = {}) {
    const { m, other } = accessMatch(userId, matchId);
    const rows = db.all('SELECT * FROM messages WHERE match_id = ? AND id > ? ORDER BY id ASC LIMIT ?', m.id, Number(after) || 0, Math.min(Number(limit) || 100, 200));
    return { match: { id: m.id, user: profiles.publicCard(userId, other) }, messages: rows.map((r) => serialize(userId, r)) };
  }
  function markRead(userId, matchId) {
    const { m } = accessMatch(userId, matchId);
    const last = db.get('SELECT MAX(id) id FROM messages WHERE match_id = ?', m.id).id || 0;
    db.run('INSERT INTO match_reads(match_id, user_id, last_read_id) VALUES (?,?,?) ON CONFLICT(match_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)', m.id, userId, last);
  }

  function insertMessage(userId, m, other, { clientId, kind, body, inviteId }) {
    const r = db.run('INSERT OR IGNORE INTO messages(match_id, sender_id, client_id, kind, body, invite_id, created_at) VALUES (?,?,?,?,?,?,?)', m.id, userId, clientId, kind, body, inviteId || null, ctx.now());
    const msg = db.get('SELECT * FROM messages WHERE match_id = ? AND sender_id = ? AND client_id = ?', m.id, userId, clientId);
    if (r.changes) {
      db.run('UPDATE matches SET last_message_at = ? WHERE id = ?', msg.created_at, m.id);
      const s = profiles.getSettings(other.id);
      const me = profiles.getProfile(userId);
      ctx.notify(other.id, 'message', me.display_name, s.notif_preview ? body.slice(0, 80) : 'Nova mensagem', { matchId: m.id });
    }
    return { msg, created: r.changes > 0 };
  }

  /** Envio com confirmação do servidor e idempotência por clientId (nova tentativa não duplica). */
  function send(userId, matchId, { clientId, body }) {
    const { m, other } = accessMatch(userId, matchId);
    if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 64) throw bad('invalid_client_id', 'Identificador da mensagem inválido.');
    const text = String(body ?? '').replace(/\r\n/g, '\n').trim();
    if (!text) throw bad('empty_message', 'Escreva uma mensagem.');
    if (text.length > config.limits.messageMax) throw bad('message_too_long', `A mensagem aceita até ${config.limits.messageMax} caracteres.`);
    const dup = db.get('SELECT id FROM messages WHERE match_id = ? AND sender_id = ? AND client_id = ?', m.id, userId, clientId);
    if (!dup && !sendLimiter.take(String(userId))) throw new HttpError(429, 'slow_down', 'Calma! Você está enviando mensagens rápido demais.');
    return serialize(userId, db.tx(() => insertMessage(userId, m, other, { clientId, kind: 'text', body: text }).msg));
  }

  // ---- "Bora tomar um café?" — proposta privada dentro do match ----
  function createInvite(userId, matchId, { place, when, clientId }) {
    const { m, other } = accessMatch(userId, matchId);
    const p = String(place ?? '').replace(/\s+/g, ' ').trim();
    if (p.length < 3 || p.length > 80) throw bad('invalid_place', 'Informe um local público (3 a 80 caracteres).');
    const at = Number(when);
    if (!Number.isFinite(at) || at < ctx.now() || at > ctx.now() + 60 * DAY) throw bad('invalid_date', 'Escolha uma data futura (até 60 dias).');
    return serialize(userId, db.tx(() => {
      const pending = db.get(`SELECT 1 FROM invites WHERE match_id = ? AND status = 'proposed' AND proposer_id = ?`, m.id, userId);
      if (pending) throw bad('invite_pending', 'Você já tem um convite aguardando resposta.');
      const r = db.run('INSERT INTO invites(match_id, proposer_id, place, scheduled_at, created_at, updated_at) VALUES (?,?,?,?,?,?)', m.id, userId, p, at, ctx.now(), ctx.now());
      return insertMessage(userId, m, other, { clientId: clientId && String(clientId).length >= 8 ? String(clientId) : `invite-${r.lastInsertRowid}`, kind: 'invite', body: p, inviteId: Number(r.lastInsertRowid) }).msg;
    }));
  }
  function answerInvite(userId, inviteId, action) {
    const iv = db.get('SELECT * FROM invites WHERE id = ?', Number(inviteId));
    if (!iv) throw notFound();
    const { m, other } = accessMatch(userId, iv.match_id);
    let status;
    if (action === 'accept' || action === 'decline') {
      if (iv.proposer_id === userId) throw forbidden('not_allowed', 'Quem convidou não pode responder o próprio convite.');
      if (iv.status !== 'proposed') throw bad('invite_closed', 'Este convite já foi respondido.');
      status = action === 'accept' ? 'accepted' : 'declined';
    } else if (action === 'cancel') {
      if (iv.proposer_id !== userId) throw forbidden('not_allowed', 'Só quem convidou pode cancelar.');
      if (!['proposed', 'accepted'].includes(iv.status)) throw bad('invite_closed', 'Este convite já foi encerrado.');
      status = 'cancelled';
    } else throw bad('invalid_action', 'Ação inválida.');
    db.tx(() => {
      db.run('UPDATE invites SET status = ?, updated_at = ? WHERE id = ?', status, ctx.now(), iv.id);
      const label = { accepted: 'aceitou o convite', declined: 'não poderá ir desta vez', cancelled: 'cancelou o convite' }[status];
      const me = profiles.getProfile(userId);
      insertMessage(userId, m, other, { clientId: `invite-${iv.id}-${status}`, kind: 'system', body: `${me.display_name} ${label}.` });
    });
    return { id: iv.id, status };
  }

  /** Desfazer match: encerra a conversa e a possibilidade de novas mensagens, nos dois lados. */
  function unmatch(userId, matchId) {
    const m = db.get('SELECT * FROM matches WHERE id = ?', Number(matchId));
    if (!m || (m.user_a !== userId && m.user_b !== userId)) throw notFound('Conversa não encontrada.');
    if (m.status === 'ended') return { ok: true };
    db.tx(() => {
      db.run(`UPDATE matches SET status = 'ended', ended_at = ?, ended_by = ?, ended_reason = 'unmatch' WHERE id = ?`, ctx.now(), userId, m.id);
      db.run('UPDATE likes SET active = 0 WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', m.user_a, m.user_b, m.user_b, m.user_a);
      db.run(`UPDATE invites SET status = 'cancelled', updated_at = ? WHERE match_id = ? AND status IN ('proposed','accepted')`, ctx.now(), m.id);
    });
    return { ok: true };
  }

  return { accessMatch, listMatches, messages, markRead, send, createInvite, answerInvite, unmatch };
};
