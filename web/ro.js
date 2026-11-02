/* Armant 360 · Menu do R.O. e Compras (extensão do painel)
   Carregar depois de controle.js:  <script src="ro.js" defer></script>
   #ro       Menu do R.O.: recebe os pedidos de material dos operários da obra (app de campo), faz a triagem
             (ajusta quantidades, tira itens, define a prioridade) e encaminha cada material para o almoxarifado
             (tem em estoque) ou para o setor de compras (precisa comprar). Também pode recusar, com motivo.
   #compras  Setor de compras: recebe o que o R.O. encaminhou, registra a compra (fornecedor, nº da OC, previsão)
             e avisa quando chegou no almoxarifado, que entrega na obra.
   Situações do pedido: triagem → aberto (almoxarifado) | compras → comprado → aberto → atendido; ou recusado. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{},NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null,MT=()=>window.ArmantMateriais||null;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const qf=v=>nf(v,Math.abs(v-Math.round(v))<1e-6?0:2);
const num=v=>{const s=String(v==null?'':v).replace(/\s/g,'');if(!s)return NaN;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const br=iso=>iso?iso.split('-').reverse().join('/'):'—';
const demandas=()=>typeof CAD.demandas==='function'?CAD.demandas():[];
const demByCC=cc=>demandas().find(d=>d.cc===cc);
const me=()=>AC()?AC().user():null;
const users=()=>AC()&&AC().users?AC().users():[];
const roDe=cc=>typeof CAD.roDe==='function'?CAD.roDe(cc):'';
const gestor=()=>{const A=AC();return !A||A.can('operations')||A.can('projects');};
const souRO=cc=>!!(me()&&cc&&roDe(cc)===me().id);
const podeTriar=cc=>gestor()||souRO(cc);
const podeComprar=()=>{const A=AC();return !A||A.can('compras');};

if(!NAV.some(x=>x[0]==='ro')){const at=NAV.findIndex(x=>x[0]==='campo');NAV.splice(at<0?NAV.length:at,0,['ro','Menu do R.O.','check']);}
if(!NAV.some(x=>x[0]==='compras')){const at=NAV.findIndex(x=>x[0]==='campo');NAV.splice(at<0?NAV.length:at,0,['compras','Compras','receipt']);}

const ST={triagem:['Com o R.O.','aguardando triagem'],aberto:['No almoxarifado','separar e entregar'],compras:['Em compras','precisa comprar'],comprado:['Comprado','aguardando chegada'],atendido:['Entregue','na obra'],recusado:['Recusado','não será atendido']};
const ped=()=>MT()?MT().state.ped:[];
const pedById=id=>ped().find(p=>p.id===id);
const mats=()=>MT()?MT().materiais()||[]:[];
const mat=id=>mats().find(m=>m.id===id);
const estoque=()=>{try{return MT()&&MT().ledger?MT().ledger():{};}catch(e){return {};}};
/* o Menu do R.O. não grava o estoque: quem grava é o dono (materiais.js) */
const save=()=>{try{MT().save();return true;}catch(e){say('Não foi possível salvar neste navegador.');return false;}};
const hist=(p,t)=>{(p.hist=p.hist||[]).push({d:hoje(),t:t+(me()?' · '+me().nome:'')});};
const matTxt=it=>{const m=mat(it.m);return qf(it.q)+' '+(m?m.u+' '+esc(m.d):esc(it.m));};
const visRO=()=>ped().filter(p=>podeTriar(p.cc));
const doSetor=(...s)=>users().filter(u=>s.includes(u.setor)&&u.nivel>=2).map(u=>u.id);
const pessoa=nome=>{const u=users().find(x=>x.id===nome||norm(x.nome)===norm(nome));return u?u.id:'';};
function avisar(ids,o){const N=NU();if(N&&ids.length)N.notify([...new Set(ids)],o);}

/* ---------- estado da tela ---------- */
const V={cc:'',aba:'triagem',ed:{}};
const linhas=p=>{if(!V.ed[p.id]){const st=estoque();V.ed[p.id]=p.itens.map(it=>({m:it.m,q:String(it.q).replace('.',','),dest:(st[it.m]&&st[it.m].q>=it.q)?'almox':'compras',on:true}));}return V.ed[p.id];};

const intro=(t,p,i)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">'+(i||'menu do R.O.')+'</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic('truck')+'</div>';
const kpi=(L)=>'<div class="kpi-grid ct-kpis ct-kpi4">'+['triagem','aberto','compras','comprado'].map(k=>'<article class="kpi-card ct-k'+(V.aba===k?' on':'')+'" data-ro-aba="'+k+'" role="button" tabindex="0"><div class="kpi-top"><div class="kpi-label">'+ST[k][0]+'</div></div><div class="kpi-number">'+L.filter(p=>p.st===k).length+'</div><p class="kpi-subtitle">'+ST[k][1]+'</p></article>').join('')+'</div>';

function cardTriagem(p){const ls=linhas(p),st=estoque(),d=demByCC(p.cc),atras=p.para&&p.para<hoje();
 return '<article class="ro-card'+(p.prio==='urgente'?' urg':'')+'" data-ro-card="'+p.id+'"><header><div><strong>'+p.id+'</strong> <a class="cad-cc" href="#controle/'+p.cc+'">'+p.cc+'</a><small>'+esc(p.quem||'—')+' pediu em '+br(p.data)+(p.para?' · precisa até <b'+(atras?' class="ro-late"':'')+'>'+br(p.para)+'</b>':'')+(d?' · '+esc((d.nome||'').slice(0,50)):'')+'</small></div>'+
  '<select data-ro-prio="'+p.id+'" aria-label="Prioridade"><option value="normal">Prioridade normal</option><option value="urgente"'+(p.prio==='urgente'?' selected':'')+'>Urgente</option></select></header>'+
  (p.obs?'<p class="ro-obs">“'+esc(p.obs)+'”</p>':'')+
  '<table class="ob-t ro-t"><thead><tr><th></th><th>Material</th><th>Quantidade</th><th>Em estoque</th><th>Encaminhar para</th></tr></thead><tbody>'+
  ls.map((l,i)=>{const m=mat(l.m),s=st[l.m]?st[l.m].q:0;return '<tr class="'+(l.on?'':'ro-off')+'"><td><input type="checkbox" data-ro-on="'+p.id+'|'+i+'"'+(l.on?' checked':'')+' aria-label="Manter este material"></td><td class="ob-d">'+(m?esc(m.d)+' <small>'+esc(m.id)+'</small>':esc(l.m))+'</td><td class="ob-nw"><input class="ro-q" inputmode="decimal" data-ro-q="'+p.id+'|'+i+'" value="'+esc(l.q)+'"'+(l.on?'':' disabled')+'> '+(m?esc(m.u):'')+'</td><td class="ob-nw'+(s<num(l.q)?' ro-falta':'')+'">'+qf(s)+(m?' '+esc(m.u):'')+'</td><td><select data-ro-dest="'+p.id+'|'+i+'"'+(l.on?'':' disabled')+'><option value="almox">Almoxarifado</option><option value="compras"'+(l.dest==='compras'?' selected':'')+'>Compras</option></select></td></tr>';}).join('')+'</tbody></table>'+
  '<div class="ro-foot"><input class="ro-nota" data-ro-nota="'+p.id+'" placeholder="Nota da triagem (vai junto para o almoxarifado e compras)" value="'+esc(p.nota||'')+'">'+
  '<button class="button primary fn-sm" data-ro-ok="'+p.id+'">Concluir triagem e encaminhar</button><button class="text-button" data-ro-rec="'+p.id+'">Recusar</button></div>'+
  '<div class="ro-recf" data-ro-recf="'+p.id+'" hidden><input data-ro-mot="'+p.id+'" placeholder="Motivo da recusa (o operário recebe)"><button class="button outline fn-sm" data-ro-recok="'+p.id+'">Confirmar recusa</button></div></article>';}

function tabela(L,acoes){if(!L.length)return '<p class="area-note">Nenhum pedido aqui.</p>';
 return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Pedido</th><th>Obra</th><th>Quem pediu</th><th>Materiais</th><th>Situação</th>'+(acoes?'<th></th>':'')+'</tr></thead><tbody>'+L.map(p=>'<tr><td class="ob-nw">'+p.id+(p.prio==='urgente'?' <span class="ro-urg">urgente</span>':'')+'<small>'+br(p.data)+(p.para?' · até '+br(p.para):'')+'</small></td><td class="ob-nw"><a class="cad-cc" href="#controle/'+p.cc+'">'+p.cc+'</a></td><td>'+esc(p.quem||'—')+'</td><td class="ob-d">'+p.itens.map(matTxt).join('<br>')+(p.nota?'<small>R.O.: '+esc(p.nota)+'</small>':'')+(p.motivo?'<small>Motivo: '+esc(p.motivo)+'</small>':'')+(p.compra?'<small>OC '+esc(p.compra.oc||'—')+' · '+esc(p.compra.forn||'')+(p.compra.prev?' · chega '+br(p.compra.prev):'')+'</small>':'')+'</td><td class="ob-nw"><span class="ro-st '+p.st+'">'+(ST[p.st]||[p.st])[0]+'</span>'+(p.hist&&p.hist.length?'<small>'+esc(p.hist[p.hist.length-1].t)+'</small>':'')+'</td>'+(acoes?'<td class="ob-nw">'+acoes(p)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';}

function pagRO(){const todos=visRO(),ds=demandas().filter(d=>podeTriar(d.cc)),L=todos.filter(p=>!V.cc||p.cc===V.cc);
 const tri=L.filter(p=>p.st==='triagem').sort((a,b)=>(b.prio==='urgente')-(a.prio==='urgente')||String(a.para||'9').localeCompare(String(b.para||'9')));
 return intro('Pedidos de material das obras.','Os operários pedem material pelo App de campo. O R.O. da obra confere, ajusta e encaminha: o que tem em estoque vai para o almoxarifado, o que falta vai para compras.'+(gestor()?' Você vê todas as obras (gestão).':' Você vê as obras em que é R.O.'))+
  '<div class="toolbar cad-tools"><select id="ro-cc" aria-label="Obra"><option value="">Todas as minhas obras ('+ds.length+')</option>'+ds.map(d=>'<option value="'+d.cc+'"'+(V.cc===d.cc?' selected':'')+'>'+d.cc+' · '+esc((d.nome||'').slice(0,40))+'</option>').join('')+'</select><a class="button outline fn-sm" href="#controle/ro">'+ic('check')+'Painel do R.O. (tarefas)</a></div>'+
  kpi(L)+
  (V.aba==='triagem'?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Para triar</h2><p>'+tri.length+' pedido(s) · urgentes e com data mais próxima primeiro</p></div></div>'+(tri.length?'<div class="ro-cards">'+tri.map(cardTriagem).join('')+'</div>':'<p class="area-note">Nenhum pedido aguardando triagem.</p>')+'</section>'
  :'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+ST[V.aba][0]+'</h2><p>'+ST[V.aba][1]+'</p></div><button class="text-button" data-ro-aba="triagem">← Voltar para a triagem</button></div>'+tabela(L.filter(p=>p.st===V.aba))+'</section>')+
  '<details class="panel ob-panel"><summary class="panel-header"><div><h2>Histórico</h2><p>Pedidos já entregues ou recusados</p></div></summary>'+tabela(L.filter(p=>['atendido','recusado'].includes(p.st)).slice(-40).reverse())+'</details>';}

function pagCompras(){const L=ped(),forn=typeof CAD.fornecedores==='function'?CAD.fornecedores():[];
 const fila=L.filter(p=>p.st==='compras').sort((a,b)=>(b.prio==='urgente')-(a.prio==='urgente')||String(a.para||'9').localeCompare(String(b.para||'9')));
 return intro('Pedidos de compra das obras.','Chegam aqui os materiais que o R.O. encaminhou para compra. Registre a compra (fornecedor, nº da ordem de compra e previsão) e marque quando chegar no almoxarifado: o almoxarifado entrega na obra.','compras')+
  '<div class="kpi-grid ct-kpis ct-kpi4">'+[['A comprar',fila.length,fila.filter(p=>p.prio==='urgente').length+' urgente(s)'],['Comprados',L.filter(p=>p.st==='comprado').length,'aguardando chegada'],['Atrasados',L.filter(p=>p.st==='comprado'&&p.compra&&p.compra.prev&&p.compra.prev<hoje()).length,'passou a previsão'],['Entregues',L.filter(p=>p.st==='atendido'&&p.compra).length,'comprados e já na obra']].map(([a,b,c])=>'<article class="kpi-card"><div class="kpi-top"><div class="kpi-label">'+a+'</div></div><div class="kpi-number">'+b+'</div><p class="kpi-subtitle">'+c+'</p></article>').join('')+'</div>'+
  '<section class="panel ob-panel"><div class="panel-header"><div><h2>A comprar</h2><p>Encaminhados pelo R.O.</p></div></div>'+tabela(fila,p=>'<button class="button primary fn-sm" data-co-comp="'+p.id+'">Registrar compra</button> <button class="text-button" data-co-dev="'+p.id+'">Devolver ao R.O.</button>')+'</section>'+
  '<section class="panel ob-panel"><div class="panel-header"><div><h2>Comprados</h2><p>Aguardando chegada no almoxarifado</p></div></div>'+tabela(L.filter(p=>p.st==='comprado'),p=>'<button class="button outline fn-sm" data-co-chegou="'+p.id+'">Chegou no almoxarifado</button>')+'</section>'+
  '<datalist id="co-forn">'+forn.map(f=>'<option value="'+esc(f.fant||f.razao)+'">').join('')+'</datalist>';}

function modalCompra(p){document.querySelectorAll('.ct-modal').forEach(x=>x.remove());
 document.body.insertAdjacentHTML('beforeend','<div class="fn-drawer ct-modal" role="dialog" aria-modal="true" aria-label="Registrar compra"><div class="fn-dback" data-co-x></div><aside class="fn-dpanel"><header><h2>Registrar compra · '+p.id+'</h2><button class="icon-button" type="button" data-co-x aria-label="Fechar">×</button></header><form class="fr-form" id="co-form" data-id="'+p.id+'"><p class="area-note">'+p.cc+' · '+p.itens.map(matTxt).join(', ')+'</p><div class="ob-form">'+
  '<label class="ob-field cad-wide"><span>Fornecedor <b class="cad-req">*</b></span><input name="forn" list="co-forn" required></label><label class="ob-field"><span>Nº da ordem de compra</span><input name="oc"></label><label class="ob-field"><span>Previsão de chegada <b class="cad-req">*</b></span><input type="date" name="prev" required value="'+(p.para||'')+'"></label><label class="ob-field"><span>Valor total (R$)</span><input name="valor" inputmode="decimal"></label><label class="ob-field cad-wide"><span>Observação</span><input name="obs"></label></div>'+
  '<p class="cad-err" id="co-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Salvar compra</button><button class="text-button" type="button" data-co-x>Cancelar</button></div></form></aside></div>');
 const f=document.getElementById('co-form');if(f)f.elements.forn.focus();}

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on,txt){const notice=document.querySelector('.demo-notice p'),act=document.querySelector('.heading-actions');if(on){if(!('n' in chrome))chrome.n=notice?notice.innerHTML:'';if(notice)notice.innerHTML=txt;if(act)act.style.visibility='hidden';}else if('n' in chrome){if(notice)notice.innerHTML=chrome.n;if(act)act.style.visibility='';delete chrome.n;}}
function nav(cur){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id===cur?'active':'')+'"'+(id===cur?' aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+(id==='ro'&&pendRO()?'<span class="nav-count">'+pendRO()+'</span>':'')+'</a>').join('');}
const pendRO=()=>visRO().filter(p=>p.st==='triagem').length;
const prevRender=render;
render=function(){const [v]=location.hash.slice(1).split('/');
 if(v==='ro'||v==='compras'){const c=document.getElementById('view');nav(v);
  if(!MT()){c.innerHTML='<p class="area-note">Módulo de materiais indisponível.</p>';return;}
  const ro=v==='ro';setChrome(true,ro?'<strong>Menu do R.O.</strong> Triagem dos pedidos de material das obras.':'<strong>Compras.</strong> Pedidos de compra encaminhados pelos R.O.');
  document.getElementById('breadcrumb').textContent=ro?'Obras · Menu do R.O.':'Suprimentos · Compras';
  document.getElementById('page-title').innerHTML=(ro?'Menu do R.O.':'Compras')+'<span>.</span>';
  document.getElementById('page-subtitle').textContent=ro?'Recebe os pedidos de material, faz a triagem e encaminha.':'Materiais a comprar para as obras.';
  c.innerHTML=ro?pagRO():pagCompras();c.className='fade-in';return;}
 setChrome(false);prevRender();
 if(v==='materiais'){const c=document.getElementById('view'),n=ped().filter(p=>p.st==='triagem').length;if(n&&c&&!c.querySelector('.ro-aviso'))c.insertAdjacentHTML('afterbegin','<p class="area-note ro-aviso">'+n+' pedido(s) das obras ainda com o R.O. para triagem. Chegam aqui depois de triados.</p>');}};

/* ---------- ações ---------- */
const on=()=>/^#(ro|compras)/.test(location.hash);
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
function concluir(p){const ls=linhas(p),nota=(document.querySelector('[data-ro-nota="'+p.id+'"]')||{}).value||'';
 const ok=ls.filter(l=>l.on).map(l=>({m:l.m,q:num(l.q),dest:l.dest}));
 if(!ok.length)return say('Nenhum material marcado. Para não atender, use Recusar.');
 if(ok.some(l=>!(l.q>0)))return say('Confira as quantidades.');
 const alm=ok.filter(l=>l.dest==='almox').map(({m,q})=>({m,q})),com=ok.filter(l=>l.dest==='compras').map(({m,q})=>({m,q}));
 const tirados=ls.filter(l=>!l.on).length,mud=ok.filter(l=>{const o=p.itens.find(i=>i.m===l.m);return o&&o.q!==l.q;}).length;
 p.nota=nota.trim();p.triado={d:hoje(),por:me()?me().nome:''};p.itensPedidos=p.itensPedidos||p.itens.slice();
 let novo=null;
 if(alm.length&&com.length){const M=MT();novo=M.addPedido({cc:p.cc,quem:p.quem,para:p.para,obs:p.obs,prio:p.prio,nota:p.nota,itens:com,st:'compras',origem:p.id,triado:p.triado});hist(novo,'separado do '+p.id+' na triagem: vai para compras');p.itens=alm;p.st='aberto';}
 else if(alm.length){p.itens=alm;p.st='aberto';}else{p.itens=com;p.st='compras';}
 hist(p,'triagem: '+(p.st==='aberto'?'almoxarifado':'compras')+(novo?' (parte em compras: '+novo.id+')':'')+(tirados?' · '+tirados+' item(ns) retirado(s)':'')+(mud?' · '+mud+' quantidade(s) ajustada(s)':''));
 delete V.ed[p.id];save();
 const temAlm=p.st==='aberto',temCom=p.st==='compras'||!!novo,ids=[];
 if(temAlm)avisar(doSetor('Almoxarifado'),{tipo:'tarefa',titulo:'Separar material · '+p.id+' · '+p.cc,texto:alm.map(matTxt).join(', ').replace(/<[^>]+>/g,'')+(p.nota?' · R.O.: '+p.nota:''),link:'#materiais/entrega',email:p.prio==='urgente'});
 if(temCom){const c=novo||p;avisar(doSetor('Suprimentos'),{tipo:'tarefa',email:true,titulo:(c.prio==='urgente'?'URGENTE · ':'')+'Comprar material · '+c.id+' · '+c.cc,texto:c.itens.map(matTxt).join(', ').replace(/<[^>]+>/g,'')+(c.para?' · precisa até '+br(c.para):'')+(c.nota?' · R.O.: '+c.nota:''),link:'#compras'});}
 const op=pessoa(p.quem);if(op)ids.push(op);avisar(ids,{tipo:'campo',titulo:'Seu pedido '+p.id+' foi triado pelo R.O.',texto:(temAlm?'O almoxarifado vai separar. ':'')+(temCom?'Parte vai ser comprada. ':'')+(p.nota||''),link:'#campo/pedido',pop:false});
 refresh();say('Pedido '+p.id+' encaminhado'+(temAlm&&temCom?' ao almoxarifado e a compras ('+novo.id+')':temAlm?' ao almoxarifado':' a compras')+'.');}
document.addEventListener('click',e=>{if(!on())return;const t=e.target.closest('[data-ro-aba],[data-ro-ok],[data-ro-rec],[data-ro-recok],[data-co-comp],[data-co-dev],[data-co-chegou],[data-co-x]');if(!t)return;const d=t.dataset;
 if(d.roAba){V.aba=d.roAba;refresh();return;}
 if(d.roOk){const p=pedById(d.roOk);if(p&&p.st==='triagem'&&podeTriar(p.cc))concluir(p);return;}
 if(d.roRec){const f=document.querySelector('[data-ro-recf="'+d.roRec+'"]');if(f){f.hidden=false;f.querySelector('input').focus();}return;}
 if(d.roRecok){const p=pedById(d.roRecok);if(!p||!podeTriar(p.cc))return;const mot=(document.querySelector('[data-ro-mot="'+p.id+'"]')||{}).value||'';if(!mot.trim())return say('Escreva o motivo da recusa.');
  p.st='recusado';p.motivo=mot.trim();hist(p,'recusado: '+p.motivo);delete V.ed[p.id];save();const op=pessoa(p.quem);if(op)avisar([op],{tipo:'campo',titulo:'Pedido '+p.id+' recusado pelo R.O.',texto:p.motivo,link:'#campo/pedido'});refresh();say('Pedido '+p.id+' recusado.');return;}
 if(d.coX!==undefined){document.querySelectorAll('.ct-modal').forEach(x=>x.remove());return;}
 if(!podeComprar())return say('Só o setor de compras registra as compras.');
 if(d.coComp){const p=pedById(d.coComp);if(p)modalCompra(p);return;}
 if(d.coDev){const p=pedById(d.coDev);if(!p)return;if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar: devolver ao R.O.';return;}p.st='triagem';hist(p,'devolvido ao R.O. por compras');save();const ro=roDe(p.cc);if(ro)avisar([ro],{tipo:'tarefa',titulo:'Compras devolveu o pedido '+p.id,texto:'Revise a triagem.',link:'#ro'});refresh();say('Pedido '+p.id+' voltou para o R.O.');return;}
 if(d.coChegou){const p=pedById(d.coChegou);if(!p)return;p.st='aberto';hist(p,'chegou no almoxarifado');save();avisar(doSetor('Almoxarifado'),{tipo:'tarefa',titulo:'Material comprado chegou · '+p.id+' · '+p.cc,texto:'Lançar a entrada da nota e entregar na obra.',link:'#materiais/entrega'});const ro=roDe(p.cc);if(ro)avisar([ro],{tipo:'aviso',titulo:'Material do pedido '+p.id+' chegou no almoxarifado',texto:p.itens.map(matTxt).join(', ').replace(/<[^>]+>/g,''),link:'#ro',pop:false});refresh();say('Pedido '+p.id+' no almoxarifado para entrega.');}});
document.addEventListener('change',e=>{if(!on())return;const t=e.target,d=t.dataset;
 if(t.id==='ro-cc'){V.cc=t.value;refresh();return;}
 const k=d.roOn||d.roQ||d.roDest;if(k){const [id,i]=k.split('|'),p=pedById(id);if(!p)return;const l=linhas(p)[+i];if(d.roOn){l.on=t.checked;refresh();}else if(d.roQ)l.q=t.value;else l.dest=t.value;return;}
 if(d.roPrio){const p=pedById(d.roPrio);if(p&&podeTriar(p.cc)){p.prio=t.value;save();refresh();}return;}});
document.addEventListener('input',e=>{if(!on())return;const d=e.target.dataset;if(d&&d.roQ){const [id,i]=d.roQ.split('|'),p=pedById(id);if(p)linhas(p)[+i].q=e.target.value;}});
document.addEventListener('keydown',e=>{if(!on()||(e.key!=='Enter'&&e.key!==' '))return;const k=e.target.closest&&e.target.closest('[data-ro-aba]');if(k){e.preventDefault();k.click();}});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='co-form')return;e.preventDefault();const g=n=>String(f.elements[n].value||'').trim(),er=m=>{document.getElementById('co-err').textContent=m;};
 const p=pedById(f.dataset.id);if(!p||!podeComprar())return er('Sem permissão.');if(!g('forn'))return er('Informe o fornecedor.');if(!g('prev'))return er('Informe a previsão de chegada.');
 const v=num(g('valor'));if(g('valor')&&!(v>=0))return er('Valor inválido.');
 p.compra={forn:g('forn'),oc:g('oc'),prev:g('prev'),valor:v>=0?v:null,obs:g('obs'),d:hoje(),por:me()?me().nome:''};p.st='comprado';hist(p,'comprado de '+p.compra.forn+(p.compra.oc?' (OC '+p.compra.oc+')':'')+', chega '+br(p.compra.prev));save();
 const ro=roDe(p.cc);if(ro)avisar([ro],{tipo:'aviso',titulo:'Compra feita · pedido '+p.id,texto:p.compra.forn+(p.compra.oc?' · OC '+p.compra.oc:'')+' · previsão '+br(p.compra.prev),link:'#ro',pop:false});
 document.querySelectorAll('.ct-modal').forEach(x=>x.remove());refresh();say('Compra registrada. O R.O. foi avisado.');});

window.ArmantRO={version:'1.0',ST,pendentes:pendRO};
})();
