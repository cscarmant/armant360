// Coluna Responsável (R.O.) na lista de obras
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1415, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.evaluate(() => localStorage.setItem('a360obrasvista', 'painel')); await p.reload(); await p.waitForTimeout(400); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360cad'));
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#projects'); await p.waitForTimeout(600);
  ok('coluna Responsável (R.O.)', await p.locator('th.cad-roh').count() === 1);
  const real = p.locator('tr.ob-real-row').first();
  ok('obra real sem R.O. mostra "definir R.O." na própria lista', /definir R\.O\./.test(await real.locator('.cad-ro-sel').evaluate(e => e.options[e.selectedIndex].text)));
  await real.locator('.cad-ro-sel').selectOption('USR-001'); await p.waitForTimeout(500);
  ok('escolher na lista grava o R.O. (mesmo dado do Controle de obras)', await p.evaluate(() => ArmantCadastros.roDe('CC-2026-001')) === 'USR-001');
  ok('kanban mostra o R.O. escolhido (mesma base)', await p.evaluate(() => ArmantKanbanObras.obras().find(o => o.k === 'CC-2026-001').ro) === 'Valentim');
  ok('obras fictícias também escolhem o R.O. na mesma base', await p.locator('tr:has([data-project="OB-001"]) .cad-ro-sel[data-cad-setro="OB-001"]').count() === 1);
  ok('toda linha tem a célula', await p.$$eval('.table-panel tbody tr', trs => trs.filter(t => !t.querySelector('td[colspan]')).every(t => t.querySelector('.cad-ro'))));
  ok('com R.O. escolhido aparece o nome', (await p.locator('tr.ob-real-row .cad-ro-sel').first().evaluate(e => e.options[e.selectedIndex].text)).startsWith('Valentim'));
  if (OUT) await p.locator('.table-panel').first().screenshot({ path: OUT + '/shot_ro.png' });
  await p.fill('#project-search', 'hospital'); await p.waitForTimeout(500);
  ok('busca mantém a coluna', await p.locator('th.cad-roh').count() === 1 && await p.$$eval('.table-panel tbody tr', trs => trs.filter(t => !t.querySelector('td[colspan]')).every(t => t.querySelector('.cad-ro'))));
  await p.goto(base + '#overview'); await p.waitForTimeout(600);
  ok('visão geral também tem a coluna', await p.locator('th.cad-roh').count() >= 1);
  await p.goto(base + '#projects'); await p.waitForTimeout(500); await p.fill('#project-search', ''); await p.waitForTimeout(400); await p.click('[data-project="OB-003"]'); await p.waitForTimeout(500);
  ok('clique na fictícia continua abrindo a obra', (await p.evaluate(() => location.hash)) === '#obra/OB-003');
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
