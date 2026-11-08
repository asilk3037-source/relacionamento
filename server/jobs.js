'use strict';
/** Rotinas periódicas: cruzamentos, retenção, expiração de assinaturas e limpeza de contas excluídas. */
function runJobs(ctx, s) {
  const out = {};
  try { out.crossings = s.paths.process(); } catch (e) { out.crossingsError = e.message; }
  s.paths.sweep();
  s.plans.sweep();
  out.purged = s.privacy.purgeDeleted();
  const now = ctx.now();
  ctx.db.run('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)', now, now - 30 * 86400000);
  ctx.db.run('DELETE FROM email_tokens WHERE expires_at < ?', now - 86400000);
  ctx.db.run('DELETE FROM notifications WHERE created_at < ?', now - 90 * 86400000);
  return out;
}
function startJobs(ctx, s, everyMs = 5 * 60000) {
  const t = setInterval(() => { try { runJobs(ctx, s); } catch (e) { console.error('job falhou', e); } }, everyMs);
  t.unref();
  return () => clearInterval(t);
}
module.exports = { runJobs, startJobs };
