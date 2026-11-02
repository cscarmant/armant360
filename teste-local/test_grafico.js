// Cronograma & caixa: ligar e desligar cada série e alternar o tipo do gráfico
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360grafico')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  await p.goto(base + '#timeline'); await p.waitForTimeout(800);
  const vis = () => p.$$eval('.tl-cash-svg .tl-flow-series', g => [...new Set(g.map(x => x.dataset.series))].join(','));
  ok('4 botões de série + mostrar todas + 3 tipos', await p.locator('[data-tl-serie]').count() === 4 && await p.locator('[data-tl-todas]').count() === 1 && await p.locator('[data-tl-tipo]').count() === 3);
  ok('começa com entradas, gastos e medições', (await vis()) === 'income,out,measured');
  await p.click('[data-tl-serie="out"]'); await p.waitForTimeout(300); ok('desligar gastos', (await vis()) === 'income,measured' && (await p.getAttribute('[data-tl-serie="out"]', 'aria-pressed')) === 'false');
  await p.click('[data-tl-serie="balance"]'); await p.waitForTimeout(300); ok('ligar saldo', (await vis()) === 'income,measured,balance');
  await p.click('[data-tl-todas]'); await p.waitForTimeout(300); ok('mostrar todas', (await vis()) === 'income,out,measured,balance');
  await p.click('[data-tl-todas]'); await p.waitForTimeout(300); ok('desligar todas mostra o aviso', (await vis()) === '' && /Ligue pelo menos uma série/.test(await p.locator('.tl-cash-svg').innerHTML()));
  await p.click('[data-tl-todas]'); await p.waitForTimeout(300);
  await p.click('[data-tl-tipo="barras"]'); await p.waitForTimeout(300); ok('barras (saldo como linha)', await p.locator('.tl-flow-bar').count() === 24 && (await vis()).includes('balance'));
  if (OUT) await p.locator('.tl-chart-options').locator('..').screenshot({ path: OUT + '/shot_graf_barras.png' }).catch(() => {});
  await p.click('[data-tl-tipo="areas"]'); await p.waitForTimeout(300); ok('áreas', await p.locator('.tl-cash-svg path[fill-opacity]').count() === 4);
  await p.reload(); await p.waitForTimeout(900); await p.goto(base + '#timeline'); await p.waitForTimeout(700);
  ok('escolha lembrada', (await p.getAttribute('[data-tl-tipo="areas"]', 'aria-pressed')) === 'true' && (await vis()) === 'income,out,measured,balance');
  await p.click('[data-tl-week="4"]').catch(() => {}); await p.waitForTimeout(300); ok('semana selecionada continua funcionando', /SEMANA SELECIONADA/i.test(await p.locator('.tl-week-summary').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
