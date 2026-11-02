// Botão Voltar em todas as telas internas (modo simples e completo)
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n); const H = () => p.evaluate(() => location.hash);
  await p.goto(base); await p.evaluate(() => localStorage.setItem('a360obrasvista', 'painel')); await p.reload(); await p.waitForTimeout(400); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '1')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  ok('Início sem barra', (await H()) === '#inicio' && await p.locator('.sx-nav').count() === 0);
  await p.click('a[href="#setor/almoxarifado"]'); await p.waitForTimeout(400);
  ok('setor sem barra e com Movimentações', await p.locator('.sx-nav').count() === 0 && await p.locator('.sx-btn[href="#materiais/movs"]').count() === 1);
  await p.click('.sx-btn[href="#materiais/estoque"]'); await p.waitForTimeout(500);
  const bar = await p.locator('#view > .sx-nav').innerText(); ok('Estoque com Voltar, Almoxarifado e Início', /Voltar/.test(bar) && /Almoxarifado/.test(bar) && /Início/.test(bar));
  if (OUT) await p.screenshot({ path: OUT + '/shot_voltar.png' });
  await p.click('a[href="#materiais/catalogo"]'); await p.waitForTimeout(400);
  await p.click('[data-sx-voltar]'); await p.waitForTimeout(500); ok('Voltar volta à tela anterior (Estoque)', (await H()) === '#materiais/estoque');
  await p.click('[data-sx-voltar]'); await p.waitForTimeout(500); ok('Voltar de novo volta ao setor', (await H()) === '#setor/almoxarifado');
  await p.goto(base + '#setor/engenharia'); await p.waitForTimeout(300); await p.click('.sx-btn[href="#projects"]'); await p.waitForTimeout(500);
  await p.click('[data-project="OB-001"]'); await p.waitForTimeout(500); await p.click('.ob-tabs a[href$="/medicao"]'); await p.waitForTimeout(400);
  ok('obra: barra no topo e sem o "Voltar às obras" duplicado', await p.locator('#view > .sx-nav').count() === 1 && !(await p.locator('.ob-back').isVisible()));
  await p.click('[data-sx-voltar]'); await p.waitForTimeout(500); ok('Voltar da aba volta à aba anterior da obra', (await H()) === '#obra/OB-001');
  await p.click('[data-sx-voltar]'); await p.waitForTimeout(500); ok('e depois à lista de obras', (await H()) === '#projects');
  // link direto: sem tela anterior, vai ao setor
  await p.goto(base + '#materiais/movs'); await p.reload(); await p.waitForTimeout(1200); await p.click('[data-sx-voltar]'); await p.waitForTimeout(500);
  ok('link direto: Voltar leva ao setor da tela', (await H()) === '#setor/almoxarifado');
  // todas as rotas internas têm a barra
  const rotas = ['#projects', '#obra', '#fluxo', '#timeline', '#controle', '#ro', '#campo', '#commercial', '#operations', '#compras', '#listas', '#fornecedores', '#materiais/entrega', '#finance', '#catalog', '#rh', '#meurh', '#frota', '#pmoc', '#atribuidas', '#comunicados', '#reunioes', '#acesso', '#auditoria', '#cc/CC-2026-001'];
  const sem = []; for (const r of rotas) { await p.goto(base + r); await p.waitForTimeout(350); if (await p.locator('#view > .sx-nav').count() !== 1) sem.push(r); }
  ok('todas as telas internas têm Voltar (' + rotas.length + ')', sem.length === 0); if (sem.length) console.log(sem);
  // modo completo
  await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.goto(base + '#overview'); await p.reload(); await p.waitForTimeout(900);
  ok('modo completo: visão geral sem barra', await p.locator('.sx-nav').count() === 0);
  await p.click('#navigation a[href="#finance"]'); await p.waitForTimeout(500);
  ok('modo completo: Financeiro tem Voltar (sem Início)', await p.locator('#view > .sx-nav [data-sx-voltar]').count() === 1 && !/Início/.test(await p.locator('#view > .sx-nav').innerText()));
  await p.click('[data-sx-voltar]'); await p.waitForTimeout(500); ok('modo completo: Voltar volta à visão geral', (await H()) === '#overview');
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
