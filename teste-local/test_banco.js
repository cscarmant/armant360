// Banco de dados: aba no menu principal, só superadmin; tabelas, busca, por obra e exportação
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360mat', JSON.stringify({ semBase: true }))); await p.reload(); await p.waitForTimeout(400); await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900); if (await p.locator('[data-tr=skip]').isVisible().catch(() => false)) await p.click('[data-tr=skip]');
  await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.goto(base + '#overview'); await p.reload(); await p.waitForTimeout(900);
  const nav = await p.$$eval('#navigation a', a => a.map(x => x.getAttribute('href')));
  ok('Banco de dados no menu principal, logo abaixo da Visão geral', nav[0] === '#overview' && nav[1] === '#banco');
  await p.click('#navigation a[href="#banco"]'); await p.waitForTimeout(600);
  const n = await p.evaluate(() => ArmantBanco.tabelas()); ok('27 tabelas organizadas por setor (23 + 4 do catálogo por área)', n.length === 27 && await p.locator('.bd-card').count() === 27 &&await p.locator('#view section.panel h2').first().innerText() === 'Engenharia');
  ok('tabelas com registros (obras 15, materiais 20, EAP 244)', n.find(t => t.id === 'demandas').registros === 15 && n.find(t => t.id === 'materiais').registros === 20 && n.find(t => t.id === 'eap').registros === 244);
  if (OUT) await p.screenshot({ path: OUT + '/shot_banco.png' });
  await p.click('.bd-card[href="#banco/t/eap"]'); await p.waitForTimeout(500);
  ok('tabela aberta (EAP) com colunas', await p.locator('.bd-t thead th').count() >= 8 && await p.locator('.bd-t tbody tr').count() === 244);
  await p.fill('#bd-q', 'condensadora'); await p.waitForTimeout(400);
  const nq = await p.locator('.bd-t tbody tr').count(); ok('busca filtra e mantém o foco', nq > 0 && nq < 244 && (await p.evaluate(() => document.activeElement.id)) === 'bd-q');
  const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-bd-exp="csv"]')]); const f1 = path.join(OUT, 'tdl', d1.suggestedFilename()); await d1.saveAs(f1);
  ok('CSV da tabela (todas as 244 linhas)', fs.readFileSync(f1, 'utf8').split('\r\n').length === 245);
  await p.goto(base + '#banco/obra/CC-2026-001'); await p.waitForTimeout(600);
  ok('por obra: CC-2026-001 com a EAP e as demais tabelas ligadas', /244 registro/.test(await p.locator('#view').innerText()) && await p.locator('#bd-cc').inputValue() === 'CC-2026-001');
  await p.selectOption('#bd-cc', 'CC-2026-003'); await p.waitForTimeout(500); ok('trocar de obra', (await p.evaluate(() => location.hash)) === '#banco/obra/CC-2026-003');
  let xl = false; try { const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('[data-bd-exp="obra"]')]); const f2 = path.join(OUT, 'tdl', d2.suggestedFilename()); await d2.saveAs(f2); xl = fs.readFileSync(f2).slice(0, 2).toString() === 'PK' && /CC-2026-003/.test(f2); } catch (e) { console.log('   ', e.message.split('\n')[0]); }
  ok('exportar a obra em Excel', xl);
  ok('sem CPF, RG ou fotos nas tabelas', await p.evaluate(() => ArmantBanco.tabelas().every(t => ArmantBanco.linhas(t.id).every(r => Object.keys(r).every(k => !/cpf|^rg$|foto|senha/i.test(k)) && Object.values(r).every(v => !(typeof v === 'string' && v.startsWith('data:')))))));
  ok('regra: só nível 6 (superadmin) acessa', await p.evaluate(() => { const A = ArmantAcesso, L = A.users(); L.push({ id: 'USR-T5', nome: 'Teste', email: 't@gmail.com', nivel: 5, setor: 'Diretoria', ativo: true, obras: [] }); const r = A.canUser('USR-T5', 'banco') === false && A.canUser('USR-001', 'banco') === true; L.splice(L.findIndex(u => u.id === 'USR-T5'), 1); return r; }));
  await p.evaluate(() => localStorage.setItem('a360simples', '1')); await p.goto(base + '#inicio'); await p.reload(); await p.waitForTimeout(900);
  ok('modo simples: Banco de dados no menu do superadmin', await p.locator('#navigation a[href="#banco"]').count() === 1);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
