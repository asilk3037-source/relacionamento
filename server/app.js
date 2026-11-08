'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createContext } = require('./ctx');
const buildServices = require('./services');
const { HttpError, unauthorized, forbidden, bad } = require('./lib/errors');
const { DAY } = require('./lib/time');

function createApp(options = {}) {
  const ctx = options.ctx || createContext(options);
  if (!config.mediaSecret) throw new Error('MEDIA_SECRET é obrigatório em produção.');
  const s = buildServices(ctx);
  ctx.services = s;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.prod ? 1 : false);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
    const o = req.get('origin');
    if (o && origins.includes(o)) { res.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', Vary: 'Origin' }); if (req.method === 'OPTIONS') return res.sendStatus(204); }
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '100kb' }));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const r = express.Router();

  // ---- Autenticação ----
  const authn = (req, res, next) => {
    const h = req.get('authorization') || '';
    const a = s.accounts.authenticate(h.startsWith('Bearer ') ? h.slice(7) : null);
    if (!a) return next(unauthorized());
    req.user = a.user; req.session = a.session; next();
  };
  const active = (req, res, next) => {
    if (req.user.status === 'active') return next();
    const code = req.user.status === 'pending_verification' ? 'email_unverified' : 'account_suspended';
    next(forbidden(code, code === 'email_unverified' ? 'Confirme seu e-mail para continuar.' : 'Sua conta está restrita. Você pode enviar um recurso.'));
  };
  const staff = (req, res, next) => (req.user.role === 'user' ? next(forbidden('staff_only', 'Acesso restrito à equipe.')) : next());

  const meView = (u) => {
    const p = s.profiles.getProfile(u.id), st = s.profiles.getSettings(u.id);
    const plan = s.plans.current(u.id);
    const card = s.profiles.publicCard(u.id, u, { full: true });
    return {
      user: { id: u.public_id, email: u.email, status: u.status, role: u.role, age: card.age, emailVerified: !!u.email_verified_at, createdAt: u.created_at, isDemo: !!u.is_demo },
      profile: { ...card, gender: p.gender, smoking: p.smoking, children: p.children, drinking: p.drinking, pets: p.pets, heightCm: p.height_cm, work: p.work, education: p.education, city: p.city, locationSource: p.location_source, complete: s.profiles.isComplete(u.id), interestsList: card.interests },
      settings: {
        theme: st.theme, pauseDiscovery: !!st.pause_discovery, pausePaths: !!st.pause_paths, showGender: !!st.show_gender, showHabits: !!st.show_habits,
        notifMatches: !!st.notif_matches, notifMessages: !!st.notif_messages, notifLikes: !!st.notif_likes, notifOps: !!st.notif_ops, notifPreview: !!st.notif_preview,
        onboardingDone: !!st.onboarding_done,
        prefs: { ageMin: st.pref_age_min, ageMax: st.pref_age_max, distanceKm: st.pref_distance_km, genders: s.profiles.json(st.pref_genders, []), intents: s.profiles.json(st.pref_intents, []) },
      },
      plan, quota: u.status === 'active' ? s.discovery.quota(u.id) : null,
      paths: s.paths.status(u.id),
      termsVersion: config.termsVersion,
    };
  };
  const ip = (req) => req.ip;

  r.post('/auth/register', wrap(async (req, res) => {
    const out = await s.accounts.register({ ...req.body, device: req.get('user-agent') });
    res.status(201).json({ token: out.sessionToken, ...meView(s.profiles.getUser(out.userId)) });
  }));
  r.post('/auth/login', wrap(async (req, res) => {
    const out = await s.accounts.login({ ...req.body, device: req.get('user-agent'), ip: ip(req) });
    res.json({ token: out.sessionToken, ...meView(s.profiles.getUser(out.userId)) });
  }));
  r.post('/auth/logout', authn, (req, res) => { s.accounts.logout(req.session.id); res.json({ ok: true }); });
  r.post('/auth/verify', wrap((req, res) => { s.accounts.verifyEmail(req.body.token); res.json({ ok: true }); }));
  r.post('/auth/resend-verification', authn, (req, res) => { s.accounts.resendVerification(req.user.id); res.json({ ok: true }); });
  r.post('/auth/forgot', (req, res) => { s.accounts.forgot(req.body.email, ip(req)); res.json({ ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' }); });
  r.post('/auth/reset', wrap(async (req, res) => { await s.accounts.reset(req.body.token, req.body.password); res.json({ ok: true }); }));
  r.post('/auth/change-password', authn, wrap(async (req, res) => { await s.accounts.changePassword(req.user.id, req.session.id, req.body.current, req.body.next); res.json({ ok: true }); }));
  r.get('/auth/sessions', authn, (req, res) => res.json({ sessions: s.accounts.listSessions(req.user.id, req.session.id) }));
  r.delete('/auth/sessions/:id', authn, (req, res) => { s.accounts.revokeSession(req.user.id, Number(req.params.id)); res.json({ ok: true }); });
  r.post('/auth/sessions/revoke-others', authn, (req, res) => { s.accounts.revokeAll(req.user.id, req.session.id); res.json({ ok: true }); });

  // ---- Conta e perfil ----
  r.get('/me', authn, (req, res) => res.json(meView(req.user)));
  r.patch('/me/profile', authn, (req, res) => { s.profiles.updateProfile(req.user.id, req.body); res.json(meView(s.profiles.getUser(req.user.id))); });
  r.put('/me/settings', authn, (req, res) => { s.profiles.updateSettings(req.user.id, req.body); res.json(meView(s.profiles.getUser(req.user.id))); });
  r.put('/me/location', authn, active, (req, res) => res.json(s.profiles.setLocation(req.user.id, req.body)));
  r.get('/cities', (req, res) => res.json({ cities: config.cities.map(({ id, name }) => ({ id, name })) }));
  r.post('/me/export', authn, wrap(async (req, res) => { await s.accounts.reauth(req.user.id, req.body.password); res.json(s.privacy.exportData(req.user.id)); }));
  r.post('/me/delete', authn, wrap(async (req, res) => res.json(await s.accounts.requestDeletion(req.user.id, req.body.password))));
  r.get('/me/popularity', authn, active, (req, res) => res.json(s.popularity.summary(req.user.id)));
  r.post('/me/appeal', authn, (req, res) => res.json(s.safety.appeal(req.user.id, req.body.text)));

  r.post('/me/photos', authn, express.raw({ type: ['image/*', 'application/octet-stream'], limit: config.limits.photoMaxBytes + 1024 }), (req, res) => {
    res.status(201).json(s.profiles.addPhoto(req.user.id, Buffer.isBuffer(req.body) ? req.body : null));
  });
  r.delete('/me/photos/:id', authn, (req, res) => { s.profiles.removePhoto(req.user.id, req.params.id); res.json({ ok: true }); });
  r.put('/me/photos/order', authn, (req, res) => { s.profiles.orderPhotos(req.user.id, req.body.ids); res.json({ ok: true }); });

  // ---- Descoberta, curtidas ----
  r.get('/discover', authn, active, (req, res) => res.json(s.discovery.discover(req.user.id, { limit: req.query.limit })));
  r.post('/discover/:id/like', authn, active, (req, res) => res.json(s.discovery.like(req.user.id, req.params.id)));
  r.post('/discover/:id/pass', authn, active, (req, res) => res.json(s.discovery.pass(req.user.id, req.params.id)));
  r.post('/discover/undo', authn, active, (req, res) => res.json(s.discovery.undoPass(req.user.id)));
  r.get('/likes', authn, active, (req, res) => res.json(s.discovery.likesReceived(req.user.id)));
  r.get('/quota', authn, active, (req, res) => res.json(s.discovery.quota(req.user.id)));
  r.get('/profiles/:id', authn, active, (req, res) => res.json(s.discovery.viewProfile(req.user.id, req.params.id)));

  // ---- Matches e conversas ----
  r.get('/matches', authn, active, (req, res) => res.json({ matches: s.chat.listMatches(req.user.id) }));
  r.get('/matches/:id/messages', authn, active, (req, res) => res.json(s.chat.messages(req.user.id, req.params.id, req.query)));
  r.post('/matches/:id/messages', authn, active, (req, res) => res.status(201).json(s.chat.send(req.user.id, req.params.id, req.body)));
  r.post('/matches/:id/read', authn, active, (req, res) => { s.chat.markRead(req.user.id, req.params.id); res.json({ ok: true }); });
  r.delete('/matches/:id', authn, active, (req, res) => res.json(s.chat.unmatch(req.user.id, req.params.id)));
  r.post('/matches/:id/invites', authn, active, (req, res) => res.status(201).json(s.chat.createInvite(req.user.id, req.params.id, req.body)));
  r.post('/invites/:id/:action', authn, active, (req, res) => res.json(s.chat.answerInvite(req.user.id, req.params.id, req.params.action)));

  // ---- Segurança ----
  r.get('/blocks', authn, (req, res) => res.json({ blocks: s.safety.listBlocks(req.user.id) }));
  r.post('/blocks/:id', authn, (req, res) => res.json(s.safety.block(req.user.id, req.params.id)));
  r.delete('/blocks/:id', authn, (req, res) => res.json(s.safety.unblock(req.user.id, req.params.id)));
  r.post('/reports', authn, (req, res) => res.status(201).json(s.safety.report(req.user.id, req.body)));

  // ---- Caminhos ----
  r.get('/paths', authn, active, (req, res) => res.json(s.paths.list(req.user.id)));
  r.post('/paths/consent', authn, active, (req, res) => res.json(s.paths.giveConsent(req.user.id)));
  r.delete('/paths/consent', authn, (req, res) => res.json(s.paths.revoke(req.user.id)));
  r.put('/paths/pause', authn, active, (req, res) => res.json(s.paths.setPaused(req.user.id, !!req.body.paused)));
  r.post('/paths/signal', authn, active, (req, res) => res.json(s.paths.submitSignal(req.user.id, req.body)));

  // ---- Planos ----
  r.get('/plans', authn, (req, res) => res.json({ catalog: s.plans.catalog(), current: s.plans.current(req.user.id), mockBilling: !config.prod }));
  r.post('/plans/checkout', authn, active, (req, res) => res.json(s.plans.startCheckout(req.user.id, req.body.plan, req.body.cycle)));
  r.post('/plans/mock/confirm', authn, active, (req, res) => res.json(s.plans.confirmMock(req.user.id, Number(req.body.subscriptionId))));
  r.post('/plans/google/verify', authn, active, wrap(async (req, res) => res.json(await s.plans.verifyGoogle(req.user.id, req.body))));
  r.post('/plans/cancel', authn, active, (req, res) => res.json(s.plans.cancelRenewal(req.user.id)));
  r.post('/plans/boost', authn, active, (req, res) => res.json(s.plans.startBoost(req.user.id)));
  r.put('/plans/discreet', authn, active, (req, res) => res.json(s.plans.setDiscreet(req.user.id, !!req.body.on)));
  r.post('/webhooks/google-play', wrap(async (req, res) => {
    const secret = config.google.webhookSecret;
    if (!secret || req.get('x-webhook-secret') !== secret) throw forbidden('bad_webhook', 'Não autorizado.');
    res.json(await s.plans.handleWebhook('google', req.body.eventId, req.body.purchaseToken));
  }));

  // ---- Notificações ----
  r.get('/notifications', authn, (req, res) => {
    const rows = ctx.db.all('SELECT id, kind, title, body, data, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', req.user.id);
    res.json({ unread: rows.filter((n) => !n.read_at).length, items: rows.map((n) => ({ ...n, data: n.data ? JSON.parse(n.data) : null })) });
  });
  r.post('/notifications/read', authn, (req, res) => { ctx.db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', ctx.now(), req.user.id); res.json({ ok: true }); });

  // ---- Administração ----
  const A = express.Router();
  A.use(authn, staff);
  A.get('/me', (req, res) => res.json({ id: req.user.public_id, email: req.user.email, role: req.user.role }));
  A.get('/metrics', (req, res) => res.json(s.admin.metrics(req.user)));
  A.get('/users', (req, res) => res.json({ users: s.admin.searchUsers(req.user, req.query.q) }));
  A.get('/users/:id', (req, res) => res.json(s.admin.getUser(req.user, req.params.id)));
  A.post('/users/:id/status', wrap(async (req, res) => res.json(await s.admin.setUserStatus(req.user, req.params.id, req.body))));
  A.post('/users/:id/birthdate', wrap(async (req, res) => res.json(await s.admin.changeBirthDate(req.user, req.params.id, req.body))));
  A.post('/users/:id/role', wrap(async (req, res) => res.json(await s.admin.setRole(req.user, req.params.id, req.body))));
  A.get('/photos/pending', (req, res) => res.json({ photos: s.admin.pendingPhotos(req.user) }));
  A.post('/photos/:id/approve', (req, res) => res.json(s.admin.reviewPhoto(req.user, req.params.id, true)));
  A.post('/photos/:id/reject', (req, res) => res.json(s.admin.reviewPhoto(req.user, req.params.id, false, req.body.reason)));
  A.get('/reports', (req, res) => res.json({ reports: s.admin.listReports(req.user, req.query.status) }));
  A.get('/reports/:id', (req, res) => res.json(s.admin.getReport(req.user, req.params.id)));
  A.post('/reports/:id/assign', (req, res) => res.json(s.admin.assignReport(req.user, req.params.id)));
  A.post('/reports/:id/resolve', wrap(async (req, res) => res.json(await s.admin.resolveReport(req.user, req.params.id, req.body))));
  A.get('/appeals', (req, res) => res.json({ appeals: s.admin.listAppeals(req.user) }));
  A.post('/appeals/:id', wrap(async (req, res) => res.json(await s.admin.decideAppeal(req.user, req.params.id, req.body))));
  A.get('/deletions', (req, res) => res.json({ deletions: s.admin.listDeletions(req.user) }));
  A.get('/params', (req, res) => res.json(s.admin.getParams(req.user)));
  A.put('/params/:key', wrap(async (req, res) => res.json(await s.admin.setParam(req.user, req.params.key, req.body))));
  A.get('/audit', (req, res) => res.json({ audit: s.admin.audit(req.user) }));
  r.use('/admin', A);

  if (config.exposeDevOutbox && !options.noDevRoutes) {
    r.get('/dev/outbox', (req, res) => res.json({ emails: ctx.db.all('SELECT * FROM outbox ORDER BY id DESC LIMIT 20') }));
  }
  r.use((req, res, next) => next(new HttpError(404, 'not_found', 'Rota não encontrada.')));
  app.use('/api', r);

  // ---- Mídia (URLs assinadas) e arquivos estáticos ----
  app.get('/media/:id', (req, res, next) => {
    try {
      const { file, mime } = s.profiles.openMedia(req.params.id, req.query);
      if (!fs.existsSync(file)) return next(new HttpError(404, 'not_found', 'Imagem não encontrada.'));
      res.set({ 'Content-Type': mime, 'Cache-Control': 'private, max-age=600', 'Content-Security-Policy': "default-src 'none'; sandbox" });
      fs.createReadStream(file).pipe(res);
    } catch (e) { next(e); }
  });
  // Quais artes finais existem (webp > png > jpg > svg); evita requisições 404 no app.
  app.get('/art-manifest.json', (req, res) => {
    const dir = path.join(config.publicDir, 'assets', 'art'); const out = {};
    const rank = { webp: 4, png: 3, jpg: 2, jpeg: 2, svg: 1 };
    try { for (const f of fs.readdirSync(dir)) { const m = /^([a-z0-9-]+)\.(webp|png|jpe?g|svg)$/.exec(f); if (m && (!out[m[1]] || rank[m[2]] > rank[out[m[1]]])) out[m[1]] = m[2]; } } catch { /* sem pasta */ }
    res.set('Cache-Control', 'no-cache').json(out);
  });
  app.use(express.static(config.publicDir, { extensions: ['html'], setHeaders: (res, p) => { if (p.endsWith('sw.js')) res.set('Cache-Control', 'no-cache'); } }));

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.extra || {}) } });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: 'Conteúdo grande demais.' } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Requisição inválida.' } });
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: 'Algo deu errado. Tente novamente.' } });
  });
  return { app, ctx, services: s };
}
module.exports = { createApp };
