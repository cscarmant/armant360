// "Entrar com Google": abre a página do Google (accounts.google.com) e volta logado
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = process.argv[2];
const srv = http.createServer((q, s) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(SITE, u); if (!fs.existsSync(f)) { s.statusCode = 404; return s.end(); } s.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); s.end(fs.readFileSync(f)); }).listen(0);
const BASE = 'http://localhost:' + srv.address().port + '/';
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); let ida = null;
  await p.route('https://accounts.google.com/**', r => { const u = new URL(r.request().url()); ida = u;
    const jwt = ['e30', Buffer.from(JSON.stringify({ email: 'valentim.arr@gmail.com', email_verified: true, nonce: u.searchParams.get('nonce') })).toString('base64url'), 'x'].join('.');
    r.fulfill({ status: 302, headers: { Location: u.searchParams.get('redirect_uri') + '#id_token=' + jwt + '&state=' + u.searchParams.get('state') } }); });
  await p.goto(BASE); await p.waitForTimeout(500);
  await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('a360acesso')); a.cfg.gid = '123-teste.apps.googleusercontent.com'; localStorage.setItem('a360acesso', JSON.stringify(a)); }); await p.reload(); await p.waitForTimeout(600);
  await p.click('#ac-google'); await p.waitForTimeout(1500);
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  ok('foi para a página de login do Google', ida && ida.pathname === '/o/oauth2/v2/auth' && ida.searchParams.get('client_id') === '123-teste.apps.googleusercontent.com' && ida.searchParams.get('prompt') === 'select_account');
  ok('voltou logado como Valentim', (await p.evaluate(() => (window.ArmantAcesso.user() || {}).email)) === 'valentim.arr@gmail.com');
  ok('token removido do endereço', !/id_token/.test(p.url()));
  // token adulterado (nonce diferente) não entra
  await p.evaluate(() => ArmantAcesso.logout()); await p.waitForTimeout(300);
  const fake = ['e30', Buffer.from(JSON.stringify({ email: 'valentim.arr@gmail.com', email_verified: true, nonce: 'outro' })).toString('base64url'), 'x'].join('.');
  await p.evaluate(() => sessionStorage.setItem('a360g', JSON.stringify({ st: 'S1', nc: 'N1' })));
  await p.goto(BASE + '#id_token=' + fake + '&state=S1'); await p.reload(); await p.waitForTimeout(700);
  ok('token com nonce errado é recusado', !(await p.evaluate(() => window.ArmantAcesso.user())));
  console.log('erros:', errs.length ? errs : 'nenhum'); await b.close(); srv.close();
})();
