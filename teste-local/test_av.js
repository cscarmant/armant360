const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const out=process.argv[3];
fs.writeFileSync(out+'/p.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+fs.readFileSync(process.argv[2],'utf8')+'</body></html>');
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+out+'/p.html#obra/avanco');await p.waitForTimeout(600);
await p.fill('input[data-av="2.1.05"]','50');           // contêiner 33% -> 50%
await p.fill('input[data-av="2.1.09"]','80');           // tapume 66%? -> 80
await p.selectOption('select[data-avm="3.10.1.01"]','90'); // condensadora 8HP 70 -> 90
await p.fill('input[data-av="2.1.01"]','50');            // abaixo do anterior (100) -> erro
await p.waitForTimeout(300);
console.log('side1:',(await p.locator('#avside').innerText()).replace(/\n+/g,' | ').slice(0,330));
await p.fill('input[data-av="2.1.01"]','');await p.waitForTimeout(200);
await p.screenshot({path:out+'/av1.png'});
await p.click('#avsave');await p.waitForTimeout(400);
console.log('side2:',(await p.locator('#avside').innerText()).replace(/\n+/g,' | ').slice(0,420));
await p.goto('file://'+out+'/p.html#obra/andamento');await p.waitForTimeout(500);
console.log('andamento:',(await p.locator('#tabp').innerText()).replace(/\n+/g,' | ').slice(0,160));
await p.goto('file://'+out+'/p.html#obra/avanco');await p.waitForTimeout(400);await p.click('#avundo');await p.waitForTimeout(300);
console.log('undo:',(await p.locator('#avside .k-v').innerText()));
console.log('errors',errs);await b.close();})();
