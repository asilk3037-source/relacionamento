'use strict';
// Fluxos de ponta a ponta: cadastro + onboarding com foto, match, chat com envio/falha/nova tentativa, bloqueio.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3111';
const OUT = process.argv[2] || '/tmp/elo-shots2';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.setDefaultTimeout(8000); p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); }); return { c, p }; };
  let failed = 0;
  let cur = null;
  const step = async (name, fn) => { try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '-', e.message.split('\n')[0]); if (cur) { console.log('      url:', cur.url(), '| texto:', (await cur.evaluate(() => document.body.innerText.slice(0, 160).replace(/\n+/g, ' / ')).catch(() => '?'))); await cur.screenshot({ path: path.join(OUT, 'fail-' + name.replace(/\W+/g, '-') + '.png') }).catch(() => {}); } } };
  const { c, p } = await mk(); cur = p;
  const email = `novo${Date.now()}@teste.com`;
  await step('menor de idade é barrado no cadastro', async () => {
    await p.goto(BASE + '/#/signup'); await p.fill('#email', 'menor@teste.com'); await p.fill('#password', 'senha1234');
    await p.fill('#birthDate', `${new Date().getFullYear() - 16}-01-01`); await p.check('input[name=acceptTerms]'); await p.click('button[type=submit]');
    await p.waitForSelector('#signup-error:not(:empty)'); const t = await p.textContent('#signup-error'); if (!/18 anos/.test(t)) throw new Error(t);
  });
  await step('cadastro + onboarding completo', async () => {
    await p.fill('#email', email); await p.fill('#birthDate', '1994-05-10'); await p.click('button[type=submit]');
    await p.waitForSelector('input[name=displayName]'); await p.fill('input[name=displayName]', 'Nina'); await p.selectOption('select[name=gender]', 'mulher'); await p.fill('textarea[name=bio]', 'Olá, mundo!'); await p.click('button[type=submit]');
    await p.waitForSelector('[data-photo-input]'); await p.setInputFiles('[data-photo-input]', path.join(__dirname, '..', 'public/assets/icons/icon-512.png')); await p.waitForSelector('.pslot img');
    await p.click('[data-act=ob-photos-next]'); await p.waitForSelector('input[name=interests]'); await p.fill('input[name=interests]', 'Café, Música'); await p.click('button[type=submit]');
    await p.waitForSelector('form[data-form=ob4]'); await p.click('[data-key=genders][data-val=homem]'); await p.click('button[type=submit]');
    await p.waitForSelector('[data-act=ob-location]'); await p.click('[data-act=ob-location]'); await p.waitForSelector('[data-act=loc-city]'); await p.click('[data-id=bh]'); await p.waitForTimeout(500);
    await p.click('[data-act=ob-finish]'); await p.waitForSelector('#nav a.active'); await p.screenshot({ path: path.join(OUT, '01-novo-descobrir.png') });
  });
  await step('só aparecem homens compatíveis, e a nova conta curte e passa', async () => {
    await p.waitForSelector('.pcard h2, .empty h2'); const names = []; 
    for (let i = 0; i < 3; i++) { const n = await p.textContent('#topcard h2').catch(() => null); if (!n) break; names.push(n); await p.click('[data-act=pass]'); await p.waitForTimeout(450); }
    console.log('      vistos:', names.join(' | ')); if (names.some((n) => /Marina|Júlia|Bia|Camila|Larissa/.test(n))) throw new Error('mulher apareceu apesar do filtro');
  });
  await step('Caminhos exige consentimento', async () => { await p.click('#nav a[href="#/paths"]'); await p.waitForSelector('[data-act=paths-consent]'); });
  await c.close();

  // Alex (teste@elo.test) dá match com Marina e conversa
  const A = await mk(); cur = A.p;
  await step('login Alex, grade, curtir Marina => match', async () => {
    await A.p.goto(BASE + '/'); await A.p.click('text=Já tenho conta'); await A.p.fill('#email', 'teste@elo.test'); await A.p.fill('#password', 'elo12345'); await A.p.click('button[type=submit]');
    await A.p.waitForSelector('.pcard');
    for (let i = 0; i < 12; i++) { const n = await A.p.textContent('#topcard h2'); if (/Marina/.test(n)) break; await A.p.click('[data-act=pass]'); await A.p.waitForTimeout(450); }
    await A.p.click('[data-act=like]'); await A.p.waitForSelector('.match-pop'); await A.p.waitForTimeout(350); await A.p.screenshot({ path: path.join(OUT, '02-match.png') });
    await A.p.click('text=Dar o primeiro oi'); await A.p.waitForSelector('#mtext');
  });
  await step('chat: envia, confirma, falha offline e reenvia sem duplicar', async () => {
    await A.p.fill('#mtext', 'Oi Marina!'); await A.p.click('.composer button'); await A.p.waitForSelector('.msg.mine:has-text("Oi Marina!") .meta:not(:has-text("Enviando"))');
    await A.c.setOffline(true); await A.p.fill('#mtext', 'Mensagem offline'); await A.p.click('.composer button'); await A.p.waitForSelector('.msg.failed'); await A.p.screenshot({ path: path.join(OUT, '03-chat-failed.png') });
    await A.c.setOffline(false); await A.p.click('[data-act=retry]'); await A.p.waitForFunction(() => document.querySelectorAll('.msg.mine').length === 2 && !document.querySelector('.msg.failed'));
    const n = await A.p.locator('.msg.mine:has-text("Mensagem offline")').count(); if (n !== 1) throw new Error('duplicou: ' + n);
  });
  await step('convite "Bora tomar um café?"', async () => {
    await A.p.click('[data-act=new-invite]'); await A.p.fill('input[name=place]', 'Café da Praça'); await A.p.click('form[data-form=invite] button[type=submit]'); await A.p.waitForSelector('.msg.invite'); await A.p.screenshot({ path: path.join(OUT, '04-chat-invite.png') });
  });
  await step('desfazer match encerra a conversa', async () => {
    await A.p.click('[data-act=chat-more]'); await A.p.click('[data-act=unmatch]'); await A.p.waitForSelector('h1:text("Conversas")'); await A.p.waitForSelector('text=Nenhuma conversa ainda');
  });
  const errs = [...(A.p.errors || []), ...(p.errors || [])].filter((e) => !/status of (4|5)\d\d/.test(e));
  console.log('erros de console:', errs.length ? errs : 'nenhum'); await b.close(); process.exit(failed ? 1 : 0);
})();
