import { html, raw, str, api, view, art, icon, on, onForm, route, go, setMe, store, toast, errMsg, options, L, $, $$, mediaUrl } from '../core.js';
import { mountPhotos } from './photos.js';
import { locationSheet } from './location.js';

const TOTAL = 5;
const head = (n, title, sub) => html`<div class="steps" aria-label="Etapa ${n} de ${TOTAL}">${[1, 2, 3, 4, 5].map((i) => raw(`<i class="${i <= n ? 'on' : ''}"></i>`))}</div><h1>${title}</h1><p class="muted">${sub}</p>`;

export function bootOnboarding() {
  route('/onboarding/:step', async (step) => {
    const n = Number(step); const me = store.get().me;
    if (!me) return go('#/welcome');
    const p = me.profile;
    if (n === 1) return view(html`${art('onb-profile', '', 'spot-art')}${head(1, 'Como você quer aparecer?', 'Seu nome e o que você procura. Você pode mudar tudo depois.')}
      <form data-form="ob1">
        <label for="n">Nome de exibição</label><input id="n" name="displayName" maxlength="40" required value="${p.name || ''}" autocomplete="nickname">
        <label for="g">Gênero</label><select id="g" name="gender">${raw(options(L.gender, p.gender || 'nao_informar'))}</select>
        <label for="i">O que você procura</label><select id="i" name="intent" required>${raw(options(L.intent, p.intent || 'relacionamento'))}</select>
        <label for="b">Sobre você</label><textarea id="b" name="bio" maxlength="500" placeholder="Café sem pressa, música ao vivo e uma boa conversa…">${p.bio || ''}</textarea>
        <button class="btn primary block" type="submit" style="margin-top:18px">Continuar</button>
      </form>`, { nav: false });
    if (n === 2) {
      view(html`${head(2, 'Suas fotos', 'Adicione de 1 a 6 fotos suas. A primeira é a principal. Todas passam por revisão antes de aparecer.')}
      <div id="photo-area"></div>
      <button class="btn primary block" data-act="ob-photos-next" style="margin-top:18px">Continuar</button>
      <button class="btn ghost block" data-act="ob-back">Voltar</button>`, { nav: false });
      return mountPhotos($('#photo-area'));
    }
    if (n === 3) return view(html`${art('onb-interests', '', 'spot-art')}${head(3, 'O que você curte?', 'Escolha até 8 interesses, separados por vírgula. E, se quiser, conte mais sobre seu jeito de viver.')}
      <form data-form="ob3">
        <label for="it">Interesses</label><input id="it" name="interests" value="${(p.interests || []).join(', ')}" placeholder="Café, música, trilhas, cinema">
        <label for="sm">Você fuma?</label><select id="sm" name="smoking">${raw(options(L.smoking, p.smoking))}</select>
        <label for="ch">Filhos</label><select id="ch" name="children">${raw(options(L.children, p.children))}</select>
        <label for="dr">Bebidas alcoólicas</label><select id="dr" name="drinking">${raw(options(L.drinking, p.drinking))}</select>
        <label for="pt">Pets</label><select id="pt" name="pets">${raw(options(L.pets, p.pets))}</select>
        <p class="field-hint">Tudo opcional. “Prefiro não informar” é sempre uma opção.</p>
        <button class="btn primary block" type="submit" style="margin-top:18px">Continuar</button><button class="btn ghost block" type="button" data-act="ob-back">Voltar</button>
      </form>`, { nav: false });
    if (n === 4) { const pr = me.settings.prefs; return view(html`${art('onb-prefs', '', 'spot-art')}${head(4, 'Quem você quer conhecer?', 'Só mostramos pessoas que também combinam com o que você é. Dá para ajustar quando quiser.')}
      <form data-form="ob4">
        <label>Faixa de idade</label>
        <div class="range-row"><input name="ageMin" type="number" min="18" max="100" value="${pr.ageMin}" aria-label="Idade mínima"> <span>a</span> <input name="ageMax" type="number" min="18" max="100" value="${pr.ageMax}" aria-label="Idade máxima"></div>
        <label for="d">Distância máxima</label><select id="d" name="distanceKm">${raw([5, 10, 25, 50, 100, 200].map((k) => `<option value="${k}" ${k === pr.distanceKm ? 'selected' : ''}>${k} km</option>`).join(''))}</select>
        <label>Gêneros de interesse</label>
        <div class="chips" role="group" aria-label="Gêneros de interesse">${Object.entries(L.genderPref).map(([k, v]) => raw(`<button type="button" class="chip btnlike" data-act="toggle-pref" data-key="genders" data-val="${k}" aria-pressed="${pr.genders.includes(k)}">${v}</button>`))}</div>
        <p class="field-hint">Sem seleção, mostramos todas as pessoas compatíveis.</p>
        <label>Intenção</label>
        <div class="chips" role="group" aria-label="Intenções">${Object.entries(L.intent).map(([k, v]) => raw(`<button type="button" class="chip btnlike" data-act="toggle-pref" data-key="intents" data-val="${k}" aria-pressed="${pr.intents.includes(k)}">${v}</button>`))}</div>
        <button class="btn primary block" type="submit" style="margin-top:18px">Continuar</button><button class="btn ghost block" type="button" data-act="ob-back">Voltar</button>
      </form>`, { nav: false }); }
    if (n === 5) return view(html`${art('onb-location', '', 'spot-art')}${head(5, 'Perto de você', 'Usamos sua localização só para mostrar pessoas da sua região, em faixas de distância (como “menos de 5 km”). Nunca mostramos o ponto exato.')}
      <div class="card-surface stack"><p class="small muted">Você escolhe: usar a localização do aparelho enquanto o app está aberto, ou informar sua cidade manualmente. Se negar, o app continua funcionando.</p>
        <button class="btn primary block" data-act="ob-location">Definir minha região</button></div>
      <button class="btn secondary block" data-act="ob-finish" style="margin-top:14px">Concluir</button><button class="btn ghost block" data-act="ob-back">Voltar</button>`, { nav: false });
    go('#/onboarding/1');
  });

  const refresh = async () => setMe(await api('GET', '/me'));
  const step = () => Number(location.hash.split('/').pop());
  onForm({
    async ob1(f, v) { await api('PATCH', '/me/profile', v); await refresh(); go('#/onboarding/2'); },
    async ob3(f, v) { await api('PATCH', '/me/profile', { interests: v.interests.split(',').map((s) => s.trim()).filter(Boolean), smoking: v.smoking, children: v.children, drinking: v.drinking, pets: v.pets }); await refresh(); go('#/onboarding/4'); },
    async ob4(f, v) {
      const prefs = { ageMin: Number(v.ageMin), ageMax: Number(v.ageMax), distanceKm: Number(v.distanceKm), genders: $$('[data-key=genders][aria-pressed=true]').map((b) => b.dataset.val), intents: $$('[data-key=intents][aria-pressed=true]').map((b) => b.dataset.val) };
      await api('PUT', '/me/settings', { prefs }); await refresh(); go('#/onboarding/5');
    },
  });
  on({
    'toggle-pref': (el) => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'),
    'ob-back': () => go(`#/onboarding/${Math.max(1, step() - 1)}`),
    'ob-photos-next': async () => { await refresh(); go('#/onboarding/3'); },
    'ob-location': () => locationSheet(),
    async 'ob-finish'() { setMe(await api('PUT', '/me/settings', { onboardingDone: true })); toast('Tudo pronto! Boas conexões.'); go('#/discover'); },
  });
}
