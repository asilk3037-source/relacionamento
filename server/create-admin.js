'use strict';
// Cria (ou promove) uma conta interna. Uso: npm run create-admin -- email@dominio.com 'SenhaForte123' [admin|moderator|support]
const config = require('./config');
const { createContext } = require('./ctx');
const buildServices = require('./services');
const [email, password, role = 'admin'] = process.argv.slice(2);
if (!email || !password || !['admin', 'moderator', 'support'].includes(role)) { console.error("Uso: npm run create-admin -- email 'senha' [admin|moderator|support]"); process.exit(1); }
(async () => {
  const ctx = createContext(); const s = buildServices(ctx); const { db } = ctx;
  s.accounts.checkPassword(password);
  const e = email.trim().toLowerCase(); const now = ctx.now();
  const ex = db.get('SELECT id FROM users WHERE email = ?', e);
  if (ex) { db.run('UPDATE users SET role = ?, status = ? WHERE id = ?', role, 'active', ex.id); console.log(`Conta existente promovida a ${role}.`); }
  else {
    const r = db.run("INSERT INTO users(public_id, email, password_hash, birth_date, status, role, email_verified_at, terms_version, terms_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ctx.publicId(), e, await s.accounts.hashPassword(password), '1985-01-01', 'active', role, now, config.termsVersion, now, now);
    const id = Number(r.lastInsertRowid); db.run('INSERT INTO profiles(user_id, display_name, updated_at) VALUES (?,?,?)', id, role, now); db.run('INSERT INTO settings(user_id, onboarding_done) VALUES (?,1)', id);
    console.log(`Conta ${role} criada: ${e}. Acesse /admin/`);
  }
  ctx.audit(null, 'staff.create_admin_cli', 'user', e); db.close();
})();
