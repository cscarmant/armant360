// Estoque com exemplos de foto: todo material de exemplo tem uma imagem; a foto real substitui a de exemplo
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360mat', JSON.stringify({ semBase: true }))); await p.reload(); await p.waitForTimeout(400); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#materiais/estoque'); await p.waitForTimeout(800);
  const n = await p.evaluate(() => ArmantMateriais.materiais().length);
  const com = await p.evaluate(() => ArmantMateriais.materiais().filter(m => m.foto).length);
  ok('todo material de exemplo tem imagem (' + com + ' de ' + n + ')', com === n && n > 0);
  ok('estoque mostra as miniaturas', (await p.locator('.mt-thb img').count()) === n);
  await p.locator('.mt-thb').first().click(); await p.waitForTimeout(300);
  ok('ampliar diz que é ilustração de exemplo', /ilustração de exemplo/.test(await p.locator('.mt-lb figcaption').innerText()));
  await p.click('[data-mt-lbx]');
  await p.goto(base + '#materiais/catalogo'); await p.waitForTimeout(700);
  const id = await p.evaluate(() => ArmantMateriais.materiais()[0].id);
  await p.setInputFiles('[data-mt-foto="' + id + '"]', path.join(OUT, 'bomba.jpg')); await p.waitForTimeout(900);
  ok('foto real troca a de exemplo', await p.evaluate(id => { const m = ArmantMateriais.materiais().find(x => x.id === id); return !!m.foto && !m.fotoEx; }, id));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await p.screenshot({ path: OUT + '/estoque-exemplos.png', fullPage: false });
  await b.close();
})();
