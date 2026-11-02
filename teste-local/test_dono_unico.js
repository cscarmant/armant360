// Dono único: cada informação tem um só lugar. R.O. só em C.resp; a chave a360mat só é gravada por materiais.js; a360ctrl só por controle.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');

  /* 1. quem grava cada chave: só o dono */
  const web = SITE, arq = fs.readdirSync(web).filter(f => f.endsWith('.js'));
  const quem = (chave) => arq.filter(f => fs.readFileSync(path.join(web, f), 'utf8').includes("setItem('" + chave + "'"));
  ok('a360mat é gravada só por materiais.js', JSON.stringify(quem('a360mat')) === JSON.stringify(['materiais.js']));
  ok('a360ctrl é gravada só por controle.js', JSON.stringify(quem('a360ctrl')) === JSON.stringify(['controle.js']));

  /* 2. R.O. em um lugar só: grava pelo dono, lê em todas as telas pelo mesmo acesso */
  const r = await p.evaluate(() => {
    const C = ArmantCadastros, out = {};
    const uid = (ArmantAcesso.users()[0] || {}).id;
    C.setResp('CC-2026-001', 'ro', uid);
    out.lido = C.roDe('CC-2026-001') === uid;
    out.banco = (ArmantBanco.linhas('demandas').find(x => x.cc === 'CC-2026-001') || {}).ro === ArmantAcesso.users()[0].nome;
    out.semCopia = C.demandas().every(d => !d.ro);
    return out;
  });
  ok('R.O. gravado pelo dono e lido pelo acesso único', r.lido);
  ok('Banco de dados mostra o mesmo R.O. (sem cópia na demanda)', r.banco && r.semCopia);

  /* 3. obras e clientes continuam vindo só de ArmantCadastros.demandas() / clientes() */
  const so = await p.evaluate(() => ArmantBanco.linhas('demandas').length === ArmantCadastros.demandas().length);
  ok('aba de obras lê só ArmantCadastros.demandas()', so);

  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
