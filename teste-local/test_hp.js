const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base+'#overview');await p.waitForTimeout(1500);console.log('offer',await p.locator('#tr-offer').count());await p.screenshot({path:out+'/h-offer.png'});
await p.click('[data-tr=start]');await p.waitForTimeout(500);
for(let i=0;i<9;i++){const t=await p.locator('#tr-pop strong').innerText();const sp=await p.locator('#tr-spot').evaluate(e=>e.style.display+' '+e.style.width);console.log(i+1,t,'|',sp);if(i===1||i===5)await p.screenshot({path:out+'/h-tour'+i+'.png'});await p.click('[data-tr=next]');await p.waitForTimeout(600);}
console.log('tour closed',await p.locator('#tr-ov').count());
await p.click('#hp-fab');await p.waitForTimeout(200);await p.fill('#hp-in','como importo nota fiscal em pdf?');await p.click('#hp-form button');await p.waitForTimeout(400);console.log('ans:',(await p.locator('.hp-m.ai').last().innerText()).slice(0,140));
await p.fill('#hp-in','qual a capital da França?');await p.click('#hp-form button');await p.waitForTimeout(300);console.log('off-topic:',(await p.locator('.hp-m.ai').last().innerText()).slice(0,140));
await p.screenshot({path:out+'/h-chat.png'});
await p.reload();await p.waitForTimeout(1300);console.log('offer after seen',await p.locator('#tr-offer').count());
const m=await b.newPage({viewport:{width:390,height:844}});await m.goto(base+'#campo');await m.waitForTimeout(1200);console.log('fab on campo visible?',await m.locator('#hp-fab').isVisible(),'offer',await m.locator('#tr-offer').count());
console.log('errors',errs);await b.close();})();
