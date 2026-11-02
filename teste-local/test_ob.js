// Várias obras por usuário: cadastro, tabela de usuários e aprovação de pedido
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(500); await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'valentim.arr@gmail.com'); await p.waitForTimeout(800);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.evaluate(() => { const C = ArmantCadastros.state; [['CC-2026-002', 'Banrisul Vale do Sol'], ['CC-2026-003', 'Hospital Moinhos'], ['CC-2026-004', 'CMPA Câmara Municipal'], ['CC-2026-005', 'Banrisul Agência Centro']].forEach(([cc, nome]) => C.dem.push({ cc, nome, cli: '', etapa: 2 })); localStorage.setItem('a360cad', JSON.stringify(C)); });
  await p.goto(base + '#acesso'); await p.reload(); await p.waitForTimeout(900);
  const f = p.locator('#ac-new'); console.log(await p.evaluate(() => [ArmantCadastros.demandas().length, document.querySelectorAll('#ac-new .ac-obp-i').length, !!document.querySelector('#ac-new'), location.hash]));
  ok('formulário lista as 5 obras com nome', (await f.locator('.ac-obp-i').count()) === 5 && /Hospital Moinhos/.test(await f.locator('.ac-obp-l').innerText()));
  await f.locator('[data-obp-q]').fill('banrisul');
  ok('busca filtra (2 Banrisul)', (await f.locator('.ac-obp-i:not([hidden])').count()) === 2);
  await f.locator('[data-obp=all]').click();
  ok('marcar todas marca só as filtradas', /2 de 5/.test(await f.locator('[data-obp-n]').innerText()));
  await f.locator('[data-obp-q]').fill('');
  await f.locator('.ac-obp-i', { hasText: 'CMPA' }).click();
  ok('contador 3 de 5', /3 de 5/.test(await f.locator('[data-obp-n]').innerText()));
  await f.locator('[name=nome]').fill('Teste Várias'); await f.locator('[name=email]').fill('varias@gmail.com'); if (await f.locator('[name=pw]').count()) await f.locator('[name=pw]').fill('abc12345');
  await p.screenshot({ path: OUT + '/obras-multi.png' });
  await f.locator('button[type=submit]').click(); await p.waitForTimeout(600);
  const u = await p.evaluate(() => JSON.parse(localStorage.getItem('a360acesso')).users.find(x => x.email === 'varias@gmail.com'));
  ok('usuário salvo com 3 obras', u && u.obras.length === 3 && u.obras.includes('CC-2026-004'));
  const row = p.locator('tr', { hasText: 'varias@gmail.com' });
  await row.locator('.ac-ob summary').click(); await row.locator('[data-obp=all]').click(); await p.waitForTimeout(300);
  ok('tabela: marcar todas grava as 5', (await p.evaluate(() => JSON.parse(localStorage.getItem('a360acesso')).users.find(x => x.email === 'varias@gmail.com').obras.length)) === 5);
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
