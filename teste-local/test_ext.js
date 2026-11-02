// Extrato bancário: OFX, CSV, Excel (Conta Azul), PDF; sem duplicar; conciliação, lançamento novo, ignorar, desfazer
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], E = process.argv[3], OUT = process.argv[4], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const skip = async () => { if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {}); };
  await p.goto(base); await p.waitForTimeout(500); await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'valentim.arr@gmail.com'); await p.waitForTimeout(800); await skip();
  // títulos em aberto para conciliar
  await p.evaluate(() => { const F = ArmantFinanceiro; F.lancarExterno({ ref: 't1', tipo: 'rec', desc: 'Medição 05 TJ-RS', parte: 'TJ-RS Tribunal de Justiça', valor: 461064.41, venc: '2026-10-20', status: 'aberto', cat: 'Medição de obra' });
    F.lancarExterno({ ref: 't2', tipo: 'pag', desc: 'Material OC 06431', parte: 'Refrigeração Dufrio', valor: 5230, venc: '2026-10-15', status: 'aberto', cat: 'Materiais' });
    F.lancarExterno({ ref: 't3', tipo: 'rec', desc: 'Manutenção Hospital', parte: 'Hospital Exemplo', valor: 12500, venc: '2026-10-16', status: 'aberto' }); F.save(); });
  await p.goto(base + '#finance/extrato'); await p.waitForTimeout(800); await skip();
  ok('aba Extrato e conciliação no Financeiro', (await p.locator('#ex-form').count()) === 1);
  const importar = async (arq, nova) => { if (nova) { await p.selectOption('#ex-form [name=conta]', '__nova'); await p.fill('#ex-form [name=nova]', nova); }
    await p.setInputFiles('#ex-form [name=arq]', path.join(E, arq)); await p.click('#ex-form button[type=submit]'); await p.waitForTimeout(2500); };
  await importar('banrisul-outubro.ofx', 'Banrisul 06.123456.0-1');
  const prev = await p.locator('.ex-prev').innerText(); console.log('   ', prev.split('\n')[0]);
  ok('OFX: 4 lançamentos e saldo do banco', /4 lançamento/.test(prev) && /355\.774,51/.test(prev));
  await p.click('[data-ex-ok]'); await p.waitForTimeout(500);
  ok('lançamentos importados', (await p.locator('.ex-t tbody tr').count()) === 4);
  const st = await p.locator('.ex-t tbody').innerText();
  ok('sugestões: TJ-RS e Dufrio exatas, tarifa sem título', (st.match(/sugestão exata/g) || []).length === 2 && /sem título/.test(st));
  // reimportar o mesmo arquivo não duplica
  await importar('banrisul-outubro.ofx');
  ok('mesmo arquivo de novo: reconhece 4 já importados', /4 já importado/.test(await p.locator('.ex-prev').innerText()));
  await p.click('[data-ex-ok]'); await p.waitForTimeout(400);
  ok('não duplicou', (await p.evaluate(() => ArmantExtrato.state.mov.length)) === 4);
  // conciliar exatos
  await p.click('[data-ex-todos]'); await p.waitForTimeout(500);
  const tit = await p.evaluate(() => ArmantFinanceiro.state.tit.filter(t => t.ref === 't1' || t.ref === 't2').map(t => t.status + ':' + (t.liq && t.liq.data)));
  ok('2 títulos baixados com a data do banco', tit.includes('recebido:2026-10-21') && tit.includes('pago:2026-10-15'));
  // tarifa: criar lançamento (categoria sugerida)
  await p.click('[data-ex-f=pend]'); await p.waitForTimeout(300);
  const linhaTarifa = p.locator('.ex-t tbody tr', { hasText: 'TARIFA' });
  await linhaTarifa.locator('[data-ex-novo]').click(); await p.waitForTimeout(300);
  ok('categoria sugerida para tarifa: Administrativo', (await p.locator('.ex-nform [name=cat]').inputValue()) === 'Administrativo');
  await p.click('.ex-nform button[type=submit]'); await p.waitForTimeout(400);
  ok('tarifa virou despesa paga', await p.evaluate(() => ArmantFinanceiro.state.tit.some(t => t.orig === 'extrato' && t.valor === 59.9 && t.status === 'pago')));
  await p.locator('.ex-t tbody tr', { hasText: 'APLICACAO' }).locator('[data-ex-ign]').click(); await p.waitForTimeout(300);
  ok('aplicação ignorada como transferência', await p.evaluate(() => ArmantExtrato.state.mov.some(m => /APLICACAO/.test(m.desc) && /transfer/.test(m.ign))));
  ok('saldo do banco confere com o sistema', (await p.locator('.ex-saldo').innerText()).includes('confere'));
  await p.screenshot({ path: OUT + '/extrato.png', fullPage: true });
  // desfazer uma conciliação
  await p.click('[data-ex-f=conc]'); await p.waitForTimeout(300);
  await p.locator('.ex-t tbody tr', { hasText: 'DUFRIO' }).locator('[data-ex-undo]').click(); await p.waitForTimeout(300);
  ok('desfazer volta o título a pagar para aberto', await p.evaluate(() => ArmantFinanceiro.state.tit.find(t => t.ref === 't2').status === 'aberto'));
  // CSV (Itaú, ; e D/C, Windows-1252)
  await importar('itau-outubro.csv', 'Itaú 12345-6');
  const pc = await p.locator('.ex-prev').innerText(); console.log('   ', pc.split('\n')[0]);
  ok('CSV com D/C: 3 lançamentos (ignora saldo anterior), acentos ok, saldo', /3 lançamento/.test(pc) && /30\.516,29/.test(pc));
  await p.click('[data-ex-ok]'); await p.waitForTimeout(400);
  ok('IOF ficou negativo e PIX positivo', await p.evaluate(() => { const M = ArmantExtrato.state.mov; return M.find(m => m.desc === 'IOF').valor === -3.21 && M.find(m => /PIX/.test(m.desc)).valor === 12500; }));
  ok('PIX do hospital com sugestão exata', await p.evaluate(() => { const m = ArmantExtrato.state.mov.find(x => /PIX/.test(x.desc)); const s = ArmantExtrato.sugestao(m); return !!s && s.exato; }));
  // Excel (exportação da Conta Azul)
  await importar('contaazul-extrato.xlsx', 'Conta Azul - conta principal');
  const px = await p.locator('.ex-prev').innerText(); console.log('   ', px.split('\n')[0]);
  ok('Excel da Conta Azul: 2 lançamentos e saldo', /2 lançamento/.test(px) && /58\.401,37/.test(px));
  await p.click('[data-ex-ok]'); await p.waitForTimeout(400);
  // PDF
  await importar('banco-exemplo.pdf', 'Banco Exemplo');
  const pp = await p.locator('.ex-prev, #ex-err').allInnerTexts(); console.log('   ', pp.join(' | ').split('\n')[0]);
  ok('PDF: 2 lançamentos lidos (conferir)', /2 lançamento/.test(pp.join(' ')) && /PDF/.test(pp.join(' ')));
  if (await p.locator('[data-ex-ok]').count()) { await p.click('[data-ex-ok]'); await p.waitForTimeout(400); }
  ok('PDF: tarifa D negativa, ano do período', await p.evaluate(() => { const m = ArmantExtrato.state.mov.find(x => /TARIFA DOC/.test(x.desc)); return m && m.valor === -15.9 && m.data === '2026-10-06'; }));
  // formato desconhecido
  await p.setInputFiles('#ex-form [name=arq]', path.join(E, 'pdf.html')); await p.click('#ex-form button[type=submit]'); await p.waitForTimeout(600);
  ok('formato desconhecido: mensagem clara', /não reconhecido/.test(await p.locator('#ex-err').innerText()));
  ok('Conta Azul: no protótipo explica que a sincronização é no servidor', (await p.locator('.ex-ca').innerText()).includes('site com servidor'));
  ok('desfazer importação de um arquivo', await (async () => { await p.click('.ex-lotes summary'); const n0 = await p.evaluate(() => ArmantExtrato.state.mov.length); await p.locator('[data-ex-dellote]').first().click(); await p.locator('[data-ex-dellote]').first().click(); await p.waitForTimeout(400); return (await p.evaluate(() => ArmantExtrato.state.mov.length)) < n0; })());
  // Conta Azul (servidor simulado): sincroniza títulos e saldos
  await p.evaluate(() => { window.ArmantPonte = { sb: { functions: { invoke: async (n, o) => ({ data: o.body.acao === 'sincronizar' ? { contas: [{ id: 'ca1', nome: 'Conta Corrente', banco: 'BANRISUL', saldo: 1000.36 }], receber: [{ id: 'r1', tipo: 'rec', descricao: 'Medição Banrisul Vale do Sol', vencimento: '2026-11-10', total: 28297.38, pago: 0, nao_pago: 28297.38, parte: 'Banrisul', categoria: 'Medição de obra' }], pagar: [{ id: 'p1', tipo: 'pag', descricao: 'Aluguel do escritório', vencimento: '2026-10-05', total: 4500, pago: 4500, nao_pago: 0, parte: 'Imobiliária' }] } : {} }) } } }; ArmantExtrato.state.ca = { conectado: true }; });
  await p.goto(base + '#finance/notas'); await p.goto(base + '#finance/extrato'); await p.waitForTimeout(500);
  await p.click('[data-ex-ca=sync]'); await p.waitForTimeout(800);
  const tca = await p.evaluate(() => ArmantFinanceiro.state.tit.filter(t => /^ca:/.test(t.ref)).map(t => t.ref + ':' + t.tipo + ':' + t.status));
  ok('sincronizou títulos da Conta Azul (aberto e já pago)', tca.includes('ca:r1:rec:aberto') && tca.includes('ca:p1:pag:pago'));
  ok('mostra contas e saldos da Conta Azul', (await p.locator('.ex-ca').innerText()).includes('1.000,36'));
  await p.click('[data-ex-ca=sync]'); await p.waitForTimeout(600);
  ok('sincronizar de novo não duplica', (await p.evaluate(() => ArmantFinanceiro.state.tit.filter(t => /^ca:/.test(t.ref)).length)) === 2);
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
