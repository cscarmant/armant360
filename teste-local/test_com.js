// Gestão de comunicados: grupos no app, comunicado com ciente, chat, Dia a Dia e App de campo
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const login = async (email, pw) => { await p.goto(base); await p.waitForTimeout(400); if (await p.locator('.profile button, [data-ac-out]').count() && !(await p.locator('#ac-login').count())) {} await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, email); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]'); };
  await login('valentim.arr@gmail.com', 'jonjon');
  await p.goto(base + '#acesso'); await p.waitForTimeout(400); await p.click('#ac-demo'); await p.waitForTimeout(800);
  await p.goto(base + '#comunicados'); await p.waitForTimeout(500);
  await p.evaluate(() => ArmantSimples.desligar()); await p.waitForTimeout(1500); await p.goto(base + '#comunicados'); await p.waitForTimeout(500);
  ok('módulo Comunicados no menu completo', (await p.locator('#navigation a[href="#comunicados"]').count()) === 1);
  await p.click('[data-co-aba=grupos]'); await p.waitForTimeout(300);
  await p.fill('#co-gform [name=nome]', 'Equipe de campo'); await p.check('#co-gform input[name=setores][value="Campo"]'); await p.check('#co-gform input[name=setores][value="Engenharia"]');
  await p.click('#co-gform button[type=submit]'); await p.waitForTimeout(400);
  const m = await p.evaluate(() => ArmantComunicados.membros('GRP-001').map(u => u.nome));
  ok('grupo por setor (Campo + Obras): Carlos e Ana', m.includes('Carlos Souza') && m.includes('Ana R.O.') && !m.includes('Teste Financeiro'));
  await p.fill('#co-gform [name=nome]', 'Equipe de campo'); await p.check('#co-gform input[name=todos]'); await p.click('#co-gform button[type=submit]'); await p.waitForTimeout(300);
  ok('não deixa nome repetido', /Já existe/.test(await p.locator('#co-gerr').innerText()));
  await p.fill('#co-gform [name=nome]', 'Financeiro e diretoria'); await p.uncheck('#co-gform input[name=todos]'); await p.locator('[data-co-pq]').fill('financ'); await p.locator('#co-gform [data-co-pt]:not([hidden]) input').first().check(); await p.check('#co-gform input[name=setores][value="Diretoria"]'); await p.click('#co-gform button[type=submit]'); await p.waitForTimeout(300);
  ok('grupo com pessoa escolhida + setor', (await p.evaluate(() => ArmantComunicados.membros('GRP-002').map(u => u.nome))).includes('Teste Financeiro'));
  await p.click('[data-co-aba=enviar]'); await p.waitForTimeout(300);
  await p.fill('#co-cform [name=titulo]', 'Uso obrigatório de EPI'); await p.fill('#co-cform [name=texto]', 'A partir de segunda, capacete e cinto em toda a obra.'); await p.check('#co-cform input[name=grupos][value="GRP-001"]'); await p.selectOption('#co-cform [name=prio]', 'urgente');
  await p.click('#co-cform button[type=submit]'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => ArmantComunicados.state.com[0]);
  ok('comunicado enviado aos membros do grupo', c && c.para.length >= 2 && c.ciente === true);
  ok('aparece em Enviados com 0 ciente', /0 \/ /.test(await p.locator('#view').innerText()));
  ok('chat do grupo recebeu o comunicado', await p.evaluate(() => ArmantNucleo.state.msgs.some(x => x.conv === 'grp:GRP-001' && /EPI/.test(x.txt))));
  await p.screenshot({ path: OUT + '/comunicados.png', fullPage: true });
  // Ana (Obras) vê no Dia a Dia e no chat
  await p.evaluate(() => { const u = ArmantAcesso.users().find(x => x.nome === 'Ana R.O.'); ArmantAcesso.verComo(u.id); });
  await p.goto(base + '#atribuidas'); await p.waitForTimeout(500);
  ok('Dia a Dia da Ana mostra o comunicado urgente', /Uso obrigatório de EPI/.test(await p.locator('#view').innerText()));
  await p.goto(base + '#chat'); await p.waitForTimeout(400);
  ok('chat oculto: o grupo não aparece na tela de chat (mensagem fica guardada)', !/Equipe de campo/.test(await p.locator('#view').innerText()) && await p.evaluate(() => ArmantNucleo.state.msgs.some(x => x.conv === 'grp:GRP-001')));
  await p.goto(base + '#atribuidas'); await p.waitForTimeout(400);
  await p.locator('.dd-com [data-co-ciente]').click(); await p.waitForTimeout(300);
  ok('ciente pelo Dia a Dia', await p.evaluate(() => Object.keys(ArmantComunicados.state.com[0].cientes).length === 1));
  ok('sai do Dia a Dia depois do ciente', !/Uso obrigatório de EPI/.test(await p.locator('#view').innerText()));
  // Carlos (campo) vê no App de campo
  await p.evaluate(() => { ArmantAcesso.verComo(null); });
  await p.evaluate(() => { const u = ArmantAcesso.users().find(x => x.nome === 'Carlos Souza'); ArmantAcesso.verComo(u.id); });
  await p.goto(base + '#campo'); await p.waitForTimeout(600);
  ok('App de campo mostra o comunicado', (await p.locator('.co-cp').count()) === 1);
  await p.screenshot({ path: OUT + '/comunicado-campo.png' });
  await p.locator('.co-cp [data-co-ciente]').click(); await p.waitForTimeout(300);
  ok('ciente pelo App de campo', await p.evaluate(() => Object.keys(ArmantComunicados.state.com[0].cientes).length === 2));
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
