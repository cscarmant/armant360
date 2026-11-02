// Chat oculto: sem item no menu (completo e simples), sem atalhos, #chat volta ao início; Dia a Dia continua
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360simples')); await p.reload(); await p.waitForTimeout(300);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(700); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#inicio'); await p.waitForTimeout(700);
  const menu = async () => (await p.locator('#navigation').innerText());
  ok('modo simples: sem Chat no menu, com Dia a Dia', !/Chat/.test(await menu()) && /Dia a Dia/.test(await menu()));
  await p.goto(base + '#chat'); await p.waitForTimeout(700);
  ok('#chat leva ao início simples', (await p.locator('#view .sx-setor').count()) === 8);
  await p.evaluate(() => ArmantSimples.desligar()); await p.waitForTimeout(1500);
  ok('modo completo: sem Chat no menu', !/\bChat\b/.test(await menu()) && /Dia a Dia/.test(await menu()));
  await p.goto(base + '#campo'); await p.waitForTimeout(600);
  ok('atalho de chat da obra no App de campo sumiu', (await p.locator('a[href^="#chat"]:visible').count()) === 0);
  await p.goto(base + '#chat/obra:CC-2026-001'); await p.waitForTimeout(600);
  ok('link de chat direto não abre a tela de chat', (await p.locator('#ch-in:visible').count()) === 0);
  ok('sem erros de página', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
