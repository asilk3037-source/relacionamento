'use strict';
// Gera ilustrações-reserva (SVG) para cada arte do app. Quando você gerar a arte final por IA e salvar
// em public/assets/art/<chave>.webp (ou .png), o app passa a usá-la automaticamente (veja docs/ARTE-PROMPTS.md).
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'public', 'assets', 'art');
fs.mkdirSync(out, { recursive: true });

const B = '#2865EB', N = '#182334', O = '#FF672E', S = '#DCE7FF', C = '#FFE3D6', W = '#FFFFFF';
const ring = (cx, cy, r, rot, c = B, sw = 14) => `<rect x="${cx - r}" y="${cy - r * 1.25}" width="${r * 2}" height="${r * 2.5}" rx="${r}" transform="rotate(${rot} ${cx} ${cy})" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
const eloMark = (cx, cy, s = 1) => `<g transform="translate(${cx} ${cy}) scale(${s})">${ring(-34, 0, 38, -25)}${ring(34, 0, 38, 25, O)}</g>`;
const path_ = (d, c = B, sw = 10, dash = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const person = (x, y, skin, hair, shirt, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-60 140c0-70 28-92 60-92s60 22 60 92z" fill="${shirt}"/><ellipse cx="0" cy="0" rx="34" ry="42" fill="${skin}"/><path d="M-36 -8c-8-52 64-60 72-2-18-6-30-22-33-34-4 18-22 32-39 36z" fill="${hair}"/><path d="M-12 8q12 8 24 0" stroke="${N}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
const bubble = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2.6}" fill="${c}"/>`;
const dots = (n, x, y, gap, c = O) => Array.from({ length: n }, (_, i) => `<circle cx="${x + i * gap}" cy="${y}" r="7" fill="${c}"/>`).join('');

const bg = (w, h, id) => `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EAF1FF"/><stop offset="1" stop-color="#FFE9DF"/></linearGradient></defs><rect width="${w}" height="${h}" rx="${Math.min(w, h) / 9}" fill="url(#g${id})"/><circle cx="${w * .82}" cy="${h * .18}" r="${h * .13}" fill="${O}" opacity=".16"/><circle cx="${w * .14}" cy="${h * .86}" r="${h * .18}" fill="${B}" opacity=".12"/>`;

const squares = {
  'age-gate': `${eloMark(200, 170, 1.5)}<rect x="130" y="270" width="140" height="56" rx="28" fill="${B}"/><text x="200" y="307" text-anchor="middle" font-family="system-ui,sans-serif" font-size="30" font-weight="800" fill="${W}">18+</text>`,
  'verify-email': `<rect x="90" y="130" width="220" height="150" rx="22" fill="${W}" stroke="${B}" stroke-width="10"/>${path_('M100 150 200 225 300 150')}<circle cx="300" cy="140" r="34" fill="${O}"/>${path_('M285 140l11 11 20-22', W, 8)}`,
  suspended: `<path d="M200 90l100 36v70c0 70-48 106-100 124-52-18-100-54-100-124v-70z" fill="${W}" stroke="${B}" stroke-width="10"/>${path_('M200 150v70', O, 14)}<circle cx="200" cy="256" r="8" fill="${O}"/>`,
  'onb-profile': `${person(200, 150, '#C98B66', '#2E2420', B, 1.4)}<circle cx="300" cy="110" r="26" fill="${O}"/>${path_('M288 110h24M300 98v24', W, 6)}`,
  'onb-interests': `${[[120, 130, B], [250, 110, O], [160, 220, O], [280, 230, B], [200, 170, N]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="42" fill="${c}" opacity=".9"/>`).join('')}${eloMark(200, 175, .5)}`,
  'onb-prefs': `${path_('M90 130h220M90 200h220M90 270h220', S, 12)}<circle cx="150" cy="130" r="22" fill="${B}"/><circle cx="250" cy="200" r="22" fill="${O}"/><circle cx="190" cy="270" r="22" fill="${B}"/>`,
  'onb-location': `<path d="M200 330S110 240 110 170a90 90 0 0 1 180 0c0 70-90 160-90 160z" fill="${B}"/><circle cx="200" cy="170" r="36" fill="${W}"/>${path_('M60 350q140-40 280 0', O, 8, '4 18')}`,
  'empty-paused': `<rect x="130" y="110" width="50" height="180" rx="18" fill="${B}"/><rect x="220" y="110" width="50" height="180" rx="18" fill="${O}"/>`,
  'empty-profile': `${person(200, 160, '#E0AC85', '#6B3F2A', '#8FA6D8', 1.4)}${path_('M110 330h180', O, 10, '2 18')}`,
  'empty-discover': `${eloMark(200, 165, 1.3)}${path_('M80 320q60-50 120-10t120-20', O, 8, '3 16')}`,
  match: `${ring(160, 190, 62, -25, B, 16)}${ring(240, 190, 62, 25, O, 16)}<path d="M200 110l8 16 18 3-13 12 3 18-16-9-16 9 3-18-13-12 18-3z" fill="${O}" transform="translate(0 -30)"/>${dots(5, 120, 330, 40)}`,
  limit: `<circle cx="200" cy="190" r="100" fill="none" stroke="${S}" stroke-width="22"/><path d="M200 90a100 100 0 1 1-92 62" fill="none" stroke="${B}" stroke-width="22" stroke-linecap="round"/>${path_('M200 140v55l36 24', O, 12)}`,
  'no-photo': `<circle cx="200" cy="150" r="56" fill="${B}" opacity=".35"/><path d="M80 330c0-90 50-120 120-120s120 30 120 120z" fill="${B}" opacity=".35"/>`,
  'likes-locked': `<path d="M200 300c-95-70-130-120-100-165 24-34 72-30 100 10 28-40 76-44 100-10 30 45-5 95-100 165z" fill="${B}" opacity=".85"/><rect x="160" y="170" width="80" height="64" rx="16" fill="${W}"/><path d="M178 170v-16a22 22 0 0 1 44 0v16" fill="none" stroke="${W}" stroke-width="12"/><circle cx="200" cy="202" r="9" fill="${O}"/>`,
  'empty-matches': `${bubble(90, 120, 160, 70, B)}${bubble(150, 210, 160, 70, O)}${dots(3, 130, 155, 24, W)}`,
  'empty-chat': `${bubble(90, 110, 190, 78, B)}${bubble(130, 210, 180, 78, O)}${path_('M120 140h110M160 240h110', W, 8)}`,
  'empty-likes': `<path d="M200 300c-95-70-130-120-100-165 24-34 72-30 100 10 28-40 76-44 100-10 30 45-5 95-100 165z" fill="none" stroke="${B}" stroke-width="12"/>${dots(3, 160, 360, 40, O)}`,
  'empty-paths': `${path_('M60 300C120 120 200 320 250 160s90-30 100-60', B, 10, '1 18')}${path_('M50 120C130 220 180 60 240 190s100 40 110 90', O, 10, '1 18')}<circle cx="205" cy="190" r="14" fill="${N}"/>`,
  'plans-hero': `<path d="M200 70l30 80 80 30-80 30-30 80-30-80-80-30 80-30z" fill="${B}"/><path d="M310 70l10 24 24 10-24 10-10 24-10-24-24-10 24-10z" fill="${O}"/>${eloMark(200, 180, .55).replace(new RegExp(B, 'g'), W).replace(new RegExp(O, 'g'), W)}`,
  popularity: `${[[100, 220, 70, S], [160, 160, 130, B], [220, 120, 170, O], [280, 190, 100, B]].map(([x, y, h, c]) => `<rect x="${x - 22}" y="${y + 100 - h / 2 + 30}" width="44" height="${h}" rx="14" fill="${c}"/>`).join('')}${path_('M70 330h260', N, 6)}`,
  safety: `<path d="M200 80l105 38v75c0 75-50 112-105 132-55-20-105-57-105-132v-75z" fill="${B}"/>${path_('M155 205l32 32 62-70', W, 16)}`,
  error: `<circle cx="200" cy="190" r="104" fill="${W}" stroke="${B}" stroke-width="12"/>${path_('M200 130v70', O, 16)}<circle cx="200" cy="244" r="10" fill="${O}"/>${path_('M60 330l40-20M300 320l44 24', S, 10)}`,
};
const wide = {
  'welcome-hero': `${[[130, 240, '#B9835F', '#2B211C', '#2865EB'], [290, 230, '#E0AC85', '#5C3524', '#FF672E'], [470, 250, '#8A5A3D', '#1C1714', '#182334'], [650, 238, '#F0C4A0', '#B5651D', '#6D8CE0']].map(([x, y, a, b, c]) => person(x, y, a, b, c, 1.3)).join('')}${path_('M20 470C180 360 250 520 400 430s240 70 380-30', O, 10, '2 20')}${path_('M20 520C160 450 260 560 420 500s250 20 360-20', B, 8, '2 20')}<rect x="300" y="60" width="200" height="70" rx="35" fill="${W}" opacity=".9"/><text x="400" y="106" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="800" fill="${B}">elo</text>`,
  'paths-art': `${path_('M30 420C170 130 270 520 410 260S650 150 770 320', B, 22, '2 34')}${path_('M30 130C190 330 290 90 410 300s240 130 360-20', O, 22, '2 34')}<circle cx="405" cy="285" r="26" fill="${N}"/><circle cx="405" cy="285" r="10" fill="${W}"/>${person(130, 420, '#C98B66', '#2E2420', B, .55)}${person(670, 150, '#E0AC85', '#6B3F2A', O, .55)}`,
};
const write = (name, w, h, body) => fs.writeFileSync(path.join(out, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img">${bg(w, h, name)}${body}</svg>\n`);
for (const [k, v] of Object.entries(squares)) write(k, 400, 400, v);
for (const [k, v] of Object.entries(wide)) write(k, 800, 600, v);
// Ícones do app
const ic = path.join(__dirname, '..', 'public', 'assets', 'icons'); fs.mkdirSync(ic, { recursive: true });
const mark = (s) => `<g transform="translate(256 256) scale(${s})">${ring(-34, 0, 38, -25, W, 14)}${ring(34, 0, 38, 25, W, 14)}</g>`;
fs.writeFileSync(path.join(ic, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${B}"/>${mark(3.2)}</svg>\n`);
fs.writeFileSync(path.join(ic, 'icon-maskable.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${B}"/>${mark(2.4)}</svg>\n`);
console.log('placeholders:', Object.keys(squares).length + Object.keys(wide).length);
