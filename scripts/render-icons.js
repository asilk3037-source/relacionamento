'use strict';
// Converte os ícones SVG em PNG (usa o Chromium/Playwright já instalado).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const dir = path.join(__dirname, '..', 'public', 'assets', 'icons');
  const b = await chromium.launch(); const pg = await b.newPage();
  for (const [src, out, size] of [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-maskable.svg', 'icon-maskable-512.png', 512]]) {
    await pg.setViewportSize({ width: size, height: size });
    await pg.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(dir, src)).toString('base64')}" width="${size}" height="${size}">`);
    await pg.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
})();
