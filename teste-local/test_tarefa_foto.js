// App de campo: concluir tarefa exige foto com legenda; legenda aparece no escritório
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html', FOTO = path.join(OUT, 'foto_servico.jpg');
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  const id = await p.evaluate(() => { const u = ArmantAcesso.user(); return ArmantCampo.programar({ cc: 'CC-2026-001', titulo: 'Instalar evaporadora sala 3', resp: u.nome, foto: false }).id; });
  await p.goto(base + '#campo/tarefa/' + id); await p.waitForTimeout(700);
  ok('aviso de foto com legenda ao concluir', /uma foto com legenda/.test(await p.locator('.cp-need').innerText()));
  await p.click('#cp-tar button[type=submit]'); await p.waitForTimeout(300);
  ok('sem foto não conclui', await p.evaluate(id => ArmantCampo.state.tar.find(t => t.id === id).st, id) === 'pendente');
  await p.setInputFiles('#cp-tfile', FOTO); await p.waitForTimeout(800);
  ok('foto entra com campo de legenda', await p.locator('[data-cp-leg="0"]').count() === 1);
  await p.click('#cp-tar button[type=submit]'); await p.waitForTimeout(300);
  ok('foto sem legenda não conclui', await p.evaluate(id => ArmantCampo.state.tar.find(t => t.id === id).st, id) === 'pendente');
  await p.fill('[data-cp-leg="0"]', 'Evaporadora instalada e nivelada'); await p.fill('#cp-tar [name=com]', 'ok'); await p.waitForTimeout(150);
  ok('aviso fica verde com a legenda', await p.locator('.cp-need.ok').count() === 1);
  if (OUT) await p.screenshot({ path: OUT + '/shot_tarefa.png', fullPage: true });
  await p.click('#cp-tar button[type=submit]'); await p.waitForTimeout(500);
  const r = await p.evaluate(id => { const t = ArmantCampo.state.tar.find(t => t.id === id); return [t.st, t.res.fotos.length, t.res.legs[0]]; }, id);
  ok('conclui com foto e legenda salvas', r[0] === 'feito' && r[1] === 1 && r[2] === 'Evaporadora instalada e nivelada');
  // parcial: foto não obrigatória
  const id2 = await p.evaluate(() => ArmantCampo.programar({ cc: 'CC-2026-001', titulo: 'Passar tubulação', resp: ArmantAcesso.user().nome, foto: false }).id);
  await p.goto(base + '#campo/tarefa/' + id2); await p.waitForTimeout(500); await p.click('[data-cp-st="parcial"]'); await p.waitForTimeout(200);
  await p.fill('#cp-tar [name=com]', 'Faltou material'); await p.click('#cp-tar button[type=submit]'); await p.waitForTimeout(400);
  ok('"feita em parte" não exige foto', await p.evaluate(id => ArmantCampo.state.tar.find(t => t.id === id).st, id2) === 'parcial');
  await p.setViewportSize({ width: 1366, height: 900 }); await p.goto(base + '#programacao'); await p.waitForTimeout(600);
  ok('escritório vê a legenda da foto', /Evaporadora instalada e nivelada/.test(await p.locator('#view').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
