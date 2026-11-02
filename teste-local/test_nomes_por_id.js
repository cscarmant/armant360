// Nomes por id: o histórico do RH e as notificações do núcleo guardam o id da pessoa e mostram o nome do cadastro atual.
// Quem saiu do cadastro continua aparecendo com o nome gravado na época.
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');

  // monta dados no formato que o sistema grava, usando a pessoa logada
  const eu = await p.evaluate(() => ArmantAcesso.user());
  const hoje = new Date().toISOString().slice(0, 10);
  await p.evaluate(([eu, hoje]) => {
    const ac = JSON.parse(localStorage.getItem('a360acesso'));
    ac.users.find(u => u.id === eu.id).nome = 'NOME NOVO TESTE';
    localStorage.setItem('a360acesso', JSON.stringify(ac));
    localStorage.setItem('a360rh', JSON.stringify({ via: [{ id: 'VIA-T1', uid: eu.id, destino: 'Cidade teste', ida: hoje, volta: hoje, motivo: 'teste de nome', st: 'aprovada', em: hoje, cc: '', hist: [
      { t: hoje, uid: eu.id, nome: 'NOME ANTIGO', st: 'aprovada', com: '' },
      { t: hoje, uid: 'USR-SAIU', nome: 'Ex funcionario', st: 'aprovada', com: '' },
      { t: hoje, nome: 'Texto antigo', st: 'aprovada', com: '' }] }], docs: [], seq: { v: 1, d: 0 } }));
    localStorage.setItem('a360nucleo', JSON.stringify({ log: [], notif: [{ id: 'NT1', para: eu.id, de: eu.id, deNome: 'NOME ANTIGO', tipo: 'aviso', titulo: 'Aviso de teste', texto: 'x', link: '', em: new Date().toISOString(), lida: false, pop: false }, { id: 'NT2', para: eu.id, de: 'USR-SAIU', deNome: 'Ex funcionario', tipo: 'aviso', titulo: 'Aviso antigo', texto: 'y', link: '', em: new Date().toISOString(), lida: false, pop: false }], atr: [], msgs: [], dest: [], lidas: {}, reun: [], seq: { n: 2, a: 0, m: 0, d: 0, r: 0 }, ultimo: {} }));
  }, [eu, hoje]);
  await p.goto(base + '#rh/viagens'); await p.reload(); await p.waitForTimeout(800);

  const rh = await p.evaluate(() => document.getElementById('view') ? document.getElementById('view').innerText : '');
  ok('histórico do RH mostra o nome atual (pelo id)', rh.includes('NOME NOVO TESTE') && !rh.includes('NOME ANTIGO'));
  ok('histórico do RH mantém o nome de quem saiu do cadastro', rh.includes('Ex funcionario'));
  ok('histórico antigo sem id continua com o nome gravado', rh.includes('Texto antigo'));

  await p.click('#nt-bell').catch(() => {}); await p.waitForTimeout(400);
  const nt = await p.evaluate(() => Array.from(document.querySelectorAll('.nt-dd, .nt-list, #nt-panel')).map(x => x.innerText).join(' | '));
  ok('notificação mostra o nome atual de quem enviou', nt.includes('NOME NOVO TESTE') && !nt.includes('NOME ANTIGO'));
  ok('notificação de quem saiu mostra o nome gravado', nt.includes('Ex funcionario'));

  // fonte da nota fiscal: o centro de custo leva ao cliente pelo id (a emissão em si não é testada aqui)
  const cli = await p.evaluate(() => ArmantCadastros.demandas().find(d => d.cc === 'CC-2026-001').cli);
  ok('centro de custo CC-2026-001 aponta para o cliente pelo id', cli === 'CLI-001');

  ok('sem erros de página', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
