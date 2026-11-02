// Login sem e-mail e senha: Entrar com Google + ENTRAR DEMO (versão de demonstração)
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(600);
  ok('no protótipo o login tem e-mail e senha', (await p.locator('#ac-login [name=email]').count()) === 1);
  ok('tem Entrar com Google', (await p.locator('#ac-google').count()) === 1);
  ok('tem ENTRAR DEMO e "Versão de demonstração"', (await p.locator('#ac-entrar-demo').innerText()) === 'ENTRAR DEMO' && /Versão de demonstração/.test(await p.locator('.ac-demo-msg').innerText()));
  await p.screenshot({ path: OUT + '/login-demo.png' });
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  ok('ENTRAR DEMO entra como superadmin, sem pedir senha', await p.evaluate(() => { const u = ArmantAcesso.user(); return !!u && u.nivel >= 6; }));
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#acesso'); await p.waitForTimeout(500);
  ok('Usuários e acessos sem "Minha senha", "Senha inicial" e "Nova senha"', !/Minha senha|Senha inicial|Nova senha/.test(await p.locator('#view').innerText()));
  await p.fill('#ac-new [name=nome]', 'Pessoa Nova'); await p.fill('#ac-new [name=email]', 'pessoa.nova@gmail.com'); await p.click('#ac-new button[type=submit]'); await p.waitForTimeout(400);
  ok('cadastra usuário sem senha', await p.evaluate(() => ArmantAcesso.users().some(u => u.email === 'pessoa.nova@gmail.com')));
  await p.click('#ac-out').catch(() => p.evaluate(() => ArmantAcesso.logout())); await p.waitForTimeout(600);
  ok('ao sair volta para o login com ENTRAR DEMO', (await p.locator('#ac-entrar-demo').count()) === 1);
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
