'use strict';
const config = require('./config');
const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const { bootstrapAdmin } = require('./bootstrap');

const { app, ctx, services } = createApp();
bootstrapAdmin(ctx, services);
const server = app.listen(config.port, () => {
  console.log(`Elo rodando em http://localhost:${config.port}  (admin: /admin/)`);
  if (!config.prod) console.log('Modo desenvolvimento: fotos aprovadas automaticamente, compra simulada e e-mails em /api/dev/outbox.');
});
startJobs(ctx, services);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => { ctx.db.close(); process.exit(0); }));
