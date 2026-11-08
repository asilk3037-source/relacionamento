// Painel de operação: suporte (contas), moderação (fotos, denúncias, recursos) e administração (parâmetros, auditoria).
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tok = { get: () => sessionStorage.getItem('elo.admin'), set: (t) => (t ? sessionStorage.setItem('elo.admin', t) : sessionStorage.removeItem('elo.admin')) };
let me = null, tab = 'overview';
async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { ...(tok.get() ? { Authorization: 'Bearer ' + tok.get() } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(d?.error?.message || 'Erro'); e.status = r.status; throw e; }
  return d;
}
const fmt = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '—');
const TABS = { overview: ['Visão geral', ['support', 'moderator', 'admin']], accounts: ['Contas', ['support', 'moderator', 'admin']], photos: ['Fotos', ['moderator', 'admin']], reports: ['Denúncias', ['moderator', 'admin']], appeals: ['Recursos', ['moderator', 'admin']], deletions: ['Exclusões', ['support', 'admin']], params: ['Parâmetros', ['admin']], audit: ['Auditoria', ['admin']] };

function login() {
  $('#main').innerHTML = `<div class="card" style="max-width:380px;margin:60px auto"><h2>Entrar na operação</h2><form id="lf"><label>E-mail<input name="email" type="email" required autocomplete="username"></label><label>Senha<input name="password" type="password" required autocomplete="current-password"></label><div class="err" id="le"></div><button class="btn">Entrar</button></form><p class="muted">Acesso restrito à equipe. Sessões internas expiram em 8 horas e ações sensíveis pedem justificativa e nova confirmação de senha.</p></div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { const r = await api('POST', '/auth/login', f); tok.set(r.token); await start(); } catch (err) { $('#le').textContent = err.message; }
  };
}
async function start() {
  try { me = await api('GET', '/admin/me'); } catch { tok.set(null); return login(); }
  $('#who').textContent = `${me.email} · ${me.role}`; $('#logout').hidden = false;
  $('#logout').onclick = async () => { try { await api('POST', '/auth/logout'); } catch { /* ok */ } tok.set(null); location.reload(); };
  show(tab);
}
function shell(inner) {
  const tabs = Object.entries(TABS).filter(([, [, roles]]) => roles.includes(me.role)).map(([k, [t]]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${t}</button>`).join('');
  $('#main').innerHTML = `<nav class="tabs" role="tablist">${tabs}</nav>${inner}`;
  document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
}
async function show(t) {
  tab = t;
  try { await VIEWS[t](); } catch (e) { shell(`<div class="card err">${esc(e.message)}</div>`); }
}
/** Diálogo de ação sensível: justificativa obrigatória + senha. */
function sensitive(title, extra, onOk) {
  const d = $('#dlg'); d.innerHTML = `<form method="dialog" id="sf"><h3>${esc(title)}</h3>${extra}<label>Justificativa (obrigatória)<textarea name="justification" required minlength="8"></textarea></label><label>Sua senha<input name="password" type="password" required autocomplete="current-password"></label><div class="err" id="se"></div><div style="display:flex;gap:8px"><button class="btn" value="ok">Confirmar</button><button class="btn alt" value="cancel" formnovalidate>Cancelar</button></div></form>`;
  d.showModal();
  $('#sf').onsubmit = async (e) => {
    if (e.submitter?.value === 'cancel') return d.close();
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { await onOk(f); d.close(); } catch (err) { $('#se').textContent = err.message; }
  };
}
const VIEWS = {
  async overview() {
    const m = await api('GET', '/admin/metrics');
    const L = { accounts: 'Contas', active: 'Ativas', approvedProfiles: 'Perfis com foto aprovada', matches: 'Matches', matchesWithMessage: 'Matches com conversa', openReports: 'Denúncias abertas', pendingPhotos: 'Fotos pendentes', paidSubscriptions: 'Assinaturas pagas', newLast7d: 'Novas contas (7 dias)' };
    shell(`<div class="grid">${Object.entries(m).map(([k, v]) => `<div class="card stat"><b>${v}</b>${L[k] || k}</div>`).join('')}</div><p class="muted">Métricas agregadas. Não incluem texto de conversa, localização nem preferências sensíveis.</p>`);
  },
  async accounts() {
    shell(`<div class="card"><form id="sq"><label>Buscar por e-mail, nome ou ID público<input name="q" placeholder="ex.: maria"></label><button class="btn">Buscar</button></form></div><div id="res"></div>`);
    $('#sq').onsubmit = async (e) => {
      e.preventDefault(); const q = new FormData(e.target).get('q'); const r = await api('GET', '/admin/users?q=' + encodeURIComponent(q));
      $('#res').innerHTML = `<div class="card"><table><tr><th>ID</th><th>E-mail</th><th>Status</th><th>Plano</th><th></th></tr>${r.users.map((u) => `<tr><td>${u.id}${u.isDemo ? ' <span class="badge">demo</span>' : ''}</td><td>${esc(u.email)}</td><td><span class="badge">${u.status}</span> ${u.role !== 'user' ? `<span class="badge">${u.role}</span>` : ''}</td><td>${u.plan}</td><td><button class="btn alt" data-u="${u.id}">Abrir</button></td></tr>`).join('')}</table></div>`;
      document.querySelectorAll('[data-u]').forEach((b) => (b.onclick = () => account(b.dataset.u)));
    };
  },
  async photos() {
    const r = await api('GET', '/admin/photos/pending');
    shell(`<h2>Fotos em análise (${r.photos.length})</h2><div class="photos">${r.photos.map((p) => `<div class="card"><img src="${esc(p.url)}" alt="Foto pendente"><div class="muted">${esc(p.name)} · ${fmt(p.created_at)}</div><button class="btn" data-ok="${p.id}">Aprovar</button> <button class="btn danger" data-no="${p.id}">Recusar</button></div>`).join('') || '<p class="muted">Nada pendente.</p>'}</div>`);
    document.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = async () => { await api('POST', `/admin/photos/${b.dataset.ok}/approve`); show('photos'); }));
    document.querySelectorAll('[data-no]').forEach((b) => (b.onclick = async () => { const reason = prompt('Motivo da recusa (obrigatório):'); if (!reason) return; await api('POST', `/admin/photos/${b.dataset.no}/reject`, { reason }); show('photos'); }));
  },
  async reports() {
    const r = await api('GET', '/admin/reports?status=open'); const r2 = await api('GET', '/admin/reports?status=in_review');
    const row = (x) => `<tr><td><span class="badge sev${x.severity}">${x.severity === 1 ? 'crítica' : x.severity === 2 ? 'alta' : 'normal'}</span></td><td>${esc(x.protocol)}</td><td>${esc(x.category)}</td><td>${esc(x.target_name || '')} (#${x.target_id})</td><td>${fmt(x.created_at)}</td><td><button class="btn alt" data-r="${x.id}">Analisar</button></td></tr>`;
    shell(`<h2>Fila de denúncias</h2><div class="card"><table><tr><th>Gravidade</th><th>Protocolo</th><th>Categoria</th><th>Alvo</th><th>Data</th><th></th></tr>${[...r.reports, ...r2.reports].map(row).join('') || '<tr><td colspan=6 class="muted">Fila vazia.</td></tr>'}</table></div><p class="muted">Metas de resposta só serão prometidas após dimensionar a cobertura da equipe.</p>`);
    document.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => report(b.dataset.r)));
  },
  async appeals() {
    const r = await api('GET', '/admin/appeals');
    shell(`<h2>Recursos de usuários restritos</h2>${r.appeals.map((a) => `<div class="card"><b>Sanção #${a.id}</b> (${esc(a.kind)}) — usuário #${a.user_id}<p class="muted">${esc(a.reason)}</p><pre>${esc(a.appeal_text)}</pre><button class="btn" data-g="${a.id}">Aceitar recurso</button> <button class="btn danger" data-d="${a.id}">Negar</button></div>`).join('') || '<p class="muted">Sem recursos abertos.</p>'}`);
    const decide = (id, decision) => sensitive(decision === 'grant' ? 'Aceitar recurso' : 'Negar recurso', '', async (f) => { await api('POST', `/admin/appeals/${id}`, { ...f, decision }); show('appeals'); });
    document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => decide(b.dataset.g, 'grant')));
    document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => decide(b.dataset.d, 'deny')));
  },
  async deletions() {
    const r = await api('GET', '/admin/deletions');
    shell(`<h2>Solicitações de exclusão</h2><div class="card"><table><tr><th>Conta</th><th>Pedido em</th><th>Limpeza programada</th></tr>${r.deletions.map((d) => `<tr><td>${esc(d.public_id)}</td><td>${fmt(d.deleted_at)}</td><td>${fmt(d.purge_at)}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">Nenhuma.</td></tr>'}</table></div>`);
  },
  async params() {
    const r = await api('GET', '/admin/params'); const v = r.dailyLikes;
    shell(`<h2>Parâmetros</h2><div class="card"><h3>Curtidas diárias por plano</h3><form id="pf"><div class="grid"><label>Free<input name="free" type="number" min="0" max="1000" value="${v.free}"></label><label>Plus<input name="plus" type="number" min="0" max="1000" value="${v.plus}"></label><label>Premium<input name="premium" type="number" min="0" max="1000" value="${v.premium}"></label></div><button class="btn">Salvar…</button></form><p class="muted">A mudança vale para o dia corrente; o consumo já feito é mantido.</p></div>`);
    $('#pf').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const value = { free: +f.free, plus: +f.plus, premium: +f.premium }; sensitive('Alterar curtidas diárias', '', async (x) => { await api('PUT', '/admin/params/dailyLikes', { ...x, value }); show('params'); }); };
  },
  async audit() {
    const r = await api('GET', '/admin/audit');
    shell(`<h2>Trilha de auditoria</h2><div class="card"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Justificativa</th></tr>${r.audit.map((a) => `<tr><td>${fmt(a.created_at)}</td><td>${a.actor_id ?? 'sistema'}</td><td>${esc(a.action)}</td><td>${esc(a.target_type || '')} ${esc(a.target_id || '')}</td><td>${esc(a.justification || '')}</td></tr>`).join('')}</table></div>`);
  },
};
async function account(id) {
  const u = await api('GET', '/admin/users/' + id); const d = $('#dlg');
  d.innerHTML = `<h3>Conta #${u.id} ${esc(u.name || '')}</h3><p>${esc(u.email)}<br><span class="badge">${u.status}</span> <span class="badge">${u.plan}</span> reports: ${u.reports}</p>${u.sanctions.map((s) => `<div class="muted">• ${esc(s.kind)}: ${esc(s.reason)} (${fmt(s.created_at)})${s.lifted_at ? ' — suspensa em ' + fmt(s.lifted_at) : ''}</div>`).join('')}<p class="muted">Suporte vê apenas a situação da conta: sem conversas nem localização.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${['moderator', 'admin'].includes(me.role) ? (u.status === 'suspended' ? '<button class="btn" id="a-restore">Restaurar</button>' : '<button class="btn danger" id="a-suspend">Suspender</button>') : ''}${me.role === 'admin' ? '<button class="btn alt" id="a-birth">Corrigir nascimento</button><button class="btn alt" id="a-role">Alterar papel</button>' : ''}<button class="btn alt" id="a-close">Fechar</button></div>`;
  d.showModal(); $('#a-close').onclick = () => d.close();
  const act = (sel, title, extra, fn) => { const b = $(sel); if (b) b.onclick = () => { d.close(); sensitive(title, extra, fn); }; };
  act('#a-suspend', 'Suspender conta', '', async (f) => { await api('POST', `/admin/users/${id}/status`, { ...f, action: 'suspend' }); });
  act('#a-restore', 'Restaurar conta', '', async (f) => { await api('POST', `/admin/users/${id}/status`, { ...f, action: 'restore' }); });
  act('#a-birth', 'Corrigir data de nascimento', '<label>Nova data<input name="birthDate" type="date" required></label>', async (f) => { await api('POST', `/admin/users/${id}/birthdate`, f); });
  act('#a-role', 'Alterar papel interno', '<label>Papel<select name="role"><option>user</option><option>support</option><option>moderator</option><option>admin</option></select></label>', async (f) => { await api('POST', `/admin/users/${id}/role`, f); });
}
async function report(id) {
  const r = await api('GET', '/admin/reports/' + id); const d = $('#dlg');
  d.innerHTML = `<h3>${esc(r.protocol)} · ${esc(r.category)}</h3><p class="muted">Contra #${r.target_id} · ${fmt(r.created_at)}</p><p>${esc(r.details) || '<i class="muted">Sem detalhes.</i>'}</p>${r.evidence.length ? `<h4>Evidências (últimas mensagens)</h4><pre>${r.evidence.map((m) => `[${m.from}] ${esc(m.body)}`).join('\n')}</pre>` : ''}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" data-x="dismiss">Arquivar</button><button class="btn alt" data-x="warn">Advertir</button><button class="btn danger" data-x="suspend">Suspender</button><button class="btn danger" data-x="ban">Banir</button><button class="btn alt" id="rc">Fechar</button></div>`;
  d.showModal(); $('#rc').onclick = () => d.close(); api('POST', `/admin/reports/${id}/assign`).catch(() => {});
  d.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => { d.close(); sensitive(`Decisão: ${b.textContent}`, '', async (f) => { await api('POST', `/admin/reports/${id}/resolve`, { ...f, action: b.dataset.x }); show('reports'); }); }));
}
if (tok.get()) start(); else login();
