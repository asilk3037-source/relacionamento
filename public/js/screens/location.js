import { html, raw, api, sheet, closeSheet, on, setMe, toast, errMsg, store } from '../core.js';

export async function locationSheet() {
  const { cities } = await api('GET', '/cities');
  const me = store.get().me;
  sheet(html`<h2>Sua região</h2>
    <p class="muted">${me.profile.city ? `Hoje: ${me.profile.city} (${me.profile.locationSource === 'manual' ? 'cidade escolhida por você' : 'localização do aparelho'}).` : 'Ainda não definida.'} Mostramos apenas faixas de distância, nunca seu ponto exato.</p>
    <button class="btn primary block" data-act="loc-gps">Usar a localização do aparelho</button>
    <p class="small muted center" style="margin:10px 0">ou escolha sua cidade</p>
    <div class="chips">${cities.map((c) => raw(`<button class="chip btnlike" data-act="loc-city" data-id="${c.id}">${c.name}</button>`))}</div>`);
}
const done = async () => { setMe(await api('GET', '/me')); closeSheet(); toast('Região atualizada.'); };
on({
  'loc-gps': () => new Promise((resolve) => {
    if (!navigator.geolocation) { toast('Este aparelho não oferece localização. Escolha sua cidade.'); return resolve(); }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { await api('PUT', '/me/location', { mode: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); await done(); } catch (e) { toast(errMsg(e)); }
      resolve();
    }, () => { toast('Sem permissão de localização. Você pode escolher sua cidade.'); resolve(); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }),
  async 'loc-city'(el) { await api('PUT', '/me/location', { mode: 'manual', cityId: el.dataset.id }); await done(); },
});
