'use strict';
// Dados de DESENVOLVIMENTO: perfis fictícios marcados como "demonstração" (is_demo) e contas internas de teste.
// Nunca roda em produção. Para trocar os retratos por imagens geradas por IA, veja docs/ARTE-PROMPTS.md (seção "Retratos demo").
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createContext } = require('./ctx');
const buildServices = require('./services');

if (config.prod && !process.env.SEED_FORCE) { console.error('Seed bloqueado em produção.'); process.exit(1); }
const ctx = createContext(); const s = buildServices(ctx);
const { db } = ctx;

const portrait = (p) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480"><rect width="400" height="480" fill="${p.bg}"/><circle cx="310" cy="95" r="95" fill="#fff" opacity=".2"/><path d="M0 340 400 240v240H0Z" fill="#fff" opacity=".15"/><path d="M60 480c0-140 45-172 140-172s140 32 140 172" fill="${p.shirt}"/><path d="M170 278h60v57c-15 25-45 25-60 0" fill="${p.skin}"/><ellipse cx="200" cy="196" rx="79" ry="108" fill="${p.hair}"/><ellipse cx="200" cy="216" rx="64" ry="83" fill="${p.skin}"/><path d="M133 205c-12-107 125-143 136 5-34-15-55-52-57-75-9 34-42 63-79 70" fill="${p.hair}"/><path d="M163 216q10-8 20 0m34 0q10-8 20 0" stroke="#332a23" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M183 259q17 13 34-2" stroke="#5a3029" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

const PEOPLE = [
  ['Marina', 28, 'mulher', 'relacionamento', 'Café sem pressa, música ao vivo e uma boa conversa. Qual cantinho de BH você me apresentaria?', ['Café', 'Música', 'Arte'], 'bh', '#b9cee9', '#ad7154', '#392c25', '#365d9e', 168, 'Designer'],
  ['Rafael', 31, 'homem', 'conhecer', 'Entre uma trilha e um cinema, sempre cabe um pão de queijo.', ['Trilhas', 'Cinema', 'Cozinhar'], 'bh', '#c3d6eb', '#78503c', '#292721', '#324d78', 181, 'Engenheiro'],
  ['Júlia', 26, 'mulher', 'relacionamento', 'Livros na mochila e vontade de descobrir a próxima exposição.', ['Livros', 'Arte', 'Viagens'], 'bh', '#c0cfe8', '#d7a17e', '#784832', '#394b58', 165, 'Professora'],
  ['Lucas', 29, 'homem', 'casual', 'Domingo de feira, fotografia de rua e uma boa playlist.', ['Fotografia', 'Música', 'Café'], 'bh', '#c8d4e7', '#bd8b65', '#302b24', '#456998', 176, 'Fotógrafo'],
  ['Bia', 33, 'mulher', 'conhecer', 'Corrida de manhã, vinho no fim de semana e muito papo.', ['Corrida', 'Vinho', 'Cinema'], 'bh', '#d6dff0', '#8a5a3d', '#1c1714', '#c4471a', 170, 'Advogada'],
  ['Théo', 35, 'homem', 'relacionamento', 'Cozinho para os amigos e procuro quem curta uma boa história.', ['Cozinhar', 'Livros', 'Viagens'], 'bh', '#c9d9ee', '#e0ac85', '#6b3f2a', '#3c4a63', 183, 'Chef'],
  ['Alê', 30, 'nao_binario', 'descobrindo', 'Teatro, bicicleta e conversas sem roteiro.', ['Teatro', 'Bicicleta', 'Arte'], 'bh', '#ccd8ee', '#c98b66', '#2e2420', '#5a6fa8', 172, 'Atriz/Ator'],
  ['Camila', 27, 'mulher', 'relacionamento', 'Praia quando dá, montanha quando precisa.', ['Praia', 'Trilhas', 'Yoga'], 'rj', '#bcd0ea', '#d9a47f', '#4a2b1c', '#2f5d9a', 164, 'Fisioterapeuta'],
  ['Pedro', 32, 'homem', 'casual', 'Futebol, samba e uma cerveja gelada com bons amigos.', ['Futebol', 'Samba', 'Cerveja'], 'rj', '#c2d3ec', '#9a6a4a', '#201915', '#a83a1c', 178, 'Jornalista'],
  ['Larissa', 29, 'mulher', 'conhecer', 'Fotografia analógica e brechós. Me mostre o seu favorito.', ['Fotografia', 'Brechós', 'Café'], 'sp', '#c5d4ec', '#e8bb96', '#8a5a2b', '#374e7a', 167, 'Arquiteta'],
];

(async () => {
  const now = ctx.now();
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const artDir = path.join(config.publicDir, 'assets', 'art', 'demo');
  const mk = async (email, password, birthYear, role, demo) => {
    if (db.get('SELECT 1 FROM users WHERE email = ?', email)) return null;
    const r = db.run("INSERT INTO users(public_id, email, password_hash, birth_date, status, role, email_verified_at, is_demo, terms_version, terms_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ctx.publicId(), email, await s.accounts.hashPassword(password), `${birthYear}-03-15`, 'active', role, now, demo ? 1 : 0, config.termsVersion, now, now - 5 * 86400000);
    const id = Number(r.lastInsertRowid);
    db.run('INSERT INTO profiles(user_id, updated_at) VALUES (?,?)', id, now); db.run('INSERT INTO settings(user_id, onboarding_done) VALUES (?,1)', id);
    return id;
  };
  let n = 0;
  for (const [i, p] of PEOPLE.entries()) {
    const id = await mk(`demo${i + 1}@elo.demo`, 'demo-' + Math.random().toString(36).slice(2), new Date().getFullYear() - p[1], 'user', true);
    if (!id) continue; n++;
    const city = config.cities.find((c) => c.id === p[6]);
    db.run('UPDATE profiles SET display_name=?, bio=?, gender=?, intent=?, interests=?, city=?, lat=?, lng=?, location_source=?, location_updated_at=?, height_cm=?, work=?, smoking=?, children=?, drinking=?, pets=? WHERE user_id=?',
      p[0], p[4], p[2], p[3], JSON.stringify(p[5]), city.name, city.lat + (Math.random() - .5) * .08, city.lng + (Math.random() - .5) * .08, 'manual', now, p[11], p[12], 'nao_fumo', 'nao_informar', 'socialmente', ['tenho_gato', 'tenho_cachorro', 'gosto'][i % 3], id);
    // retrato: imagem gerada por IA, se existir em public/assets/art/demo/demo-N.(webp|jpg|png); senão, ilustração SVG
    let key, mime;
    const found = ['webp', 'jpg', 'png'].map((e) => ({ e, f: path.join(artDir, `demo-${i + 1}.${e}`) })).find((x) => fs.existsSync(x.f));
    if (found) { key = `demo-${i + 1}.${found.e}`; fs.copyFileSync(found.f, path.join(config.uploadDir, key)); mime = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' }[found.e]; }
    else { key = `demo-${i + 1}.svg`; fs.writeFileSync(path.join(config.uploadDir, key), portrait({ bg: p[7], skin: p[8], hair: p[9], shirt: p[10] })); mime = 'image/svg+xml'; }
    db.run('INSERT INTO photos(public_id, user_id, position, status, storage_key, mime, bytes, created_at) VALUES (?,?,0,?,?,?,?,?)', ctx.publicId(), id, 'approved', 'seed:' + key, mime, fs.statSync(path.join(config.uploadDir, key)).size, now);
    // alguns já curtiram a conta de teste (útil para ver "Quem curtiu você")
  }
  const test = await mk('teste@elo.test', 'elo12345', new Date().getFullYear() - 29, 'user', false);
  if (test) {
    const city = config.cities[0];
    db.run("UPDATE profiles SET display_name='Alex', bio='Gosto de conhecer lugares novos e de uma boa conversa.', gender='nao_informar', intent='relacionamento', interests=?, city=?, lat=?, lng=?, location_source='manual', location_updated_at=? WHERE user_id=?", JSON.stringify(['Café', 'Música', 'Viagens']), city.name, city.lat, city.lng, now, test);
    const key = 'teste-alex.svg'; fs.writeFileSync(path.join(config.uploadDir, key), portrait({ bg: '#d0dcf0', skin: '#c98b66', hair: '#2e2420', shirt: '#2865eb' }));
    db.run('INSERT INTO photos(public_id, user_id, position, status, storage_key, mime, bytes, created_at) VALUES (?,?,0,?,?,?,?,?)', ctx.publicId(), test, 'approved', 'seed:' + key, 'image/svg+xml', 1, now);
    // Marina e Rafael já curtiram Alex (Rafael vira match ao curtir de volta)
    for (const e of ['demo1@elo.demo', 'demo2@elo.demo']) { const f = db.get('SELECT id FROM users WHERE email = ?', e); if (f) db.run('INSERT OR IGNORE INTO likes(from_id, to_id, active, day, created_at) VALUES (?,?,1,?,?)', f.id, test, '2000-01-01', now); }
  }
  await mk('admin@elo.test', 'elo-admin-123', 1985, 'admin', false);
  await mk('moderador@elo.test', 'elo-mod-12345', 1990, 'moderator', false);
  await mk('suporte@elo.test', 'elo-sup-12345', 1992, 'support', false);
  for (const e of ['admin@elo.test', 'moderador@elo.test', 'suporte@elo.test']) { const u = db.get('SELECT id FROM users WHERE email = ?', e); db.run("UPDATE profiles SET display_name = ? WHERE user_id = ? AND display_name = ''", e.split('@')[0], u.id); }
  console.log(`Seed concluído: ${n} perfis de demonstração.`);
  console.log('Conta de teste: teste@elo.test / elo12345');
  console.log('Painel /admin/: admin@elo.test / elo-admin-123 · moderador@elo.test / elo-mod-12345 · suporte@elo.test / elo-sup-12345');
  ctx.db.close();
})();
