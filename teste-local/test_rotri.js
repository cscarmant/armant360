// Menu do R.O.: triagem dos pedidos do campo → almoxarifado e compras
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(500); await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'valentim.arr@gmail.com'); await p.waitForTimeout(800);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#acesso'); await p.waitForTimeout(300); await p.click('#ac-demo'); await p.waitForTimeout(700);
  const r = await p.evaluate(() => { const M = ArmantMateriais, ms = M.materiais(); M.state.mov.push({ id: 'MOV-T1', n: 999, tipo: 'entrada', data: '2026-10-01', itens: [{ m: ms[0].id, q: 10, pu: 20 }] }); const st = M.ledger(); const tem = ms.find(m => st[m.id] && st[m.id].q >= 2), nao = ms.find(m => !st[m.id] || st[m.id].q <= 0);
    const ped = M.addPedido({ cc: 'CC-2026-001', quem: 'Carlos Souza', itens: [{ m: tem.id, q: 2 }, { m: nao.id, q: 5 }], para: '2026-10-30', obs: 'para a casa de máquinas' });
    M.addPedido({ cc: 'CC-2026-001', quem: 'Carlos Souza', itens: [{ m: tem.id, q: 1 }], para: '2026-11-05' });
    return { id: ped.id, st: ped.st, tem: tem.id, nao: nao.id }; });
  ok('pedido do campo nasce "com o R.O." (triagem)', r.st === 'triagem');
  await p.goto(base + '#ro'); await p.waitForTimeout(600);
  ok('menu do R.O. e Compras acessíveis (no modo completo, no menu lateral)', (await p.locator('#navigation a[href="#ro"]').count()) === 1 && (await p.locator('#navigation a[href="#compras"]').count()) === 1 || (await p.evaluate(() => ArmantSimples.ligado())));
  ok('2 pedidos para triar', (await p.locator('.ro-card').count()) === 2);
  const card = p.locator('[data-ro-card="' + r.id + '"]');
  ok('sugere almoxarifado para o que tem estoque e compras para o que falta', (await card.locator('select[data-ro-dest$="|0"]').inputValue()) === 'almox' && (await card.locator('select[data-ro-dest$="|1"]').inputValue()) === 'compras');
  await card.locator('[data-ro-prio]').selectOption('urgente'); await p.waitForTimeout(200);
  const card2 = p.locator('[data-ro-card="' + r.id + '"]');
  await card2.locator('input[data-ro-q$="|1"]').fill('4');
  await card2.locator('[data-ro-nota]').fill('comprar com urgência, obra parada');
  await p.screenshot({ path: OUT + '/ro-triagem.png', fullPage: true });
  await card2.locator('[data-ro-ok]').click(); await p.waitForTimeout(400);
  const s = await p.evaluate(id => { const L = ArmantMateriais.state.ped; const a = L.find(x => x.id === id), c = L.find(x => x.origem === id); return { a: a.st, ai: a.itens.length, c: c && c.st, cq: c && c.itens[0].q, prio: c && c.prio, nota: c && c.nota }; }, r.id);
  ok('dividiu: almoxarifado fica com o original, compras com um novo pedido', s.a === 'aberto' && s.ai === 1 && s.c === 'compras');
  ok('quantidade ajustada (4), prioridade e nota seguem para compras', s.cq === 4 && s.prio === 'urgente' && /urgência/.test(s.nota));
  // recusar o outro
  const outro = p.locator('.ro-card').first(); await outro.locator('[data-ro-rec]').click(); await outro.locator('[data-ro-recok]').click(); await p.waitForTimeout(200);
  ok('recusa exige motivo', (await p.locator('.ro-card').count()) === 1);
  await outro.locator('[data-ro-mot]').fill('já tem na obra'); await outro.locator('[data-ro-recok]').click(); await p.waitForTimeout(300);
  ok('recusado com motivo', await p.evaluate(() => ArmantMateriais.state.ped.some(x => x.st === 'recusado' && x.motivo === 'já tem na obra')));
  // almoxarifado vê o pedido triado
  await p.goto(base + '#materiais/entrega'); await p.waitForTimeout(500);
  ok('almoxarifado recebe só o triado', /Pedidos das obras/.test(await p.locator('#view').innerText()) && (await p.locator('[data-mt-ped="' + r.id + '"]').count()) === 1);
  // compras
  await p.goto(base + '#compras'); await p.waitForTimeout(500);
  const cid = await p.evaluate(id => ArmantMateriais.state.ped.find(x => x.origem === id).id, r.id);
  await p.click('[data-co-comp="' + cid + '"]'); await p.fill('#co-form [name=forn]', 'Refrigeração Dufrio'); await p.fill('#co-form [name=oc]', '06450'); await p.fill('#co-form [name=valor]', '1.250,00'); await p.click('#co-form button[type=submit]'); await p.waitForTimeout(400);
  ok('compra registrada (OC, fornecedor)', await p.evaluate(id => { const x = ArmantMateriais.state.ped.find(y => y.id === id); return x.st === 'comprado' && x.compra.oc === '06450' && x.compra.valor === 1250; }, cid));
  await p.screenshot({ path: OUT + '/compras.png', fullPage: true });
  await p.click('[data-co-chegou="' + cid + '"]'); await p.waitForTimeout(300);
  ok('chegou: vai para o almoxarifado entregar', await p.evaluate(id => ArmantMateriais.state.ped.find(y => y.id === id).st === 'aberto', cid));
  ok('operário avisado da triagem e da recusa', await p.evaluate(() => { const c = ArmantAcesso.users().find(u => u.nome === 'Carlos Souza'), L = ArmantNucleo.state.notif.filter(n => n.para === c.id); return L.some(n => /triado/.test(n.titulo)) && L.some(n => /recusado/.test(n.titulo)); }));
  // R.O. de fora dos setores de Obras/Operação (Teste Comercial, nível 3) abre o Menu do R.O. e tria só a obra dele
  const rid = await p.evaluate(() => { const u = ArmantAcesso.users().find(x => x.nome === 'Teste Comercial'); ArmantCadastros.setResp('CC-2026-001', 'ro', u.id); const M = ArmantMateriais; M.addPedido({ cc: 'CC-2026-001', quem: 'Carlos Souza', itens: [{ m: M.materiais()[0].id, q: 1 }] }); localStorage.setItem('a360mat', JSON.stringify(M.state)); ArmantAcesso.verComo(u.id); return u.id; });
  await p.goto(base + '#ro'); await p.waitForTimeout(600);
  await p.goto(base + '#setor/engenharia'); await p.waitForTimeout(400); const temBotao = (await p.locator('#view a[href="#ro"]').count()) === 1; await p.goto(base + '#ro'); await p.waitForTimeout(500); ok('R.O. (Comercial, nível 3) vê o Menu do R.O. no setor Engenharia e abre', temBotao && (await p.locator('.ro-card').count()) === 1);
  ok('não vê Compras (não é de Suprimentos)', (await p.locator('#navigation a[href="#compras"]').count()) === 0 && (await p.evaluate(() => ArmantAcesso.can('compras'))) === false);
  await p.locator('.ro-card [data-ro-ok]').click(); await p.waitForTimeout(300);
  ok('R.O. triou o pedido da obra dele', await p.evaluate(() => ArmantMateriais.state.ped.slice(-1)[0].st !== 'triagem'));
  await p.evaluate(() => ArmantAcesso.verComo(null));
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
