const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const p=await b.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
// material entry -> payable
await p.goto(base+'#materiais/lancamento');await p.waitForTimeout(300);await p.fill('[data-mt-h=forn]','Dufrio');await p.selectOption('select[data-mt-l="0"]','MAT-003');await p.fill('input[data-mt-l="0"][data-k=q]','10');await p.fill('input[data-mt-l="0"][data-k=pu]','500');await p.click('#mt-save');await p.waitForTimeout(200);
await p.goto(base+'#finance');await p.waitForTimeout(600);
console.log('kpis:',(await p.locator('#fn-tab .kpi-grid').innerText()).replace(/\n+/g,' | '));
console.log('alerts:',(await p.locator('.fn-alerts').innerText().catch(()=>'')).replace(/\n+/g,' | '));
await p.screenshot({path:out+'/f-visao.png',fullPage:true});
await p.click('[data-fn-go=config]');await p.waitForTimeout(300);await p.click('#fn-ctadd');await p.waitForTimeout(200);
await p.fill('[data-fn-ct][data-k=saldo]','250.000,00');await p.fill('[data-fn-cfg=cnpj]','11.222.333/0001-81');await p.fill('[data-fn-cfg=razao]','ARMANT LTDA');
await p.goto(base+'#finance/receber');await p.waitForTimeout(400);console.log('receber rows',await p.locator('#fn-tab tbody tr').count());
await p.locator('[data-fn-fat]').first().click();await p.waitForTimeout(400);console.log('drawer:',await p.locator('.fn-dpanel h2').innerText(),'|',await p.inputValue('[name=tomNome]'),await p.inputValue('[name=valor]'));
await p.fill('[name=tomCnpj]','00.000.000/0001-91');await p.click('#fn-nota button[type=submit]');await p.waitForTimeout(400);console.log('toast:',await p.locator('#toast').innerText(),'hash',await p.evaluate(()=>location.hash));
const xml=await p.evaluate(()=>window.ArmantFinanceiro.state.notas[0].xml);console.log(xml.split('\n').slice(2,8).join(' ').slice(0,300));
const ok=await p.evaluate(x=>!new DOMParser().parseFromString(x,'application/xml').getElementsByTagName('parsererror').length,xml);console.log('xml well-formed',ok);
const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-fn-xml]')]);console.log('download:',dl?dl.suggestedFilename():'none');
await p.goto(base+'#finance/pagar');await p.waitForTimeout(300);console.log('pagar:',(await p.locator('#fn-tab tbody').innerText()).replace(/\s+/g,' ').slice(0,200));
await p.locator('[data-fn-baixa]').first().click();await p.waitForTimeout(200);await p.click('#fn-baixa button[type=submit]');await p.waitForTimeout(300);console.log('toast:',await p.locator('#toast').innerText());
await p.click('[data-fn-newrec]');await p.fill('#fn-rec [name=desc]','Aluguel do escritório');await p.fill('#fn-rec [name=valor]','8.500,00');await p.click('#fn-rec button[type=submit]');await p.waitForTimeout(300);
await p.click('[data-fn-new=pag]');await p.fill('#fn-form [name=desc]','Mão de obra Iceclima');await p.fill('#fn-form [name=valor]','90.000,00');await p.selectOption('#fn-form [name=cc]','CC-2026-001');await p.fill('#fn-form [name=parc]','3');await p.click('#fn-form button[type=submit]');await p.waitForTimeout(300);
console.log('pagar rows',await p.locator('#fn-tab tbody tr').count());
await p.goto(base+'#finance/fluxo');await p.waitForTimeout(300);console.log('fluxo kpis:',(await p.locator('#fn-tab .kpi-grid').innerText()).replace(/\n+/g,' | '));await p.screenshot({path:out+'/f-fluxo.png',fullPage:true});
await p.goto(base+'#finance/obras');await p.waitForTimeout(300);console.log('obras:',(await p.locator('#fn-tab tbody').innerText()).replace(/\s+/g,' '));
await p.goto(base+'#finance');await p.waitForTimeout(300);await p.screenshot({path:out+'/f-visao2.png',fullPage:true});
await p.goto(base+'#finance/notas');await p.waitForTimeout(300);await p.click('[data-fn-nnova]');await p.waitForTimeout(200);await p.click('[data-fn-ntipo=nfe]');await p.waitForTimeout(200);console.log('nfe form items',await p.locator('.fn-itens tbody tr').count());await p.keyboard.press('Escape');
const m=await b.newPage({viewport:{width:390,height:844}});for(const h of ['#finance','#finance/receber','#finance/fluxo','#finance/notas']){await m.goto(base+h);await m.waitForTimeout(300);console.log(h,'overflow',await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
console.log('errors',errs);await b.close();})();
