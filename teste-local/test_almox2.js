// Almoxarifado v2: Saídas, vários estoques, transferência, cadastrar vários, exportar/importar CSV e Excel
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3] || '/tmp', base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360mat', JSON.stringify({ semBase: true }))); await p.reload(); await p.waitForTimeout(400);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#materiais/entrega'); await p.waitForTimeout(500);
  ok('aba chama Saídas', /Saídas/.test(await p.locator('.ob-tabs').innerText()) && !/Entrega de materiais/.test(await p.locator('.ob-tabs').innerText()));
  ok('formulário de saída', /Saída de materiais/.test(await p.locator('#mt-tab').innerText()) && await p.locator('[data-mt-tipo="transf"]').count() === 1);
  // novo estoque
  await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(400);
  await p.fill('#mt-dn', 'Depósito obra CMPA'); await p.fill('#mt-dl', 'Porto Alegre'); await p.click('#mt-dsave'); await p.waitForTimeout(300);
  ok('segundo estoque criado', await p.evaluate(() => ArmantMateriais.estoques().length) === 2);
  // entrada no central
  await p.goto(base + '#materiais/lancamento'); await p.waitForTimeout(400);
  await p.fill('[data-mt-h="forn"]', 'Fornecedor Teste'); await p.selectOption('[data-mt-l="0"][data-k="m"]', 'MAT-001'); await p.waitForTimeout(150);
  await p.fill('[data-mt-l="0"][data-k="q"]', '10'); await p.fill('[data-mt-l="0"][data-k="pu"]', '100'); await p.waitForTimeout(150); await p.click('#mt-save'); await p.waitForTimeout(300);
  // transferência 4 para o depósito
  await p.goto(base + '#materiais/entrega'); await p.waitForTimeout(300); await p.click('[data-mt-tipo="transf"]'); await p.waitForTimeout(300);
  await p.selectOption('[data-mt-h="dep2"]', 'DEP-02'); await p.selectOption('[data-mt-l="0"][data-k="m"]', 'MAT-001'); await p.waitForTimeout(150); await p.fill('[data-mt-l="0"][data-k="q"]', '4'); await p.waitForTimeout(150);
  await p.click('#mt-save'); await p.waitForTimeout(300);
  const sal = await p.evaluate(() => [ArmantMateriais.ledger(null, 'DEP-01')['MAT-001'].q, ArmantMateriais.ledger(null, 'DEP-02')['MAT-001'].q, ArmantMateriais.ledger()['MAT-001'].q, ArmantMateriais.ledger(null, 'DEP-02')['MAT-001'].cm]);
  ok('transferência: central 6, depósito 4, total 10, custo 100', sal.join() === '6,4,10,100');
  // saída do depósito acima do saldo bloqueia
  await p.click('[data-mt-tipo="entrega"]'); await p.waitForTimeout(300);
  await p.selectOption('[data-mt-h="dep"]', 'DEP-02'); await p.selectOption('[data-mt-h="cc"]', 'CC-2026-001'); await p.selectOption('[data-mt-h="rec"]', { index: 1 }); await p.selectOption('[data-mt-l="0"][data-k="m"]', 'MAT-001'); await p.waitForTimeout(150); await p.fill('[data-mt-l="0"][data-k="q"]', '5'); await p.waitForTimeout(200);
  ok('saída acima do saldo do estoque é bloqueada', await p.locator('#mt-save').isDisabled() && /Depósito obra CMPA/.test(await p.locator('#mt-side').innerText()));
  await p.fill('[data-mt-l="0"][data-k="q"]', '3'); await p.waitForTimeout(200); await p.click('#mt-save'); await p.waitForTimeout(300);
  ok('saída do depósito registrada', await p.evaluate(() => ArmantMateriais.ledger(null, 'DEP-02')['MAT-001'].q) === 1);
  await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(400);
  ok('estoque mostra o saldo por estoque', /Almoxarifado central: 6/.test(await p.locator('#mt-tab').innerText()));
  await p.click('[data-mt-dep="DEP-02"]'); await p.waitForTimeout(300);
  ok('filtro por estoque', /Estoque · Depósito obra CMPA/.test(await p.locator('#mt-tab').innerText()));
  // cadastrar vários
  await p.goto(base + '#materiais/catalogo'); await p.waitForTimeout(400);
  await p.fill('#mt-bulk', 'Descrição;Unidade;Categoria;Mínimo\nLuva de raspa; PAR; EPI; 10\nAbraçadeira nylon 200 mm; CX; Suportes e fixação\nTubo de cobre 1/4" (rolo 15 m); RL; Tubulação\nLuva de raspa; PAR'); await p.click('#mt-bulkprev'); await p.waitForTimeout(300);
  const t = await p.locator('.mt-bulk').innerText();
  ok('conferência mostra 2 ok, 1 já cadastrado, 1 repetido', /já cadastrado/.test(t) && /repetido na lista/.test(t) && /Cadastrar 2 material/.test(t));
  const n0 = await p.evaluate(() => ArmantMateriais.materiais().length); await p.click('#mt-bulkok'); await p.waitForTimeout(300);
  ok('cadastrou 2', await p.evaluate(() => ArmantMateriais.materiais().length) === n0 + 2);
  // exportar CSV
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-mt-exp="csv"][data-q="materiais"]')]);
  const csvPath = path.join(OUT, 'tdl', dl.suggestedFilename()); await dl.saveAs(csvPath); const csv = fs.readFileSync(csvPath, 'utf8');
  ok('CSV de materiais (; e BOM)', csv.charCodeAt(0) === 0xfeff && /^﻿Código;Descrição;Unidade;Categoria;Mínimo/.test(csv) && /Luva de raspa/.test(csv));
  // importar CSV: um novo, um atualizado, um saldo
  const imp = path.join(OUT, 'tdl', 'imp.csv'); fs.writeFileSync(imp, '﻿Código;Descrição;Unidade;Categoria;Mínimo;Saldo;Custo médio;Estoque\nMAT-002;Tubo de cobre 3/8" (rolo 15 m);RL;Tubulação;9;;;\n;Fita isolante 19 mm;RL;Elétrica;5;20;"7,50";Depósito obra CMPA\nMAT-001;Tubo de cobre 1/4" (rolo 15 m);RL;Tubulação;4;8;;Almoxarifado central\n');
  await p.setInputFiles('#mt-impfile', imp); await p.waitForTimeout(600);
  const pv = await p.locator('.mt-impprev').innerText();
  ok('prévia: 1 novo, 1 atualizado, 2 saldos', /1 material\(is\) novo/.test(pv) && /1 material\(is\) com cadastro atualizado/.test(pv) && /2 saldo/.test(pv));
  await p.click('#mt-impok'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const M = ArmantMateriais, f = M.materiais().find(m => /Fita isolante/.test(m.d)); return [M.materiais().find(m => m.id === 'MAT-002').min, f ? M.ledger(null, 'DEP-02')[f.id].q : -1, f ? M.ledger(null, 'DEP-02')[f.id].cm : -1, M.ledger(null, 'DEP-01')['MAT-001'].q]; });
  ok('importação aplicada (mínimo 9, fita 20 a 7,50 no depósito, cobre 1/4 central 8)', r.join() === '9,20,7.5,8');
  await p.setInputFiles('#mt-impfile', imp); await p.waitForTimeout(600);
  ok('reimportar a mesma planilha não duplica', /0 material\(is\) novo/.test(await p.locator('.mt-impprev').innerText()) && /0 saldo/.test(await p.locator('.mt-impprev').innerText()));
  await p.click('#mt-impx');
  // Excel
  let xl = false; try { const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('[data-mt-exp="xlsx"]')]); const xp = path.join(OUT, 'tdl', d2.suggestedFilename()); await d2.saveAs(xp); xl = fs.readFileSync(xp).slice(0, 2).toString() === 'PK';
    await p.setInputFiles('#mt-impfile', xp); await p.waitForTimeout(900); xl = xl && /0 material\(is\) novo/.test(await p.locator('.mt-impprev').innerText()); } catch (e) { console.log('   (Excel:', e.message.split('\n')[0], ')'); }
  ok('Excel exporta (.xlsx) e reimporta sem mudanças', xl);
  await p.goto(base + '#materiais/movs'); await p.waitForTimeout(300);
  ok('movimentações mostram a transferência', /Almoxarifado central → Depósito obra CMPA/.test(await p.locator('#mt-tab').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
