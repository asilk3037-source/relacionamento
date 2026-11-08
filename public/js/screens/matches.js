import { html, raw, str, esc, api, view, art, icon, on, route, go, setMe, store, toast, errMsg, L, mediaUrl, onLeave, renderNav, timeFmt, dateTimeFmt, sheet, closeSheet, onForm, $ } from '../core.js';
import { upsell } from './plans.js';
import { profileSheet } from './discover.js';
import { safetySheet } from './safety.js';

const av = (c, cls = 'avatar') => (c.photos[0] ? `<img class="${cls}" src="${esc(mediaUrl(c.photos[0].url))}" alt="">` : `<div class="${cls}"></div>`);
let tab = 'matches';

export function bootMatches() {
  route('/matches', async () => {
    view(html`<div class="loading"><div class="spinner" role="status" aria-label="Carregando"></div></div>`);
    const [m, l] = await Promise.all([api('GET', '/matches'), api('GET', '/likes')]);
    const body = tab === 'matches'
      ? (m.matches.length ? m.matches.map((x) => raw(`<a class="list-row" href="#/chat/${x.id}">${av(x.user)}<span class="grow"><b>${esc(x.user.name)}, ${x.user.age}</b><br><small class="muted">${x.last ? 'Continuar conversa' : 'Que tal dar o primeiro oi?'}</small></span>${str(icon('chats'))}</a>`)) : html`<div class="empty">${art('empty-matches', '', 'spot-art')}<h2>Seus matches aparecem aqui</h2><p>Quando duas pessoas se curtem, a conversa é liberada gratuitamente.</p><a class="btn primary" href="#/discover">Descobrir pessoas</a></div>`)
      : likesBody(l);
    view(html`<h1>Matches</h1>
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'matches'}" data-act="tab" data-tab="matches">Matches (${m.matches.length})</button><button role="tab" aria-selected="${tab === 'likes'}" data-act="tab" data-tab="likes">Quem curtiu você (${l.count})</button></div>${body}`);
  });
  route('/chats', async () => {
    view(html`<div class="loading"><div class="spinner" role="status" aria-label="Carregando"></div></div>`);
    const draw = async () => {
      const { matches } = await api('GET', '/matches');
      store.set({ unreadChats: matches.reduce((n, x) => n + (x.unread ? 1 : 0), 0) });
      view(html`<h1>Conversas</h1>${matches.length ? matches.map((x) => raw(`<a class="list-row" href="#/chat/${x.id}">${av(x.user)}<span class="grow"><b>${esc(x.user.name)}</b><br><small class="muted">${x.last ? esc((x.last.mine ? 'Você: ' : '') + x.last.body) : 'Diga oi 👋'}</small></span>${x.unread ? `<span class="badge">${x.unread}</span>` : ''}</a>`)) : html`<div class="empty">${art('empty-chat', '', 'spot-art')}<h2>Nenhuma conversa ainda</h2><p>Dê match com alguém para começar a conversar.</p></div>`}`);
    };
    await draw(); const t = setInterval(() => draw().catch(() => {}), 12000); onLeave(() => clearInterval(t));
  });
  route('/chat/:id', async (id) => chat(Number(id)));
}

function likesBody(l) {
  if (l.locked) return html`<div class="card-surface center">${art('likes-locked', '', 'spot-art')}<h2>${l.count ? `${l.count} ${l.count === 1 ? 'pessoa curtiu' : 'pessoas curtiram'} você` : 'Ninguém novo por aqui ainda'}</h2><p class="muted">Ver quem curtiu faz parte do Elo Plus e do Premium. Você continua podendo curtir, dar match e conversar de graça.</p>${l.count ? raw('<button class="btn primary" data-act="likes-upsell">Ver quem curtiu</button>') : ''}</div>`;
  if (!l.items.length) return html`<div class="empty">${art('empty-likes', '', 'spot-art')}<h2>Sem novas curtidas</h2><p>Quando alguém curtir você, aparece aqui.</p></div>`;
  return html`<div class="grid">${l.items.map((c) => raw(`<button class="gcard" data-act="open-profile" data-id="${esc(c.id)}" aria-label="Ver perfil de ${esc(c.name)}">${c.photos[0] ? `<img class="photo" src="${esc(mediaUrl(c.photos[0].url))}" alt="">` : ''}<span class="cap">${esc(c.name)}, ${c.age}</span></button>`))}</div>`;
}

// ---- Chat ----
async function chat(id) {
  let data = await api('GET', `/matches/${id}/messages`);
  const pending = []; // mensagens ainda não confirmadas pelo servidor
  let last = 0;
  const bubble = (m) => {
    if (m.kind === 'system') return `<div class="msg system">${esc(m.body)}</div>`;
    if (m.kind === 'invite' && m.invite) {
      const iv = m.invite; const st = { proposed: 'Aguardando resposta', accepted: 'Aceito ✓', declined: 'Recusado', cancelled: 'Cancelado' }[iv.status];
      const btns = iv.status === 'proposed' && !iv.mine ? `<div class="row" style="margin-top:8px"><button class="btn primary" data-act="invite" data-do="accept" data-id="${iv.id}">Aceitar</button><button class="btn secondary" data-act="invite" data-do="decline" data-id="${iv.id}">Não posso</button></div>` : (iv.mine && ['proposed', 'accepted'].includes(iv.status) ? `<button class="link" data-act="invite" data-do="cancel" data-id="${iv.id}">Cancelar convite</button>` : '');
      return `<div class="msg invite">${str(icon('coffee'))} <b>Bora tomar um café?</b><br>${esc(iv.place)}<br><span class="small">${dateTimeFmt(iv.when)} · ${st}</span>${btns}</div>`;
    }
    return `<div class="msg ${m.mine ? 'mine' : ''} ${m.failed ? 'failed' : ''}">${esc(m.body)}<span class="meta">${m.failed ? 'Não enviada · <button class="link" data-act="retry" data-cid="' + esc(m.clientId) + '">Tentar de novo</button>' : m.pending ? 'Enviando…' : timeFmt(m.at)}</span></div>`;
  };
  const paint = (keep) => {
    const list = $('.msgs'); const stick = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const html_ = [...data.messages, ...pending].map(bubble).join('') || '<p class="muted center">Comece com algo que vocês têm em comum.</p>';
    if (list) { list.innerHTML = html_; if (stick || keep) list.scrollTop = list.scrollHeight; }
  };
  const u = data.match.user;
  view(html`<div class="chat-head"><a class="icon-btn" href="#/chats" aria-label="Voltar para conversas">${icon('back')}</a><button class="row grow" data-act="open-profile" data-id="${u.id}" style="text-align:left">${raw(av(u, 'avatar" style="width:44px;height:50px'))}<b>${u.name}</b></button><button class="icon-btn" data-act="chat-more" aria-label="Mais opções">${icon('more')}</button></div>
    <div class="msgs" id="msgs" role="log" aria-live="polite" aria-label="Mensagens"></div>
    <div class="row" style="padding-top:6px"><button class="chip btnlike" data-act="new-invite">${icon('coffee')} Bora tomar um café?</button></div>
    <form class="composer" data-form="send"><label for="mtext" class="sr-only">Mensagem</label><textarea id="mtext" name="body" rows="1" maxlength="2000" placeholder="Escreva sua mensagem…" required></textarea><button class="btn primary" type="submit" aria-label="Enviar mensagem" style="width:52px;padding:0">${icon('send')}</button></form>`, { nav: false, cls: 'fit' });
  paint(true); await api('POST', `/matches/${id}/read`).catch(() => {});
  last = data.messages.length ? data.messages[data.messages.length - 1].id : 0;
  const poll = async () => {
    try {
      const r = await api('GET', `/matches/${id}/messages?after=0`); // reflete mudanças de convites
      data = r; paint(); await api('POST', `/matches/${id}/read`).catch(() => {});
    } catch (e) { if (e.code === 'match_ended' || e.status === 404) { clearInterval(t); toast('Esta conversa foi encerrada.'); go('#/chats'); } }
  };
  const t = setInterval(poll, 4000); onLeave(() => clearInterval(t));
  chatCtx = { id, pending, paint, poll, data: () => data };
  const ta = $('#mtext'); ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); ta.form.requestSubmit(); } });
  void last;
}
let chatCtx = null;
async function deliver(m) {
  const c = chatCtx; if (!c) return;
  try {
    await api('POST', `/matches/${c.id}/messages`, { clientId: m.clientId, body: m.body });
    c.pending.splice(c.pending.indexOf(m), 1); await c.poll();
  } catch (e) {
    if (e.code === 'match_ended') { toast('Esta conversa foi encerrada.'); return go('#/chats'); }
    m.pending = false; m.failed = true; c.paint(true);
  }
}
onForm({
  async send(f, v) {
    const body = (v.body || '').trim(); if (!body || !chatCtx) return;
    const m = { clientId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), body, mine: true, pending: true };
    chatCtx.pending.push(m); f.reset(); chatCtx.paint(true); await deliver(m);
  },
  async invite(f, v) {
    const when = new Date(v.when).getTime();
    await api('POST', `/matches/${chatCtx.id}/invites`, { place: v.place, when }); closeSheet(); await chatCtx.poll(); toast('Convite enviado.');
  },
});
on({
  tab(el) { tab = el.dataset.tab; go('#/matches'); },
  'likes-upsell': () => upsell('Veja quem curtiu você', 'Descubra quem já demonstrou interesse e curta de volta. Faz parte do Elo Plus e do Premium.'),
  retry(el) { const m = chatCtx.pending.find((x) => x.clientId === el.dataset.cid); if (m) { m.failed = false; m.pending = true; chatCtx.paint(true); deliver(m); } },
  'new-invite'() {
    const d = new Date(Date.now() + 2 * 86400000); d.setHours(16, 0, 0, 0); const iso = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    sheet(html`<h2>Bora tomar um café?</h2><p class="muted">Sugira um local público e um horário. O convite fica só entre vocês dois e não reserva nem confirma nada.</p>
      <form data-form="invite"><label for="ip">Local público</label><input id="ip" name="place" maxlength="80" required placeholder="Ex.: Café da Praça da Liberdade"><label for="iw">Data e hora</label><input id="iw" name="when" type="datetime-local" required value="${iso}"><button class="btn primary block" type="submit" style="margin-top:16px">Enviar convite</button></form>`);
  },
  async invite(el) { await api('POST', `/invites/${el.dataset.id}/${el.dataset.do}`); await chatCtx.poll(); },
  'chat-more'() {
    const u = chatCtx.data().match.user;
    sheet(html`<h2>${u.name}</h2><div class="row-actions"><button class="btn secondary" data-act="chat-safety">Bloquear ou denunciar</button><button class="btn secondary" data-act="unmatch">Desfazer match</button></div>`);
  },
  'chat-safety'() { const u = chatCtx.data().match.user; safetySheet(u.id, u.name, chatCtx.id); },
  async unmatch() { await api('DELETE', `/matches/${chatCtx.id}`); closeSheet(); toast('Match desfeito. A conversa foi encerrada.'); go('#/chats'); },
});
