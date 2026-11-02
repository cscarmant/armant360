const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const html=fs.readFileSync(process.argv[2],'utf8');const out=process.argv[3];
const wrap='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>';
fs.writeFileSync(out+'/p.html',wrap);
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
for(const h of ['overview','projects','obra/andamento','obra/medicao','obra/aditivos','obra/prazo','timeline','obra/perfil']){
 await p.goto('file://'+out+'/p.html#'+h);await p.waitForTimeout(700);
 if(h==='obra/medicao'){await p.fill('input[data-p="2.1.09"]','50');await p.selectOption('select[data-mk="3.10.1.02"]','70');await p.waitForTimeout(300);
   console.log('fat:',(await p.locator('#fat').innerText()).replace(/\n+/g,' | ').slice(0,400));}
 await p.screenshot({path:`${out}/pp-${h.replace('/','_')}.png`,fullPage:false});}
await p.setViewportSize({width:400,height:900});await p.goto('file://'+out+'/p.html#obra/medicao');await p.waitForTimeout(600);
console.log('mobile scrollW',await p.evaluate(()=>document.documentElement.scrollWidth));await p.screenshot({path:`${out}/pp-mobile.png`});
console.log('errors',errs);await b.close();})();
