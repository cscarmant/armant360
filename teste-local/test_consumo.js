// Painel do superadmin → Consumo e custos (modo protótipo e modo servidor simulado)
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(500); await p.click('#ac-entrar-demo'); await p.waitForTimeout(700);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#auditoria'); await p.waitForTimeout(400);
  await p.click('[data-au-view=consumo]'); await p.waitForTimeout(900);
  ok('aba Consumo e custos no Painel do superadmin', (await p.locator('#cs-consumo').count()) === 1);
  const t = await p.locator('#cs-consumo').innerText();
  ok('modo protótipo: mostra estimativa e 4 medidores', /Estimativa do protótipo/.test(t) && (await p.locator('.cs-k').count()) === 4);
  ok('previsão com Free e Pro para hoje, 6 e 12 meses', (await p.locator('.cs-prev tbody tr').count()) === 3 && /US\$ 25,00/.test(t));
  await p.fill('[data-cs-cfg=usuarios]', '50'); await p.waitForTimeout(600); await p.fill('[data-cs-cfg=emailsDia]', '3'); await p.waitForTimeout(600);
  const t2 = await p.locator('.cs-prev').innerText();
  ok('50 usuários × 3 e-mails/dia passam do Resend grátis (US$ 20)', /US\$ 20,00/.test(t2));
  await p.fill('[data-cs-cfg=cambio]', '6'); await p.waitForTimeout(600);
  ok('câmbio entra no total em reais', /R\$ 270,00/.test(await p.locator('.cs-prev').innerText()));
  ok('parâmetros ficam guardados', await p.evaluate(() => JSON.parse(localStorage.getItem('a360consumo')).usuarios === 50));
  // servidor simulado: painel_consumo
  await p.evaluate(() => { const dia = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    window.ArmantPonte = { uso: () => ({ banco: { req: 1, down: 1000, up: 0 } }), sb: { rpc: async (n) => n !== 'painel_consumo' ? { data: null } : ({ data: { banco_bytes: 420 * 1024 * 1024, tabelas: [{ nome: 'estado_modulo', bytes: 300 * 1024 * 1024, linhas: 14 }, { nome: 'auditoria', bytes: 60 * 1024 * 1024, linhas: 9000 }], arquivos: [{ cofre: 'fotos-campo', qtd: 900, bytes: 0.85 * 1024 ** 3 }, { cofre: 'anexos', qtd: 40, bytes: 50 * 1024 * 1024 }], usuarios_ativos_30d: 20, perfis_ativos: 24, emails_30d: 1200,
      uso_30d: { banco: { req: 5000, down: 6 * 1024 ** 3, up: 1e8 }, arquivos: { req: 900, down: 2 * 1024 ** 3, up: 3e8 } }, dias_medidos: 10, por_dia: Array.from({ length: 10 }, (_, i) => ({ dia: dia(10 - i), down: (0.5 + i / 20) * 1024 ** 3, pessoas: 18 })), por_pessoa: [{ perfil_id: 'USR-006', nome: 'Carlos Souza', setor: 'Campo', down: 900 * 1024 * 1024 }], historico: [] } }) } }; });
  await p.evaluate(() => ArmantConsumo.recarregar()); await p.waitForTimeout(600);
  const t3 = await p.locator('#cs-consumo').innerText();
  ok('modo servidor: números medidos e aviso de arquivos perto do limite do Free', /Medido no servidor/.test(t3) && /Plano Free: perto do limite/.test(t3));
  ok('gráfico de tráfego por dia (10 barras) com tabela', (await p.locator('.cs-svg .cs-b').count()) === 10 && (await p.locator('.cs-tab table').count()) >= 1);
  ok('Free não cabe (tráfego) e Pro sem excedente', /não cabe: .*tráfego/.test(t3) && /sem excedente/.test(t3));
  ok('quem mais consome', /Carlos Souza/.test(t3));
  await p.screenshot({ path: OUT + '/consumo.png', fullPage: true });
  console.log('erros de página:', errs.length ? errs : 'nenhum'); await b.close();
})();
