// Pessoa por id nas tarefas do campo: grava o id, converte nome antigo ao abrir o campo e mostra o nome na tela
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');

  const users = await p.evaluate(() => ArmantAcesso.users().map(u => ({ id: u.id, nome: u.nome })));
  const u1 = users[0], u2 = users[0]; // a demo tem uma pessoa só
  const t = await p.evaluate(([a, b2]) => {
    const T = ArmantCampo.programar({ cc: 'CC-2026-001', titulo: 'Teste de id', resp: a.id, equipe: [b2.id], data: new Date().toISOString().slice(0, 10) });
    return { resp: T.resp, equipe: T.equipe };
  }, [u1, u2]);
  ok('tarefa gravada com o id da pessoa (não com o nome)', t.resp === u1.id && t.equipe[0] === u2.id);

  // nome antigo (texto) é convertido para o id ao abrir o campo
  await p.evaluate(([nome]) => { ArmantCampo.state.tar.push({ id: 'TAR-LEG', data: new Date().toISOString().slice(0, 10), cc: 'CC-2026-001', titulo: 'Antiga', resp: nome, equipe: [], st: 'pendente' }); localStorage.setItem('a360campo', JSON.stringify(ArmantCampo.state)); }, [u1.nome]);
  await p.goto(base + '#campo'); await p.reload(); await p.waitForTimeout(700);
  const leg = await p.evaluate(() => ArmantCampo.state.tar.find(x => x.id === 'TAR-LEG'));
  ok('nome antigo convertido para o id ao abrir o campo', leg && leg.resp === u1.id);

  // a tela mostra o nome, não o id
  const txt = await p.evaluate(() => document.getElementById('view') ? document.getElementById('view').innerText : '');
  ok('tela do campo mostra o nome da pessoa', txt.includes(u1.nome) && !txt.includes(u1.id));

  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
