// Login: e-mail e senha no protótipo (ENTRAR DEMO e Google continuam); senha errada é recusada
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(500);
  ok('tela tem e-mail e senha, ENTRAR DEMO e Google', (await p.locator('#ac-login [name=email]').count()) === 1 && (await p.locator('#ac-entrar-demo').count()) === 1 && (await p.locator('#ac-google').count()) === 1);
  await p.screenshot({ path: OUT + '/login-email.png' });
  await p.fill('#ac-login [name=email]', 'valentim.arr@gmail.com'); await p.fill('#ac-login [name=pw]', 'senha-errada'); await p.click('#ac-login button'); await p.waitForTimeout(400);
  ok('senha errada é recusada', /incorretos/.test(await p.locator('#ac-login .ac-err').innerText()));
  await p.fill('#ac-login [name=pw]', 'jonjon'); await p.click('#ac-login button'); await p.waitForTimeout(800);
  ok('senha certa entra como Valentim', await p.evaluate(() => ArmantAcesso.user() && ArmantAcesso.user().email === 'valentim.arr@gmail.com'));
  await p.evaluate(() => ArmantAcesso.logout()); await p.waitForTimeout(500);
  await p.fill('#ac-login [name=email]', 'nao@outlook.com'); await p.fill('#ac-login [name=pw]', 'x'); await p.click('#ac-login button'); await p.waitForTimeout(300);
  ok('e-mail que não é Gmail é recusado', /só com conta Gmail/.test(await p.locator('#ac-login .ac-err').innerText()));
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(600);
  ok('ENTRAR DEMO continua funcionando', await p.evaluate(() => !!ArmantAcesso.user()));
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
