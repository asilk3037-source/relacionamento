'use strict';
const http = require('http');
const { createApp } = require('../server/app');
const { DAY } = require('../server/lib/time');

/** Sobe a aplicação em memória, numa porta efetiva, com relógio controlável. */
async function boot(opts = {}) {
  const built = createApp({ dbPath: ':memory:', quiet: true, ...opts });
  const server = http.createServer(built.app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const t = { ...built, base, server, clock: built.ctx.clock };
  t.close = () => new Promise((r) => server.close(() => { built.ctx.db.close(); r(); }));
  t.api = async (method, path, { token, body, raw, headers } = {}) => {
    const res = await fetch(base + '/api' + path, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(raw ? {} : body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    const txt = await res.text();
    let json; try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
    return { status: res.status, body: json };
  };
  let n = 0;
  /** Cria um usuário completo (perfil, foto, localização) e devolve token + dados. */
  t.user = async (over = {}) => {
    n++;
    const email = over.email || `user${n}-${Math.random().toString(36).slice(2, 6)}@teste.com`;
    const birthDate = over.birthDate || `${new Date(t.clock.now()).getUTCFullYear() - (over.age || 28)}-01-01`;
    const reg = await t.api('POST', '/auth/register', { body: { email, password: 'senha1234', birthDate, acceptTerms: true } });
    if (reg.status !== 201) throw new Error('registro falhou ' + JSON.stringify(reg.body));
    const token = reg.body.token;
    const userId = built.ctx.db.get('SELECT id FROM users WHERE email = ?', email).id;
    built.ctx.db.run('UPDATE users SET status = ? WHERE id = ?', over.verified === false ? 'pending_verification' : 'active', userId);
    await t.api('PATCH', '/me/profile', { token, body: { displayName: over.name || `Pessoa ${n}`, gender: over.gender || 'mulher', intent: over.intent || 'relacionamento', bio: 'Oi!' } });
    if (over.photo !== false) await t.api('POST', '/me/photos', { token, raw: jpeg(), headers: { 'content-type': 'image/jpeg' } });
    await t.api('PUT', '/me/location', { token, body: { mode: 'gps', lat: over.lat ?? -19.92, lng: over.lng ?? -43.94, accuracyM: 30 } });
    if (over.prefs) await t.api('PUT', '/me/settings', { token, body: { prefs: over.prefs } });
    return { email, token, id: userId, pid: reg.body.user.id, password: 'senha1234' };
  };
  t.advance = (ms) => { const c = built.ctx.clock; const base0 = c.now(); c.now = () => base0 + ms; };
  t.setNow = (ms) => { built.ctx.clock.now = () => ms; };
  t.DAY = DAY;
  return t;
}

/** JPEG mínimo com um segmento EXIF (GPS) para testar a remoção de metadados. */
function jpeg(withExif = true) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (withExif) { const p = Buffer.from('Exif\0\0GPSLATITUDE-19.92-SECRET'); const h = Buffer.alloc(4); h.writeUInt16BE(0xffe1); h.writeUInt16BE(p.length + 2, 2); parts.push(h, p); }
  const jf = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0xff, 0xd9]);
  parts.push(jf, sos);
  return Buffer.concat(parts);
}
module.exports = { boot, jpeg };
