const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(base+'#overview');await p.waitForTimeout(500);console.log('nav:',(await p.locator('#navigation').innerText()).replace(/\n+/g,' | '));
await p.goto(base+'#operations');await p.waitForTimeout(400);console.log('ops panels:',await p.locator('#cad-btn-dem').count(),await p.locator('#cad-btn-forn').count(),await p.locator('.mt-quick').count());
await p.click('#cad-btn-forn');await p.waitForTimeout(300);console.log('forn list rows',await p.locator('#cad-fres tbody tr').count());
await p.click('[data-cad-ft="Serviço"]');await p.waitForTimeout(200);console.log('serviço rows',await p.locator('#cad-fres tbody tr').count());
await p.click('text=+ Novo fornecedor');await p.waitForTimeout(300);await p.fill('[name=razao]','Frigelar Comércio e Indústria');await p.fill('[name=fant]','Frigelar');await p.click('#cad-forn button[type=submit]');await p.waitForTimeout(200);console.log('err:',await p.locator('#cad-err').innerText());
await p.check('input[name=tipos][value=Materiais]');await p.check('input[name=docs][value="Cartão CNPJ"]');await p.click('#cad-forn button[type=submit]');await p.waitForTimeout(300);console.log('hash',await p.evaluate(()=>location.hash));
await p.screenshot({path:out+'/f-ficha.png',fullPage:true});
await p.goto(base+'#materiais/lancamento');await p.waitForTimeout(300);console.log('datalist opts',await p.locator('#mt-fl option').count());
await p.fill('[data-mt-h=forn]','Frigelar');await p.selectOption('select[data-mt-l="0"]','MAT-001');await p.fill('input[data-mt-l="0"][data-k=q]','2');await p.fill('input[data-mt-l="0"][data-k=pu]','300');await p.click('#mt-save');await p.waitForTimeout(300);
await p.goto(base+'#fornecedores/FOR-007');await p.waitForTimeout(300);console.log('forn entradas:',(await p.locator('section:has(h2:text("Entradas de material"))').innerText()).replace(/\n+/g,' | ').slice(0,160));
for(const h of ['#rh','#pmoc']){await p.goto(base+h);await p.waitForTimeout(300);console.log(h,await p.locator('#page-title').innerText(),await p.locator('.nav-item.active').innerText(),await p.locator('.cad-card').count());await p.screenshot({path:out+'/z'+h.slice(1)+'.png',fullPage:true});}
await p.goto(base+'#catalog');await p.waitForTimeout(300);console.log('catalog ok',await p.locator('#page-title').innerText(),'notice',(await p.locator('.demo-notice p').innerText()).slice(0,30));
const m=await b.newPage({viewport:{width:390,height:844}});for(const h of ['#fornecedores','#fornecedores/novo','#rh','#pmoc','#obra/planejamento']){await m.goto(base+h);await m.waitForTimeout(300);console.log(h,'overflow',await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
console.log('errors',errs);await b.close();})();
