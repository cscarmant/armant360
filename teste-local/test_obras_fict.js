// Obras fictícias completas: cada OB-0xx abre a tela de obra (todas as abas), marcada como fictícia, sem dados do TJ-RS; medição por quantidade
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.evaluate(() => localStorage.setItem('a360obrasvista', 'painel')); await p.reload(); await p.waitForTimeout(400); await p.waitForTimeout(400); await p.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('a360demo-') || k === 'a360').forEach(k => localStorage.removeItem(k)); });
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(800);
  if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]');
  await p.goto(base + '#projects'); await p.waitForTimeout(700);
  const row = p.locator('[data-project="OB-001"]').first();
  ok('linha da obra fictícia marcada', /obra fictícia/.test(await row.innerText()));
  await row.click(); await p.waitForTimeout(600);
  ok('clique abre a tela da obra fictícia', (await p.evaluate(() => location.hash)) === '#obra/OB-001');
  let t = await p.locator('#view').innerText();
  ok('cabeçalho marcado como fictícia', /obra fictícia · demonstração/.test(t) && /Hospital Horizonte/.test(t));
  ok('aviso do topo diz obra fictícia', /Obra fictícia/.test(await p.locator('.demo-notice').innerText()));
  const hrefs = await p.$$eval('.ob-tabs a', a => a.map(x => x.getAttribute('href')));
  ok('abas ficam dentro da obra (11)', hrefs.length === 11 && hrefs.every(h => h.startsWith('#obra/OB-001/')));
  const ids = await p.evaluate(() => (window.ARMANT_OBRAS_DEMO || []).map(d => d.id));
  ok('12 obras fictícias', ids.length === 12);
  let vaz = [], ruim = [];
  for (const id of ids) for (const h of hrefs) {
    const tab = h.split('/')[2]; await p.goto(base + '#obra/' + id + '/' + tab); await p.waitForTimeout(120);
    const tx = await p.locator('#view').innerText();
    if (tx.length < 300) vaz.push(id + '/' + tab);
    if (/TJ-RS|\bTJ\b|CRON|Foro|Petrópolis|Tribunal/.test(tx) || /NaN|undefined|Infinity/.test(tx)) ruim.push(id + '/' + tab + ': ' + (tx.match(/.{0,30}(TJ-RS|\bTJ\b|CRON|Foro|Petrópolis|Tribunal|NaN|undefined|Infinity).{0,30}/) || [''])[0]);
  }
  ok('todas as abas de todas as obras têm conteúdo', vaz.length === 0); if (vaz.length) console.log(vaz.slice(0, 10));
  ok('nenhuma aba mostra dado do TJ-RS nem NaN', ruim.length === 0); if (ruim.length) console.log(ruim.slice(0, 10));
  const nomes = await p.evaluate(() => Object.values(ArmantObrasDemo).map(o => o.obra.valor + '|' + o.items.length));
  ok('cada obra tem valores próprios', new Set(nomes).size === 12);
  // medição por quantidade
  await p.goto(base + '#obra/OB-002/medicao'); await p.waitForTimeout(400);
  const inp = p.locator('[data-ob-mq]').first(); const c = await inp.getAttribute('data-ob-mq');
  const it = await p.evaluate(c => { const i = ArmantObrasDemo['OB-002'].items.find(x => x.c === c); return { q: i.q, t: i.t }; }, c);
  await inp.fill('1'); await p.waitForTimeout(150);
  const pct = await p.evaluate(c => ArmantObrasDemo['OB-002'].state.med[c], c);
  ok('quantidade vira percentual do item', Math.abs(pct - 100 / it.q) < 1e-6);
  ok('valor da linha pela quantidade', /R\$/.test(await p.locator('[data-ob-v="' + c + '"]').innerText()));
  await inp.fill(String(it.q + 5)); await p.waitForTimeout(150);
  ok('quantidade acima do contratado acusa erro', /acima do contratado/.test(await p.locator('[data-ob-v="' + c + '"]').innerText()) && /ob-err/.test(await inp.evaluate(e => e.closest('tr').className)));
  ok('fictícia guarda em chave própria', await p.evaluate(() => !!localStorage.getItem('a360demo-OB-002') && !(JSON.parse(localStorage.getItem('a360') || '{}').medQ || {})[Object.keys(ArmantObrasDemo['OB-002'].state.medQ)[0]]));
  await inp.fill(''); await p.waitForTimeout(100);
  // obra real continua igual
  await p.goto(base + '#obra'); await p.waitForTimeout(400); t = await p.locator('#view').innerText();
  ok('obra real continua com TJ-RS', /obra real/.test(t) && /Alto Petrópolis/.test(t) && !/obra fictícia · demonstração/.test(t));
  ok('abas da obra real sem código', (await p.$$eval('.ob-tabs a', a => a.map(x => x.getAttribute('href')))).every(h => /^#obra\/[a-z]+$/.test(h)));
  ok('centro de custo só na obra real', await p.locator('.cad-ccpill').count() === 1);
  await p.goto(base + '#obra/medicao'); await p.waitForTimeout(400);
  ok('medição da obra real com entrada em quantidade', await p.locator('[data-ob-mq]').count() > 50 && await p.locator('[data-ob-p]').count() === 0);
  await p.goto(base + '#projects'); await p.waitForTimeout(400);
  ok('ao sair da obra o aviso volta ao normal', !/Obra fictícia|Obra real\./.test(await p.locator('.demo-notice').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
