const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base+'#obra/avanco');await p.waitForTimeout(600);
await p.fill('input[data-ob-q="3.10.1.02"]','2');await p.fill('input[data-ob-q="2.1.09"]','20');await p.fill('input[data-ob-q="2.1.01"]','1'); // 2.1.01 já 100% -> acima do saldo
await p.waitForTimeout(200);console.log('btn disabled (esperado true):',await p.locator('#ob-avsave').isDisabled());
await p.fill('input[data-ob-q="2.1.01"]','');await p.fill('#ob-pobs','Entrega Trane parcial');await p.waitForTimeout(200);
console.log('side:',(await p.locator('#ob-side .kpi-subtitle').innerText()));
await p.click('#ob-avsave');await p.waitForTimeout(300);
console.log('periodo sugerido:',await p.inputValue('#ob-pini'),await p.inputValue('#ob-pfim'));
await p.fill('input[data-ob-q="3.10.1.02"]','0,9');await p.fill('input[data-ob-q="2.1.09"]','30');await p.waitForTimeout(200);await p.click('#ob-avsave');await p.waitForTimeout(300);
await p.screenshot({path:out+'/q-avanco.png'});
await p.goto(base+'#obra/relatorio');await p.waitForTimeout(500);
console.log('rel:',(await p.locator('#ob-tab').innerText()).replace(/\n+/g,' | ').slice(0,700));
await p.screenshot({path:out+'/q-rel.png',fullPage:true});
await p.goto(base+'#obra/medicao');await p.waitForTimeout(400);console.log('exec col 2.1.09:',await p.locator('tr:has(input[data-ob-p="2.1.09"]) td:nth-child(4)').innerText());
console.log('errors',errs);await b.close();})();
