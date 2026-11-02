// Obras: chave Painel geral ⇄ Kanban, lembrada
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n); const vis = s => p.locator(s).first().isVisible().catch(() => false);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360obrasvista')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  await p.goto(base + '#projects'); await p.waitForTimeout(600);
  ok('chave no topo de Obras', await p.locator('#kb-vista [role=switch]').count() === 1);
  ok('começa no Kanban (painel escondido)', await vis('#kb-obras') && !(await vis('#view > .table-panel')) && !(await vis('#view > .kpi-grid')));
  if (OUT) await p.locator('#view').screenshot({ path: OUT + '/shot_vista_k.png', clip: undefined }).catch(() => {});
  await p.click('[data-kb-vista]'); await p.waitForTimeout(500);
  ok('troca para o Painel geral (indicadores e tabela, sem kanban)', !(await vis('#kb-obras')) && await vis('#view > .table-panel') && await vis('#view > .kpi-grid') && (await p.getAttribute('[data-kb-vista]', 'aria-checked')) === 'false');
  await p.reload(); await p.waitForTimeout(900); await p.goto(base + '#projects'); await p.waitForTimeout(500);
  ok('escolha fica lembrada', await vis('#view > .table-panel') && !(await vis('#kb-obras')));
  await p.click('[data-kb-vista]'); await p.waitForTimeout(500);
  ok('volta ao Kanban', await vis('#kb-obras') && (await p.getAttribute('[data-kb-vista]', 'aria-checked')) === 'true');
  await p.goto(base + '#overview'); await p.waitForTimeout(500);
  ok('visão geral não é afetada (tabela visível, sem chave)', await vis('.table-panel') && await p.locator('#kb-vista').count() === 0);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
