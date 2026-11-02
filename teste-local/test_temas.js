// Opções de design: seletor existe, troca as cores (variáveis), guarda a escolha neste navegador e volta ao padrão
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');
  ok('seletor de design na tela', await p.locator('#a360-tema select option').count() === 4);
  const cor = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--petrol').trim());
  const padrao = await cor();
  await p.selectOption('#a360-tema select', 'azul'); await p.waitForTimeout(200);
  ok('tema Azul troca a cor principal', (await cor()) === '#1e3a5f' && (await cor()) !== padrao);
  ok('escolha guardada neste navegador', await p.evaluate(() => localStorage.getItem('a360tema')) === 'azul');
  await p.reload(); await p.waitForTimeout(700);
  ok('escolha volta depois de recarregar', (await cor()) === '#1e3a5f');
  await p.selectOption('#a360-tema select', 'padrao'); await p.waitForTimeout(200);
  ok('Padrão restaura as cores originais', (await cor()) === padrao);
  const fs = require('fs'); ok('chave do tema fora da sincronização com o banco', /a360tema: 1/.test(fs.readFileSync(SITE + '/ponte-supabase.js', 'utf8')));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
