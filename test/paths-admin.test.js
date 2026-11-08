'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, jpeg } = require('./helpers');

let t;
before(async () => { t = await boot(); });
after(async () => { await t.close(); });

const sig = (token, lat, lng, accuracyM = 20) => t.api('POST', '/paths/signal', { token, body: { lat, lng, accuracyM } });

describe('Caminhos cruzados (QA09)', () => {
  test('sem consentimento não coleta; com consentimento exige precisão', async () => {
    const a = await t.user();
    assert.equal((await sig(a.token, -19.92, -43.94)).body.error.code, 'no_consent');
    await t.api('POST', '/paths/consent', { token: a.token });
    assert.equal((await sig(a.token, -19.92, -43.94, 500)).body.reason, 'imprecise');
    assert.equal((await sig(a.token, -19.92, -43.94, 50)).body.accepted, true);
    await t.api('PUT', '/paths/pause', { token: a.token, body: { paused: true } });
    assert.equal((await sig(a.token, -19.92, -43.94)).body.error.code, 'paused');
  });

  test('cruza só com proximidade, janela de tempo, atraso mínimo e densidade; sem coordenadas na resposta', async () => {
    const T0 = Date.now();
    t.setNow(T0);
    const a = await t.user({ name: 'Ana' }), b = await t.user({ name: 'Beto', gender: 'homem' }), c = await t.user({ name: 'Cris' }), far = await t.user({ name: 'Longe' });
    for (const u of [a, b, c, far]) await t.api('POST', '/paths/consent', { token: u.token });
    // a e b a ~50 m, mesma hora; c por perto (densidade); far a ~5 km
    await sig(a.token, -19.9200, -43.9400);
    await sig(b.token, -19.9204, -43.9402);
    await sig(c.token, -19.9210, -43.9410);
    await sig(far.token, -19.8700, -43.9400);
    t.setNow(T0 + 30 * 60000);
    assert.equal(t.services.paths.process().created, 0, 'antes de 60 min não apresenta sugestão');
    t.setNow(T0 + 2 * 3600000);
    const res = t.services.paths.process();
    assert.ok(res.created >= 1);
    const la = (await t.api('GET', '/paths', { token: a.token })).body;
    const names = la.items.map((i) => i.user.name).sort();
    assert.ok(names.includes('Beto'));
    assert.ok(!names.includes('Longe'));
    const raw = JSON.stringify(la);
    assert.ok(!/lat|lng|latitude|longitude|-19\.9|-43\.9/.test(raw), 'resposta sem coordenadas');
    assert.ok(la.items[0].period && la.items[0].day && !('at' in la.items[0]), 'sem horário exato');

    // bloqueio impede sugestão nos dois sentidos
    await t.api('POST', `/blocks/${b.pid}`, { token: a.token });
    assert.ok(!(await t.api('GET', '/paths', { token: a.token })).body.items.some((i) => i.user.name === 'Beto'));
    assert.ok(!(await t.api('GET', '/paths', { token: b.token })).body.items.some((i) => i.user.name === 'Ana'));

    // revogar remove sinais e derivados
    await t.api('DELETE', '/paths/consent', { token: c.token });
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM location_signals WHERE user_id = ?', c.id).n, 0);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM crossings WHERE user_a = ? OR user_b = ?', c.id, c.id).n, 0);
    assert.equal((await sig(c.token, -19.92, -43.94)).body.error.code, 'no_consent');

    // retenção: sinais brutos somem após 24 h; cruzamentos após 7 dias
    t.setNow(T0 + 25 * 3600000); t.services.paths.sweep();
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM location_signals').n, 0);
    t.setNow(T0 + 8 * 86400000); t.services.paths.sweep();
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM crossings').n, 0);
    t.setNow(Date.now());
  });

  test('baixa densidade suprime o cruzamento; modo discreto também', async () => {
    const T0 = Date.now(); t.setNow(T0);
    t.ctx.db.exec('DELETE FROM location_signals; DELETE FROM crossings;');
    const a = await t.user({ lat: -23.55, lng: -46.63 }), b = await t.user({ lat: -23.55, lng: -46.63 });
    for (const u of [a, b]) await t.api('POST', '/paths/consent', { token: u.token });
    await sig(a.token, -23.5500, -46.6300); await sig(b.token, -23.5501, -46.6301);
    t.setNow(T0 + 2 * 3600000);
    assert.equal(t.services.paths.process().created, 0, 'só 2 pessoas na região: suprimido');
    t.ctx.config.paths.minDensity = 2;
    t.services.paths.process();
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM crossings').n, 1);
    t.ctx.db.exec('DELETE FROM crossings');
    t.ctx.db.run("INSERT INTO subscriptions(user_id, plan, cycle, state, provider, provider_ref, started_at, current_period_end, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", a.id, 'premium', 'month', 'active', 'mock', 'pp', 1, t.ctx.now() + 1e9, 1, 1);
    t.ctx.db.run('UPDATE settings SET discreet = 1 WHERE user_id = ?', a.id);
    t.services.paths.process();
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM crossings').n, 0, 'discreto suprime exposição por caminhos');
    t.ctx.config.paths.minDensity = 3; t.setNow(Date.now());
  });
});

describe('Moderação de fotos e administração', () => {
  test('em produção as fotos nascem pendentes, não aparecem e só o moderador libera', async () => {
    t.ctx.config.autoApprovePhotos = false;
    const u = await t.user({ name: 'Nova' }), viewer = await t.user();
    assert.ok(!(await t.api('GET', '/discover', { token: viewer.token })).body.items.some((i) => i.id === u.pid));
    const mod = await t.user({ name: 'Mod' });
    t.ctx.db.run("UPDATE users SET role = 'moderator' WHERE id = ?", mod.id);
    const pend = await t.api('GET', '/admin/photos/pending', { token: mod.token });
    const mine = pend.body.photos.find((p) => p.user_id === u.id);
    assert.ok(mine);
    assert.equal((await fetch(t.base + mine.url)).status, 200, 'moderador vê a foto pendente');
    assert.equal((await t.api('GET', '/admin/photos/pending', { token: viewer.token })).status, 403);
    assert.equal((await t.api('POST', `/admin/photos/${mine.id}/reject`, { token: mod.token, body: {} })).body.error.code, 'reason_required');
    assert.equal((await t.api('POST', `/admin/photos/${mine.id}/approve`, { token: mod.token })).status, 200);
    assert.ok((await t.api('GET', '/discover', { token: viewer.token })).body.items.some((i) => i.id === u.pid));
    t.ctx.config.autoApprovePhotos = true;
  });

  test('ações sensíveis exigem justificativa e senha; ficam na trilha de auditoria; papéis são respeitados', async () => {
    const mod = await t.user({ name: 'Mod2' }), adm = await t.user({ name: 'Adm' }), sup = await t.user({ name: 'Sup' });
    const bad1 = await t.user({ name: 'Abusivo' }), rep = await t.user();
    t.ctx.db.run("UPDATE users SET role = 'moderator' WHERE id = ?", mod.id);
    t.ctx.db.run("UPDATE users SET role = 'admin' WHERE id = ?", adm.id);
    t.ctx.db.run("UPDATE users SET role = 'support' WHERE id = ?", sup.id);
    const r = await t.api('POST', '/reports', { token: rep.token, body: { targetId: bad1.pid, category: 'ameaca', details: 'x' } });
    const id = t.ctx.db.get('SELECT id FROM reports WHERE protocol = ?', r.body.protocol).id;
    const list = await t.api('GET', '/admin/reports', { token: mod.token });
    assert.equal(list.body.reports[0].severity, 1, 'fila ordenada por gravidade');
    assert.equal((await t.api('POST', `/admin/reports/${id}/resolve`, { token: mod.token, body: { action: 'suspend', justification: 'curta' } })).body.error.code, 'justification_required');
    assert.equal((await t.api('POST', `/admin/reports/${id}/resolve`, { token: mod.token, body: { action: 'suspend', justification: 'Ameaça comprovada no chat', password: 'errada123' } })).body.error.code, 'wrong_password');
    assert.equal((await t.api('POST', `/admin/reports/${id}/resolve`, { token: mod.token, body: { action: 'suspend', justification: 'Ameaça comprovada no chat', password: mod.password } })).status, 200);
    assert.equal(t.ctx.db.get('SELECT status FROM users WHERE id = ?', bad1.id).status, 'suspended');
    // recurso do usuário suspenso
    const login = await t.api('POST', '/auth/login', { body: { email: bad1.email, password: bad1.password } });
    assert.equal((await t.api('POST', '/me/appeal', { token: login.body.token, body: { text: 'Foi um engano, peço revisão.' } })).status, 200);
    const ap = await t.api('GET', '/admin/appeals', { token: mod.token });
    assert.equal(ap.body.appeals.length, 1);
    assert.equal((await t.api('POST', `/admin/appeals/${ap.body.appeals[0].id}`, { token: mod.token, body: { decision: 'grant', justification: 'Contexto esclarecido', password: mod.password } })).status, 200);
    assert.equal(t.ctx.db.get('SELECT status FROM users WHERE id = ?', bad1.id).status, 'active');
    // suporte não decide denúncias nem altera parâmetros; moderador não altera parâmetros; admin sim
    assert.equal((await t.api('GET', '/admin/reports', { token: sup.token })).status, 403);
    assert.equal((await t.api('GET', '/admin/users?q=Abus', { token: sup.token })).body.users.length, 1);
    assert.equal((await t.api('PUT', '/admin/params/dailyLikes', { token: mod.token, body: { value: { free: 10, plus: 50, premium: 100 } } })).status, 403);
    const set = await t.api('PUT', '/admin/params/dailyLikes', { token: adm.token, body: { value: { free: 25, plus: 100, premium: 200 }, justification: 'Teste A/B do piloto', password: adm.password } });
    assert.equal(set.body.dailyLikes.free, 25);
    assert.equal(t.services.plans.limitFor('free'), 25);
    const audit = (await t.api('GET', '/admin/audit', { token: adm.token })).body.audit.map((a) => a.action);
    for (const a of ['report.suspend', 'appeal.grant', 'param.set']) assert.ok(audit.includes(a), a);
    // equipe não consegue alterar o próprio papel; usuário comum não entra no painel
    assert.equal((await t.api('POST', `/admin/users/${adm.id}/role`, { token: adm.token, body: { role: 'user', justification: 'tentando algo', password: adm.password } })).body.error.code, 'self_role');
    assert.equal((await t.api('GET', '/admin/metrics', { token: rep.token })).status, 403);
    const m = (await t.api('GET', '/admin/metrics', { token: adm.token })).body;
    assert.ok(m.accounts > 0 && !JSON.stringify(m).includes('@'));
  });

  test('alteração de nascimento só por administrador, com justificativa', async () => {
    const adm = await t.user(), u = await t.user();
    t.ctx.db.run("UPDATE users SET role = 'admin' WHERE id = ?", adm.id);
    const r = await t.api('POST', `/admin/users/${u.id}/birthdate`, { token: adm.token, body: { birthDate: '1990-05-05', justification: 'Documento conferido pelo suporte', password: adm.password } });
    assert.equal(r.status, 200);
    assert.equal(t.ctx.db.get('SELECT birth_date FROM users WHERE id = ?', u.id).birth_date, '1990-05-05');
    assert.equal((await t.api('POST', `/admin/users/${u.id}/birthdate`, { token: u.token, body: { birthDate: '1980-01-01' } })).status, 403);
  });
});
