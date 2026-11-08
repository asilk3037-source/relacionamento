'use strict';
const crypto = require('crypto');
const config = require('./config');
const { openDb } = require('./db');

/** Contexto compartilhado: banco, relógio injetável (testes), parâmetros administráveis e utilidades. */
function createContext(overrides = {}) {
  const db = overrides.db || openDb(overrides.dbPath || config.dbPath);
  const clock = { now: () => Date.now() };
  const ctx = {
    db, config, clock,
    now: () => clock.now(),
    publicId: () => crypto.randomBytes(9).toString('base64url'),
    param(key, fallback) {
      const r = db.get('SELECT value FROM parameters WHERE key = ?', key);
      if (!r) return fallback;
      try { return JSON.parse(r.value); } catch { return fallback; }
    },
    audit(actorId, action, targetType, targetId, justification, meta) {
      db.run('INSERT INTO audit_log(actor_id, action, target_type, target_id, justification, meta, created_at) VALUES (?,?,?,?,?,?,?)',
        actorId, action, targetType, targetId == null ? null : String(targetId), justification || null, meta ? JSON.stringify(meta) : null, ctx.now());
    },
    mail(to, subject, body) {
      db.run('INSERT INTO outbox(to_email, subject, body, created_at) VALUES (?,?,?,?)', to, subject, body, ctx.now());
      if (!config.prod && !overrides.quiet) console.log(`[e-mail simulado] para ${to}: ${subject}`);
    },
    notify(userId, kind, title, body, data) {
      const s = db.get('SELECT * FROM settings WHERE user_id = ?', userId);
      const map = { match: 'notif_matches', message: 'notif_messages', like: 'notif_likes', ops: 'notif_ops' };
      if (s && map[kind] && !s[map[kind]]) return;
      db.run('INSERT INTO notifications(user_id, kind, title, body, data, created_at) VALUES (?,?,?,?,?,?)', userId, kind, title, body, data ? JSON.stringify(data) : null, ctx.now());
    },
    sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  };
  return ctx;
}
module.exports = { createContext };
