// Núcleo do app: template seguro, API, estado, rotas, sheets, arte e rótulos.
const SAFE = Symbol('safe');
export const raw = (s) => ({ [SAFE]: String(s ?? '') });
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Template com escape automático de todas as interpolações (use raw() só para HTML confiável). */
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += (Array.isArray(v) ? v.map(part).join('') : part(v)) + strings[i + 1]; });
  return raw(out);
}
const part = (v) => (v && typeof v === 'object' && SAFE in v ? v[SAFE] : v === false || v == null ? '' : esc(v));
export const str = (r) => (r && r[SAFE] !== undefined ? r[SAFE] : String(r ?? ''));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---- Ícones (traço fino, 24x24) ----
const ICONS = {
  discover: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  paths: '<path d="M5 4v8a5 5 0 0 0 5 5h9M15 13l4 4-4 4M19 4v3a5 5 0 0 1-5 5H5"/>',
  matches: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z"/>',
  chats: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  card: '<rect x="6" y="3" width="12" height="18" rx="3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  logo: '<rect x="4" y="8" width="20" height="25" rx="10" transform="rotate(-25 14 20) scale(.6)"/><rect x="17" y="7" width="19" height="25" rx="9" transform="rotate(25 26 20) scale(.6)"/>',
};
export const icon = (n, cls = '') => raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`);
export const logoMark = () => raw('<svg class="logo-mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="5" aria-hidden="true"><rect x="4" y="8" width="20" height="25" rx="10" transform="rotate(-25 14 20)"/><rect x="17" y="7" width="19" height="25" rx="9" transform="rotate(25 26 20)"/></svg>');

// ---- Arte: usa a imagem gerada por IA (.webp) quando existir; senão o placeholder .svg ----
export const art = (key, alt = '', cls = '') => raw(`<img class="art ${esc(cls)}" data-art="${esc(key)}" src="/assets/art/${esc(key)}.${esc((window.ELO_ART || {})[key] || 'svg')}" alt="${esc(alt)}" ${alt ? '' : 'role="presentation"'} loading="lazy" decoding="async">`);
/** Descobre quais artes finais (geradas por IA) existem; as demais usam o placeholder .svg. */
export async function loadArtManifest() { try { window.ELO_ART = await (await fetch((window.ELO_API_BASE || '') + '/art-manifest.json')).json(); } catch { window.ELO_ART = {}; } }
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLImageElement) || !el.dataset.art) return;
  if (!el.src.endsWith('.svg')) el.src = `/assets/art/${el.dataset.art}.svg`; else el.style.visibility = 'hidden';
}, true);

// ---- Rótulos ----
export const L = {
  gender: { mulher: 'Mulher', homem: 'Homem', nao_binario: 'Não binário', outra: 'Outra identidade', nao_informar: 'Prefiro não informar' },
  genderPref: { mulher: 'Mulheres', homem: 'Homens', nao_binario: 'Pessoas não binárias', outra: 'Outras identidades' },
  intent: { relacionamento: 'Relacionamento', conhecer: 'Conhecer pessoas', casual: 'Algo casual', descobrindo: 'Ainda estou descobrindo' },
  smoking: { nao_fumo: 'Não fumo', as_vezes: 'Fumo às vezes', fumo: 'Fumo', parando: 'Estou parando', nao_informar: 'Prefiro não informar' },
  children: { tenho: 'Tenho filhos', nao_tenho: 'Não tenho filhos', nao_informar: 'Prefiro não informar' },
  drinking: { nao_bebo: 'Não bebo', socialmente: 'Socialmente', bebo: 'Bebo', nao_informar: 'Prefiro não informar' },
  pets: { tenho_cachorro: 'Tenho cachorro', tenho_gato: 'Tenho gato', tenho_outros: 'Tenho outros pets', gosto: 'Gosto de animais', nao_tenho: 'Não tenho pets', nao_informar: 'Prefiro não informar' },
};
export const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateFmt = (ms) => new Date(ms).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
export const dateTimeFmt = (ms) => new Date(ms).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const timeFmt = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const options = (map, value) => Object.entries(map).map(([k, v]) => `<option value="${esc(k)}" ${k === value ? 'selected' : ''}>${esc(v)}</option>`).join('');

// ---- API ----
export class ApiError extends Error { constructor(status, body) { super(body?.error?.message || 'Algo deu errado.'); this.status = status; this.code = body?.error?.code; this.data = body?.error || {}; } }
const base = () => window.ELO_API_BASE || '';
const tok = { get: () => { try { return localStorage.getItem('elo.token'); } catch { return null; } }, set: (t) => { try { t ? localStorage.setItem('elo.token', t) : localStorage.removeItem('elo.token'); } catch { /* sem storage */ } } };
export const token = tok;
export async function api(method, path, body, opts = {}) {
  const headers = {};
  const t = tok.get(); if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (opts.raw) { payload = opts.raw; headers['Content-Type'] = opts.type || 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(base() + '/api' + path, { method, headers, body: payload }); }
  catch { throw new ApiError(0, { error: { code: 'offline', message: 'Sem conexão. Verifique sua internet e tente de novo.' } }); }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && t && !opts.noAuthRedirect) { tok.set(null); store.set({ me: null }); location.hash = '#/welcome'; }
    throw new ApiError(res.status, data);
  }
  return data;
}
export const mediaUrl = (u) => (u && u.startsWith('/') ? base() + u : u);

// ---- Estado ----
const subs = new Set();
export const store = {
  s: { me: null, deck: [], deckEnd: false },
  get: () => store.s,
  set(p) { Object.assign(store.s, p); subs.forEach((f) => f(store.s)); },
  sub(f) { subs.add(f); return () => subs.delete(f); },
};
export const setMe = (data) => { const me = { ...(store.s.me || {}), ...data }; delete me.token; store.set({ me }); applyTheme(me.settings?.theme); return me; };
export function applyTheme(theme) {
  const t = theme || (() => { try { return localStorage.getItem('elo.theme'); } catch { return null; } })() || 'system';
  try { localStorage.setItem('elo.theme', t); } catch { /* sem storage */ }
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]')?.setAttribute('content', dark ? '#191A1D' : '#F3F6FA');
}

// ---- Toast, sheets e confirmação ----
let toastTimer;
export function toast(msg, ms = 3400) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
export const errMsg = (e) => (e instanceof ApiError ? e.message : 'Algo deu errado. Tente novamente.');
let sheetCloser = null;
export function sheet(content, { onClose, cls = '' } = {}) {
  closeSheet();
  const wrap = $('#sheet');
  wrap.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet ${esc(cls)}" role="dialog" aria-modal="true" tabindex="-1"><button class="sheet-close icon-btn" data-act="close-sheet" aria-label="Fechar">${str(icon('x'))}</button>${str(content)}</div>`;
  wrap.classList.add('open');
  const dlg = $('.sheet', wrap); dlg.focus({ preventScroll: true });
  sheetCloser = onClose || null;
  return dlg;
}
export function closeSheet() {
  const wrap = $('#sheet'); if (!wrap.classList.contains('open')) return;
  wrap.classList.remove('open'); wrap.innerHTML = '';
  const f = sheetCloser; sheetCloser = null; f && f();
}
export function confirmSheet({ title, text, ok = 'Confirmar', danger = false, fields = '' }) {
  return new Promise((resolve) => {
    let done = false;
    sheet(html`<h2>${title}</h2><p>${text}</p>${raw(fields)}<div class="row-actions"><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-ok">${ok}</button><button class="btn ghost" data-act="close-sheet">Agora não</button></div>`, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    $('[data-act=confirm-ok]').addEventListener('click', () => {
      const vals = {}; $$('#sheet [name]').forEach((i) => { vals[i.name] = i.value; });
      done = true; closeSheet(); resolve(vals);
    });
  });
}

// ---- Eventos delegados ----
const actions = {}; const forms = {};
export const on = (map) => Object.assign(actions, map);
export const onForm = (map) => Object.assign(forms, map);
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'close-sheet') { if (!el.getAttribute('href')) e.preventDefault(); return closeSheet(); } // links com href seguem a navegação
  const fn = actions[act]; if (fn) { e.preventDefault(); Promise.resolve(fn(el, e)).catch((err) => toast(errMsg(err))); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); const fn = forms[f.dataset.form];
  if (!fn) return;
  const btn = $('[type=submit]', f); btn && (btn.disabled = true);
  Promise.resolve(fn(f, Object.fromEntries(new FormData(f)))).catch((err) => toast(errMsg(err))).finally(() => { btn && (btn.disabled = false); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---- Rotas ----
const routes = [];
export const route = (pattern, fn) => routes.push({ re: new RegExp('^' + pattern.replace(/:[a-z]+/gi, '([^/]+)') + '$'), fn });
export const go = (hash) => { if (location.hash === hash) renderRoute(); else location.hash = hash; };
let cleanup = null;
export const onLeave = (f) => { cleanup = f; };
export async function renderRoute() {
  if (cleanup) { try { cleanup(); } catch { /* ok */ } cleanup = null; }
  closeSheet();
  const path = location.hash.replace(/^#/, '') || '/';
  for (const r of routes) { const m = r.re.exec(path); if (m) { try { await r.fn(...m.slice(1).map(decodeURIComponent)); } catch (e) { view(html`<div class="empty">${art('error', '')}<h2>Não deu certo</h2><p>${errMsg(e)}</p><button class="btn primary" data-act="reload">Tentar de novo</button></div>`); } return; } }
  go('#/');
}
export function view(content, { nav = true, cls = '' } = {}) {
  const v = $('#view'); v.className = 'view ' + cls; v.innerHTML = str(content); v.scrollTop = 0;
  document.body.classList.toggle('no-nav', !nav);
  $('#nav').hidden = !nav;
  if (nav) renderNav();
  const h = $('h1, h2', v); if (h) { h.setAttribute('tabindex', '-1'); }
}
export function renderNav() {
  const cur = (location.hash.replace(/^#\//, '').split('/')[0]) || 'discover';
  const active = { discover: 'discover', paths: 'paths', matches: 'matches', chats: 'chats', chat: 'chats', me: 'me', edit: 'me', settings: 'me', plans: 'me', popularity: 'me' }[cur];
  const unread = store.s.unreadChats || 0;
  $('#nav').innerHTML = [['discover', 'Descobrir'], ['paths', 'Caminhos'], ['matches', 'Matches'], ['chats', 'Conversas'], ['me', 'Meu perfil']].map(([k, t]) =>
    `<a href="#/${k}" class="${active === k ? 'active' : ''}" ${active === k ? 'aria-current="page"' : ''}>${str(icon(k))}<span>${t}</span>${k === 'chats' && unread ? `<i class="dot" aria-label="${unread} novas">${unread > 9 ? '9+' : unread}</i>` : ''}</a>`).join('');
}
