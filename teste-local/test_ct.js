// Controle de obras, atividades da demanda, importação do e-mail/orçamento, e-mails e login
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const SITE = process.argv[2], UP = process.argv[3], OUT = process.argv[4];
  const base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const mails = []; await p.route('https://script.google.com/**', r => { mails.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ body: 'ok' }); });
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const skipTour = async () => { if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {}); };
  await p.goto(base); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/login-logo.png' });
  ok('login: logo grande e slogan', (await p.locator('.ac-brand img').boundingBox()).width >= 200 && (await p.locator('.ac-slogan').innerText()).toLowerCase().includes('inteligência'));
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'valentim.arr@gmail.com'); await p.waitForTimeout(800); await skipTour();
  // envio automático de e-mail ligado (Apps Script simulado)
  await p.goto(base + '#acesso'); await p.waitForTimeout(500); await skipTour();
  await p.fill('#ac-hook', 'https://script.google.com/macros/s/TESTE/exec'); await p.dispatchEvent('#ac-hook', 'change'); await p.waitForTimeout(200);
  // conta criada → e-mail
  await p.fill('#ac-new [name=nome]', 'Carlos Souza'); await p.fill('#ac-new [name=email]', 'carlos.campo@gmail.com');
  await p.selectOption('#ac-new [name=nivel]', '3').catch(() => {}); await p.fill('#ac-new [name=pw]', 'inicial123'); await p.click('#ac-new button[type=submit]'); await p.waitForTimeout(800);
  ok('e-mail de conta criada', mails.some(m => m.tipo === 'conta' && m.para === 'carlos.campo@gmail.com' && /senha inicial/.test(m.texto)));
  // cadastro de demanda importando e-mail, orçamento e documentos
  await p.goto(base + '#demanda/nova'); await p.waitForTimeout(600);
  const files = ['RES_ 26_450 BANRISUL AG VALE DO SOL.eml', 'ORC_26_450_BANRISUL_AG_VALE_DO_SOL_R00.xlsx', 'ARM_Laudo_Tecnico_Substituicao_Banrisul_AG_VALE_DO_SOL_R02_assinado.pdf', 'FICHA DE PREENCHIMENTO PARA OBRAS DO BANRISUL.pdf'].map(f => path.join(UP, f));
  await p.setInputFiles('#cad-difile', files); await p.waitForTimeout(4000);
  const v = n => p.inputValue('#cad-dem [name=' + n + ']');
  const campos = { valor: await v('valor'), aprovNum: await v('aprovNum'), aprovData: await v('aprovData'), orc: await v('orc'), nome: await v('nome'), cidade: await v('cidade'), uf: await v('uf'), aprovDoc: await v('aprovDoc'), end: await v('end') };
  console.log('   campos:', JSON.stringify(campos));
  ok('valor, contrato, data e orçamento vieram do e-mail', campos.valor === '28.297,38' && campos.aprovNum === '0300454/2023' && campos.aprovData === '2026-10-27' && campos.orc === 'ORC 26/450' && campos.aprovDoc === 'E-mail de aprovação do cliente');
  ok('local da obra veio da planilha', campos.cidade === 'Vale do Sol' && campos.uf === 'RS' && campos.end === 'Rua Augusto Emmel');
  const rel = await p.locator('#cad-direl').innerText(); console.log('   resumo:', rel.replace(/\n/g, ' | ').slice(0, 600));
  ok('22 atividades do orçamento, soma confere com R$ 28.297,38', /22 atividade/.test(rel) && /confere com o total/.test(rel));
  ok('pendência "data de início" detectada', /data de início/i.test(rel) && /PENDÊNCIA/.test(await v('obs')));
  await p.screenshot({ path: OUT + '/demanda-importada.png', fullPage: false });
  await p.click('[data-di-cli]'); await p.waitForTimeout(300);
  ok('cliente Banrisul cadastrado e selecionado', (await p.locator('#cad-dem select[name=cli] option:checked').innerText()).includes('BANRISUL'));
  await p.click('#cad-dem button[type=submit]'); await p.waitForTimeout(900);
  const cc = p.url().split('#cc/')[1]; ok('centro de custo gerado: ' + cc, /^CC-2026-\d{3}$/.test(cc || ''));
  const linhas = await p.locator('.cad-itens tbody tr').count(); ok('ficha mostra 22 atividades da demanda', linhas === 22);
  ok('total da lista = R$ 28.297,38', (await p.locator('.cad-itens tfoot').innerText()).includes('28.297,38'));
  ok('4 documentos guardados na demanda', (await p.locator('[data-di-open]').count()) === 4);
  // superadmin manipula a lista
  await p.click('[data-it-ed="IT-002"]'); await p.waitForTimeout(300);
  await p.fill('.cad-itrow [data-it-f=qtd]', '30'); await p.click('[data-it-save="IT-002"]'); await p.waitForTimeout(400);
  await p.fill('#cad-it [name=atividade]', 'Mobilização e desmobilização'); await p.fill('#cad-it [name=qtd]', '1'); await p.fill('#cad-it [name=valor]', '850,00'); await p.click('#cad-it button[type=submit]'); await p.waitForTimeout(400);
  const cad = await p.evaluate(c => JSON.parse(localStorage.getItem('a360cad')).itens[c], cc);
  ok('superadmin editou e adicionou atividade (banco a360cad)', cad.length === 23 && cad.find(i => i.id === 'IT-002').qtd === 30 && cad.some(i => i.atividade === 'Mobilização e desmobilização' && i.valor === 850));
  await p.screenshot({ path: OUT + '/ficha-atividades.png', fullPage: true });
  // controle de obras da obra
  await p.click('.ct-ccbtn'); await p.waitForTimeout(600);
  await p.selectOption('#ct-item', 'IT-001'); await p.waitForTimeout(100);
  ok('atividade da lista preenche o formulário', (await p.inputValue('#ct-form [name=titulo]')).startsWith('condicionador de ar split') && (await p.inputValue('#ct-form [name=qtd]')) === '1');
  const uid = await p.evaluate(() => ArmantAcesso.users().find(u => u.email === 'carlos.campo@gmail.com').id);
  await p.selectOption('#ct-form [name=resp]', uid); await p.fill('#ct-form [name=prazo]', '2026-11-20'); await p.selectOption('#ct-form [name=cls]', 'urgente');
  await p.click('#ct-form button[type=submit]'); await p.waitForTimeout(600);
  ok('e-mail de tarefa nova para o responsável', mails.some(m => m.tipo === 'tarefa' && m.para === 'carlos.campo@gmail.com' && /Nova atividade/.test(m.assunto)));
  ok('notificação no app do responsável', await p.evaluate(id => JSON.parse(localStorage.getItem('a360nucleo')).notif.some(n => n.para === id && /Nova atividade/.test(n.titulo)), uid));
  // atrasada (prazo vencido) e com restrição
  await p.fill('#ct-form [name=titulo]', 'Pedir liberação de acesso (ficha Banrisul)'); await p.selectOption('#ct-form [name=resp]', uid); await p.fill('#ct-form [name=inicio]', '2026-10-20'); await p.fill('#ct-form [name=prazo]', '2026-10-25'); await p.selectOption('#ct-form [name=cls]', 'andamento');
  await p.click('#ct-form button[type=submit]'); await p.waitForTimeout(500);
  await p.fill('#ct-form [name=titulo]', 'Desinstalar equipamento antigo'); await p.selectOption('#ct-form [name=resp]', uid); await p.fill('#ct-form [name=inicio]', ''); await p.fill('#ct-form [name=prazo]', '2026-11-30'); await p.selectOption('#ct-form [name=cls]', 'restricao');
  await p.click('#ct-form button[type=submit]'); await p.waitForTimeout(300);
  ok('restrição exige descrição', (await p.locator('#ct-err').innerText()).includes('restrição'));
  await p.fill('#ct-form [name=restricao]', 'Aguardando data de início confirmada pelo Banrisul'); await p.click('#ct-form button[type=submit]'); await p.waitForTimeout(500);
  const col = async k => p.locator('[data-ct-col=' + k + '] .ct-card').count();
  ok('quadro: 1 urgente, 1 atrasado, 1 com restrição', (await col('urgente')) === 1 && (await col('atrasado')) === 1 && (await col('restricao')) === 1);
  // mudar a classificação pelo cartão
  const idU = await p.locator('[data-ct-col=urgente] .ct-card').getAttribute('data-ct-id');
  await p.selectOption('[data-ct-cls="' + idU + '"]', 'concluido'); await p.waitForTimeout(500);
  ok('cartão mudou para concluído', (await col('concluido')) === 1 && (await col('urgente')) === 0);
  await p.screenshot({ path: OUT + '/controle-obra.png', fullPage: true });
  // geral de todas as obras
  await p.goto(base + '#controle'); await p.waitForTimeout(600);
  const kp = await p.locator('.ct-kpis').innerText();
  ok('geral: contagem por classificação', /Atividades\s*3/.test(kp));
  ok('geral: tabela por obra com a obra nova', (await p.locator('.ct-obras').innerText()).includes(cc));
  await p.click('[data-ct-f=atrasado]'); await p.waitForTimeout(300);
  ok('filtro Atrasado no geral', (await p.locator('.ct-card').count()) === 1);
  await p.click('[data-ct-vista=lista]'); await p.waitForTimeout(300);
  ok('vista em lista', (await p.locator('.ob-t tbody tr').count()) >= 1);
  await p.click('[data-ct-f=atrasado]'); await p.click('[data-ct-vista=quadro]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/controle-geral.png', fullPage: true });
  ok('Operação & CSC tem o atalho do Controle de obras', await (async () => { await p.goto(base + '#operations'); await p.waitForTimeout(600); return (await p.locator('.mt-quick [href="#controle"]').count()) === 1; })());
  // atribuição de tarefa → e-mail
  await p.goto(base + '#atribuidas'); await p.waitForTimeout(500);
  if (await p.locator('[data-at-tab=nova]').count()) await p.click('[data-at-tab=nova]');
  await p.waitForTimeout(300);
  if (await p.locator('#at-form').count()) {
    await p.selectOption('#at-form [name=para]', uid); await p.fill('#at-form [name=titulo]', 'Enviar ficha de liberação ao Banrisul'); await p.click('#at-form button[type=submit]'); await p.waitForTimeout(500);
    ok('e-mail de tarefa atribuída', mails.some(m => m.para === 'carlos.campo@gmail.com' && /Tarefa atribuída/.test(m.assunto)));
  } else ok('formulário de atribuição encontrado', false);
  // quem não é superadmin só vê a lista da demanda
  await p.evaluate(() => ArmantAcesso.logout()); await p.waitForTimeout(400);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'carlos.campo@gmail.com'); await p.waitForTimeout(800);
  if (await p.locator('#ac-pw').count()) { await p.fill('#ac-pw [name=pw]', 'novaSenha123'); await p.fill('#ac-pw [name=pw2]', 'novaSenha123'); await p.click('#ac-pw button[type=submit]'); await p.waitForTimeout(700); }
  await skipTour();
  await p.goto(base + '#cc/' + cc); await p.waitForTimeout(600);
  ok('não superadmin: lista da demanda só leitura', (await p.locator('.cad-itens tbody tr').count()) === 23 && (await p.locator('[data-it-ed]').count()) === 0 && (await p.locator('#cad-it').count()) === 0);
  if (process.argv[5]) { await p.evaluate(() => ArmantCampo.programar({ cc: 'CC-2026-002', titulo: 'Tarefa de teste', resp: 'Carlos Souza', data: new Date().toISOString().slice(0, 10), atv: JSON.parse(localStorage.getItem('a360ctrl')).at[0].id }));
    await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('a360campo')); (c.dia = c.dia || []).push({ id: 'DIA-0001', cc: 'CC-2026-002', data: '2026-10-26', por: 'Carlos Souza', env: '2026-10-28', hora: '10:00', atraso: 2, motivo: 'Sem sinal', equipe: [{ nome: 'Carlos Souza', funcao: 'técnico', ent: '07:30', sai: '17:00' }], serv: 'Passagem de tubulação', ocorr: '', clima: 'Chuva', fotos: [] }); localStorage.setItem('a360campo', JSON.stringify(c)); });
    const bk = await p.evaluate(async () => { const dados = {}; Object.keys(localStorage).filter(k => /^a360/.test(k) && k !== 'a360sess').forEach(k => dados[k] = localStorage.getItem(k));
      const fs = await ArmantNucleo.files.all(), rd = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
      const arquivos = []; for (const f of fs) arquivos.push({ id: f.id, nome: f.nome, mime: f.mime, data: f.blob ? await rd(f.blob) : f.data }); return { app: 'Armant 360', versao: 'teste', gerado: new Date().toISOString(), por: 'teste', dados, arquivos }; });
    require('fs').writeFileSync(process.argv[5], JSON.stringify(bk)); console.log('   backup salvo:', Object.keys(bk.dados).length, 'módulos,', bk.arquivos.length, 'arquivos'); }
  console.log('   e-mails enviados:', mails.map(m => m.tipo + '→' + m.para + ': ' + m.assunto).join(' || '));
  console.log('erros de página:', errs.length ? errs : 'nenhum');
  await b.close();
})();
