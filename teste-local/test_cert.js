// Certificado digital A1: incluir, ler validade, avisar antes de expirar, renovar
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], C = process.argv[3], OUT = process.argv[4], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const mails = []; await p.route('https://script.google.com/**', r => { mails.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ body: 'ok' }); });
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  const skip = async () => { if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {}); };
  await p.goto(base); await p.waitForTimeout(500); await p.click('#ac-entrar-demo'); await p.waitForTimeout(400); await p.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, 'valentim.arr@gmail.com'); await p.waitForTimeout(800); await skip();
  await p.goto(base + '#acesso'); await p.waitForTimeout(400); await p.fill('#ac-hook', 'https://script.google.com/macros/s/T/exec'); await p.dispatchEvent('#ac-hook', 'change');
  await p.goto(base + '#finance/notas'); await p.waitForTimeout(700); await skip();
  ok('painel do certificado em Notas fiscais', (await p.locator('#ce-panel').count()) === 1);
  const incluir = async (arq, senha) => { await p.setInputFiles('#ce-form [name=arq]', path.join(C, arq)); await p.fill('#ce-form [name=senha]', senha); await p.click('#ce-form button[type=submit]'); await p.waitForTimeout(2500); };
  await incluir('vence20.pfx', 'errada');
  ok('senha errada é recusada', (await p.locator('#ce-err').innerText()).includes('Senha incorreta'));
  await incluir('semchave.p12', 'senha123');
  ok('arquivo sem chave privada não é aceito como A1', /chave privada|não é um certificado/i.test(await p.locator('#ce-err').innerText()));
  await incluir('vence20.pfx', 'senha123');
  const card = await p.locator('.ce-card').innerText(); console.log('   ', card.replace(/\n/g, ' | ').slice(0, 300));
  ok('lê titular, CNPJ e validade (AES, OpenSSL 3)', card.includes('ARMANT SOLUCOES EM CLIMATIZACAO LTDA') && card.includes('13.591.585/0001-03') && /vence em (19|20) dia/.test(card));
  ok('senha não fica guardada', !(await p.evaluate(() => JSON.stringify(localStorage))).includes('senha123'));
  ok('arquivo não vai para a área sincronizada', await p.evaluate(async () => !(await ArmantNucleo.files.all()).some(f => /pfx/.test(f.nome || ''))));
  ok('aviso no app para o superadmin', await p.evaluate(() => JSON.parse(localStorage.getItem('a360nucleo')).notif.some(n => n.para === 'USR-001' && /Certificado A1 vence em/.test(n.titulo))));
  ok('e-mail de aviso enviado', mails.some(m => /Certificado A1 vence em/.test(m.assunto) && m.para === 'valentim.arr@gmail.com'));
  const n1 = mails.length; await p.reload(); await p.waitForTimeout(800);
  ok('não repete o aviso no mesmo limite', mails.length === n1);
  ok('faixa de alerta no Financeiro', await (async () => { await p.goto(base + '#finance'); await p.waitForTimeout(600); return (await p.locator('.ce-faixa').innerText()).includes('vence em'); })());
  await p.goto(base + '#finance/notas'); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/certificado.png', fullPage: false });
  // simula a passagem do tempo: faltando 6 dias, avisa de novo (limite de 7)
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('a360cert')); const d = new Date(); d.setDate(d.getDate() + 6); s.atual.ate = d.toISOString().slice(0, 10); localStorage.setItem('a360cert', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(900);
  ok('novo aviso quando chega a 7 dias', mails.some(m => /vence em 6 dia/.test(m.assunto)));
  // baixar o arquivo guardado neste aparelho
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('[data-ce-baixar]')]);
  ok('baixa o .pfx guardado', !!dl && /\.pfx$/.test(dl.suggestedFilename()));
  // renovar: certificado legado 3DES, válido 400 dias
  await incluir('vence20-3des.pfx', 'senha123');
  ok('lê certificado no formato antigo (3DES)', (await p.locator('.ce-card').innerText()).includes('ARMANT'));
  await incluir('valido400.pfx', 'senha123');
  ok('renovação: novo válido e anterior no histórico', (await p.locator('.ce-card').innerText()).includes('válido por mais') && (await p.locator('.ce-hist').innerText()).includes('Certificados anteriores'));
  ok('faixa some depois da renovação', await (async () => { await p.goto(base + '#finance'); await p.waitForTimeout(500); return (await p.locator('.ce-faixa').count()) === 0; })());
  // CNPJ diferente do emitente
  await p.evaluate(() => { const f = JSON.parse(localStorage.getItem('a360fin')) || {}; f.cfg = f.cfg || {}; f.cfg.cnpj = '13.591.585/0001-03'; localStorage.setItem('a360fin', JSON.stringify(f)); }); await p.reload(); await p.waitForTimeout(500);
  await p.goto(base + '#finance/notas'); await p.waitForTimeout(600); await incluir('outro.pfx', 'senha123');
  ok('alerta de CNPJ diferente do emitente', (await p.locator('.ce-warn').innerText()).includes('diferente'));
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
