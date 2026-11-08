import { html, raw, esc, api, view, art, icon, on, onForm, route, go, setMe, store, toast, errMsg, sheet, closeSheet, confirmSheet, options, L, mediaUrl, dateFmt, dateTimeFmt, applyTheme, token, $, $$ } from '../core.js';
import { mountPhotos } from './photos.js';
import { locationSheet } from './location.js';
import { facts } from './discover.js';
import { upsell } from './plans.js';

const THEMES = { system: 'Acompanhar o sistema', light: 'Claro (branco e azul)', dark: 'Escuro (grafite e laranja)' };
const sw = (id, on_, label, sub = '') => raw(`<div class="setting"><span class="grow"><label for="${id}" style="margin:0">${esc(label)}</label>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</span><button id="${id}" class="switch" role="switch" aria-checked="${on_}" data-act="toggle-setting" data-key="${id}"></button></div>`);

export function bootMe() {
  route('/me', async () => {
    const me = store.get().me; const p = me.profile; const pl = me.plan;
    const unread = (await api('GET', '/notifications').catch(() => ({ unread: 0 }))).unread;
    view(html`<div class="row"><h1 class="grow">Meu perfil</h1><button class="icon-btn" data-act="open-notifs" aria-label="Notificações${unread ? `, ${unread} novas` : ''}">${icon('bell')}${unread ? raw(`<i class="dot" style="position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;border-radius:9px;background:var(--primary);color:var(--on-primary);font-size:.65rem;display:grid;place-items:center;font-style:normal">${unread}</i>`) : ''}</button></div>
      <div class="card-surface row" style="gap:16px">${p.photos[0] ? raw(`<img class="avatar" style="width:84px;height:100px" src="${esc(mediaUrl(p.photos[0].url))}" alt="Sua foto principal">`) : raw('<div class="avatar" style="width:84px;height:100px"></div>')}<div class="grow"><h2 style="margin:0">${p.name || 'Sem nome'}, ${p.age}</h2><div class="small muted">${p.city || 'Região não definida'}</div><a class="link" href="#/edit">Editar perfil completo</a></div></div>
      ${p.photos.some((x) => x.status === 'pending') ? raw('<p class="banner small">Suas fotos novas estão em análise. Você aparece para outras pessoas assim que uma for aprovada.</p>') : ''}
      <div class="card-surface" style="margin-top:12px"><div class="row"><span class="grow"><b>Elo ${pl.plan === 'free' ? 'Free' : pl.plan === 'plus' ? 'Plus' : 'Premium'}</b><div class="small muted">${me.quota ? `${me.quota.remaining} de ${me.quota.limit} curtidas hoje` : ''}</div></span><a class="btn secondary" href="#/plans">${pl.plan === 'free' ? 'Conhecer planos' : 'Meu plano'}</a></div>
        ${pl.plan === 'premium' ? raw(`<div class="setting"><span class="grow"><b>Modo discreto</b><div class="small muted">Só aparece para quem você curtir.</div></span><button class="switch" role="switch" aria-label="Modo discreto" aria-checked="${pl.discreet}" data-act="toggle-discreet"></button></div>
          <div class="setting"><span class="grow"><b>Destaque de 30 minutos</b><div class="small muted">${pl.boost?.active ? 'Ativo agora' : pl.boost?.availableAt ? 'Disponível em ' + dateFmt(pl.boost.availableAt) : '1 por semana'}</div></span><button class="btn secondary" data-act="boost" ${pl.boost?.active || pl.boost?.availableAt ? 'disabled' : ''}>Usar</button></div>`) : raw('<p class="small muted" style="margin:10px 0 0">Modo discreto e destaque semanal fazem parte do Premium.</p>')}</div>
      <div class="section-title">Atividade</div>
      <a class="list-row" href="#/popularity">${icon('chart')}<span class="grow"><b>Minha popularidade</b><br><small class="muted">Só você vê. Sem ranking de aparência.</small></span></a>
      <a class="list-row" href="#/settings">${icon('settings')}<span class="grow"><b>Configurações</b><br><small class="muted">Aparência, notificações, privacidade e conta</small></span></a>
      <button class="list-row" data-act="open-help">${icon('info')}<span class="grow"><b>Ajuda e segurança</b></span></button>
      <button class="btn ghost block" data-act="logout" style="margin-top:14px">Sair</button>`);
  });

  route('/edit', async () => {
    const p = store.get().me.profile;
    view(html`<a class="link" href="#/me">${icon('back')} Meu perfil</a><h1>Seu perfil, seu jeito</h1>
      <div class="section-title">Fotos</div><div id="photo-area"></div>
      <form data-form="edit-profile"><div class="section-title">Sobre você</div>
        <label for="n">Nome de exibição</label><input id="n" name="displayName" maxlength="40" required value="${p.name}">
        <p class="field-hint">Idade pública: ${p.age} anos (calculada da data de nascimento, que fica privada).</p>
        <label for="g">Gênero</label><select id="g" name="gender">${raw(options(L.gender, p.gender))}</select>
        <label for="i">O que você procura</label><select id="i" name="intent">${raw(options(L.intent, p.intent))}</select>
        <label for="b">Descrição</label><textarea id="b" name="bio" maxlength="500">${p.bio}</textarea>
        <label for="it">Interesses (até 8, separados por vírgula)</label><input id="it" name="interests" value="${p.interests.join(', ')}">
        <div class="section-title">Jeito de viver (opcional)</div>
        <label for="sm">Fumo</label><select id="sm" name="smoking">${raw(options(L.smoking, p.smoking))}</select>
        <label for="ch">Filhos</label><select id="ch" name="children">${raw(options(L.children, p.children))}</select>
        <p class="field-hint">Não pedimos nomes, idades ou fotos dos seus filhos.</p>
        <label for="dr">Bebidas alcoólicas</label><select id="dr" name="drinking">${raw(options(L.drinking, p.drinking))}</select>
        <label for="pt">Pets</label><select id="pt" name="pets">${raw(options(L.pets, p.pets))}</select>
        <label for="h">Altura em cm</label><input id="h" name="heightCm" type="number" min="100" max="250" value="${p.heightCm ?? ''}">
        <label for="w">Profissão</label><input id="w" name="work" maxlength="60" value="${p.work}">
        <label for="e">Escolaridade</label><input id="e" name="education" maxlength="60" value="${p.education}">
        <button class="btn primary block" type="submit" style="margin-top:18px">Salvar perfil</button></form>`);
    mountPhotos($('#photo-area'));
  });

  route('/popularity', async () => {
    const r = await api('GET', '/me/popularity');
    view(html`<a class="link" href="#/me">${icon('back')} Meu perfil</a>${art('popularity', '', 'spot-art')}<span class="badge">Só você vê</span><h1>Sua popularidade</h1>
      <p class="muted">Atividade do seu perfil nos últimos ${r.windowDays} dias, em números agregados.</p>
      <div class="stats"><div class="stat"><b>${r.visits}</b><span>Visitas</span></div><div class="stat"><b>${r.likes}</b><span>Curtidas</span></div><div class="stat"><b>${r.matches}</b><span>Matches</span></div></div>
      ${r.enoughData ? '' : raw('<h3>Ainda conhecendo seu ritmo</h3><p>Com pouco histórico, não mostramos nenhuma classificação. Os primeiros dois dias ajudam a reunir atividade, mas o volume de pessoas na sua região também influencia.</p>')}
      <p class="small muted">Visitas contam uma vez por pessoa e por dia, sem identificar quem visitou. Não é uma nota de beleza, não garante visibilidade e não aparece para outras pessoas. Comprar um plano não aumenta esses números.</p>
      <a class="btn primary" href="#/edit">Completar meu perfil</a>`);
  });

  route('/settings', async () => {
    const me = store.get().me; const s = me.settings;
    view(html`<a class="link" href="#/me">${icon('back')} Meu perfil</a><h1>Configurações</h1>
      <div class="section-title">Aparência</div><label for="th" class="sr-only">Tema</label><select id="th" data-act="set-theme">${raw(options(THEMES, s.theme))}</select>
      <div class="section-title">Descoberta e localização</div>
      ${sw('pauseDiscovery', s.pauseDiscovery, 'Pausar descoberta', 'Seu perfil deixa de aparecer para novas pessoas. Conversas continuam.')}
      ${sw('pausePaths', s.pausePaths, 'Pausar Caminhos', 'Interrompe novas coletas e sugestões.')}
      <button class="list-row" data-act="open-location">${icon('pin')}<span class="grow"><b>Minha região</b><br><small class="muted">${esc(me.profile.city || 'Não definida')}${me.profile.locationSource === 'manual' ? ' · cidade escolhida por você' : ''}</small></span></button>
      <div class="section-title">Privacidade do perfil</div>
      ${sw('showGender', s.showGender, 'Mostrar meu gênero no perfil')}${sw('showHabits', s.showHabits, 'Mostrar jeito de viver (fumo, filhos, bebidas, pets, altura…)')}
      <div class="section-title">Notificações</div>
      ${sw('notifMatches', s.notifMatches, 'Novos matches')}${sw('notifMessages', s.notifMessages, 'Mensagens')}${sw('notifLikes', s.notifLikes, 'Curtidas recebidas', 'No plano Free, o aviso nunca revela quem curtiu.')}${sw('notifOps', s.notifOps, 'Avisos do serviço')}${sw('notifPreview', s.notifPreview, 'Mostrar prévia das mensagens', 'Desligado por padrão, para mais discrição.')}
      <div class="section-title">Segurança</div>
      <button class="list-row" data-act="open-blocks">${icon('shield')}<span class="grow"><b>Pessoas bloqueadas</b></span></button>
      <button class="list-row" data-act="open-sessions">${icon('lock')}<span class="grow"><b>Dispositivos e sessões</b></span></button>
      <div class="section-title">Seus dados</div>
      <button class="list-row" data-act="export-data"><span class="grow"><b>Exportar meus dados</b><br><small class="muted">Pede sua senha novamente</small></span></button>
      <a class="list-row" href="/legal.html" target="_blank" rel="noopener"><span class="grow"><b>Termos e privacidade</b></span></a>
      <button class="btn danger block" data-act="delete-account" style="margin-top:18px">Excluir minha conta</button>`);
  });
}

const SETTING_MAP = { pauseDiscovery: 'pauseDiscovery', pausePaths: 'pausePaths', showGender: 'showGender', showHabits: 'showHabits', notifMatches: 'notifMatches', notifMessages: 'notifMessages', notifLikes: 'notifLikes', notifOps: 'notifOps', notifPreview: 'notifPreview' };
onForm({
  async 'edit-profile'(f, v) {
    const body = { ...v, interests: v.interests.split(',').map((x) => x.trim()).filter(Boolean), heightCm: v.heightCm === '' ? null : Number(v.heightCm) };
    await api('PATCH', '/me/profile', body); setMe(await api('GET', '/me')); toast('Perfil salvo.'); go('#/me');
  },
  async 'export-form'() {},
});
document.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-act=set-theme]'); if (!s) return;
  try { setMe(await api('PUT', '/me/settings', { theme: s.value })); } catch (err) { toast(errMsg(err)); }
});
on({
  async 'toggle-setting'(el) {
    const key = SETTING_MAP[el.dataset.key]; const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', next);
    try { setMe(await api('PUT', '/me/settings', { [key]: next })); } catch (e) { el.setAttribute('aria-checked', !next); throw e; }
  },
  async 'toggle-discreet'(el) { const next = el.getAttribute('aria-checked') !== 'true'; try { const plan = await api('PUT', '/plans/discreet', { on: next }); setMe({ plan }); el.setAttribute('aria-checked', next); toast(next ? 'Modo discreto ativado.' : 'Modo discreto desativado.'); } catch (e) { if (e.code === 'plan_required') upsell('Conheça no modo discreto', 'Fica disponível no Elo Premium.'); else throw e; } },
  async boost() { setMe({ plan: await api('POST', '/plans/boost') }); toast('Destaque de 30 minutos ativado. Ele aumenta a exposição, mas não garante matches.', 6000); go('#/me'); },
  'open-help'() { sheet(html`${art('safety', '', 'spot-art')}<h2>Ajuda e segurança</h2><ul class="stack small"><li>Bloquear e denunciar são gratuitos em todos os planos e ficam no menu “⋯” de qualquer perfil ou conversa.</li><li>Combine encontros em locais públicos e avise alguém de confiança.</li><li>Nunca envie dinheiro nem dados bancários.</li><li>Dúvidas e suporte: suporte@elo.app (exemplo — defina o canal oficial antes do lançamento).</li></ul><button class="btn primary block" data-act="close-sheet">Entendi</button>`); },
  async 'open-notifs'() {
    const r = await api('GET', '/notifications');
    sheet(html`<h2>Notificações</h2>${r.items.length ? r.items.map((n) => raw(`<div class="list-row" style="min-height:0"><span class="grow"><b>${esc(n.title)}</b>${n.read_at ? '' : ' <span class="badge">nova</span>'}<br><small class="muted">${esc(n.body)}</small></span></div>`)) : raw('<p class="muted">Nada por aqui.</p>')}`);
    await api('POST', '/notifications/read');
  },
  async 'open-blocks'() {
    const r = await api('GET', '/blocks');
    sheet(html`<h2>Pessoas bloqueadas</h2>${r.blocks.length ? r.blocks.map((b) => raw(`<div class="setting"><span class="grow">${esc(b.name || 'Perfil')}</span><button class="btn secondary" data-act="unblock" data-id="${esc(b.id)}">Desbloquear</button></div>`)) : raw('<p class="muted">Você não bloqueou ninguém.</p>')}<p class="small muted">Desbloquear não restaura matches nem conversas encerradas.</p>`);
  },
  async unblock(el) { await api('DELETE', `/blocks/${el.dataset.id}`); closeSheet(); toast('Desbloqueado.'); },
  async 'open-sessions'() {
    const r = await api('GET', '/auth/sessions');
    sheet(html`<h2>Dispositivos</h2>${r.sessions.map((s) => raw(`<div class="setting"><span class="grow"><b>${s.current ? 'Este aparelho' : 'Outro aparelho'}</b><div class="small muted">${esc((s.device || '').slice(0, 60))} · ${dateTimeFmt(s.last_seen_at)}</div></span>${s.current ? '' : `<button class="btn secondary" data-act="revoke-session" data-id="${s.id}">Sair</button>`}</div>`))}${r.sessions.length > 1 ? raw('<button class="btn secondary block" data-act="revoke-others" style="margin-top:12px">Sair de todos os outros</button>') : ''}`);
  },
  async 'revoke-session'(el) { await api('DELETE', `/auth/sessions/${el.dataset.id}`); closeSheet(); toast('Dispositivo desconectado.'); },
  async 'revoke-others'() { await api('POST', '/auth/sessions/revoke-others'); closeSheet(); toast('Outros dispositivos desconectados.'); },
  async 'export-data'() {
    const v = await confirmSheet({ title: 'Exportar meus dados', text: 'Para sua segurança, confirme sua senha. O arquivo não inclui dados privados de outras pessoas.', ok: 'Exportar', fields: '<label for="pw">Senha</label><input id="pw" name="password" type="password" autocomplete="current-password">' });
    if (!v) return;
    const data = await api('POST', '/me/export', { password: v.password });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'meus-dados-elo.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Arquivo gerado.');
  },
  async 'delete-account'() {
    const v = await confirmSheet({ title: 'Excluir sua conta?', text: 'Seu perfil fica oculto agora, suas sessões são encerradas e a limpeza dos dados é programada para até 30 dias. Excluir a conta não cancela assinaturas feitas na loja — cancele-as também no Google Play.', ok: 'Excluir minha conta', danger: true, fields: '<label for="pw2">Confirme sua senha</label><input id="pw2" name="password" type="password" autocomplete="current-password">' });
    if (!v) return;
    await api('POST', '/me/delete', { password: v.password }); token.set(null); store.set({ me: null, deck: [] }); applyTheme('system'); toast('Conta em exclusão. Sentiremos sua falta.', 6000); go('#/welcome');
  },
});
