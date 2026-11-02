/* Armant 360 · usar o Google Chrome já instalado nesta máquina quando o Chromium do Playwright não baixa.
   Ativa só com ARMANT_CHROME=1 (ex.: ARMANT_CHROME=1 node -r ./usar-chrome-instalado.js teste.js).
   Sem a variável, os testes usam o Chromium do Playwright, como antes. */
if (process.env.ARMANT_CHROME === '1') {
  const { chromium } = require('playwright');
  const abrir = chromium.launch.bind(chromium);
  chromium.launch = (opcoes) => abrir({ channel: 'chrome', ...(opcoes || {}) });
}
