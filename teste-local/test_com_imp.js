// Comercial: importar clientes e negociações de CSV e Excel, com prévia
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const SITE = process.argv[2], OUT = process.argv[3], base = 'file://' + SITE + '/index.html', D = path.join(OUT, 'tdl');
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
  await p.goto(base); await p.waitForTimeout(400); await p.evaluate(() => localStorage.removeItem('a360cad')); await p.reload(); await p.waitForTimeout(400); await p.click('#ac-entrar-demo'); await p.waitForTimeout(900);
  await p.goto(base + '#commercial'); await p.waitForTimeout(600);
  ok('área de importação no Comercial', await p.locator('#ci-panel #ci-file').count() === 1);
  const [dm] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-ci-mod="negociacoes"]')]); const fm = path.join(D, dm.suggestedFilename()); await dm.saveAs(fm);
  ok('modelo de negociações (CSV)', /^﻿Título;Cliente;CNPJ;Valor;Etapa/.test(fs.readFileSync(fm, 'utf8')));
  const c1 = path.join(D, 'clientes.csv'); fs.writeFileSync(c1, '﻿Razão social;Sigla;CNPJ;Cidade;UF;Contato;E-mail\nHospital Exemplo Ltda.;HEX;;Porto Alegre;RS;Fulano;fulano@exemplo.com.br\nCâmara Municipal de Porto Alegre;CMPA;89.522.437/0001-07;Porto Alegre;RS;Beltrano;\nIndústria Teste S.A.;;11.111.111/1111-11;Canoas;RS;;\n');
  const n0 = await p.evaluate(() => ArmantCadastros.clientes().length);
  await p.setInputFiles('#ci-file', c1); await p.waitForTimeout(600);
  let t = await p.locator('#ci-panel').innerText();
  ok('prévia: 2 novos, CMPA já cadastrada, aviso de CNPJ inválido', /2 cliente\(s\) novo/.test(t) && /Câmara Municipal de Porto Alegre já está cadastrado/.test(t) && /CNPJ 11\.111\.111\/1111-11 inválido/.test(t));
  await p.click('#ci-ok'); await p.waitForTimeout(500);
  ok('clientes gravados (+2), CMPA sem duplicar', await p.evaluate(() => ArmantCadastros.clientes().length) === n0 + 2 && await p.evaluate(() => ArmantCadastros.clientes().filter(c => /Câmara Municipal/.test(c.razao)).length) === 1);
  // Excel com duas abas (gerado no navegador com a mesma biblioteca)
  const b64 = await p.evaluate(async () => { await new Promise((ok, ko) => { if (window.XLSX) return ok(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    const X = window.XLSX, wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Razão social', 'CNPJ', 'Cidade', 'UF'], ['Clínica Nova Ltda.', '', 'Gravataí', 'RS']]), 'Clientes');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Título', 'Cliente', 'Valor', 'Etapa', 'Responsável', 'Data do próximo passo'], ['Climatização do bloco B', 'Hospital Exemplo Ltda.', 250000, 'Proposta enviada', 'Valentim', '15/11/2026'], ['Retrofit do CPD', 'Clínica Nova Ltda.', '98.500,00', 'Negociação', '', ''], ['Reforma pequena', 'Empresa Desconhecida', 12000, 'prospecção', '', ''], ['Climatização do bloco B', 'Hospital Exemplo Ltda.', 1, 'x', '', '']]), 'Negociações');
    const u8 = new Uint8Array(X.write(wb, { bookType: 'xlsx', type: 'array' })); let s = ''; u8.forEach(c => s += String.fromCharCode(c)); return btoa(s); });
  const xp = path.join(D, 'comercial.xlsx'); fs.writeFileSync(xp, Buffer.from(b64, 'base64'));
  const g0 = await p.evaluate(() => ArmantCadastros.state.neg.length);
  await p.setInputFiles('#ci-file', xp); await p.waitForTimeout(900); t = await p.locator('#ci-panel').innerText();
  ok('Excel: 2 abas lidas; 3 negociações, 2 clientes novos (Clínica e Empresa Desconhecida), 1 repetida', /3 negociação/.test(t) && /2 cliente\(s\) novo/.test(t) && /já existe para este cliente/.test(t));
  await p.click('#ci-ok'); await p.waitForTimeout(500);
  const ng = await p.evaluate(() => ArmantCadastros.state.neg.slice(-3).map(n => n.etapa + '|' + n.valor + '|' + (n.proxData || '')));
  ok('negociações nas etapas certas, valor e data convertidos', ng[0] === 'prop|250000|2026-11-15' && ng[1] === 'neg|98500|' && ng[2] === 'prosp|12000|' && await p.evaluate(() => ArmantCadastros.state.neg.length) === g0 + 3);
  ok('aparecem no kanban do Comercial', /Retrofit do CPD/.test(await p.locator('#kb-wrap').innerText()));
  await p.setInputFiles('#ci-file', xp); await p.waitForTimeout(900);
  ok('reimportar não duplica', /0 negociação/.test(await p.locator('#ci-panel').innerText()) && /0 cliente\(s\) novo/.test(await p.locator('#ci-panel').innerText()));
  ok('sem erros', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
