// Fluxo: painel geral com obras por etapa, lista curta, filtro e ajuste manual
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => { localStorage.removeItem('a360fluxoetapa'); localStorage.removeItem('a360cad'); localStorage.removeItem('a360kanban'); }); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900);
  await p.goto(base + '#fluxo'); await p.waitForTimeout(700);
  ok('painel geral no topo do fluxo', await p.locator('.fx-pg').count() === 1 && await p.evaluate(() => { const a = document.querySelector('.fx-pg'), b2 = document.querySelector('.fx-legenda'); return !!(a.compareDocumentPosition(b2) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  ok('10 etapas com contagem', await p.locator('.fx-etc').count() === 10);
  const tot = await p.$$eval('.fx-eth em', e => e.reduce((a, x) => a + +x.textContent, 0)); ok('soma das etapas = 15 obras', tot === 15);
  ok('lista curta (até 4) e "+ N obra(s)"', await p.locator('.fx-etc:nth-child(7) .fx-mini li a').count() === 4 && /\+ 7 obra/.test(await p.locator('.fx-etc:nth-child(7)').innerText()));
  await p.click('[data-fx-mais="7"]'); await p.waitForTimeout(300); ok('ver todas da etapa', await p.locator('.fx-maislist li').count() === 11);
  await p.click('.fx-etc:nth-child(8) .fx-eth'); await p.waitForTimeout(300); ok('clicar na etapa filtra as tarefas (Medições: 9)', await p.locator('.fx-card').count() === 9);
  await p.selectOption('[data-fx-mv="OB-001"]', '8'); await p.waitForTimeout(300);
  ok('ajuste manual da etapa (OB-001 → Medições)', await p.evaluate(() => ArmantFluxo.obras().find(x => x.k === 'OB-001').et) === 8 && /Hospital Horizonte/.test(await p.locator('.fx-etc:nth-child(8)').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
