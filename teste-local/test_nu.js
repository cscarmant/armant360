const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const base='file://'+process.argv[2]+'/index.html';const out=process.argv[3];
const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const login=async(pg,email,pw)=>{await pg.goto(base+'#overview');await pg.waitForTimeout(500);await pg.click('#ac-entrar-demo'); await pg.waitForTimeout(400); await pg.evaluate(e => { const u = ArmantAcesso.users().find(x => x.email === e); if (u && u.nivel < 6) ArmantAcesso.verComo(u.id); }, email);await pg.waitForTimeout(600);};
await p.goto(base);await p.waitForTimeout(500);await p.fill('#ac-first [name=nome]','Valentim');await p.fill('#ac-first [name=email]','valentim.teste@gmail.com');await p.fill('#ac-first [name=pw]','segredo1');await p.fill('#ac-first [name=pw2]','segredo1');await p.click('#ac-first button');await p.waitForTimeout(500);
await p.click('#ac-demo');await p.waitForTimeout(800);
console.log('nav:',(await p.locator('#navigation').innerText()).replace(/\n+/g,' | '));
// atribuir tarefa ao campo
await p.goto(base+'#atribuidas');await p.waitForTimeout(400);const opts=await p.locator('#at-form [name=para] option').allInnerTexts();console.log('pode atribuir a',opts.length-1);
await p.selectOption('#at-form [name=para]',{label:'Carlos Souza · Campo'});await p.fill('#at-form [name=titulo]','Levar o gás R-410A para a obra');await p.fill('#at-form [name=prazo]','2026-10-29');await p.click('#at-form button[type=submit]');await p.waitForTimeout(300);console.log('toast',await p.locator('#toast').innerText());
// chat
await p.goto(base+'#chat');await p.waitForTimeout(400);console.log('convs',await p.locator('.ch-it').count());await p.click('[data-ch-open="obra:CC-2026-001"]');await p.waitForTimeout(300);await p.fill('#ch-in','Bom dia equipe! Hoje chega o guindauto às 8h.');await p.press('#ch-in','Enter');await p.waitForTimeout(300);
await p.hover('.ch-m');await p.click('.ch-m [data-ch-dest]');await p.waitForTimeout(200);await p.selectOption('#ch-dp',{label:'Carlos Souza'});await p.fill('#ch-dn','confirmar recebimento');await p.click('[data-ch-dok]');await p.waitForTimeout(300);console.log('dest toast',await p.locator('#toast').innerText());
await p.screenshot({path:out+'/n-chat.png'});
// reunião
await p.goto(base+'#reunioes');await p.waitForTimeout(300);await p.fill('#rn-form [name=titulo]','Alinhamento semanal TJ-RS');await p.check('#rn-form input[name=part] >> nth=0');await p.check('#rn-form input[name=part] >> nth=4');await p.fill('#rn-form [name=link]','https://meet.google.com/abc-defg-hij');await p.click('#rn-form button[type=submit]');await p.waitForTimeout(300);console.log('reu toast',await p.locator('#toast').innerText(),'cards',await p.locator('.rn-card').count());
// superadmin
await p.goto(base+'#auditoria');await p.waitForTimeout(600);console.log('aud kpis',(await p.locator('.kpi-grid').innerText()).replace(/\n+/g,' | '));console.log('log rows',await p.locator('.au-tw tbody tr').count());console.log('first rows:',(await p.locator('.au-tw tbody tr').first().innerText()).replace(/\s+/g,' '));
await p.screenshot({path:out+'/n-aud.png',fullPage:true});
const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('#au-bk')]);console.log('backup',dl?dl.suggestedFilename():'none');const bkpath=dl?await dl.path():null;
// login como campo, ver popup
await p.evaluate(()=>document.getElementById('ac-out').click());await p.waitForTimeout(300);await login(p,'campo.teste@gmail.com','armant123');await p.waitForTimeout(1500);
console.log('campo hash',await p.evaluate(()=>location.hash),'popup',await p.locator('.nt-pop').count(),(await p.locator('.nt-pop').innerText().catch(()=>'')).replace(/\n+/g,' | ').slice(0,160));
await p.screenshot({path:out+'/n-pop.png'});
await p.click('[data-nt-go]');await p.waitForTimeout(500);console.log('after go',await p.evaluate(()=>location.hash),'cards',await p.locator('.at-card').count());
await p.click('[data-at-st=concluida]');await p.waitForTimeout(200);await p.fill('#at-ct','Gás entregue no canteiro.');await p.click('[data-ok="1"]');await p.waitForTimeout(300);console.log('concl toast',await p.locator('#toast').innerText());
await p.goto(base+'#chat/__dest');await p.waitForTimeout(400);console.log('dest cards',await p.locator('.ch-dcard').count());
// restaurar backup
await p.evaluate(()=>document.getElementById('ac-out').click());await p.waitForTimeout(300);await login(p,'valentim.teste@gmail.com','segredo1');await p.goto(base+'#auditoria');await p.waitForTimeout(500);
if(bkpath){await p.setInputFiles('#au-file',bkpath);await p.waitForTimeout(400);console.log('restore confirm',await p.locator('.au-conf').count());}
const m=await ctx.newPage();await m.setViewportSize({width:390,height:844});await m.goto(base+'#chat/obra:CC-2026-001');await m.waitForTimeout(500);console.log('mobile chat overflow',await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth));await m.screenshot({path:out+'/n-chat-m.png'});
console.log('errors',errs);await b.close();})();
