// Modo simples v2: 1ª tela só com setores; botão de modo; estoque com foto; ver e trocar
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360simples')); await p.reload(); await p.waitForTimeout(300);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(700);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#inicio'); await p.waitForTimeout(700);
  ok('primeira tela: só botões de setor (8)', (await p.locator('#view .sx-setor').count()) === 8 && (await p.locator('#view .sx-btn').count()) === 8);
  ok('botão de modo visível no topo', (await p.locator('#sx-modo').count()) === 1 && /ligado/.test(await p.locator('#sx-modo').innerText()));
  ok('primeira tela sem cabeçalho nem rodapé', !(await p.locator('.page-footer').isVisible()));
  await p.screenshot({ path: OUT + '/v2-inicio.png' });
  await p.click('#view .sx-setor[href="#setor/suprimentos"]'); await p.waitForTimeout(400);
  ok('setor Suprimentos tem 3 botões', (await p.locator('#view .sx-btn').count()) === 3);
  await p.screenshot({ path: OUT + '/v2-suprimentos.png' });
  await p.goto(base + '#setor/almoxarifado'); await p.waitForTimeout(500);
  ok('setor Almoxarifado tem 5 botões (com Movimentações)', (await p.locator('#view .sx-btn').count()) === 5);
  // estoque com foto
  await p.goto(base + '#materiais/catalogo'); await p.waitForTimeout(700);
  const mid = await p.evaluate(() => ArmantMateriais.materiais()[0].id);
  await p.setInputFiles('[data-mt-foto="' + mid + '"]', path.join(OUT, 'bomba.jpg')); await p.waitForTimeout(900);
  ok('foto do material salva', await p.evaluate(id => !!ArmantMateriais.materiais().find(m => m.id === id).foto, mid));
  ok('estoque mostra a miniatura', (await p.locator('.mt-thb img').count()) >= 1);
  await p.locator('.mt-thb').first().click(); await p.waitForTimeout(300);
  ok('foto abre ampliada', (await p.locator('.mt-lb img').count()) === 1);
  await p.screenshot({ path: OUT + '/v2-estoque.png' });
  await p.click('[data-mt-lbx]');
  // trocar de modo
  await p.click('#sx-modo'); await p.waitForTimeout(1200);
  ok('botão desliga o modo e mostra o menu completo', (await p.locator('#navigation .nav-item').count()) > 8 && /desligado/.test(await p.locator('#sx-modo').innerText()));
  await p.click('#sx-modo'); await p.waitForTimeout(1200);
  ok('botão liga de novo o modo simples', (await p.locator('#view .sx-setor').count()) === 8);
  ok('sem erros de página', errs.length === 0);
  if (errs.length) console.log(errs);
  await b.close();
})();
