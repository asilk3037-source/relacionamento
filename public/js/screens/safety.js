import { html, raw, api, sheet, closeSheet, on, onForm, toast, errMsg, go, confirmSheet } from '../core.js';

const CATS = { assedio: 'Assédio ou comportamento inadequado', menor: 'Suspeita de menor de idade', ameaca: 'Ameaça', fraude: 'Fraude ou golpe', perfil_falso: 'Perfil falso', discriminacao: 'Discriminação', midia_intima: 'Mídia íntima sem consentimento', outro: 'Outro motivo' };
export function safetySheet(id, name = 'esta pessoa', matchId = null) {
  sheet(html`<h2>Você no controle</h2>
    <p class="muted">Bloquear remove ${name} da sua descoberta, dos Caminhos e das conversas, nos dois sentidos, e a pessoa não é avisada. Você não precisa denunciar para bloquear.</p>
    <button class="btn secondary block" data-act="do-block" data-id="${id}">Bloquear perfil</button>
    <h3 style="margin-top:22px">Denunciar</h3>
    <form data-form="report"><input type="hidden" name="targetId" value="${id}"><input type="hidden" name="matchId" value="${matchId || ''}">
      <label for="rc">Motivo</label><select id="rc" name="category">${raw(Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''))}</select>
      <label for="rd">Detalhes (opcional)</label><textarea id="rd" name="details" maxlength="1000"></textarea>
      <label class="check"><input type="checkbox" name="alsoBlock" checked><span>Bloquear também</span></label>
      <p class="field-hint">Nossa equipe analisa a denúncia. Se vier de uma conversa, as últimas mensagens são anexadas como evidência.</p>
      <button class="btn primary block" type="submit">Enviar denúncia</button></form>`);
}
on({
  async 'do-block'(el) { await api('POST', `/blocks/${el.dataset.id}`); closeSheet(); toast('Perfil bloqueado.'); go('#/discover'); },
});
onForm({
  async report(f, v) {
    const r = await api('POST', '/reports', { targetId: v.targetId, category: v.category, details: v.details, matchId: v.matchId ? Number(v.matchId) : undefined, alsoBlock: v.alsoBlock === 'on' });
    closeSheet(); toast(`Denúncia enviada. Protocolo ${r.protocol}.`, 6000); go('#/discover');
  },
});
