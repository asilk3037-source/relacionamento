import { html, raw, str, esc, api, view, art, icon, on, onForm, route, go, setMe, store, toast, errMsg, sheet, closeSheet, options, L, $, $$, mediaUrl, onLeave } from '../core.js';
import { locationSheet } from './location.js';
import { upsell } from './plans.js';

let mode = (() => { try { return localStorage.getItem('elo.mode') || 'cards'; } catch { return 'cards'; } })();
let photoIdx = 0;
let loading = false;

const cover = (c, i = 0) => (c.photos[i] || c.photos[0]) ? mediaUrl((c.photos[i] || c.photos[0]).url) : null;
const photoTag = (c, cls, i = 0) => (cover(c, i) ? `<img class="${cls}" src="${esc(cover(c, i))}" alt="Foto de ${esc(c.name)}" draggable="false">` : `<div class="nophoto">${str(art('no-photo', ''))}</div>`);
export const facts = (c) => raw(`<div class="facts">${[
  c.smoking && c.smoking !== 'nao_informar' ? L.smoking[c.smoking] : null, c.children && c.children !== 'nao_informar' ? L.children[c.children] : null,
  c.drinking && c.drinking !== 'nao_informar' ? L.drinking[c.drinking] : null, c.pets && c.pets !== 'nao_informar' ? L.pets[c.pets] : null,
  c.heightCm ? `${c.heightCm} cm` : null, c.work || null, c.education || null].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</div>`);

async function fill() {
  if (loading) return; loading = true;
  try {
    const r = await api('GET', '/discover?limit=10');
    const me = store.get().me; if (r.quota) setMe({ quota: r.quota });
    const known = new Set(store.get().deck.map((c) => c.id));
    store.set({ deck: [...store.get().deck, ...(r.items || []).filter((c) => !known.has(c.id))], deckEnd: true, deckFlag: r.paused ? 'paused' : r.incomplete ? 'incomplete' : null });
    void me;
  } finally { loading = false; }
}

export function bootDiscover() {
  route('/discover', async () => {
    view(html`<div class="loading"><div class="spinner" role="status" aria-label="Carregando"></div></div>`, { cls: 'fit' });
    store.set({ deck: [], deckEnd: false });
    await fill(); draw();
  });
  route('/', () => go(store.get().me ? '#/discover' : '#/welcome'));
}

export function draw() {
  const s = store.get(); const me = s.me; const deck = s.deck;
  const q = me.quota || { remaining: '–', limit: '–' };
  const needLoc = !me.profile.city;
  const head = html`<div class="discover-head"><h1 class="grow">${me.profile.city || 'Descobrir'}</h1>
    <button class="icon-btn" data-act="toggle-mode" aria-label="${mode === 'cards' ? 'Ver em grade' : 'Ver em cartões'}">${icon(mode === 'cards' ? 'grid' : 'card')}</button>
    <button class="icon-btn" data-act="open-filters" aria-label="Filtros">${icon('filter')}</button></div>
    ${needLoc ? raw(`<button class="banner" data-act="open-location">${str(icon('pin'))}<span>Defina sua região para ver distâncias e pessoas por perto.</span></button>`) : ''}
    ${me.settings.onboardingDone && !(() => { try { return localStorage.getItem('elo.twodays'); } catch { return 1; } })() ? raw(`<button class="banner" data-act="two-days">${str(icon('spark'))}<span><b>Dê tempo às conexões.</b> Experimente por pelo menos 2 dias.</span></button>`) : ''}`;
  if (s.deckFlag === 'paused') return view(html`${head}<div class="empty">${art('empty-paused', '', 'spot-art')}<h2>Descoberta pausada</h2><p>Seu perfil não aparece para novas pessoas. Suas conversas continuam normais.</p><button class="btn primary" data-act="resume-discovery">Retomar descoberta</button></div>`, { cls: 'fit' });
  if (s.deckFlag === 'incomplete') return view(html`${head}<div class="empty">${art('empty-profile', '', 'spot-art')}<h2>Complete seu perfil</h2><p>Adicione nome e o que você procura para começar a conhecer pessoas.</p><a class="btn primary" href="#/edit">Completar perfil</a></div>`, { cls: 'fit' });
  if (!deck.length) return view(html`${head}<div class="empty">${art('empty-discover', '', 'spot-art')}<h2>Por aqui, você viu todo mundo</h2><p>Ajuste os filtros ou volte mais tarde — as pessoas entram em horários diferentes.</p><button class="btn primary" data-act="open-filters">Ajustar filtros</button> <button class="btn secondary" data-act="refresh-deck">Atualizar</button></div>`, { cls: 'fit' });

  const quota = raw(`<button class="pill-btn" data-act="go-plans" aria-label="Curtidas restantes hoje: ${q.remaining} de ${q.limit}">${str(icon('heart'))} ${q.remaining} de ${q.limit} curtidas hoje</button>`);
  if (mode === 'grid') {
    return view(html`${head}<div class="grid">${deck.map((c) => raw(`<button class="gcard" data-act="open-profile" data-id="${esc(c.id)}" aria-label="Ver perfil de ${esc(c.name)}, ${c.age} anos">${photoTag(c, 'photo')}<span class="cap">${esc(c.name)}, ${c.age}</span></button>`))}</div><p class="center" style="margin-top:14px">${quota}</p>`);
  }
  const top = deck[0], next = deck[1];
  photoIdx = 0;
  view(html`${head}
    <div class="deck" id="deck">
      ${next ? raw(`<div class="pcard under" aria-hidden="true">${photoTag(next, 'photo')}</div>`) : ''}
      <article class="pcard" id="topcard" aria-label="${esc(top.name)}, ${top.age} anos">
        ${raw(photoTag(top, 'photo'))}<div class="shade"></div>
        ${top.photos.length > 1 ? raw(`<div class="bars" aria-hidden="true">${top.photos.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`) : ''}
        ${top.demo ? raw('<span class="demo-tag">Perfil de demonstração</span>') : ''}
        <span class="stamp like">CURTIR</span><span class="stamp nope">PASSAR</span>
        <div class="info"><span class="badge">${L.intent[top.intent] || ''}</span><h2>${top.name}, ${top.age}</h2><div class="small">${top.distance ? `Na sua região · ${top.distance}` : 'Na sua região'}</div></div>
        <button class="icon-btn info-btn" data-act="open-profile" data-id="${top.id}" aria-label="Ver perfil completo de ${top.name}">${icon('info')}</button>
      </article>
    </div>
    <div class="row" style="justify-content:space-between;flex-shrink:0"><span class="chips">${top.interests.slice(0, 3).map((i) => raw(`<span class="chip">${esc(i)}</span>`))}</span>${quota}</div>
    <div class="actions"><button class="act" data-act="undo" aria-label="Desfazer última dispensa">${icon('undo')}</button><button class="act" data-act="pass" aria-label="Passar ${top.name}">${icon('x')}</button><button class="act like" data-act="like" aria-label="Curtir ${top.name}">${icon('heart')}</button><button class="act" data-act="more" aria-label="Mais opções para ${top.name}">${icon('more')}</button></div>`, { cls: 'fit' });
  attachSwipe();
}

function attachSwipe() {
  const el = $('#topcard'); if (!el) return;
  let x0 = null, y0 = 0, dx = 0, moved = false, rect;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; rect = el.getBoundingClientRect(); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (x0 === null) return; dx = e.clientX - x0; if (Math.abs(dx) > 8) moved = true;
    el.style.transition = 'none'; el.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    $('.stamp.like', el).style.opacity = Math.max(0, Math.min(1, dx / 90)); $('.stamp.nope', el).style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = (e) => {
    if (x0 === null) return; const d = dx; x0 = null; el.style.transition = 'transform .2s';
    if (Math.abs(d) > 90) return decide(d > 0 ? 'like' : 'pass', d > 0 ? 1 : -1);
    el.style.transform = ''; $$('.stamp', el).forEach((s) => { s.style.opacity = 0; });
    if (!moved && e.type === 'pointerup') { // toque: trocar foto
      const c = store.get().deck[0]; if (c && c.photos.length > 1) { const left = e.clientX - rect.left < rect.width / 2; photoIdx = (photoIdx + (left ? -1 : 1) + c.photos.length) % c.photos.length; $('.photo', el).src = cover(c, photoIdx); $$('.bars i', el).forEach((b, i) => b.classList.toggle('on', i === photoIdx)); }
    }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

async function decide(kind, dir = kind === 'like' ? 1 : -1) {
  const s = store.get(); const c = s.deck[0]; if (!c) return;
  const el = $('#topcard');
  if (el) { el.style.transition = 'transform .22s, opacity .22s'; el.style.transform = `translateX(${dir * 520}px) rotate(${dir * 18}deg)`; el.style.opacity = 0; }
  await new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200));
  store.set({ deck: s.deck.slice(1) });
  try {
    if (kind === 'pass') { await api('POST', `/discover/${c.id}/pass`); }
    else {
      const r = await api('POST', `/discover/${c.id}/like`);
      setMe({ quota: r.quota });
      if (r.status === 'matched') matchSheet(c, r.matchId);
    }
  } catch (e) {
    store.set({ deck: [c, ...store.get().deck] }); // devolve o cartão: nada foi consumido
    if (e.code === 'daily_limit') { setMe({ quota: e.data.quota }); limitSheet(e.data.quota); } else toast(errMsg(e));
  }
  if (store.get().deck.length < 3 && !loading) await fill().catch(() => {});
  if (location.hash === '#/discover') draw();
}

function matchSheet(c, matchId) {
  const me = store.get().me;
  sheet(html`<div class="match-pop">${art('match', '', 'spot-art')}<div class="pair">${raw(me.profile.photos[0] ? `<img src="${esc(mediaUrl(me.profile.photos[0].url))}" alt="Você">` : '')}${raw(c.photos[0] ? `<img src="${esc(mediaUrl(c.photos[0].url))}" alt="${esc(c.name)}">` : '')}</div>
    <h2>Um novo elo!</h2><p class="muted">Você e ${c.name} se curtiram. Uma boa conversa pode começar agora.</p>
    <div class="row-actions"><a class="btn primary" href="#/chat/${matchId}" data-act="close-sheet">Dar o primeiro oi</a><button class="btn ghost" data-act="close-sheet">Continuar explorando</button></div></div>`);
}
function limitSheet(q) {
  const t = new Date(q.renewsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  sheet(html`${art('limit', '', 'spot-art')}<h2>Por hoje, você chegou ao limite</h2><p class="muted">Você usou ${q.used} de ${q.limit} curtidas. O saldo renova à meia-noite (horário de Brasília, ${t} do seu aparelho). Passar perfis e conversar com seus matches continua liberado.</p>
    <div class="row-actions"><a class="btn primary" href="#/plans" data-act="close-sheet">Ver limites dos planos</a><button class="btn ghost" data-act="close-sheet">Continuar no meu plano</button></div>`);
}

export async function profileSheet(id, { actions = true } = {}) {
  const c = await api('GET', `/profiles/${id}`);
  const first = c.photos[0];
  sheet(html`${first ? raw(`<img class="portrait" src="${esc(mediaUrl(first.url))}" alt="Foto de ${esc(c.name)}">`) : ''}
    <h2>${c.name}, ${c.age}</h2><p><span class="badge">${L.intent[c.intent] || ''}</span> ${c.distance ? raw(`<span class="small muted">· ${esc(c.distance)}</span>`) : ''} ${c.demo ? raw('<span class="badge warn">Perfil de demonstração</span>') : ''}</p>
    ${c.bio ? raw(`<h3>Sobre mim</h3><p>${esc(c.bio)}</p>`) : ''}
    ${c.interests.length ? raw(`<h3>O que eu curto</h3><div class="chips">${c.interests.map((i) => `<span class="chip">${esc(i)}</span>`).join('')}</div>`) : ''}
    <h3 style="margin-top:14px">Meu jeito de viver</h3>${facts(c)}
    ${actions ? raw(`<div class="row-actions"><button class="btn primary" data-act="like-from-sheet" data-id="${esc(c.id)}">Curtir perfil</button><button class="btn ghost" data-act="safety" data-id="${esc(c.id)}">Bloquear ou denunciar</button></div>`) : ''}`);
}

function filtersSheet() {
  const pr = store.get().me.settings.prefs;
  sheet(html`<h2>Seu tipo de conexão</h2>
    <form data-form="filters">
      <label>Faixa de idade</label><div class="range-row"><input name="ageMin" type="number" min="18" max="100" value="${pr.ageMin}" aria-label="Idade mínima"> <span>a</span> <input name="ageMax" type="number" min="18" max="100" value="${pr.ageMax}" aria-label="Idade máxima"></div>
      <label for="fd">Distância máxima</label><select id="fd" name="distanceKm">${raw([5, 10, 25, 50, 100, 200].map((k) => `<option value="${k}" ${k === pr.distanceKm ? 'selected' : ''}>${k} km</option>`).join(''))}</select>
      <label>Quem você quer conhecer</label><div class="chips">${Object.entries(L.genderPref).map(([k, v]) => raw(`<button type="button" class="chip btnlike" data-act="toggle-pref" data-key="genders" data-val="${k}" aria-pressed="${pr.genders.includes(k)}">${v}</button>`))}</div>
      <label>Intenção</label><div class="chips">${Object.entries(L.intent).map(([k, v]) => raw(`<button type="button" class="chip btnlike" data-act="toggle-pref" data-key="intents" data-val="${k}" aria-pressed="${pr.intents.includes(k)}">${v}</button>`))}</div>
      <p class="field-hint">Sem seleção, mostramos todas as pessoas compatíveis. Só ampliamos filtros quando você pede.</p>
      <button class="btn primary block" type="submit" style="margin-top:16px">Aplicar filtros</button></form>`);
}

on({
  'toggle-mode'() { mode = mode === 'cards' ? 'grid' : 'cards'; try { localStorage.setItem('elo.mode', mode); } catch { /* ok */ } draw(); },
  'open-filters': () => filtersSheet(),
  'open-location': () => locationSheet(),
  'two-days'() {
    try { localStorage.setItem('elo.twodays', '1'); } catch { /* ok */ }
    sheet(html`<h2>Dê tempo às conexões</h2><p>Sugerimos manter o app instalado por pelo menos dois dias e voltar para explorar novos perfis. As pessoas entram em horários diferentes.</p><p class="small muted">É uma sugestão de uso: não há espera obrigatória, nem garantia de curtidas ou matches, e você não precisa deixar o app aberto.</p><button class="btn primary block" data-act="close-sheet">Entendi</button>`, { onClose: draw });
  },
  'go-plans': () => go('#/plans'),
  async 'refresh-deck'() { store.set({ deck: [] }); await fill(); draw(); },
  async 'resume-discovery'() { setMe(await api('PUT', '/me/settings', { pauseDiscovery: false })); store.set({ deck: [] }); await fill(); draw(); },
  like: () => decide('like'),
  pass: () => decide('pass'),
  async undo() {
    try { const r = await api('POST', '/discover/undo'); store.set({ deck: [r.profile, ...store.get().deck] }); draw(); toast('Último perfil dispensado voltou.'); }
    catch (e) { if (e.code === 'plan_required') upsell('Dê uma segunda olhada', 'Desfazer a última dispensa faz parte do Elo Plus e do Premium.'); else toast(errMsg(e)); }
  },
  more: () => import('./safety.js').then((m) => m.safetySheet(store.get().deck[0].id, store.get().deck[0].name)),
  safety: (el) => import('./safety.js').then((m) => m.safetySheet(el.dataset.id)),
  'open-profile': (el) => profileSheet(el.dataset.id),
  async 'like-from-sheet'(el) {
    const id = el.dataset.id; closeSheet();
    const c = store.get().deck.find((x) => x.id === id) || { id, name: 'essa pessoa', photos: [] };
    try {
      const r = await api('POST', `/discover/${id}/like`); setMe({ quota: r.quota });
      store.set({ deck: store.get().deck.filter((x) => x.id !== id) });
      if (r.status === 'matched') matchSheet(c, r.matchId); else toast('Curtida enviada.');
      if (location.hash === '#/discover') draw();
    } catch (e) { if (e.code === 'daily_limit') limitSheet(e.data.quota); else toast(errMsg(e)); }
  },
});
onForm({
  async filters(f, v) {
    const prefs = { ageMin: Number(v.ageMin), ageMax: Number(v.ageMax), distanceKm: Number(v.distanceKm), genders: $$('[data-key=genders][aria-pressed=true]').map((b) => b.dataset.val), intents: $$('[data-key=intents][aria-pressed=true]').map((b) => b.dataset.val) };
    setMe(await api('PUT', '/me/settings', { prefs })); closeSheet(); store.set({ deck: [] }); await fill(); draw(); toast('Filtros aplicados.');
  },
});
