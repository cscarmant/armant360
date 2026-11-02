// Banco de dados do estoque: base oficial (ORGANIZAÇÃO ESTOQUE REV 01) carregada no primeiro uso; quem já tem dados escolhe carregar
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const resumo = () => p.evaluate(() => { const M = ArmantMateriais, mat = M.materiais(), st = M.ledger(); return { n: mat.length, val: Math.round(mat.reduce((a, m) => a + Math.max(0, st[m.id].q) * st[m.id].cm, 0) * 100) / 100, base: M.base(), ex: mat.filter(m => m.ex).length, deps: M.estoques().length }; });
  await p.goto(base); await p.waitForTimeout(300); await p.evaluate(() => localStorage.removeItem('a360mat')); await p.reload(); await p.waitForTimeout(700);
  let r = await resumo(); console.log('   ' + JSON.stringify(r));
  ok('primeiro uso: base oficial carregada (836 materiais, R$ 650.566,55, sem exemplos)', r.n === 836 && Math.abs(r.val - 650566.56) < 1 && r.ex === 0 && r.base && r.base.fonte === 'ORGANIZAÇÃO ESTOQUE REV 01');
  await p.reload(); await p.waitForTimeout(600); r = await resumo();
  ok('recarregar não duplica', r.n === 836 && Math.abs(r.val - 650566.56) < 1);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(700);
  { const tb = await p.locator('.mt-base').first().innerText().catch(e => 'ERRO ' + e.message); ok('tela de estoque mostra a base oficial', /banco de dados do estoque/i.test(tb) && /ORGANIZAÇÃO ESTOQUE REV 01/.test(tb)); if (!/ORGANIZA/.test(tb)) console.log('   ', tb.slice(0, 200)); }
  ok('movimentação de inventário inicial na data da base', await p.evaluate(() => ArmantMateriais.state.mov.filter(v => /Inventário inicial/.test(v.doc) && v.data === '2026-10-30').length) === 2);
  // navegador com dados próprios: não troca sozinho
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('a360mat')); s.base = null; s.mat = s.mat.slice(0, 3); s.mov = []; localStorage.setItem('a360mat', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(700);
  r = await resumo(); ok('dados próprios não são trocados sozinhos', r.n === 3 && !r.base);
  await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(600);
  ok('oferece carregar a base oficial', await p.locator('#mt-baseprev').count() === 1);
  await p.click('#mt-baseprev'); await p.waitForTimeout(800); ok('prévia antes de gravar', /833 material\(is\) novo/.test(await p.locator('.mt-impprev').innerText()));
  await p.click('#mt-impok'); await p.waitForTimeout(800); r = await resumo();
  ok('base oficial gravada por escolha (836 e valor certo)', r.n === 836 && Math.abs(r.val - 650566.56) < 1 && r.base);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
