// Kanban do status das obras no topo de Engenharia → Obras
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360kanban')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#setor/engenharia'); await p.waitForTimeout(300); await p.click('.sx-btn[href="#projects"]'); await p.waitForTimeout(600);
  ok('kanban no topo de Obras', await p.locator('#kb-obras').count() === 1 && await p.evaluate(() => { const k = document.getElementById('kb-obras'), t = document.querySelector('.table-panel'); return !!(k && t && (k.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)); }));
  ok('5 colunas', await p.locator('.kb-col').count() === 5);
  const n = await p.locator('.kb-ob').count(); ok('todas as obras (3 com centro de custo + 12 fictícias)', n === 15);
  const col = async k => p.$eval('[data-kbo="' + k + '"]', e => e.closest('[data-kbc]').dataset.kbc);
  ok('TJ-RS em execução, Banrisul em planejamento, Clínica Jardim (91%) em entrega', (await col('CC-2026-001')) === 'exec' && (await col('CC-2026-002')) === 'plan' && (await col('OB-005')) === 'ent');
  if (OUT) await p.locator('#kb-obras').screenshot({ path: OUT + '/shot_kanban.png' });
  await p.locator('[data-kbo="OB-012"]').scrollIntoViewIfNeeded(); await p.locator('[data-kbo="OB-012"]').dragTo(p.locator('[data-kbc="mob"] .kb-col-h')); await p.waitForTimeout(400);
  ok('arrastar muda o status e marca manual', (await col('OB-012')) === 'mob' && /manual/.test(await p.locator('[data-kbo="OB-012"]').innerText()));
  await p.reload(); await p.waitForTimeout(900); await p.goto(base + '#projects'); await p.waitForTimeout(500);
  ok('status manual fica salvo', (await col('OB-012')) === 'mob');
  await p.selectOption('[data-kbo-sel="OB-001"]', 'ent'); await p.waitForTimeout(300); ok('mudar pela seleção', (await col('OB-001')) === 'ent');
  await p.click('[data-kbo-auto="OB-012"]'); await p.waitForTimeout(300); ok('voltar ao automático', (await col('OB-012')) === 'exec');
  await p.click('[data-kbo="OB-003"] .kb-ob-t'); await p.waitForTimeout(500); ok('clique abre a obra', (await p.evaluate(() => location.hash)) === '#obra/OB-003');
  await p.goto(base + '#overview'); await p.waitForTimeout(400); ok('não aparece na visão geral', await p.locator('#kb-obras').count() === 0);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
