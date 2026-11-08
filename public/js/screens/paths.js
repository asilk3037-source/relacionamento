import { html, raw, esc, api, view, art, icon, on, route, go, setMe, store, toast, errMsg, L, mediaUrl, confirmSheet, sheet, closeSheet, dateFmt } from '../core.js';
import { profileSheet } from './discover.js';

const when = (c) => { const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); return c.day === today ? 'hoje' : c.day === y ? 'ontem' : c.day.split('-').reverse().slice(0, 2).join('/'); };

export function bootPaths() {
  route('/paths', async () => {
    view(html`<div class="loading"><div class="spinner" role="status" aria-label="Carregando"></div></div>`);
    const r = await api('GET', '/paths');
    if (!r.consent) return view(html`<h1>Caminhos cruzados</h1>${art('paths-art', 'Ilustração abstrata de caminhos que se cruzam, sem mapa real', 'hero-art')}
      <p style="margin-top:14px">Descubra pessoas que provavelmente passaram perto de você, no mesmo período. É opcional e fica desligado até você ativar.</p>
      <ul class="stack small">
        <li><b>Estimativa, não prova.</b> Um cruzamento mostra que duas pessoas estiveram por perto em horários parecidos — nada além disso.</li>
        <li><b>Só com o app aberto.</b> Neste momento não coletamos em segundo plano.</li>
        <li><b>Nada exato.</b> Nunca mostramos pontos, rotas, horários exatos ou distâncias. Só “região”, dia e período.</li>
        <li><b>Os dois precisam participar</b>, combinar nas preferências e não ter bloqueio entre si.</li>
        <li><b>Retenção curta.</b> Sinais brutos duram até 24 horas e cruzamentos, até 7 dias. Você pode pausar ou revogar quando quiser, e tudo é apagado.</li></ul>
      <button class="btn primary block" data-act="paths-consent" style="margin-top:14px">Entendi, quero ativar</button><p class="small muted center">Seu consentimento é separado da permissão de localização do sistema.</p>`);
    const rows = r.items.map((c) => raw(`<button class="list-row" data-act="open-cross" data-id="${esc(c.user.id)}">${c.user.photos[0] ? `<img class="avatar" src="${esc(mediaUrl(c.user.photos[0].url))}" alt="">` : '<div class="avatar"></div>'}<span class="grow"><b>${esc(c.user.name)}, ${c.user.age}</b><br><small class="muted">Vocês podem ter cruzado caminhos ${when(c)} (${esc(c.period)}) · ${esc(c.area)}</small></span></button>`));
    view(html`<h1>Caminhos cruzados</h1>${art('paths-art', 'Ilustração abstrata de caminhos, não é um mapa real', 'hero-art')}
      <div class="setting"><span class="grow"><b>${r.paused ? 'Caminhos pausados' : 'Caminhos ativos'}</b><br><small class="muted">${r.paused ? 'Sem novas coletas nem sugestões.' : 'Coletando só com o app aberto.'}</small></span><button class="btn secondary" data-act="paths-pause" data-paused="${r.paused ? '0' : '1'}">${r.paused ? 'Retomar' : 'Pausar'}</button></div>
      ${r.paused ? raw('') : (rows.length ? rows : html`<div class="empty">${art('empty-paths', '', 'spot-art')}<h2>Nada por enquanto</h2><p>Sugestões levam pelo menos 1 hora para aparecer, e só quando há gente suficiente na região. Sem evidência, não inventamos cruzamentos.</p></div>`)}
      <button class="link" data-act="paths-revoke" style="margin-top:12px">Revogar consentimento e apagar dados dos Caminhos</button>`);
  });
}
on({
  async 'paths-consent'() { await api('POST', '/paths/consent'); setMe(await api('GET', '/me')); collector.sync(); go('#/paths'); toast('Caminhos ativados.'); },
  async 'paths-pause'(el) { await api('PUT', '/paths/pause', { paused: el.dataset.paused === '1' }); setMe(await api('GET', '/me')); collector.sync(); go('#/paths'); },
  async 'paths-revoke'() {
    const ok = await confirmSheet({ title: 'Revogar consentimento?', text: 'Vamos parar de coletar e apagar seus sinais e cruzamentos dos Caminhos. Você pode ativar de novo quando quiser.', ok: 'Revogar e apagar', danger: true });
    if (!ok) return; await api('DELETE', '/paths/consent'); setMe(await api('GET', '/me')); collector.sync(); go('#/paths'); toast('Consentimento revogado e dados apagados.');
  },
  'open-cross': (el) => profileSheet(el.dataset.id),
});

/** Coleta em primeiro plano: só com consentimento, sem pausa, app visível; um sinal a cada 5 min. */
export const collector = (() => {
  let watch = null, lastSent = 0;
  const stop = () => { if (watch !== null) { navigator.geolocation.clearWatch(watch); watch = null; } };
  const start = () => {
    if (watch !== null || !navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition(async (pos) => {
      if (Date.now() - lastSent < 5 * 60000 || pos.coords.accuracy > 100) return; lastSent = Date.now();
      try { await api('POST', '/paths/signal', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); } catch { /* tenta no próximo */ }
    }, () => stop(), { enableHighAccuracy: true, maximumAge: 60000, timeout: 30000 });
  };
  const sync = () => { const p = store.get().me?.paths; if (p && p.consent && !p.paused && document.visibilityState === 'visible') start(); else stop(); };
  document.addEventListener('visibilitychange', sync);
  return { sync, stop };
})();
