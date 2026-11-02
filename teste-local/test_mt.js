const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(base+'#operations');await p.waitForTimeout(400);console.log('quick cards:',await p.locator('.mt-quick .cad-card').count());await p.screenshot({path:out+'/m-ops.png'});
await p.goto(base+'#materiais/lancamento');await p.waitForTimeout(300);
await p.fill('[data-mt-h=forn]','Dufrio');await p.fill('[data-mt-h=doc]','NF 1001');
await p.selectOption('select[data-mt-l="0"]','MAT-003');await p.fill('input[data-mt-l="0"][data-k=q]','10');await p.fill('input[data-mt-l="0"][data-k=pu]','480,00');
await p.click('#mt-add');await p.selectOption('select[data-mt-l="1"]','MAT-010');await p.fill('input[data-mt-l="1"][data-k=q]','3');await p.fill('input[data-mt-l="1"][data-k=pu]','1.150,00');
console.log('side:',(await p.locator('#mt-side').innerText()).replace(/\n+/g,' | ').slice(0,250));await p.screenshot({path:out+'/m-lanc.png',fullPage:true});
await p.click('#mt-save');await p.waitForTimeout(300);console.log('toast',await p.locator('#toast').innerText());
// segunda entrada preço diferente -> custo médio
await p.selectOption('select[data-mt-l="0"]','MAT-003');await p.fill('[data-mt-h=forn]','Frigelar');await p.fill('input[data-mt-l="0"][data-k=q]','10');await p.fill('input[data-mt-l="0"][data-k=pu]','520');await p.click('#mt-save');await p.waitForTimeout(300);
await p.goto(base+'#materiais/entrega');await p.waitForTimeout(300);
await p.selectOption('[data-mt-h=cc]','CC-2026-001');await p.fill('[data-mt-h=rec]','Encarregado obra');
await p.selectOption('select[data-mt-l="0"]','MAT-003');await p.fill('input[data-mt-l="0"][data-k=q]','25');await p.waitForTimeout(150);
console.log('over stock disabled?',await p.locator('#mt-save').isDisabled(),(await p.locator('#mt-side .ob-alert').innerText()));
await p.fill('input[data-mt-l="0"][data-k=q]','12');await p.waitForTimeout(150);console.log('ok disabled?',await p.locator('#mt-save').isDisabled());
await p.screenshot({path:out+'/m-entrega.png',fullPage:true});
await p.click('#mt-save');await p.waitForTimeout(300);console.log('toast',await p.locator('#toast').innerText());
await p.goto(base+'#materiais/estoque');await p.waitForTimeout(300);
console.log('kpis:',(await p.locator('.kpi-grid').innerText()).replace(/\n+/g,' | '));
console.log('row MAT-003:',(await p.locator('tr:has(td:text-is("MAT-003"))').innerText()).replace(/\s+/g,' '));
await p.screenshot({path:out+'/m-estoque.png',fullPage:true});
await p.goto(base+'#materiais/movs');await p.waitForTimeout(300);console.log('movs:',await p.locator('[data-mt-del]').count());
// excluir entrada 1 -> deve bloquear (estoque negativo)
const del=p.locator('tr:has-text("NF 1001") [data-mt-del]');await del.click();await del.click();await p.waitForTimeout(200);console.log('del toast:',await p.locator('#toast').innerText());
await p.goto(base+'#cc/CC-2026-001');await p.waitForTimeout(300);console.log('cc panel:',(await p.locator('section:has(h2:text("Materiais desta obra"))').innerText()).replace(/\n+/g,' | ').slice(0,200));
await p.goto(base+'#materiais/catalogo');await p.waitForTimeout(300);await p.fill('#mt-nd','Tubo de cobre 7/8" (barra 5 m)');await p.click('#mt-nsave');await p.waitForTimeout(200);console.log('toast',await p.locator('#toast').innerText());
const m=await b.newPage({viewport:{width:390,height:844}});for(const h of ['#materiais/entrega','#materiais/estoque','#materiais/catalogo']){await m.goto(base+h);await m.waitForTimeout(300);console.log(h,'overflow',await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
await m.screenshot({path:out+'/m-mobile.png',fullPage:true});
console.log('errors',errs);await b.close();})();
