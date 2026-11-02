// Exemplos de obra real: Banrisul (CC-2026-002) e CMPA (CC-2026-003) aparecem na lista de obras, com valor e cliente
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.evaluate(() => localStorage.setItem('a360obrasvista', 'painel')); await p.reload(); await p.waitForTimeout(400); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360cad')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  const d = await p.evaluate(() => ArmantCadastros.demandas().map(x => x.cc + ' ' + x.valor));
  ok('base única: TJ-RS, Banrisul, CMPA e as 12 fictícias (15)', d.length === 15 && d.some(x => x.startsWith('CC-2026-002 28297.38')) && d.some(x => x.startsWith('CC-2026-003 399946.56')));
  await p.goto(base + '#operations'); await p.waitForTimeout(600);
  ok('lista de demandas mostra as obras de exemplo', /CC-2026-002/.test(await p.locator('#view').innerText()) && /CC-2026-003/.test(await p.locator('#view').innerText()));
  await p.goto(base + '#cc/CC-2026-003'); await p.waitForTimeout(600);
  ok('ficha da CMPA abre com o contrato 1120', /1120/.test(await p.locator('#view').innerText()));
  await p.goto(base + '#cc/CC-2026-002'); await p.waitForTimeout(600);
  ok('ficha do Banrisul abre com o valor do orçamento', /28\.297,38/.test(await p.locator('#view').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
