'use strict';
// Cria (ou promove) uma conta interna. Uso: npm run create-admin -- email@dominio.com 'SenhaForte123' [admin|moderator|support]
const { createContext } = require('./ctx');
const buildServices = require('./services');
const { ensureStaff } = require('./bootstrap');
const [email, password, role = 'admin'] = process.argv.slice(2);
if (!email || !password || !['admin', 'moderator', 'support'].includes(role)) { console.error("Uso: npm run create-admin -- email 'senha' [admin|moderator|support]"); process.exit(1); }
(async () => {
  const ctx = createContext(); const s = buildServices(ctx);
  const r = await ensureStaff(ctx, s, email, password, role);
  console.log(r.created ? `Conta ${role} criada: ${r.email}. Acesse /admin/` : `Conta existente promovida a ${role}.`);
  ctx.db.close();
})();
