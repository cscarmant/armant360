// R.O. por obra, Painel do R.O., mandar para o campo e diário de obra atrasado
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const skip = async () => { if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {}); };
  const entrar = async (em, pw, nova) => { await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, em); await p.waitForTimeout(800);
    if (nova && await p.locator('#ac-pw').count()) { await p.fill('#ac-pw [name=pw]', nova); await p.fill('#ac-pw [name=pw2]', nova); await p.click('#ac-pw button[type=submit]'); await p.waitForTimeout(700); } await skip(); };
  const novoUsuario = async (nome, email, nivel, setor, obra) => { await p.goto(base + '#acesso'); await p.waitForTimeout(500); await p.fill('#ac-new [name=nome]', nome); await p.fill('#ac-new [name=email]', email);
    await p.selectOption('#ac-new [name=nivel]', nivel); await p.selectOption('#ac-new [name=setor]', setor); if (obra) await p.check('#ac-new input[name=obras][value="' + obra + '"]'); await p.fill('#ac-new [name=pw]', 'inicial123'); await p.click('#ac-new button[type=submit]'); await p.waitForTimeout(600); };
  await p.goto(base); await p.waitForTimeout(500); await entrar('valentim.arr@gmail.com', 'jonjon'); await skip();
  await novoUsuario('Carla Roque', 'carla.ro@gmail.com', '2', 'Financeiro');
  await novoUsuario('Pedro Campo', 'pedro.campo@gmail.com', '1', 'Campo', 'CC-2026-001');
  const ids = await p.evaluate(() => Object.fromEntries(ArmantAcesso.users().map(u => [u.nome, u.id])));
  // define o R.O. da obra (a obra-semente também)
  await p.goto(base + '#controle/CC-2026-001'); await p.waitForTimeout(600); await skip();
  await p.selectOption('#ct-setro', ids['Carla Roque']); await p.waitForTimeout(400);
  ok('R.O. definido no painel da obra', (await p.locator('.view-intro').first().innerText()).includes('Carla Roque') || (await p.locator('#view').innerText()).includes('R.O. da obra: Carla Roque'));
  ok('R.O. aparece na ficha do centro de custo', await (async () => { await p.goto(base + '#cc/CC-2026-001'); await p.waitForTimeout(500); return (await p.locator('#view').innerText()).includes('Carla Roque'); })());
  ok('R.O. foi avisado (e-mail pedido)', await p.evaluate(id => JSON.parse(localStorage.getItem('a360nucleo')).notif.some(n => n.para === id && /R\.O\. da obra/.test(n.titulo)), ids['Carla Roque']));
  ok('Cadastro de demanda: R.O. é uma pessoa', await (async () => { await p.goto(base + '#demanda/nova'); await p.waitForTimeout(400); return (await p.locator('#cad-dem select[name=ro] option').count()) >= 3; })());
  // o R.O. (sem ser gestão) entra e decide as atividades
  await p.evaluate(() => ArmantAcesso.logout()); await p.waitForTimeout(400); await entrar('carla.ro@gmail.com', 'inicial123', 'carlaNova123');
  await p.goto(base + '#controle/ro'); await p.waitForTimeout(600);
  ok('Painel do R.O. mostra a obra dela', (await p.locator('#view').innerText()).includes('CC-2026-001') && (await p.locator('.ct-ropanel').count()) === 1);
  await p.click('.ct-ropanel a[href="#controle/CC-2026-001"]'); await p.waitForTimeout(600);
  ok('R.O. pode criar atividades na obra dela', (await p.locator('#ct-form').count()) === 1);
  await p.fill('#ct-form [name=titulo]', 'Instalar evaporadoras do 2º pavimento'); await p.fill('#ct-form [name=qtd]', '8'); await p.fill('#ct-form [name=un]', 'UN');
  await p.selectOption('#ct-form [name=resp]', ids['Pedro Campo']); await p.fill('#ct-form [name=prazo]', '2026-11-15'); await p.selectOption('#ct-form [name=cls]', 'urgente'); await p.click('#ct-form button[type=submit]'); await p.waitForTimeout(600);
  ok('atividade criada pelo R.O.', (await p.locator('[data-ct-col=urgente] .ct-card').count()) === 1);
  ok('R.O. não vê o formulário de troca de R.O. (só a gestão)', (await p.locator('#ct-setro').count()) === 0);
  // manda para o campo
  await p.click('[data-ct-col=urgente] [data-ct-campo]'); await p.waitForTimeout(300);
  await p.selectOption('#ct-cform [name=resp]', 'Pedro Campo'); await p.fill('#ct-cform [name=qtd]', '2'); await p.click('#ct-cform button[type=submit]'); await p.waitForTimeout(600);
  const tar = await p.evaluate(() => JSON.parse(localStorage.getItem('a360campo')).tar.filter(t => t.atv));
  ok('tarefa do dia criada no app de campo, ligada à atividade', tar.length === 1 && tar[0].resp === 'Pedro Campo' && tar[0].prio === 'Urgente' && tar[0].qtd === 2 && /R\.O\. Carla/.test(tar[0].por));
  ok('cartão mostra "No campo"', (await p.locator('.ct-campo').first().innerText()).includes('No campo: 1'));
  ok('Pedro avisado da tarefa de campo', await p.evaluate(id => JSON.parse(localStorage.getItem('a360nucleo')).notif.some(n => n.para === id && /Nova tarefa de campo/.test(n.titulo)), ids['Pedro Campo']));
  await p.screenshot({ path: OUT + '/ro-obra.png', fullPage: true });
  // R.O. não edita obra de que não é R.O.
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('a360cad')); });
  // campo: tarefa aparece e diário atrasado
  await p.evaluate(() => ArmantAcesso.logout()); await p.waitForTimeout(400); await entrar('pedro.campo@gmail.com', 'inicial123', 'pedroNova123');
  await p.waitForTimeout(500);
  ok('Pedro cai no app de campo com a tarefa do R.O.', p.url().includes('#campo') && (await p.locator('.cp-task').count()) >= 1 && (await p.locator('#view').innerText()).includes('Instalar evaporadoras'));
  await p.goto(base + '#campo/atrasado'); await p.waitForTimeout(500);
  ok('tela de diário atrasado no app', (await p.locator('#cp-atr').count()) === 1);
  await p.fill('#cp-atr [name=data]', '2026-10-26'); await p.selectOption('#cp-atr [name=motivo]', 'Sem sinal de internet na obra');
  await p.fill('#cp-atr [name=equipe]', 'Pedro Campo, técnico, 07:30, 17:00\nJoão Ajudante, ajudante, 08:00, 17:00');
  await p.fill('#cp-atr [name=serv]', 'Passagem de tubulação frigorígena no 2º pavimento (25 m).'); await p.fill('#cp-atr [name=ocorr]', 'Fiscal visitou às 15h.'); await p.selectOption('#cp-atr [name=clima]', 'Chuva');
  await p.setInputFiles('#cp-atrfoto', require('path').join(SITE, '..', 'nftest', 'foto.jpg')); await p.waitForTimeout(800);
  await p.click('#cp-atr button[type=submit]'); await p.waitForTimeout(700);
  const rel = await p.locator('.rp-wrap').innerText();
  ok('diário entra no RDO do dia 26/10, marcado como atrasado', /26\/10\/2026/.test(rel) && /Diário enviado com atraso/i.test(rel) && /2 dia\(s\) depois/.test(rel) && /Sem sinal/.test(rel));
  ok('equipe do diário entra na tabela de presença', /João Ajudante/.test(rel) && (await p.locator('.rp-wrap img').count()) >= 1);
  ok('R.O. e CSC avisados do diário atrasado', await p.evaluate(id => JSON.parse(localStorage.getItem('a360nucleo')).notif.some(n => n.para === id && /Diário atrasado/.test(n.titulo)), ids['Carla Roque']));
  await p.goto(base + '#campo/atrasado'); await p.waitForTimeout(400);
  await p.fill('#cp-atr [name=data]', '2026-10-28'); await p.fill('#cp-atr [name=serv]', 'x'); await p.click('#cp-atr button[type=submit]'); await p.waitForTimeout(400);
  ok('não aceita hoje como diário atrasado', (await p.evaluate(() => JSON.parse(localStorage.getItem('a360campo')).dia.length)) === 1);
  await p.screenshot({ path: OUT + '/campo-atrasado.png', fullPage: true });
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
