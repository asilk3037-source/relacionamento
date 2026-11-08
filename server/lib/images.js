'use strict';
const { bad } = require('./errors');
/** Detecta o formato pelos bytes (não confia no cabeçalho do cliente). SVG é recusado. */
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
/** Remove segmentos APPn/COM do JPEG (EXIF/GPS, XMP) preservando o perfil de cor APP2 ICC. */
function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)]; let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw bad('invalid_image', 'Imagem JPEG inválida.');
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); break; } // início dos dados da imagem
    if (marker === 0xd9) { out.push(buf.subarray(i)); break; }
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const len = buf.readUInt16BE(i + 2); if (len < 2 || i + 2 + len > buf.length) throw bad('invalid_image', 'Imagem JPEG inválida.');
    const seg = buf.subarray(i, i + 2 + len);
    const isIcc = marker === 0xe2 && seg.subarray(4, 15).toString('latin1').startsWith('ICC_PROFILE');
    const strip = (marker >= 0xe1 && marker <= 0xef && !isIcc) || marker === 0xfe;
    if (!strip) out.push(seg);
    i += 2 + len;
  }
  return Buffer.concat(out);
}
/** Remove chunks eXIf/tEXt/iTXt/zTXt do PNG. */
function stripPng(buf) {
  const out = [buf.subarray(0, 8)]; let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i); const type = buf.subarray(i + 4, i + 8).toString('latin1'); const end = i + 12 + len;
    if (end > buf.length) throw bad('invalid_image', 'Imagem PNG inválida.');
    if (!['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(type)) out.push(buf.subarray(i, end));
    i = end; if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}
/** Remove chunks EXIF/XMP do WebP (RIFF) — só os chunks de metadados. */
function stripWebp(buf) {
  const out = [Buffer.alloc(12)]; let i = 12; let size = 4;
  while (i + 8 <= buf.length) {
    const type = buf.subarray(i, i + 4).toString('latin1'); const len = buf.readUInt32LE(i + 4); const padded = len + (len % 2); const end = i + 8 + padded;
    if (end > buf.length) throw bad('invalid_image', 'Imagem WebP inválida.');
    if (type !== 'EXIF' && type !== 'XMP ') { out.push(buf.subarray(i, end)); size += end - i; }
    i = end;
  }
  const head = out[0]; head.write('RIFF', 0, 'latin1'); head.writeUInt32LE(size, 4); head.write('WEBP', 8, 'latin1');
  return Buffer.concat(out);
}
function sanitizeImage(buf, maxBytes) {
  if (!buf || !buf.length) throw bad('invalid_image', 'Envie uma imagem JPEG, PNG ou WebP.');
  if (buf.length > maxBytes) throw bad('image_too_large', `A imagem deve ter no máximo ${Math.round(maxBytes / 1048576)} MB.`);
  const mime = sniff(buf);
  if (!mime) throw bad('invalid_image', 'Formato não aceito. Use JPEG, PNG ou WebP.');
  const clean = mime === 'image/jpeg' ? stripJpeg(buf) : mime === 'image/png' ? stripPng(buf) : stripWebp(buf);
  return { mime, data: clean };
}
module.exports = { sanitizeImage, sniff, stripJpeg, stripPng };
