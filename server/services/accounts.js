'use strict';
const crypto = require('crypto');
const { bad, unauthorized, forbidden, conflict, notFound } = require('../lib/errors');
const { ageFrom, DAY, HOUR } = require('../lib/time');
const { createLimiter } = require('../lib/ratelimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384 }, (e, k) => (e ? rej(e) : res(k))));

module.exports = (ctx) => {
  const { db, config } = ctx;
  const loginLimiter = createLimiter({ windowMs: 15 * 60000, max: 8 });
  const forgotLimiter = createLimiter({ windowMs: 60 * 60000, max: 5 });

  async function hashPassword(pw) {
    const salt = crypto.randomBytes(16);
    return `scrypt$${salt.toString('base64')}$${(await scrypt(pw, salt)).toString('base64')}`;
  }
  async function verifyPassword(pw, stored) {
    const [, s, h] = String(stored).split('$');
    if (!s) return false;
    const a = await scrypt(pw, Buffer.from(s, 'base64')); const b = Buffer.from(h, 'base64');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  function checkPassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8) throw bad('weak_password', 'A senha precisa ter pelo menos 8 caracteres.');
    if (pw.length > 128) throw bad('weak_password', 'A senha é longa demais (máximo 128).');
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw bad('weak_password', 'Use letras e números na senha.');
  }
  function parseBirth(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad('invalid_birth', 'Informe sua data de nascimento.');
    const d = new Date(s + 'T00:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw bad('invalid_birth', 'Data de nascimento inválida.');
    return s;
  }
  const emailHash = (e) => ctx.sha256('age:' + e);

  function newSession(userId, device) {
    const token = crypto.randomBytes(32).toString('base64url');
    const u = db.get('SELECT role FROM users WHERE id = ?', userId);
    const ttl = u.role !== 'user' ? config.staffSessionTtlHours * HOUR : config.sessionTtlDays * DAY;
    const now = ctx.now();
    db.run('INSERT INTO sessions(user_id, token_hash, device, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?)', userId, ctx.sha256(token), String(device || '').slice(0, 120), now, now, now + ttl);
    return token;
  }
  function issueEmailToken(userId, kind, ttlMs) {
    const token = crypto.randomBytes(24).toString('base64url');
    db.run('UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL', ctx.now(), userId, kind);
    db.run('INSERT INTO email_tokens(user_id, kind, token_hash, expires_at) VALUES (?,?,?,?)', userId, kind, ctx.sha256(token), ctx.now() + ttlMs);
    return token;
  }

  async function register({ email, password, birthDate, acceptTerms, device }) {
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 160) throw bad('invalid_email', 'Informe um e-mail válido.');
    checkPassword(password);
    parseBirth(birthDate);
    if (acceptTerms !== true) throw bad('terms_required', 'É preciso aceitar os termos e a política de privacidade.');
    const age = ageFrom(birthDate, ctx.now());
    if (age < config.minAge || age > 110) {
      if (age >= 0 && age < config.minAge) db.run('INSERT OR REPLACE INTO age_blocklist(email_hash, created_at) VALUES (?,?)', emailHash(email), ctx.now());
      throw forbidden('underage', 'O Elo é apenas para pessoas com 18 anos ou mais.');
    }
    if (db.get('SELECT 1 FROM age_blocklist WHERE email_hash = ?', emailHash(email))) throw forbidden('underage', 'O Elo é apenas para pessoas com 18 anos ou mais.');
    if (db.get('SELECT 1 FROM users WHERE email = ?', email)) throw conflict('email_taken', 'Não foi possível criar a conta com esses dados. Se você já tem conta, entre ou recupere o acesso.');
    const pwHash = await hashPassword(password);
    const now = ctx.now();
    const needsVerify = config.requireEmailVerification;
    const userId = db.tx(() => {
      const r = db.run('INSERT INTO users(public_id, email, password_hash, birth_date, status, terms_version, terms_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?)',
        ctx.publicId(), email, pwHash, birthDate, needsVerify ? 'pending_verification' : 'active', config.termsVersion, now, now);
      const id = Number(r.lastInsertRowid);
      db.run('INSERT INTO profiles(user_id, updated_at) VALUES (?,?)', id, now);
      db.run('INSERT INTO settings(user_id) VALUES (?)', id);
      return id;
    });
    const token = issueEmailToken(userId, 'verify', 2 * DAY);
    ctx.mail(email, 'Confirme seu e-mail no Elo', `Seu código de confirmação: ${token}`);
    return { userId, sessionToken: newSession(userId, device) };
  }

  async function login({ email, password, device, ip }) {
    email = String(email || '').trim().toLowerCase();
    const key = `${ip || ''}|${email}`;
    if (!loginLimiter.take(key)) throw new (require('../lib/errors').HttpError)(429, 'too_many_attempts', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    const u = db.get('SELECT * FROM users WHERE email = ?', email);
    const ok = u ? await verifyPassword(String(password || ''), u.password_hash) : (await scrypt('x', Buffer.alloc(16)), false);
    if (!ok) throw unauthorized('E-mail ou senha incorretos.');
    if (u.status === 'deleted') throw unauthorized('E-mail ou senha incorretos.');
    loginLimiter.reset(key);
    if (u.status === 'deleting') {
      // Login durante o período de exclusão não reativa a conta; apenas informa.
      throw forbidden('account_deleting', 'Esta conta está em processo de exclusão.');
    }
    return { userId: u.id, sessionToken: newSession(u.id, device) };
  }

  function authenticate(token) {
    if (!token) return null;
    const now = ctx.now();
    const s = db.get('SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?', ctx.sha256(token), now);
    if (!s) return null;
    const u = db.get('SELECT * FROM users WHERE id = ?', s.user_id);
    if (!u || u.status === 'deleted' || u.status === 'deleting') return null;
    if (now - s.last_seen_at > 5 * 60000) db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', now, s.id);
    return { user: u, session: s };
  }
  const logout = (sessionId) => db.run('UPDATE sessions SET revoked_at = ? WHERE id = ?', ctx.now(), sessionId);
  const revokeAll = (userId, exceptId) => db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?', ctx.now(), userId, exceptId || 0);
  const listSessions = (userId, currentId) => db.all('SELECT id, device, created_at, last_seen_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC', userId, ctx.now())
    .map((s) => ({ ...s, current: s.id === currentId }));
  function revokeSession(userId, id) {
    const r = db.run('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL', ctx.now(), id, userId);
    if (!r.changes) throw notFound();
  }

  function verifyEmail(token) {
    const t = db.get('SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ?', ctx.sha256(String(token || '')), 'verify');
    if (!t || t.used_at || t.expires_at < ctx.now()) throw bad('invalid_token', 'Link inválido ou expirado. Peça um novo.');
    db.tx(() => {
      db.run('UPDATE email_tokens SET used_at = ? WHERE id = ?', ctx.now(), t.id);
      db.run('UPDATE users SET email_verified_at = ?, status = CASE WHEN status = ? THEN ? ELSE status END WHERE id = ?', ctx.now(), 'pending_verification', 'active', t.user_id);
    });
  }
  function resendVerification(userId) {
    const u = db.get('SELECT * FROM users WHERE id = ?', userId);
    if (u.email_verified_at) return;
    ctx.mail(u.email, 'Confirme seu e-mail no Elo', `Seu código de confirmação: ${issueEmailToken(u.id, 'verify', 2 * DAY)}`);
  }

  /** Sempre responde igual: não confirma se o e-mail existe. */
  function forgot(email, ip) {
    email = String(email || '').trim().toLowerCase();
    if (!forgotLimiter.take(`${ip || ''}|${email}`)) return;
    const u = db.get("SELECT * FROM users WHERE email = ? AND status NOT IN ('deleted','deleting')", email);
    if (u) ctx.mail(u.email, 'Recuperação de acesso ao Elo', `Seu código para criar uma nova senha: ${issueEmailToken(u.id, 'reset', HOUR)}`);
  }
  async function reset(token, password) {
    checkPassword(password);
    const t = db.get('SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ?', ctx.sha256(String(token || '')), 'reset');
    if (!t || t.used_at || t.expires_at < ctx.now()) throw bad('invalid_token', 'Código inválido ou expirado. Peça um novo.');
    const h = await hashPassword(password);
    db.tx(() => {
      db.run('UPDATE email_tokens SET used_at = ? WHERE id = ?', ctx.now(), t.id);
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', h, t.user_id);
      revokeAll(t.user_id);
    });
  }
  async function changePassword(userId, sessionId, current, next) {
    const u = db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!(await verifyPassword(String(current || ''), u.password_hash))) throw forbidden('wrong_password', 'Senha atual incorreta.');
    checkPassword(next);
    const h = await hashPassword(next);
    db.tx(() => { db.run('UPDATE users SET password_hash = ? WHERE id = ?', h, userId); revokeAll(userId, sessionId); });
  }
  async function reauth(userId, password) {
    const u = db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!(await verifyPassword(String(password || ''), u.password_hash))) throw forbidden('wrong_password', 'Senha incorreta.');
  }

  /** Exclusão: oculta o perfil na hora, revoga sessões e coleta, agenda a limpeza. */
  async function requestDeletion(userId, password) {
    await reauth(userId, password);
    const now = ctx.now();
    db.tx(() => {
      db.run('UPDATE users SET status = ?, deleted_at = ?, purge_at = ? WHERE id = ?', 'deleting', now, now + config.deletePurgeDays * DAY, userId);
      db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', now, userId);
      db.run('DELETE FROM location_signals WHERE user_id = ?', userId);
      db.run('DELETE FROM crossings WHERE user_a = ? OR user_b = ?', userId, userId);
      db.run("UPDATE matches SET status = 'ended', ended_at = ?, ended_by = ?, ended_reason = 'account_deleted' WHERE (user_a = ? OR user_b = ?) AND status = 'active'", now, userId, userId, userId);
      db.run('UPDATE subscriptions SET updated_at = ? WHERE user_id = ?', now, userId);
    });
    ctx.audit(userId, 'account.deletion_requested', 'user', userId);
    return { purgeAt: now + config.deletePurgeDays * DAY };
  }

  return { register, login, authenticate, logout, revokeAll, listSessions, revokeSession, verifyEmail, resendVerification, forgot, reset, changePassword, reauth, requestDeletion, hashPassword, verifyPassword, parseBirth, checkPassword };
};
