import { html, raw, str, api, art, icon, on, mediaUrl, setMe, store, toast, errMsg, $ } from '../core.js';

/** Reduz a imagem no aparelho (também descarta metadados) antes de enviar. */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    if (blob) return blob;
  } catch { /* usa o arquivo original */ }
  return file;
}

const STATUS = { pending: 'Em análise', approved: 'Aprovada', rejected: 'Recusada' };
let area = null;
export async function mountPhotos(el) {
  area = el;
  await draw();
}
async function draw() {
  if (!area) return;
  const me = await api('GET', '/me'); setMe(me);
  const photos = me.profile.photos;
  const slots = [];
  for (let i = 0; i < 6; i++) {
    const ph = photos[i];
    slots.push(ph
      ? `<div class="pslot"><img src="${str(html`${mediaUrl(ph.url)}`)}" alt="Foto ${i + 1}${i === 0 ? ' (principal)' : ''}"><span class="badge tag ${ph.status === 'rejected' ? 'warn' : ''}">${i === 0 ? 'Principal · ' : ''}${STATUS[ph.status]}</span>
          <div class="tools"><button data-act="photo-left" data-i="${i}" aria-label="Mover foto ${i + 1} para antes" ${i === 0 ? 'disabled' : ''}>‹</button><button data-act="photo-del" data-id="${ph.id}" aria-label="Remover foto ${i + 1}">✕</button><button data-act="photo-right" data-i="${i}" aria-label="Mover foto ${i + 1} para depois" ${i === photos.length - 1 ? 'disabled' : ''}>›</button></div></div>`
      : `<label class="pslot" style="margin:0;cursor:pointer" aria-label="Adicionar foto"><input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-photo-input><span class="muted">${str(icon('camera'))}</span></label>`);
  }
  area.innerHTML = `<div class="photo-grid">${slots.join('')}</div><p class="field-hint">JPEG, PNG ou WebP, até 5 MB. Removemos a localização e outros metadados das fotos. Fotos novas passam por revisão e não substituem as aprovadas até serem liberadas.</p>`;
}
document.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-photo-input]'); if (!inp || !inp.files[0]) return;
  try { toast('Enviando foto…'); const blob = await prepareImage(inp.files[0]); await api('POST', '/me/photos', undefined, { raw: blob, type: blob.type || 'image/jpeg' }); toast('Foto enviada. Ela será revisada.'); await draw(); }
  catch (err) { toast(errMsg(err)); }
});
on({
  async 'photo-del'(el) { await api('DELETE', `/me/photos/${el.dataset.id}`); await draw(); },
  async 'photo-left'(el) { await move(Number(el.dataset.i), -1); },
  async 'photo-right'(el) { await move(Number(el.dataset.i), 1); },
});
async function move(i, d) {
  const ids = store.get().me.profile.photos.map((p) => p.id); const j = i + d;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await api('PUT', '/me/photos/order', { ids }); await draw();
}
