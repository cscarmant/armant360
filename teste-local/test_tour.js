// Tour completo: passa por todos os capítulos, cada passo acha o seu alvo, pulo de capítulo e filtro por acesso
const { chromium } = require('playwright');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => { localStorage.removeItem('a360tour'); localStorage.setItem('a360simples', '1'); });
  await p.click('#ac-entrar-demo'); await p.waitForTimeout(900);
  ok('convite do tour aparece', await p.locator('#tr-offer').count() === 1);
  await p.click('[data-tr=start]'); await p.waitForTimeout(700);
  const total = await p.evaluate(() => ArmantAjuda.passos().length);
  ok('tour completo para o superadmin (30 passos ou mais)', total >= 30);
  const sem = [], caps = new Set();
  for (let i = 0; i < total; i++) {
    await p.waitForTimeout(i ? 1000 : 300);
    const st = await p.evaluate(() => ({ h: location.hash, top: document.querySelector('.tr-top small') && document.querySelector('.tr-top small').innerText, spot: getComputedStyle(document.getElementById('tr-spot')).display, t: document.querySelector('#tr-pop strong').innerText }));
    caps.add(await p.$eval('[data-tr-cap]', s => s.value));
    if (st.spot === 'none') sem.push(st.t + ' ' + st.h);
    if (i === 11 && OUT) await p.screenshot({ path: OUT + '/shot_tour.png' });
    if (i < total - 1) await p.click('[data-tr=next]');
  }
  ok('todo passo destaca o seu alvo', sem.length === 0); if (sem.length) console.log(sem);
  ok('10 capítulos', caps.size >= 10); console.log('   ' + [...caps].join(' | '));
  await p.click('[data-tr=next]'); await p.waitForTimeout(300);
  ok('concluir fecha o tour', await p.locator('#tr-ov').count() === 0);
  await p.evaluate(() => ArmantAjuda.tour()); await p.waitForTimeout(500);
  await p.selectOption('[data-tr-cap]', 'Suprimentos'); await p.waitForTimeout(900);
  ok('pular capítulo vai para Compras', (await p.evaluate(() => location.hash)) === '#compras' && (await p.$eval('[data-tr-cap]', s => s.value)) === 'Suprimentos');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // modo completo não mostra os passos de botões grandes
  await p.evaluate(() => localStorage.setItem('a360simples', '0')); await p.reload(); await p.waitForTimeout(900);
  const n2 = await p.evaluate(() => ArmantAjuda.passos());
  ok('modo completo pula a tela de setores', !n2.some(x => /Tela inicial/.test(x)) && n2.length === total - 2);
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
