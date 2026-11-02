// Catálogo por área: Civil, Elétrica, Mecânica · HVAC; cada fornecedor com fonte e status; nenhum contato inventado; aparece no Banco de dados
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');

  const c = await p.evaluate(() => {
    const K = ArmantCatalogoAreas, F = K.fornecedores();
    return {
      areas: K.areas().map(a => a.id),
      porArea: ['civil', 'eletrica', 'mecanica'].map(a => ({ a, forn: K.fornecedores(a).length, mat: K.materiais(a).length, eq: K.equipamentos(a).length, sv: K.servicos(a).length })),
      todosComFonte: F.every(f => /^https?:\/\//.test(f.fonte) && ['confirmar', 'validado', 'descartado'].includes(f.status)),
      semContato: F.every(f => !Object.keys(f).some(k => /fone|telefone|email|whats|cnpj/i.test(k)))
    };
  });
  ok('três áreas: civil, elétrica e mecânica', JSON.stringify(c.areas) === JSON.stringify(['civil', 'eletrica', 'mecanica']));
  ok('cada área tem fornecedores, materiais, equipamentos e serviços', c.porArea.every(x => x.forn > 0 && x.mat > 0 && x.eq > 0 && x.sv > 0));
  ok('todo fornecedor tem fonte (link) e status', c.todosComFonte);
  ok('nenhum telefone, e-mail ou CNPJ inventado no catálogo', c.semContato);

  await p.click('#navigation a[href="#banco"]'); await p.waitForTimeout(500);
  const n = await p.evaluate(() => ArmantBanco.tabelas().filter(t => t.grupo === 'Catálogo por área').map(t => [t.id, t.registros]));
  ok('Banco de dados mostra as 4 tabelas do catálogo', n.length === 4 && n.every(x => x[1] > 0));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
