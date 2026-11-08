import { html, raw, esc, api, view, art, icon, on, route, go, setMe, store, toast, errMsg, sheet, closeSheet, brl, dateFmt, confirmSheet } from '../core.js';

let cycle = 'month';
const PERKS = {
  plus: ['100 curtidas por dia', 'Veja quem curtiu você', 'Desfaça o último perfil dispensado', 'Match e conversa continuam livres'],
  premium: ['200 curtidas por dia', 'Tudo do Elo Plus', 'Modo discreto: apareça só para quem você curtir', '1 destaque de 30 minutos por semana'],
};
export function upsell(title, text) {
  sheet(html`${art('plans-hero', '', 'spot-art')}<h2>${title}</h2><p class="muted">${text}</p><p class="small muted">Você continua podendo curtir perfis, dar match e conversar no plano Free.</p><div class="row-actions"><a class="btn primary" href="#/plans" data-act="close-sheet">Comparar planos</a><button class="btn ghost" data-act="close-sheet">Continuar no Free</button></div>`);
}

export function bootPlans() {
  route('/plans', async () => {
    const r = await api('GET', '/plans'); const cur = r.current;
    const yearly = cycle === 'year';
    const card = (p) => {
      const price = yearly ? p.year : p.month;
      return raw(`<section class="price-card ${p.id === 'plus' ? 'featured' : ''}"><span class="badge">${p.id === 'plus' ? 'MAIS CONTROLE' : 'MAIS POSSIBILIDADES'}</span>
        <h3 style="margin-top:8px">${esc(p.name)}</h3><div class="price">${esc(brl(price))}<small> / ${yearly ? 'ano' : 'mês'}</small></div>
        <div class="small muted">${yearly ? `${esc(brl(p.yearMonthlyEquivalent))}/mês equivalente · cobrança anual única, sem parcelamento` : 'Cobrança mensal, renovação até cancelar'}</div>
        <ul>${PERKS[p.id].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <button class="btn ${p.id === 'plus' ? 'primary' : 'secondary'} block" data-act="choose-plan" data-plan="${p.id}">${cur.plan === p.id ? 'Revisar plano' : 'Conhecer ' + esc(p.name)}</button></section>`);
    };
    view(html`<a class="link" href="#/me">${icon('back')} Meu perfil</a>
      <div class="plans-hero"><span class="small" style="opacity:.8">ELO PLUS & PREMIUM</span><h1 style="color:#fff;margin:6px 0">Mais possibilidades.<br>No seu ritmo.</h1><p style="opacity:.9;margin:0">Escolha os extras que combinam com a sua forma de conhecer pessoas.</p></div>
      <div class="tabs" role="group" aria-label="Período"><button aria-selected="${!yearly}" data-act="cycle" data-c="month">Mensal</button><button aria-selected="${yearly}" data-act="cycle" data-c="year">Anual · menor valor por mês</button></div>
      <p class="small muted">Seu plano hoje: <b>${esc(r.catalog.find((c) => c.id === cur.plan).name)}</b>${cur.periodEnd ? ` · ${cur.renews ? 'renova' : 'vai até'} ${dateFmt(cur.periodEnd)}` : ''}. ${cur.plan !== 'free' ? '<button class="link" data-act="manage-plan">Gerenciar</button>' : ''}</p>
      ${r.catalog.filter((p) => p.id !== 'free').map(card)}
      <div class="card-surface"><b>Elo Free · R$ 0</b><p class="small muted" style="margin:6px 0 0">20 curtidas por dia. Descoberta, match, conversa por texto, Caminhos, popularidade privada, bloquear, denunciar e controles de privacidade continuam gratuitos.</p></div>
      <table class="small" style="width:100%;margin-top:14px;border-collapse:collapse"><caption class="sr-only">Comparação entre planos</caption><thead><tr><th style="text-align:left">Recurso</th><th>Free</th><th>Plus</th><th>Premium</th></tr></thead><tbody class="center">
        ${[['Curtidas por dia', '20', '100', '200'], ['Match e chat', '✓', '✓', '✓'], ['Caminhos e segurança', '✓', '✓', '✓'], ['Ver quem curtiu', '—', '✓', '✓'], ['Desfazer dispensa', '—', '✓', '✓'], ['Modo discreto', '—', '—', '✓'], ['Destaque semanal', '—', '—', '✓']].map((row) => raw(`<tr style="border-top:1px solid var(--line)"><td style="text-align:left;padding:9px 0">${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`))}</tbody></table>
      <p class="small muted">Preços propostos para validação. No Android, a compra e a gestão são feitas pelo Google Play, e o preço da loja prevalece. Sem promessa de matches.</p>
      ${r.mockBilling ? raw('<p class="badge warn">Ambiente de desenvolvimento: a compra é simulada.</p>') : ''}`);
  });
}
const mockFlag = () => api('GET', '/plans').then((r) => r.mockBilling);
on({
  cycle(el) { cycle = el.dataset.c; go('#/plans'); },
  async 'choose-plan'(el) {
    const plan = el.dataset.plan; const r = await api('GET', '/plans'); const p = r.catalog.find((x) => x.id === plan); const price = cycle === 'year' ? p.year : p.month;
    sheet(html`<span class="badge">Resumo</span><h2>${p.name}</h2><div class="price">${brl(price)}<small> / ${cycle === 'year' ? 'ano' : 'mês'}</small></div>
      <p>${cycle === 'year' ? 'Pagamento anual único; o valor mensal equivalente é só informativo.' : 'Pagamento mensal.'} A assinatura renova automaticamente até você cancelar.</p>
      <p class="small muted">Cancelar a renovação mantém os benefícios até o fim do período pago. Excluir a conta não cancela a assinatura da loja.</p>
      ${r.mockBilling ? raw('<p class="badge warn">Simulação de desenvolvimento — nenhum pagamento real.</p>') : ''}
      <div class="row-actions"><button class="btn primary" data-act="buy" data-plan="${plan}">${r.mockBilling ? 'Simular compra' : 'Continuar no Google Play'}</button><button class="btn ghost" data-act="close-sheet">Agora não</button></div>`);
  },
  async buy(el) {
    const co = await api('POST', '/plans/checkout', { plan: el.dataset.plan, cycle });
    if (co.provider !== 'mock') { closeSheet(); return toast('A compra pelo Google Play será aberta pelo aplicativo Android.', 6000); }
    setMe({ plan: await api('POST', '/plans/mock/confirm', { subscriptionId: co.subscriptionId }) });
    setMe(await api('GET', '/me')); closeSheet(); toast('Plano ativado (simulação).'); go('#/plans');
  },
  async 'manage-plan'() {
    const cur = store.get().me.plan;
    sheet(html`<h2>Seu plano</h2><p><b>${cur.plan}</b> · ${cur.state === 'renewal_cancelled' ? 'renovação cancelada' : 'renovação ativa'}${cur.periodEnd ? ` · até ${dateFmt(cur.periodEnd)}` : ''}</p>
      <p class="small muted">Na versão Android, a gestão abre as assinaturas do Google Play.</p>
      <div class="row-actions">${cur.renews ? raw('<button class="btn secondary" data-act="cancel-renewal">Cancelar renovação</button>') : ''}<button class="btn ghost" data-act="close-sheet">Fechar</button></div>`);
  },
  async 'cancel-renewal'() { await api('POST', '/plans/cancel'); setMe(await api('GET', '/me')); closeSheet(); toast('Renovação cancelada. Seus benefícios continuam até o fim do período pago.', 6000); go('#/plans'); },
});
