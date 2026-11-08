'use strict';
// Percorre o app no Chromium (Playwright), registra erros de console e salva capturas em um diretório.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3111';
const OUT = process.argv[2] || '/tmp/elo-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, geolocation: { latitude: -19.92, longitude: -43.94 }, permissions: ['geolocation'] });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (['error'].includes(m.type())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  const step = async (name, fn) => { try { await fn(); console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '-', e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '-')); } };

  await page.goto(BASE + '/');
  await step('welcome', async () => { await page.waitForSelector('text=Conexões que fazem sentido'); await shot('01-welcome'); });
  await step('login', async () => {
    await page.click('text=Já tenho conta'); await page.fill('#email', 'teste@elo.test'); await page.fill('#password', 'elo12345'); await page.click('button[type=submit]');
    await page.waitForSelector('#nav a.active'); await page.waitForSelector('.pcard'); await shot('02-discover');
  });
  await step('card info', async () => { await page.click('.info-btn'); await page.waitForSelector('.sheet h2'); await shot('03-profile-sheet'); await page.click('.sheet-close'); });
  await step('like (botão)', async () => { const q0 = await page.textContent('.pill-btn'); await page.click('[data-act=like]'); await page.waitForTimeout(700); const q1 = await page.textContent('.pill-btn').catch(() => ''); console.log('      cota:', q0.trim(), '→', q1.trim()); await shot('04-after-like'); });
  await step('grade', async () => { await page.click('[data-act=toggle-mode]'); await page.waitForSelector('.grid .gcard'); await shot('05-grid'); await page.click('[data-act=toggle-mode]'); });
  await step('filtros', async () => { await page.click('[data-act=open-filters]'); await page.waitForSelector('form[data-form=filters]'); await shot('06-filters'); await page.click('.sheet-close'); });
  await step('matches + likes', async () => { await page.click('#nav a[href="#/matches"]'); await page.waitForSelector('.tabs'); await shot('07-matches'); await page.click('[data-tab=likes]'); await page.waitForSelector('.card-surface'); await shot('08-likes-locked'); });
  await step('conversas', async () => { await page.click('#nav a[href="#/chats"]'); await page.waitForSelector('h1:text("Conversas")'); await shot('09-chats'); });
  await step('caminhos', async () => { await page.click('#nav a[href="#/paths"]'); await page.waitForSelector('[data-act=paths-consent]'); await shot('10-paths-consent'); await page.click('[data-act=paths-consent]'); await page.waitForSelector('[data-act=paths-pause]'); await shot('11-paths-on'); });
  await step('perfil', async () => { await page.click('#nav a[href="#/me"]'); await page.waitForSelector('text=Minha popularidade'); await shot('12-me'); });
  await step('planos', async () => { await page.click('text=Conhecer planos'); await page.waitForSelector('.price-card'); await shot('13-plans'); await page.click('[data-plan=plus]'); await page.waitForSelector('[data-act=buy]'); await shot('14-checkout'); await page.click('[data-act=buy]'); await page.waitForSelector('text=Revisar plano'); await shot('15-plans-active'); });
  await step('edição', async () => { await page.goto(BASE + '/#/edit'); await page.waitForSelector('form[data-form=edit-profile]'); await shot('16-edit'); });
  await step('configurações + tema escuro', async () => { await page.goto(BASE + '/#/settings'); await page.waitForSelector('#th'); await page.selectOption('#th', 'dark'); await page.waitForTimeout(400); await shot('17-settings-dark'); await page.goto(BASE + '/#/discover'); await page.waitForSelector('.pcard, .empty'); await shot('18-discover-dark'); await page.goto(BASE + '/#/settings'); await page.selectOption('#th', 'light'); });
  await step('popularidade', async () => { await page.goto(BASE + '/#/popularity'); await page.waitForSelector('.stats'); await shot('19-popularity'); });
  console.log('erros de console:', errors.length ? errors : 'nenhum');
  await b.close();
})();
