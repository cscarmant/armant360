// Obras → Inserir demanda aprovada: lê o PDF, preenche, gera o centro de custo e a obra entra em Planejamento no kanban
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch();
  // PDFs de teste (fictícios) gerados pelo próprio navegador
  const mk = async (html, file) => { const q = await b.newPage(); await q.setContent('<html><body style="font-family:Arial;font-size:13px;padding:30px">' + html + '</body></html>'); await q.pdf({ path: file, format: 'A4' }); await q.close(); };
  const P1 = path.join(OUT, 'tdl', 'contrato-teste.pdf'), P2 = path.join(OUT, 'tdl', 'os-teste.pdf');
  await mk('<h2>CONTRATO Nº 045/2026</h2><p>Processo SEI nº 118.00045/2026-11</p><p>CONTRATANTE: Câmara Municipal de Porto Alegre, inscrita no CNPJ sob o nº 89.522.437/0001-07.</p><p>CONTRATADA: Armant (dados de teste).</p><p>CLÁUSULA PRIMEIRA - OBJETO: Manutenção e ampliação do sistema de climatização do plenário. </p><p>CLÁUSULA SEGUNDA - O valor global do contrato é de R$ 512.340,90 (quinhentos e doze mil).</p><p>CLÁUSULA TERCEIRA - O prazo de execução é de 120 (cento e vinte) dias, com início dos serviços em 16/11/2026.</p><p>Porto Alegre, 28 de outubro de 2026.</p>', P1);
  await mk('<h2>ORDEM DE SERVIÇO Nº 77/2026</h2><p>Objeto: Troca de condensadoras da agência Centro. </p><p>Valor total: R$ 48.900,00. Prazo de 30 (trinta) dias a contar da emissão desta ordem.</p><p>Canoas/RS, 29 de outubro de 2026.</p>', P2);
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => { localStorage.removeItem('a360cad'); localStorage.removeItem('a360kanban'); }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800); if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#projects'); await p.waitForTimeout(600);
  ok('botão "Inserir demanda aprovada" em Obras', await p.locator('#kb-obras [data-dem-obras]').count() === 1);
  await p.click('#kb-obras [data-dem-obras]'); await p.waitForTimeout(600);
  ok('abre o cadastro da demanda', (await p.evaluate(() => location.hash)) === '#demanda/nova' && await p.locator('#cad-difile').count() === 1);
  await p.setInputFiles('#cad-difile', P1); await p.waitForTimeout(4000);
  const v = await p.evaluate(() => { const f = document.getElementById('cad-dem').elements; return { doc: f.aprovDoc.value, num: f.aprovNum.value, data: f.aprovData.value, valor: f.valor.value, prazo: f.prazo.value, inicio: f.inicio.value, cli: f.cli.value, nome: f.nome.value, cid: f.cidade.value }; });
  console.log('   lido:', JSON.stringify(v));
  ok('PDF lido: contrato 045/2026, valor, 120 dias, início 16/11/2026, data 28/10', v.doc === 'Contrato assinado' && v.num === '045/2026' && v.valor === '512.340,90' && v.prazo === '120' && v.inicio === '2026-11-16' && v.data === '2026-10-28');
  ok('cliente achado pelo CNPJ (CMPA) e objeto no nome', v.cli === 'CLI-003' && /climatização do plenário/i.test(v.nome));
  ok('resumo mostra o início', /início 16\/11\/2026/.test(await p.locator('#cad-direl').innerText()));
  await p.click('#cad-dem button[type=submit]'); await p.waitForTimeout(700);
  ok('salvar volta para Obras', (await p.evaluate(() => location.hash)) === '#projects');
  const cc = await p.evaluate(() => { const d = ArmantCadastros.state.dem; return d[d.length - 1].cc; });
  const col = async k => p.$eval('[data-kbo="' + k + '"]', e => e.closest('[data-kbc]').dataset.kbc);
  ok('nova obra em Planejamento com o início no cartão', (await col(cc)) === 'plan' && /início 16\/11\/2026/.test(await p.locator('[data-kbo="' + cc + '"]').innerText()));
  // ordem de serviço sem data de início
  await p.click('#kb-obras [data-dem-obras]'); await p.waitForTimeout(600); await p.setInputFiles('#cad-difile', P2); await p.waitForTimeout(3000);
  const v2 = await p.evaluate(() => { const f = document.getElementById('cad-dem').elements; return { doc: f.aprovDoc.value, num: f.aprovNum.value, valor: f.valor.value, prazo: f.prazo.value, inicio: f.inicio.value, cid: f.cidade.value, uf: f.uf.value, obs: f.obs.value }; });
  console.log('   lido:', JSON.stringify(v2));
  ok('OS: tipo, número, valor, prazo, Canoas/RS e pendência de início', v2.doc === 'Ordem de serviço' && v2.num === '77/2026' && v2.valor === '48.900,00' && v2.prazo === '30' && v2.inicio === '' && v2.cid === 'Canoas' && v2.uf === 'RS' && /PENDÊNCIA/.test(v2.obs));
  await p.selectOption('#cad-dem [name=cli]', 'CLI-002'); await p.click('#cad-dem button[type=submit]'); await p.waitForTimeout(700);
  const cc2 = await p.evaluate(() => { const d = ArmantCadastros.state.dem; return d[d.length - 1].cc; });
  ok('sem início: Planejamento, "início a definir"', (await col(cc2)) === 'plan' && /início a definir/.test(await p.locator('[data-kbo="' + cc2 + '"]').innerText()));
  // início já passou → Mobilização
  await p.evaluate(cc => { const d = ArmantCadastros.state.dem.find(x => x.cc === cc); d.inicio = '2026-10-01'; }, cc2); await p.evaluate(() => render()); await p.waitForTimeout(400);
  ok('no dia do início passa a Mobilização', (await col(cc2)) === 'mob');
  if (OUT) await p.locator('#kb-obras').screenshot({ path: OUT + '/shot_dem.png' });
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
