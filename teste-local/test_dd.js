// Dia a Dia: tarefas atribuídas + mensagens em destaque + atividades + campo, por ordem de urgência
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const skip = async () => { if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {}); };
  const entrar = async (em, pw, nova) => { await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, em); await p.waitForTimeout(800);
    if (nova && await p.locator('#ac-pw').count()) { await p.fill('#ac-pw [name=pw]', nova); await p.fill('#ac-pw [name=pw2]', nova); await p.click('#ac-pw button[type=submit]'); await p.waitForTimeout(700); } await skip(); };
  const hoje = new Date().toISOString().slice(0, 10), add = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  await p.goto(base); await p.waitForTimeout(500); await entrar('valentim.arr@gmail.com', 'jonjon'); await skip();
  await p.goto(base + '#acesso'); await p.waitForTimeout(400);
  await p.fill('#ac-new [name=nome]', 'Ana Souza'); await p.fill('#ac-new [name=email]', 'ana.souza@gmail.com'); await p.selectOption('#ac-new [name=nivel]', '3'); await p.selectOption('#ac-new [name=setor]', 'Engenharia'); await p.fill('#ac-new [name=pw]', 'inicial123'); await p.click('#ac-new button[type=submit]'); await p.waitForTimeout(500);
  const ana = await p.evaluate(() => ArmantAcesso.users().find(u => u.nome === 'Ana Souza').id);
  ok('menu mostra "Dia a Dia"', (await p.locator('#navigation a[href="#atribuidas"]').innerText()).includes('Dia a Dia'));
  // três tarefas atribuídas
  const atribuir = async (t, prazo, prio) => { await p.goto(base + '#atribuidas'); await p.waitForTimeout(400); await p.selectOption('#at-form [name=para]', ana); await p.fill('#at-form [name=titulo]', t); if (prazo) await p.fill('#at-form [name=prazo]', prazo); await p.selectOption('#at-form [name=prio]', prio); await p.click('#at-form button[type=submit]'); await p.waitForTimeout(400); };
  await atribuir('Tarefa normal sem prazo', '', 'Normal');
  await atribuir('Tarefa urgente', add(5), 'Urgente');
  await atribuir('Tarefa atrasada', add(-2), 'Normal');
  // atividade da obra com prazo hoje e tarefa de campo de hoje
  await p.evaluate(([ana, hoje]) => { const s = JSON.parse(localStorage.getItem('a360ctrl') || '{"at":[],"seq":0}'); s.at.push({ id: 'ATV-0099', cc: 'CC-2026-001', titulo: 'Atividade com prazo hoje', resp: ana, prazo: hoje, cls: 'andamento', criado: hoje }); localStorage.setItem('a360ctrl', JSON.stringify(s));
    ArmantCampo.programar({ cc: 'CC-2026-001', titulo: 'Tarefa de campo de hoje', resp: 'Ana Souza', data: hoje }); }, [ana, hoje]);
  // mensagem em destaque para a Ana
  await p.evaluate(ana => { const N = JSON.parse(localStorage.getItem('a360nucleo')); N.msgs.push({ id: 'M-T1', conv: 'geral', de: 'USR-001', txt: 'Ana, priorize a ficha de liberação do Banrisul.', t: new Date().toISOString().slice(0, 19) });
    N.dest.push({ id: 'DS-T1', msg: 'M-T1', conv: 'geral', por: 'USR-001', para: ana, nota: 'é para hoje', em: new Date().toISOString().slice(0, 19), st: 'aberto' }); localStorage.setItem('a360nucleo', JSON.stringify(N)); }, ana);
  await p.evaluate(() => ArmantAcesso.logout()); await p.reload(); await p.waitForTimeout(600);
  await entrar('ana.souza@gmail.com', 'inicial123', 'anaNova123');
  await p.goto(base + '#atribuidas'); await p.waitForTimeout(600); await skip();
  const itens = await p.locator('.dd-it').evaluateAll(l => l.map(x => (x.querySelector('.dd-tag') || {}).textContent + ' | ' + (x.querySelector('strong') || {}).textContent));
  console.log('   ordem:', itens.join('  ⟶  '));
  ok('6 itens no Dia a Dia', itens.length === 6);
  ok('ordem por urgência: atrasada, destaque, urgente, hoje, hoje, normal',
    /^Atrasada \| Tarefa atrasada/.test(itens[0]) && /^Destaque/.test(itens[1]) && /^Urgente \| Tarefa urgente/.test(itens[2]) && /^Hoje/.test(itens[3]) && /^Hoje/.test(itens[4]) && /^Normal \| Tarefa normal/.test(itens[5]));
  ok('destaque mostra a mensagem e a nota', (await p.locator('.dd-dest').innerText()).includes('ficha de liberação') && (await p.locator('.dd-dest').innerText()).includes('é para hoje'));
  ok('contador do menu = 6', (await p.locator('#navigation a[href="#atribuidas"] .nt-c').innerText()).trim() === '6');
  await p.screenshot({ path: OUT + '/dia-a-dia.png', fullPage: true });
  await p.click('.dd-dest [data-ch-res]'); await p.waitForTimeout(500);
  ok('destaque resolvido sai do Dia a Dia', (await p.locator('.dd-it').count()) === 5 && (await p.locator('.dd-dest').count()) === 0);
  await p.click('.dd-r0 [data-at-st=concluida]'); await p.waitForTimeout(400);
  ok('concluir pela lista funciona (pede comentário ou conclui)', (await p.locator('.at-com, .dd-it').count()) >= 4);
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
