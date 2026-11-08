'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, jpeg } = require('./helpers');

let t;
before(async () => { t = await boot(); });
after(async () => { await t.close(); });

describe('Conta e maioridade (QA01)', () => {
  test('menor de 18 anos é recusado no servidor, e a tentativa com outra data também', async () => {
    const year = new Date().getUTCFullYear();
    const r = await t.api('POST', '/auth/register', { body: { email: 'menor@teste.com', password: 'senha1234', birthDate: `${year - 16}-01-01`, acceptTerms: true } });
    assert.equal(r.status, 403); assert.equal(r.body.error.code, 'underage');
    const r2 = await t.api('POST', '/auth/register', { body: { email: 'menor@teste.com', password: 'senha1234', birthDate: `${year - 30}-01-01`, acceptTerms: true } });
    assert.equal(r2.status, 403, 'não pode contornar trocando a data');
  });
  test('exige aceite dos termos, senha forte e e-mail válido', async () => {
    const base = { email: 'a@b.com', password: 'senha1234', birthDate: '1990-01-01', acceptTerms: true };
    assert.equal((await t.api('POST', '/auth/register', { body: { ...base, acceptTerms: false } })).body.error.code, 'terms_required');
    assert.equal((await t.api('POST', '/auth/register', { body: { ...base, password: 'abc' } })).body.error.code, 'weak_password');
    assert.equal((await t.api('POST', '/auth/register', { body: { ...base, email: 'x' } })).body.error.code, 'invalid_email');
  });
  test('login, logout e sessão inválida; /me nunca devolve nascimento', async () => {
    const u = await t.user();
    const me = await t.api('GET', '/me', { token: u.token });
    assert.equal(me.status, 200);
    assert.ok(!JSON.stringify(me.body).includes('birth'), 'sem nascimento na resposta');
    assert.equal((await t.api('POST', '/auth/login', { body: { email: u.email, password: 'errada123' } })).status, 401);
    const li = await t.api('POST', '/auth/login', { body: { email: u.email, password: u.password } });
    assert.equal(li.status, 200);
    await t.api('POST', '/auth/logout', { token: li.body.token });
    assert.equal((await t.api('GET', '/me', { token: li.body.token })).status, 401);
  });
  test('recuperação não revela se o e-mail existe e redefine a senha revogando sessões', async () => {
    const u = await t.user();
    const a = await t.api('POST', '/auth/forgot', { body: { email: u.email } });
    const b = await t.api('POST', '/auth/forgot', { body: { email: 'naoexiste@teste.com' } });
    assert.deepEqual(a.body, b.body);
    const mail = t.ctx.db.get("SELECT body FROM outbox WHERE to_email = ? AND subject LIKE 'Recupera%' ORDER BY id DESC", u.email);
    const code = mail.body.split(': ')[1];
    assert.equal((await t.api('POST', '/auth/reset', { body: { token: code, password: 'novasenha99' } })).status, 200);
    assert.equal((await t.api('GET', '/me', { token: u.token })).status, 401);
    assert.equal((await t.api('POST', '/auth/login', { body: { email: u.email, password: 'novasenha99' } })).status, 200);
    assert.equal((await t.api('POST', '/auth/reset', { body: { token: code, password: 'outrasenha99' } })).status, 400, 'código só vale uma vez');
  });
  test('conta suspensa ou não verificada não acessa descoberta nem conversas', async () => {
    const u = await t.user();
    const pend = await t.user({ verified: false });
    assert.equal((await t.api('GET', '/discover', { token: pend.token })).body.error.code, 'email_unverified');
    t.ctx.db.run("UPDATE users SET status = 'suspended' WHERE id = ?", u.id);
    assert.equal((await t.api('GET', '/discover', { token: u.token })).body.error.code, 'account_suspended');
    assert.equal((await t.api('GET', '/matches', { token: u.token })).status, 403);
  });
});

describe('Perfil e fotos', () => {
  test('valida campos e normaliza interesses (até 8, sem repetição)', async () => {
    const u = await t.user();
    const ok = await t.api('PATCH', '/me/profile', { token: u.token, body: { interests: ['Café', 'café', 'Música', ' Arte '], heightCm: 170, smoking: 'nao_fumo' } });
    assert.deepEqual(ok.body.profile.interests, ['Café', 'Música', 'Arte']);
    assert.equal((await t.api('PATCH', '/me/profile', { token: u.token, body: { heightCm: 50 } })).body.error.code, 'invalid_height');
    assert.equal((await t.api('PATCH', '/me/profile', { token: u.token, body: { bio: 'x'.repeat(501) } })).body.error.code, 'too_long');
    assert.equal((await t.api('PATCH', '/me/profile', { token: u.token, body: { interests: Array.from({ length: 9 }, (_, i) => 'i' + i) } })).body.error.code, 'too_many');
    assert.equal((await t.api('PATCH', '/me/profile', { token: u.token, body: { gender: 'xyz' } })).body.error.code, 'invalid_value');
  });
  test('upload remove metadados EXIF/GPS, recusa SVG e limita a 6 fotos', async () => {
    const u = await t.user({ photo: false });
    const up = await t.api('POST', '/me/photos', { token: u.token, raw: jpeg(true), headers: { 'content-type': 'image/jpeg' } });
    assert.equal(up.status, 201);
    const row = t.ctx.db.get('SELECT storage_key FROM photos WHERE public_id = ?', up.body.id);
    const stored = require('fs').readFileSync(require('path').join(t.ctx.config.uploadDir, row.storage_key));
    assert.ok(!stored.includes('GPSLATITUDE'), 'EXIF removido');
    const svg = await t.api('POST', '/me/photos', { token: u.token, raw: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), headers: { 'content-type': 'image/svg+xml' } });
    assert.equal(svg.status, 400);
    for (let i = 0; i < 5; i++) assert.equal((await t.api('POST', '/me/photos', { token: u.token, raw: jpeg(), headers: { 'content-type': 'image/jpeg' } })).status, 201);
    assert.equal((await t.api('POST', '/me/photos', { token: u.token, raw: jpeg(), headers: { 'content-type': 'image/jpeg' } })).body.error.code, 'too_many_photos');
  });
  test('URL de mídia assinada: serve para quem pode ver, falha adulterada e após bloqueio', async () => {
    const a = await t.user(), b = await t.user();
    const card = (await t.api('GET', `/profiles/${b.pid}`, { token: a.token })).body;
    const url = card.photos[0].url;
    assert.equal((await fetch(t.base + url)).status, 200);
    assert.equal((await fetch(t.base + url.replace(/s=./, 's=Z'))).status, 403);
    await t.api('POST', `/blocks/${a.pid}`, { token: b.token });
    assert.equal((await fetch(t.base + url)).status, 404);
  });
});

describe('Descoberta (QA02)', () => {
  test('aplica idade, preferência recíproca, bloqueio e distância no servidor', async () => {
    const me = await t.user({ name: 'Eu', gender: 'homem', prefs: { genders: ['mulher'], ageMin: 25, ageMax: 35, distanceKm: 25 } });
    const ok = await t.user({ name: 'Ok', gender: 'mulher', age: 30 });
    const tooOld = await t.user({ name: 'Velha', gender: 'mulher', age: 50 });
    const wrongGender = await t.user({ name: 'Homem', gender: 'homem', age: 30 });
    const far = await t.user({ name: 'Longe', gender: 'mulher', age: 30, lat: -23.55, lng: -46.63 });
    const notInterested = await t.user({ name: 'NaoQuer', gender: 'mulher', age: 30, prefs: { genders: ['mulher'] } });
    const blocked = await t.user({ name: 'Bloq', gender: 'mulher', age: 30 });
    await t.api('POST', `/blocks/${me.pid}`, { token: blocked.token });
    const names = (await t.api('GET', '/discover', { token: me.token })).body.items.map((i) => i.name);
    assert.deepEqual(names.filter((n) => ['Ok', 'Velha', 'Homem', 'Longe', 'NaoQuer', 'Bloq'].includes(n)), ['Ok']);
    void [ok, tooOld, wrongGender, far, notInterested];
  });
  test('cartão não expõe e-mail, nascimento nem coordenadas; distância vem em faixas', async () => {
    const a = await t.user(), b = await t.user();
    const items = (await t.api('GET', '/discover', { token: a.token })).body.items;
    const c = items.find((i) => i.id === b.pid);
    const s = JSON.stringify(c);
    for (const bad of ['email', 'birth', 'lat', 'lng', '@teste.com']) assert.ok(!s.includes(bad), `vazou ${bad}`);
    assert.match(c.distance, /km/);
  });
  test('discovery pausada não distribui o perfil, mas preserva o match existente', async () => {
    const a = await t.user({ name: 'DA' }), b = await t.user({ name: 'DB' });
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    const m = await t.api('POST', `/discover/${a.pid}/like`, { token: b.token });
    assert.equal(m.body.status, 'matched');
    await t.api('PUT', '/me/settings', { token: b.token, body: { pauseDiscovery: true } });
    const seen = (await t.api('GET', '/discover', { token: (await t.user()).token })).body.items.map((i) => i.id);
    assert.ok(!seen.includes(b.pid));
    assert.equal((await t.api('GET', '/matches', { token: a.token })).body.matches.length, 1);
  });
});

describe('Curtidas, cota e match (QA03–QA06)', () => {
  test('Free: a 20ª curtida é aceita, a 21ª é recusada, e renova à meia-noite de Brasília', async () => {
    const a = await t.user({ name: 'Cota' });
    const others = [];
    for (let i = 0; i < 21; i++) others.push(await t.user({ name: 'Alvo' + i }));
    for (let i = 0; i < 20; i++) assert.equal((await t.api('POST', `/discover/${others[i].pid}/like`, { token: a.token })).status, 200, `curtida ${i + 1}`);
    const over = await t.api('POST', `/discover/${others[20].pid}/like`, { token: a.token });
    assert.equal(over.status, 429); assert.equal(over.body.error.code, 'daily_limit');
    assert.equal(over.body.error.quota.remaining, 0);
    // "Passar" não consome e conversar/matches continuam funcionando
    assert.equal((await t.api('POST', `/discover/${others[20].pid}/pass`, { token: a.token })).status, 200);
    // avança para o dia seguinte (após a meia-noite de Brasília)
    const { nextMidnight } = require('../server/lib/time');
    t.setNow(nextMidnight(t.ctx.now()) + 60000);
    const again = await t.api('POST', `/discover/${others[20].pid}/like`, { token: a.token });
    assert.equal(again.status, 200);
    assert.equal(again.body.quota.used, 1);
    t.setNow(Date.now());
  });
  test('repetir a mesma curtida não duplica consumo, curtida nem match (QA05)', async () => {
    const a = await t.user({ name: 'R1' }), b = await t.user({ name: 'R2' });
    const q0 = (await t.api('GET', '/quota', { token: a.token })).body.used;
    const r1 = await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    const r2 = await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    assert.equal(r1.body.status, 'liked'); assert.equal(r2.body.status, 'already_liked');
    assert.equal((await t.api('GET', '/quota', { token: a.token })).body.used, q0 + 1);
    const back = await Promise.all([1, 2, 3].map(() => t.api('POST', `/discover/${a.pid}/like`, { token: b.token })));
    assert.ok(back.every((x) => x.body.status === 'matched'));
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM matches WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)', a.id, b.id, b.id, a.id).n, 1);
  });
  test('requisições simultâneas não gastam a mesma última unidade (QA04)', async () => {
    const a = await t.user({ name: 'Conc' });
    const targets = []; for (let i = 0; i < 6; i++) targets.push(await t.user());
    t.ctx.db.run('INSERT OR REPLACE INTO daily_likes(user_id, day, used) VALUES (?,?,19)', a.id, require('../server/lib/time').dayKey(t.ctx.now()));
    const res = await Promise.all(targets.map((x) => t.api('POST', `/discover/${x.pid}/like`, { token: a.token })));
    assert.equal(res.filter((r) => r.status === 200).length, 1);
    assert.equal(res.filter((r) => r.status === 429).length, 5);
  });
  test('Free não recebe identidade de quem curtiu; contagem agregada é gratuita (QA06)', async () => {
    const a = await t.user({ name: 'Secreta' }), b = await t.user({ name: 'Free' });
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    const likes = await t.api('GET', '/likes', { token: b.token });
    assert.equal(likes.body.locked, true); assert.equal(likes.body.count, 1); assert.deepEqual(likes.body.items, []);
    const notif = await t.api('GET', '/notifications', { token: b.token });
    const raw = JSON.stringify(notif.body);
    assert.ok(!raw.includes('Secreta') && !raw.includes(a.pid), 'notificação não revela remetente');
    const disc = JSON.stringify((await t.api('GET', '/discover', { token: b.token })).body);
    assert.ok(!/likedYou|liked_you/.test(disc));
    // Plus enxerga
    t.ctx.db.run("INSERT INTO subscriptions(user_id, plan, cycle, state, provider, provider_ref, started_at, current_period_end, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", b.id, 'plus', 'month', 'active', 'mock', 'x1', t.ctx.now(), t.ctx.now() + 86400000, 1, 1);
    const plus = await t.api('GET', '/likes', { token: b.token });
    assert.equal(plus.body.locked, false); assert.equal(plus.body.items[0].name, 'Secreta');
  });
  test('desfazer dispensa é do Plus/Premium e não devolve curtida', async () => {
    const a = await t.user(), b = await t.user({ name: 'Passada' });
    await t.api('POST', `/discover/${b.pid}/pass`, { token: a.token });
    assert.equal((await t.api('POST', '/discover/undo', { token: a.token })).body.error.code, 'plan_required');
    t.ctx.db.run("INSERT INTO subscriptions(user_id, plan, cycle, state, provider, provider_ref, started_at, current_period_end, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", a.id, 'plus', 'month', 'active', 'mock', 'x2', t.ctx.now(), t.ctx.now() + 86400000, 1, 1);
    const undo = await t.api('POST', '/discover/undo', { token: a.token });
    assert.equal(undo.body.profile.name, 'Passada');
  });
  test('trocar de plano mantém o consumo do dia', async () => {
    const a = await t.user(), tg = await t.user();
    await t.api('POST', `/discover/${tg.pid}/like`, { token: a.token });
    const co = await t.api('POST', '/plans/checkout', { token: a.token, body: { plan: 'plus', cycle: 'month' } });
    await t.api('POST', '/plans/mock/confirm', { token: a.token, body: { subscriptionId: co.body.subscriptionId } });
    const q = (await t.api('GET', '/quota', { token: a.token })).body;
    assert.equal(q.limit, 100); assert.equal(q.used, 1); assert.equal(q.remaining, 99);
  });
});

describe('Conversa e segurança (QA07)', () => {
  async function matched() {
    const a = await t.user({ name: 'CA' }), b = await t.user({ name: 'CB' });
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    const m = await t.api('POST', `/discover/${a.pid}/like`, { token: b.token });
    return { a, b, mid: m.body.matchId };
  }
  test('curtida isolada não libera chat; match libera; envio é idempotente por clientId', async () => {
    const a = await t.user(), b = await t.user();
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    assert.equal((await t.api('GET', '/matches', { token: a.token })).body.matches.length, 0);
    const { a: x, b: y, mid } = await matched();
    const s1 = await t.api('POST', `/matches/${mid}/messages`, { token: x.token, body: { clientId: 'client-aaaa1', body: 'Oi!' } });
    const s2 = await t.api('POST', `/matches/${mid}/messages`, { token: x.token, body: { clientId: 'client-aaaa1', body: 'Oi!' } });
    assert.equal(s1.body.id, s2.body.id);
    assert.equal((await t.api('GET', `/matches/${mid}/messages`, { token: y.token })).body.messages.length, 1);
    assert.equal((await t.api('POST', `/matches/${mid}/messages`, { token: x.token, body: { clientId: 'client-aaaa2', body: 'x'.repeat(2001) } })).body.error.code, 'message_too_long');
    assert.equal((await t.api('POST', `/matches/${mid}/messages`, { token: x.token, body: { clientId: 'client-aaaa3', body: '   ' } })).body.error.code, 'empty_message');
    const stranger = await t.user();
    assert.equal((await t.api('GET', `/matches/${mid}/messages`, { token: stranger.token })).status, 404);
  });
  test('bloqueio e desmatch encerram a conversa, inclusive por API', async () => {
    const m1 = await matched();
    await t.api('POST', `/blocks/${m1.b.pid}`, { token: m1.a.token });
    for (const who of [m1.a, m1.b]) {
      const r = await t.api('POST', `/matches/${m1.mid}/messages`, { token: who.token, body: { clientId: 'client-bbbb1', body: 'oi' } });
      assert.equal(r.status, 403); assert.equal(r.body.error.code, 'match_ended');
    }
    const ids = (await t.api('GET', '/discover', { token: m1.b.token })).body.items.map((i) => i.id);
    assert.ok(!ids.includes(m1.a.pid), 'bloqueio vale nos dois sentidos na descoberta');
    const m2 = await matched();
    await t.api('DELETE', `/matches/${m2.mid}`, { token: m2.b.token });
    assert.equal((await t.api('POST', `/matches/${m2.mid}/messages`, { token: m2.a.token, body: { clientId: 'client-cccc1', body: 'oi' } })).status, 403);
  });
  test('convite "Bora tomar um café?": propor, aceitar, cancelar; só o outro responde', async () => {
    const { a, b, mid } = await matched();
    const when = t.ctx.now() + 3 * 86400000;
    const inv = await t.api('POST', `/matches/${mid}/invites`, { token: a.token, body: { place: 'Café da Praça', when } });
    assert.equal(inv.status, 201); const id = inv.body.invite.id;
    assert.equal((await t.api('POST', `/invites/${id}/accept`, { token: a.token })).status, 403);
    assert.equal((await t.api('POST', `/invites/${id}/accept`, { token: b.token })).body.status, 'accepted');
    assert.equal((await t.api('POST', `/invites/${id}/cancel`, { token: a.token })).body.status, 'cancelled');
    assert.equal((await t.api('POST', `/matches/${mid}/invites`, { token: a.token, body: { place: 'Ok', when: 1 } })).status, 400);
  });
  test('denúncia gera protocolo e evidências; duas denúncias de menor suspendem preventivamente', async () => {
    const { a, b, mid } = await matched();
    await t.api('POST', `/matches/${mid}/messages`, { token: b.token, body: { clientId: 'client-dddd1', body: 'mensagem ofensiva' } });
    const r = await t.api('POST', '/reports', { token: a.token, body: { targetId: b.pid, category: 'assedio', details: 'teste', matchId: mid } });
    assert.match(r.body.protocol, /^ELO-\d{8}-[0-9A-F]{6}$/);
    const rep = t.ctx.db.get('SELECT * FROM reports WHERE protocol = ?', r.body.protocol);
    assert.match(rep.evidence, /mensagem ofensiva/);
    const t1 = await t.user(), t2 = await t.user(), target = await t.user();
    await t.api('POST', '/reports', { token: t1.token, body: { targetId: target.pid, category: 'menor' } });
    assert.equal(t.ctx.db.get('SELECT status FROM users WHERE id = ?', target.id).status, 'active');
    await t.api('POST', '/reports', { token: t2.token, body: { targetId: target.pid, category: 'menor' } });
    assert.equal(t.ctx.db.get('SELECT status FROM users WHERE id = ?', target.id).status, 'suspended');
    assert.equal((await t.api('GET', '/me', { token: target.token })).status, 401, 'sessões revogadas');
  });
});

describe('Planos e assinatura (QA08)', () => {
  test('compra pendente não libera benefício; confirmação libera; cancelar mantém até o fim; expiração e reembolso revogam', async () => {
    const u = await t.user();
    const co = await t.api('POST', '/plans/checkout', { token: u.token, body: { plan: 'premium', cycle: 'year' } });
    assert.equal(co.body.price, 299.9);
    assert.equal((await t.api('GET', '/plans', { token: u.token })).body.current.plan, 'free', 'pendente não libera');
    assert.equal((await t.api('POST', '/plans/boost', { token: u.token })).status, 403);
    await t.api('POST', '/plans/mock/confirm', { token: u.token, body: { subscriptionId: co.body.subscriptionId } });
    const cur = (await t.api('GET', '/plans', { token: u.token })).body.current;
    assert.equal(cur.plan, 'premium'); assert.equal(cur.dailyLikes, 200);
    const c = await t.api('POST', '/plans/cancel', { token: u.token });
    assert.equal(c.body.state, 'renewal_cancelled'); assert.equal(c.body.plan, 'premium', 'mantém acesso até o fim do período');
    t.advance(366 * 86400000); t.services.plans.sweep();
    assert.equal(t.services.plans.planOf(u.id), 'free');
    t.setNow(Date.now());
    const co2 = await t.api('POST', '/plans/checkout', { token: u.token, body: { plan: 'plus', cycle: 'month' } });
    await t.api('POST', '/plans/mock/confirm', { token: u.token, body: { subscriptionId: co2.body.subscriptionId } });
    t.services.plans.revoke(u.id, 'refunded');
    assert.equal((await t.api('GET', '/plans', { token: u.token })).body.current.plan, 'free');
  });
  test('destaque: 1 por semana, 30 minutos, só Premium; modo discreto limita distribuição', async () => {
    const p = await t.user({ name: 'Prem' }), v = await t.user({ name: 'Visitante' });
    const co = await t.api('POST', '/plans/checkout', { token: p.token, body: { plan: 'premium', cycle: 'month' } });
    await t.api('POST', '/plans/mock/confirm', { token: p.token, body: { subscriptionId: co.body.subscriptionId } });
    const b1 = await t.api('POST', '/plans/boost', { token: p.token });
    assert.equal(b1.body.boost.active, true);
    assert.equal((await t.api('POST', '/plans/boost', { token: p.token })).body.error.code, 'boost_unavailable');
    await t.api('PUT', '/plans/discreet', { token: p.token, body: { on: true } });
    let ids = (await t.api('GET', '/discover', { token: v.token })).body.items.map((i) => i.id);
    assert.ok(!ids.includes(p.pid), 'discreto não aparece para quem não foi curtido');
    await t.api('POST', `/discover/${v.pid}/like`, { token: p.token });
    ids = (await t.api('GET', '/discover', { token: v.token })).body.items.map((i) => i.id);
    assert.ok(ids.includes(p.pid), 'aparece para quem foi curtido');
    assert.equal((await t.api('PUT', '/plans/discreet', { token: v.token, body: { on: true } })).status, 403);
  });
  test('webhook da loja é idempotente e exige segredo', async () => {
    assert.equal((await t.api('POST', '/webhooks/google-play', { body: { eventId: 'e1', purchaseToken: 't' } })).status, 403);
    const u = await t.user();
    assert.equal((await t.api('POST', '/plans/google/verify', { token: u.token, body: { productId: 'elo_plus_month', purchaseToken: 'abc' } })).status, 501);
    const calls = [];
    t.ctx.googleVerifier = { verify: async (x) => { calls.push(x); return { state: 'active', expiresAt: t.ctx.now() + 30 * 86400000 }; } };
    const ok = await t.api('POST', '/plans/google/verify', { token: u.token, body: { productId: 'elo_plus_month', purchaseToken: 'abc' } });
    assert.equal(ok.body.plan, 'plus');
    const other = await t.user();
    assert.equal((await t.api('POST', '/plans/google/verify', { token: other.token, body: { productId: 'elo_plus_month', purchaseToken: 'abc' } })).body.error.code, 'purchase_belongs_to_other');
    const r1 = await t.services.plans.handleWebhook('google', 'evt-1', 'abc');
    const r2 = await t.services.plans.handleWebhook('google', 'evt-1', 'abc');
    assert.ok(r1.ok); assert.ok(r2.duplicate);
    delete t.ctx.googleVerifier;
  });
});

describe('Privacidade e exclusão (QA10)', () => {
  test('exportação exige senha e não inclui mensagens de terceiros', async () => {
    const a = await t.user({ name: 'Exp' }), b = await t.user();
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    const m = await t.api('POST', `/discover/${a.pid}/like`, { token: b.token });
    await t.api('POST', `/matches/${m.body.matchId}/messages`, { token: a.token, body: { clientId: 'client-eeee1', body: 'minha msg' } });
    await t.api('POST', `/matches/${m.body.matchId}/messages`, { token: b.token, body: { clientId: 'client-eeee2', body: 'msg-da-outra-pessoa' } });
    assert.equal((await t.api('POST', '/me/export', { token: a.token, body: { password: 'errada' } })).status, 403);
    const ex = await t.api('POST', '/me/export', { token: a.token, body: { password: a.password } });
    const s = JSON.stringify(ex.body);
    assert.ok(s.includes('minha msg')); assert.ok(!s.includes('msg-da-outra-pessoa'));
  });
  test('exclusão oculta o perfil imediatamente, revoga sessões e a limpeza apaga dados', async () => {
    const a = await t.user({ name: 'Sai' }), b = await t.user();
    const photo = t.ctx.db.get('SELECT storage_key FROM photos WHERE user_id = ?', a.id).storage_key;
    const file = require('path').join(t.ctx.config.uploadDir, photo);
    assert.ok(require('fs').existsSync(file));
    await t.api('POST', `/discover/${b.pid}/like`, { token: a.token });
    assert.equal((await t.api('POST', '/me/delete', { token: a.token, body: { password: 'errada1' } })).status, 403);
    assert.equal((await t.api('POST', '/me/delete', { token: a.token, body: { password: a.password } })).status, 200);
    assert.equal((await t.api('GET', '/me', { token: a.token })).status, 401);
    assert.ok(!(await t.api('GET', '/discover', { token: b.token })).body.items.some((i) => i.id === a.pid));
    t.advance(31 * 86400000);
    t.services.privacy.purgeDeleted();
    assert.ok(!require('fs').existsSync(file), 'arquivo removido');
    assert.equal(t.ctx.db.get('SELECT status FROM users WHERE id = ?', a.id).status, 'deleted');
    assert.equal(t.ctx.db.get('SELECT COUNT(*) n FROM likes WHERE from_id = ?', a.id).n, 0);
    t.setNow(Date.now());
  });
});

describe('Popularidade', () => {
  test('conta visitas únicas por pessoa e dia, ignora autovisita e não identifica visitantes', async () => {
    const a = await t.user({ name: 'Pop' }), v = await t.user();
    await t.api('GET', `/profiles/${a.pid}`, { token: v.token });
    await t.api('GET', `/profiles/${a.pid}`, { token: v.token });
    await t.api('GET', `/profiles/${a.pid}`, { token: a.token });
    const pop = (await t.api('GET', '/me/popularity', { token: a.token })).body;
    assert.equal(pop.visits, 1); assert.equal(pop.enoughData, false);
    assert.ok(!JSON.stringify(pop).includes(v.pid));
  });
});
