'use strict';
const config = require('./config');

/** Cria (ou promove) uma conta interna. Usado pelo CLI create-admin e pelo bootstrap de produção. */
async function ensureStaff(ctx, services, email, password, role = 'admin') {
  const { db } = ctx; const e = String(email).trim().toLowerCase(); const now = ctx.now();
  services.accounts.checkPassword(password);
  const ex = db.get('SELECT id FROM users WHERE email = ?', e);
  if (ex) { db.run('UPDATE users SET role = ?, status = ? WHERE id = ?', role, 'active', ex.id); return { created: false, email: e }; }
  const r = db.run("INSERT INTO users(public_id, email, password_hash, birth_date, status, role, email_verified_at, terms_version, terms_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ctx.publicId(), e, await services.accounts.hashPassword(password), '1985-01-01', 'active', role, now, config.termsVersion, now, now);
  const id = Number(r.lastInsertRowid);
  db.run('INSERT INTO profiles(user_id, display_name, updated_at) VALUES (?,?,?)', id, role, now);
  db.run('INSERT INTO settings(user_id, onboarding_done) VALUES (?,1)', id);
  ctx.audit(null, 'staff.bootstrap', 'user', e);
  return { created: true, email: e };
}
/** Se ADMIN_EMAIL e ADMIN_PASSWORD estiverem definidos e a conta ainda não existir, cria o administrador. */
async function bootstrapAdmin(ctx, services) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  if (ctx.db.get('SELECT 1 FROM users WHERE email = ?', ADMIN_EMAIL.trim().toLowerCase())) return;
  try { const r = await ensureStaff(ctx, services, ADMIN_EMAIL, ADMIN_PASSWORD, 'admin'); console.log(`Administrador criado: ${r.email} (remova ADMIN_PASSWORD dos secrets depois do primeiro acesso).`); }
  catch (e) { console.error('Não foi possível criar o administrador inicial:', e.message); }
}
module.exports = { ensureStaff, bootstrapAdmin };
