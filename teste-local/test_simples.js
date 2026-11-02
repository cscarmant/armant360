// Modo simples: início com 4 botões grandes, Obras e Suprimentos, menu curto, "Ver tudo" e "Modo simples"
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360simples')); await p.reload(); await p.waitForTimeout(300);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(700);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#inicio'); await p.waitForTimeout(600);
  ok('início tem 4 botões grandes', (await p.locator('#view .sx-btn').count()) === 4);
  ok('menu lateral tem só 5 itens (Início, Obras, Suprimentos, Chat, Dia a Dia)', (await p.locator('#navigation .nav-item').count()) === 6);
  await p.screenshot({ path: OUT + '/simples-inicio.png' });
  await p.click('#view .sx-btn[href="#obras"]'); await p.waitForTimeout(400);
  ok('Obras tem botões: Obras, Controle, Cronograma, R.O., Campo', (await p.locator('#view .sx-btn').count()) === 5);
  await p.screenshot({ path: OUT + '/simples-obras.png' });
  await p.goto(base + '#suprimentos'); await p.waitForTimeout(400);
  ok('Suprimentos tem 5 botões', (await p.locator('#view .sx-btn').count()) === 5);
  await p.screenshot({ path: OUT + '/simples-suprimentos.png' });
  await p.click('#view .sx-btn[href="#compras"]'); await p.waitForTimeout(500);
  ok('botão abre a tela certa (Compras)', /Compras/.test(await p.locator('#page-title').innerText()));
  await p.click('[data-sx-tudo]'); await p.waitForTimeout(900);
  ok('Ver tudo volta ao menu completo', (await p.locator('#navigation .nav-item').count()) > 8);
  await p.locator('.sx-volta').click(); await p.waitForTimeout(1800);
  ok('Modo simples volta ao início simples', (await p.locator('#view .sx-btn').count()) === 4);
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
