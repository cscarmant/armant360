// Importa a planilha de estoque da Armant (ORGANIZAÇÃO ESTOQUE REV 01) pelo Almoxarifado e confere os números
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], ARQ = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360mat', JSON.stringify({ semBase: true }))); await p.reload(); await p.waitForTimeout(400); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900);
  await p.goto(base + '#materiais/catalogo'); await p.waitForTimeout(500);
  const t0 = Date.now(); await p.setInputFiles('#mt-impfile', ARQ); await p.waitForSelector('.mt-impprev', { timeout: 30000 }); const tl = Date.now() - t0;
  const pv = await p.locator('.mt-impprev').innerText(); console.log('   prévia (' + tl + ' ms):\n   ' + pv.split('\n').slice(0, 7).join('\n   '));
  ok('839 linhas lidas', /839 linha/.test(pv));
  ok('opção de tirar os exemplos marcada', await p.locator('#mt-tiraex').isChecked());
  const t1 = Date.now(); await p.click('#mt-impok'); await p.waitForTimeout(800); console.log('   gravação: ' + (Date.now() - t1) + ' ms');
  const r = await p.evaluate(() => { const M = ArmantMateriais, mat = M.materiais(), st = M.ledger(), val = mat.reduce((a, m) => a + Math.max(0, st[m.id].q) * st[m.id].cm, 0);
    return { n: mat.length, ex: mat.filter(m => m.ex).length, com: mat.filter(m => st[m.id].q > 0).length, val: Math.round(val * 100) / 100, cob: mat.find(m => m.id === 'COBC0001'), deps: M.estoques().map(d => d.nome), semCod: mat.filter(m => /^MAT-/.test(m.id)).length, cats: [...new Set(mat.map(m => m.cat))].length, uns: [...new Set(mat.map(m => m.u))].join(',') }; });
  console.log('   ' + JSON.stringify(r));
  ok('836 materiais (3 descrições repetidas somadas), exemplos removidos', r.n === 836 && r.ex === 0);
  ok('código original mantido (COBC0001 · cobre flex 1/2 · KG · Cobre)', r.cob && r.cob.u === 'KG' && r.cob.cat === 'Cobre' && /COBRE FLEX 1\/2/.test(r.cob.d));
  ok('valor em estoque confere com a planilha (R$ 650.566,56)', Math.abs(r.val - 650566.56) < 1);
  ok('estoques: central (Almoxarifado Geral e Almox) + Sem local definido', r.deps.length === 2 && r.deps[1] === 'Sem local definido');
  await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(800);
  ok('tela de estoque abre com os 836', await p.locator('.mt-tab tbody tr').count() >= 800);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
