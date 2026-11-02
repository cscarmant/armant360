/* Armant 360 · Consumo e custos (Painel do superadmin → aba "Consumo e custos")
   Carregar depois de nucleo.js e antes de acesso.js:  <script src="consumo.js" defer></script>
   Com servidor: lê painel_consumo() (migração 013): tamanho do banco e dos arquivos, usuários ativos, e-mails e o
   tráfego medido pela ponte (o que cada aparelho baixou e enviou), por dia e por pessoa.
   Sem servidor (protótipo): estima pelo tamanho dos dados neste navegador.
   Com isso, projeta a conta mensal no Supabase Free e Pro (e no envio de e-mails) para o número de usuários previsto.
   Preços e limites são de referência (pesquisados em out/2026) e editáveis: confira nas páginas oficiais. */
(function(){
'use strict';
if(typeof render!=='function') return;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const num=v=>{const s=String(v==null?'':v).replace(/\s/g,'');if(!s)return NaN;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);};
const GB=1024**3,MB=1024**2;
const tam=b=>{b=+b||0;if(b>=GB)return nf(b/GB,2)+' GB';if(b>=MB)return nf(b/MB,1)+' MB';if(b>=1024)return nf(b/1024,0)+' KB';return nf(b,0)+' B';};
const usd=v=>'US$ '+nf(v,2);
const AC=()=>window.ArmantAcesso||null,NU=()=>window.ArmantNucleo||null,PT=()=>window.ArmantPonte||null;

/* ---------- planos (referência; editáveis na tela) ---------- */
const PADRAO={usuarios:0,acessos:4,dias:22,fotosDia:10,fotoKB:400,emailsDia:2,cresc:8,cambio:5.5,
 free:{banco:0.5,arquivos:1,trafego:5,mau:50000},
 pro:{base:25,banco:8,arquivos:100,trafego:250,mau:100000,xBanco:0.125,xArquivos:0.021,xTrafego:0.09,xMau:0.00325},
 email:{gratisMes:3000,gratisDia:100,pro:20,proQtd:50000,x1000:0.9}};
let CFG=JSON.parse(JSON.stringify(PADRAO));
try{const s=JSON.parse(localStorage.getItem('a360consumo')||'null');if(s)CFG={...CFG,...s,free:{...CFG.free,...(s.free||{})},pro:{...CFG.pro,...(s.pro||{})},email:{...CFG.email,...(s.email||{})}};}catch(e){}
const salvarCfg=()=>{try{localStorage.setItem('a360consumo',JSON.stringify(CFG));}catch(e){}};

/* ---------- leitura dos dados ---------- */
let D=null,carregando=false,erro='';
async function medirLocal(){
 let banco=0;const mods=[];
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!/^a360/.test(k)||/^a360(sess|tour|consumo|ultimo|demo|ponte|recarga)$/.test(k))continue;const v=localStorage.getItem(k)||'';banco+=v.length;mods.push({nome:k,bytes:v.length});}
 let arq=0,qtd=0;try{const N=NU();const all=N&&N.files?await N.files.all():[];(all||[]).forEach(f=>{const b=f&&f.blob;if(b&&b.size){arq+=b.size;qtd++;}});}catch(e){}
 const us=AC()&&AC().users?AC().users():[];
 return {fonte:'estimativa',banco:banco*2,estado:banco,arquivos:arq,arquivosQtd:qtd,ativos:us.length,perfis:us.length,emails30:null,trafego30:null,dias:0,porDia:[],porPessoa:[],partes:mods.sort((a,b)=>b.bytes-a.bytes).map(m=>({nome:nomeMod(m.nome),bytes:m.bytes})),cofres:[],historico:[]};}
const nomeMod=k=>({a360:'Obras',a360cad:'Cadastros e comercial',a360mat:'Almoxarifado e pedidos',a360fin:'Financeiro',a360frota:'Frota',a360campo:'App de campo',a360acesso:'Usuários e acessos',a360rh:'RH',a360listas:'Listas de materiais',a360ctrl:'Controle de obras',a360cert:'Certificado A1',a360extrato:'Extrato bancário',a360com:'Comunicados',a360docs:'Laudos e solicitações',a360nucleo:'Comunicação e registro',a360eap:'EAP da obra'}[k]||k);
async function medirServidor(){
 const P=PT();const {data,error}=await P.sb.rpc('painel_consumo');if(error)throw new Error(error.message);
 const u=data.uso_30d||{},soma=k=>Object.values(u).reduce((a,x)=>a+(+x[k]||0),0),pend=P.uso?P.uso():{};
 const pendDown=Object.values(pend).reduce((a,x)=>a+(+x.down||0),0);
 const est=(data.tabelas||[]).find(t=>t.nome==='estado_modulo');
 return {fonte:'servidor',banco:+data.banco_bytes||0,estado:est?+est.bytes:0,arquivos:(data.arquivos||[]).reduce((a,x)=>a+(+x.bytes||0),0),arquivosQtd:(data.arquivos||[]).reduce((a,x)=>a+(+x.qtd||0),0),
  ativos:+data.usuarios_ativos_30d||0,perfis:+data.perfis_ativos||0,emails30:+data.emails_30d||0,trafego30:soma('down')+pendDown,enviado30:soma('up'),req30:soma('req'),dias:+data.dias_medidos||0,porArea:u,
  porDia:(data.por_dia||[]).map(x=>({dia:x.dia,down:+x.down||0,pessoas:+x.pessoas||0})),porPessoa:data.por_pessoa||[],
  partes:(data.tabelas||[]).map(t=>({nome:t.nome,bytes:+t.bytes||0,linhas:+t.linhas||0})),cofres:data.arquivos||[],historico:data.historico||[]};}
async function carregar(){if(carregando)return;carregando=true;erro='';
 try{D=PT()&&PT().sb?await medirServidor():await medirLocal();}catch(e){erro=e.message||String(e);try{D=await medirLocal();}catch(x){}}
 carregando=false;pintar();}

/* ---------- projeção ---------- */
function projetar(){const c=CFG,u=+c.usuarios||Math.max(D.ativos,D.perfis,1);
 // tráfego por mês: medido (escala pelo nº de pessoas) ou estimado (fase 1: cada acesso baixa os módulos inteiros)
 let traf,base;
 if(D.fonte==='servidor'&&D.dias>=3&&D.trafego30>0){const pessoas=Math.max(1,D.ativos||D.porPessoa.length);traf=D.trafego30/D.dias*c.dias*(u/pessoas);base='medido em '+D.dias+' dia(s), proporcional a '+u+' usuário(s)';}
 else{const porAcesso=Math.max(D.estado||D.banco/2,200*1024);traf=u*c.acessos*c.dias*porAcesso+c.fotosDia*c.fotoKB*1024*c.dias*3;base='estimado: '+u+' usuário(s) × '+c.acessos+' acesso(s)/dia × '+c.dias+' dias × '+tam(porAcesso)+' por acesso, mais as fotos vistas';}
 const arqMes=c.fotosDia*c.fotoKB*1024*c.dias;
 const cresc=Math.max(0,+c.cresc||0)/100;
 const em=(m)=>({banco:D.banco*Math.pow(1+cresc,m),arquivos:D.arquivos+arqMes*m,trafego:traf,mau:u});
 const custoPro=x=>{const p=c.pro,ex={banco:Math.max(0,x.banco/GB-p.banco)*p.xBanco,arquivos:Math.max(0,x.arquivos/GB-p.arquivos)*p.xArquivos,trafego:Math.max(0,x.trafego/GB-p.trafego)*p.xTrafego,mau:Math.max(0,x.mau-p.mau)*p.xMau};return {total:p.base+ex.banco+ex.arquivos+ex.trafego+ex.mau,ex};};
 const cabeFree=x=>{const f=c.free,r=[];if(x.banco/GB>f.banco)r.push('banco');if(x.arquivos/GB>f.arquivos)r.push('arquivos');if(x.trafego/GB>f.trafego)r.push('tráfego');if(x.mau>f.mau)r.push('usuários');return r;};
 const emailsMes=D.fonte==='servidor'&&D.emails30>0&&D.ativos?D.emails30*(u/Math.max(1,D.ativos)):u*c.emailsDia*c.dias,emailsDia=emailsMes/c.dias,e=c.email;
 const custoEmail=emailsMes<=e.gratisMes&&emailsDia<=e.gratisDia?0:e.pro+Math.max(0,emailsMes-e.proQtd)/1000*e.x1000;
 let mesesFree=null;for(let m=0;m<=60;m++){if(cabeFree(em(m)).length){mesesFree=m;break;}}
 return {u,traf,base,arqMes,em,custoPro,cabeFree,emailsMes,emailsDia,custoEmail,mesesFree};}

/* ---------- tela ---------- */
const nivel=p=>p>=100?['crit','acima do limite']:p>=80?['aviso','perto do limite']:['ok','folga'];
function medidor(rot,valor,limFree,limPro,fmt,sub){const pf=limFree?valor/limFree*100:0,pp=limPro?valor/limPro*100:0,[cl,txt]=nivel(pf);
 return '<article class="kpi-card cs-k"><div class="kpi-top"><div class="kpi-label">'+rot+'</div></div><div class="kpi-number">'+fmt(valor)+'</div><p class="kpi-subtitle">'+(sub||'')+'</p>'+
 '<div class="cs-m" role="img" aria-label="'+esc(rot)+': '+nf(pf,0)+'% do limite do plano Free e '+nf(pp,0)+'% do Pro"><div class="cs-mr"><span>Free</span><div class="cs-bar"><i class="'+cl+'" style="width:'+Math.min(100,pf)+'%"></i></div><b>'+nf(pf,pf<10?1:0)+'%</b></div>'+
 '<div class="cs-mr"><span>Pro</span><div class="cs-bar"><i class="'+nivel(pp)[0]+'" style="width:'+Math.min(100,pp)+'%"></i></div><b>'+nf(pp,pp<10?1:0)+'%</b></div></div>'+
 (pf>=80?'<p class="cs-st '+cl+'">'+(cl==='crit'?'⛔ ':'⚠️ ')+'Plano Free: '+txt+'</p>':'')+'</article>';}
function grafico(L){if(!L.length)return '<p class="area-note">Ainda não há tráfego medido. Ele aparece depois que as pessoas usarem o site com servidor por alguns dias.</p>';
 const W=640,H=180,pl=48,pb=24,pt=10,max=Math.max(...L.map(x=>x.down),1),bw=(W-pl-8)/L.length,y=v=>H-pb-(v/max)*(H-pb-pt);
 const tk=[0,max/2,max];
 return '<svg class="cs-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Tráfego baixado do servidor por dia nos últimos 30 dias">'+
  tk.map(v=>'<line x1="'+pl+'" x2="'+(W-8)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="cs-grid"/><text x="'+(pl-6)+'" y="'+(y(v)+3)+'" text-anchor="end" class="cs-ax">'+esc(tam(v))+'</text>').join('')+
  L.map((x,i)=>{const h=Math.max(1,H-pb-y(x.down)),bx=pl+i*bw+1;return '<g class="cs-g"><rect class="cs-hit" x="'+(pl+i*bw)+'" y="'+pt+'" width="'+bw+'" height="'+(H-pb-pt)+'"/><rect class="cs-b" x="'+bx+'" y="'+(H-pb-h)+'" width="'+Math.max(1,bw-2)+'" height="'+h+'" rx="'+Math.min(4,bw/2-1)+'"/><title>'+esc(String(x.dia).split('-').reverse().join('/')+': '+tam(x.down)+' · '+x.pessoas+' pessoa(s)')+'</title></g>';}).join('')+
  [0,Math.floor(L.length/2),L.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>'<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" text-anchor="middle" class="cs-ax">'+esc(String(L[i].dia).slice(8,10)+'/'+String(L[i].dia).slice(5,7))+'</text>').join('')+'</svg>'+
  '<details class="cs-tab"><summary>Ver em tabela</summary><table class="ob-t"><thead><tr><th>Dia</th><th class="ob-n">Baixado</th><th class="ob-n">Pessoas</th></tr></thead><tbody>'+L.map(x=>'<tr><td>'+esc(String(x.dia).split('-').reverse().join('/'))+'</td><td class="ob-n">'+tam(x.down)+'</td><td class="ob-n">'+x.pessoas+'</td></tr>').join('')+'</tbody></table></details>';}
function partes(L,tot){if(!L.length)return '<p class="area-note">Sem dados.</p>';const mx=Math.max(...L.map(x=>x.bytes),1);
 return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>'+(D.fonte==='servidor'?'Tabela':'Módulo')+'</th><th class="ob-n">Tamanho</th><th>Participação</th></tr></thead><tbody>'+L.slice(0,15).map(x=>'<tr><td class="ob-d">'+esc(x.nome)+(x.linhas?'<small>'+nf(x.linhas,0)+' linha(s)</small>':'')+'</td><td class="ob-n">'+tam(x.bytes)+'</td><td><div class="cs-bar cs-share"><i style="width:'+(x.bytes/mx*100)+'%"></i></div><small>'+nf(tot?x.bytes/tot*100:0,1)+'%</small></td></tr>').join('')+'</tbody></table></div>';}
function campo(k,rot,dica,passo){return '<label class="ob-field"><span>'+rot+'</span><input data-cs-cfg="'+k+'" inputmode="decimal" value="'+esc(String(CFG[k]).replace('.',','))+'">'+(dica?'<small class="cad-hint">'+dica+'</small>':'')+'</label>';}
function previsao(){const P=projetar(),c=CFG,linha=(rot,m)=>{const x=P.em(m),pro=P.custoPro(x),fr=P.cabeFree(x),tot=pro.total+P.custoEmail;
  return '<tr><td class="ob-d"><strong>'+rot+'</strong><small>banco '+tam(x.banco)+' · arquivos '+tam(x.arquivos)+' · tráfego '+tam(x.trafego)+'/mês</small></td>'+
  '<td class="ob-d">'+(fr.length?'<span class="cs-st crit">⛔ não cabe: '+fr.join(', ')+'</span>':'<span class="cs-st ok">✓ cabe</span><small>pausa após 7 dias sem uso; sem backup diário</small>')+'</td>'+
  '<td class="ob-n"><strong>'+usd(pro.total)+'</strong>'+(pro.total>c.pro.base+0.005?'<small>base '+usd(c.pro.base)+' + excedente '+usd(pro.total-c.pro.base)+'</small>':'<small>sem excedente</small>')+'</td>'+
  '<td class="ob-n">'+usd(P.custoEmail)+'</td><td class="ob-n"><strong>'+usd(tot)+'</strong><small>R$ '+nf(tot*c.cambio)+'</small></td></tr>';};
 const rec=P.mesesFree===0?'O plano Free já não comporta esse uso. Use o <b>Pro</b>.':P.mesesFree!=null&&P.mesesFree<=12?'O Free comporta por cerca de <b>'+P.mesesFree+' mês(es)</b>. Para dados reais da equipe, o <b>Pro</b> é o indicado (sem pausa e com backup diário).':'O Free comporta o volume previsto, mas pausa após 7 dias sem uso e não tem backup diário. Para dados reais da equipe, use o <b>Pro</b>.';
 return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Previsão de custo da hospedagem</h2><p>Supabase (banco, login, arquivos e funções) + e-mails (Resend). O site no Netlify ou Cloudflare Pages é grátis.</p></div></div>'+
  '<form id="cs-form" class="fr-form" onsubmit="return false"><div class="ob-form cs-form">'+campo('usuarios','Usuários previstos','hoje: '+D.perfis+' cadastrado(s)')+campo('acessos','Acessos por pessoa por dia')+campo('dias','Dias de uso por mês')+campo('fotosDia','Fotos por dia (toda a equipe)')+campo('fotoKB','Tamanho médio da foto (KB)','o app comprime antes de enviar')+campo('emailsDia','E-mails por pessoa por dia')+campo('cresc','Crescimento do banco (% ao mês)')+campo('cambio','Dólar (R$)','confira a cotação do dia')+'</div></form>'+
  '<div class="table-wrap"><table class="ob-t cs-prev"><thead><tr><th>Quando</th><th>Plano Free (US$ 0)</th><th class="ob-n">Plano Pro</th><th class="ob-n">E-mails</th><th class="ob-n">Total com Pro</th></tr></thead><tbody>'+linha('Hoje (este mês)',0)+linha('Em 6 meses',6)+linha('Em 12 meses',12)+'</tbody></table></div>'+
  '<p class="cs-rec">'+rec+'</p><p class="cad-hint">Tráfego '+esc(P.base)+'. E-mails: cerca de '+nf(P.emailsMes,0)+' por mês ('+nf(P.emailsDia,0)+' por dia); o Resend grátis vai até '+nf(c.email.gratisMes,0)+'/mês e '+c.email.gratisDia+'/dia.</p>'+
  '<details class="cs-tab"><summary>Preços e limites usados (editáveis)</summary><div class="ob-form cs-form">'+
   [['free.banco','Free · banco (GB)'],['free.arquivos','Free · arquivos (GB)'],['free.trafego','Free · tráfego/mês (GB)'],['pro.base','Pro · mensalidade (US$)'],['pro.banco','Pro · banco incluso (GB)'],['pro.arquivos','Pro · arquivos inclusos (GB)'],['pro.trafego','Pro · tráfego incluso (GB)'],['pro.xBanco','Pro · GB extra de banco (US$)'],['pro.xArquivos','Pro · GB extra de arquivos (US$)'],['pro.xTrafego','Pro · GB extra de tráfego (US$)'],['email.pro','Resend Pro (US$/mês)']].map(([k,l])=>{const [a,b]=k.split('.');return '<label class="ob-field"><span>'+l+'</span><input data-cs-cfg="'+k+'" inputmode="decimal" value="'+esc(String(CFG[a][b]).replace('.',','))+'"></label>';}).join('')+
  '</div><p class="cad-hint">Valores de referência pesquisados em outubro de 2026 em sites de comparação. Confira em supabase.com/pricing e resend.com/pricing.</p><button class="text-button" data-cs-reset>Voltar aos valores de referência</button></details></section>';}
function corpo(){if(!D)return '<p class="area-note">'+(carregando?'Medindo o consumo…':'Carregando…')+'</p>';const c=CFG,f=c.free,p=c.pro;
 const srv=D.fonte==='servidor',traf=srv&&D.dias?D.trafego30/D.dias*c.dias:null;
 return (erro?'<p class="area-note cs-err">Não consegui ler o consumo do servidor ('+esc(erro)+'). Mostrando a estimativa deste navegador.</p>':'')+
  '<p class="area-note">'+(srv?'<b>Medido no servidor.</b> Banco, arquivos e usuários são os números reais. O tráfego é o que os aparelhos baixaram do servidor ('+D.dias+' dia(s) medido(s) nos últimos 30).':'<b>Estimativa do protótipo.</b> Sem servidor, o tamanho vem dos dados deste navegador e o tráfego é calculado pelos parâmetros abaixo. Com o site no servidor, esta aba passa a mostrar o consumo real.')+'</p>'+
  '<div class="kpi-grid ct-kpis ct-kpi4">'+
   medidor('Banco de dados',D.banco,f.banco*GB,p.banco*GB,tam,srv?'tamanho atual':'estimado (dados × 2)')+
   medidor('Arquivos (fotos e documentos)',D.arquivos,f.arquivos*GB,p.arquivos*GB,tam,nf(D.arquivosQtd,0)+' arquivo(s)')+
   medidor('Tráfego por mês',traf!=null?traf:projetar().traf,f.trafego*GB,p.trafego*GB,tam,traf!=null?'medido, com os usuários de hoje':'estimado')+
   medidor('Usuários ativos (30 dias)',D.ativos,f.mau,p.mau,v=>nf(v,0),D.perfis+' cadastrado(s)')+'</div>'+
  previsao()+
  '<div class="ob-split"><div class="ob-main">'+
   '<section class="panel ob-panel"><div class="panel-header"><div><h2>Tráfego por dia</h2><p>O que os aparelhos baixaram do servidor (últimos 30 dias)</p></div></div>'+grafico(D.porDia)+'</section>'+
   '<section class="panel ob-panel"><div class="panel-header"><div><h2>Onde está o espaço</h2><p>'+(srv?'Maiores tabelas do banco':'Módulos guardados neste navegador')+'</p></div></div>'+partes(D.partes,D.partes.reduce((a,x)=>a+x.bytes,0))+
   (D.cofres.length?'<h3 class="cs-h3">Arquivos por cofre</h3><div class="table-wrap"><table class="ob-t"><thead><tr><th>Cofre</th><th class="ob-n">Arquivos</th><th class="ob-n">Tamanho</th></tr></thead><tbody>'+D.cofres.map(x=>'<tr><td>'+esc(x.cofre)+'</td><td class="ob-n">'+nf(x.qtd,0)+'</td><td class="ob-n">'+tam(x.bytes)+'</td></tr>').join('')+'</tbody></table></div>':'')+'</section></div>'+
  '<aside class="ob-side">'+(srv?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Quem mais consome</h2><p>Tráfego baixado em 30 dias</p></div></div>'+(D.porPessoa.length?'<ol class="cs-rank">'+D.porPessoa.map(x=>'<li><span>'+esc(x.nome)+'<small>'+esc(x.setor||'')+'</small></span><b>'+tam(x.down)+'</b></li>').join('')+'</ol>':'<p class="area-note">Sem medição ainda.</p>')+'</section>':'')+
  '<section class="panel ob-panel"><div class="panel-header"><div><h2>Como gastar menos</h2></div></div><ul class="cs-dicas"><li>O App de campo já comprime as fotos; evite anexar fotos pelo celular sem passar pelo app.</li><li>Hoje (fase 1) cada acesso baixa os módulos inteiros. Na fase 2, cada pessoa baixa só o que é dela, e o tráfego cai bastante.</li><li>Fotos e anexos de obra antigos podem ir para o Google Drive da empresa.</li><li>Acompanhe esta aba no começo de cada mês.</li></ul></section></aside></div>';}
function pintar(){const box=document.getElementById('cs-consumo');if(box)box.innerHTML=corpo();}

/* ---------- integração com o Painel do superadmin (nucleo.js chama pagina()) ---------- */
function pagina(){setTimeout(carregar,0);return '<div id="cs-consumo">'+corpo()+'</div>';}
let tmr=null;
document.addEventListener('input',e=>{const t=e.target.closest&&e.target.closest('[data-cs-cfg]');if(!t)return;const v=num(t.value);if(!(v>=0))return;const [a,b]=t.dataset.csCfg.split('.');if(b)CFG[a][b]=v;else CFG[a]=v;salvarCfg();
 clearTimeout(tmr);tmr=setTimeout(()=>{const id=t.dataset.csCfg,pos=t.selectionStart;pintar();const n=document.querySelector('[data-cs-cfg="'+id+'"]');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}},350);});
document.addEventListener('click',e=>{if(e.target.closest('[data-cs-reset]')){const u=CFG.usuarios,cb=CFG.cambio;CFG=JSON.parse(JSON.stringify(PADRAO));CFG.usuarios=u;CFG.cambio=cb;salvarCfg();pintar();say('Preços e limites de referência restaurados.');}});
window.ArmantConsumo={version:'1.0',pagina,recarregar:carregar,projetar:()=>D?projetar():null,dados:()=>D,cfg:()=>CFG};
})();
