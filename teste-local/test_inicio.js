// Entrada no Início (não no Dia a Dia) e setor Comercial na tela inicial
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('STACK', (e.stack||'').split('\n').slice(0,4).join(' | ').slice(0,500)); });
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.removeItem('a360simples'); sessionStorage.setItem('a360ultimo', 'x'); });
  await p.evaluate(() => { location.hash = '#atribuidas'; }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(900);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  ok('entrada cai no Início, não no Dia a Dia', (await p.evaluate(() => location.hash)) === '#inicio' && (await p.locator('#view .sx-setor').count()) >= 6);
  const nomes = await p.locator('#view .sx-setor strong').allInnerTexts();
  ok('Comercial aparece na tela inicial', nomes.includes('Comercial'));
  console.log('   setores:', nomes.join(' · '));
  await p.locator('#view .sx-setor', { hasText: 'Comercial' }).click(); await p.waitForTimeout(400);
  const botoes = await p.locator('#view .sx-btn strong').allInnerTexts();
  ok('setor Comercial tem Clientes, Negociações e Painel', botoes.length === 3);
  await p.locator('#view .sx-btn', { hasText: 'Clientes' }).click(); await p.waitForTimeout(500);
  ok('botão Clientes abre a tela de clientes', /Clientes|cliente/i.test(await p.locator('#page-title').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
