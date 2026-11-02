/* Armant 360 · Confecção de listas de materiais (extensão do painel)
   Carregar depois de materiais.js:  <script src="listas.js" defer></script>
   Operação & CSC → #listas: monta a lista de materiais de cada obra (do catálogo, à mão ou colando do Excel),
   compara com o estoque, envia a separação ao almoxarifado e gera a lista de compra do que falta. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const MT=()=>window.ArmantMateriais||null,CAD=window.ArmantCadastros||{},NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null;
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
const mats=()=>MT()?MT().materiais():[];
const me=()=>AC()?AC().user():null;

const TIPOS=['Separação da obra','Compra','Orçamento'];
const STS=['Rascunho','Enviada ao almoxarifado','Enviada para compras','Concluída'];
const L={listas:[],seq:0};
try{const s=JSON.parse(localStorage.getItem('a360listas')||'null');if(s){L.listas=Array.isArray(s.listas)?s.listas:[];L.seq=s.seq||0;}}catch(e){}
const save=()=>{try{localStorage.setItem('a360listas',JSON.stringify(L));}catch(e){}};
const V={id:null,q:'',cc:'',st:'',busca:''};
const byId=id=>L.listas.find(x=>x.id===id);
/* casa uma descrição livre com o catálogo (palavras em comum) */
const toks=d=>new Set(norm(d).replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w&&!['de','da','do','x','com','para','e'].includes(w)));
function casar(desc){let best=null,bs=0;mats().forEach(m=>{const A=toks(desc),B=toks(m.d);let i=0;A.forEach(w=>{if(B.has(w))i++;});const v=i/Math.max(1,A.size+B.size-i);if(v>bs){bs=v;best=m;}});return bs>=0.5?best:null;}
function saldo(){const M=MT();return M?M.ledger():{};}
function resumo(l){const st=saldo();let tem=0,falta=0,val=0;l.itens.forEach(it=>{const s=it.m&&st[it.m]?st[it.m]:null,disp=s?Math.max(0,s.q):0,q=+it.q||0;if(it.m&&disp>=q)tem++;else falta++;if(s&&s.cm)val+=q*s.cm;});return {tem,falta,val};}

/* ---------- telas ---------- */
const intro=(t,p)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">listas · salvo neste navegador</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic('clipboard')+'</div>';
function lista(){const q=norm(V.q),F=L.listas.filter(l=>(!V.cc||l.cc===V.cc)&&(!V.st||l.st===V.st)&&(!q||norm(l.titulo+' '+l.id+' '+l.cc).includes(q))).slice().reverse();
 return intro('Listas de materiais.','Monte a lista de cada obra: do catálogo, digitando ou colando do Excel. O sistema mostra o que tem no estoque, manda a separação para o almoxarifado e gera a lista de compra do que falta.')+
 '<div class="ob-split"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Listas</h2><p>'+L.listas.length+' no total</p></div></div><div class="toolbar cad-tools"><label class="search-field">'+ic('search')+'<input id="ls-q" type="search" placeholder="Buscar lista" value="'+esc(V.q)+'"></label><label class="period-control ob-ctl"><select id="ls-fcc"><option value="">Todas as obras</option>'+demandas().map(d=>'<option value="'+d.cc+'"'+(V.cc===d.cc?' selected':'')+'>'+d.cc+'</option>').join('')+'</select></label><div class="filter-chips">'+[['','Todas'],...STS.map(s=>[s,s])].map(([k,l])=>'<button class="filter-chip '+(V.st===k?'active':'')+'" data-ls-st="'+esc(k)+'">'+l+'</button>').join('')+'</div></div>'+
 '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Lista</th><th>Obra</th><th>Tipo</th><th class="ob-n">Itens</th><th class="ob-n">No estoque</th><th class="ob-n">Comprar</th><th>Situação</th></tr></thead><tbody>'+
 (F.map(l=>{const r=resumo(l);return '<tr><td class="ob-d"><button class="fn-lnk" data-ls-open="'+l.id+'">'+esc(l.titulo)+'</button><small>'+l.id+' · '+br(l.criado)+' · '+esc(l.por||'')+'</small></td><td class="ob-nw">'+esc(l.cc)+'</td><td class="ob-nw">'+esc(l.tipo)+'</td><td class="ob-n">'+l.itens.length+'</td><td class="ob-n">'+r.tem+'</td><td class="ob-n">'+(r.falta?'<b class="fn-neg">'+r.falta+'</b>':'0')+'</td><td class="ob-nw"><span class="status'+(l.st==='Concluída'?' fn-ok':l.st==='Rascunho'?' ob-mute':'')+'">'+esc(l.st)+'</span></td></tr>';}).join('')||'<tr><td colspan="7">Nenhuma lista. Crie a primeira ao lado.</td></tr>')+'</tbody></table></div></section></div>'+
 '<aside class="ob-side"><section class="panel ob-panel"><div class="panel-header"><div><h2>Nova lista</h2></div></div><form id="ls-new" class="fr-form" novalidate><div class="ob-form"><label class="ob-field cad-wide"><span>Obra <b class="cad-req">*</b></span><select name="cc">'+demandas().map(d=>'<option value="'+d.cc+'">'+d.cc+' · '+esc(d.nome.slice(0,40))+'</option>').join('')+'</select></label><label class="ob-field cad-wide"><span>Título <b class="cad-req">*</b></span><input name="titulo" placeholder="Ex.: Tubulação e isolamento do 2º pavimento"></label><label class="ob-field cad-wide"><span>Tipo</span><select name="tipo">'+TIPOS.map(t=>'<option>'+t+'</option>').join('')+'</select></label><label class="ob-field cad-wide"><span>Necessário até</span><input name="para" type="date"></label></div><p class="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Criar e montar a lista</button></div></form></section></aside></div>';}
function editor(l){const st=saldo(),r=resumo(l),q=norm(V.busca),sug=q.length>=2?mats().filter(m=>norm(m.id+' '+m.d).includes(q)).slice(0,8):[],ed=l.st==='Rascunho';
 return '<a class="text-button ob-back" href="#listas">← Voltar às listas</a>'+intro(esc(l.titulo)+'.',esc(l.id)+' · '+esc(l.cc)+' · '+esc(l.tipo)+(l.para?' · até '+br(l.para):'')+' · '+esc(l.st))+
 '<div class="kpi-grid">'+[['Itens',String(l.itens.length),'na lista'],['No estoque',String(r.tem),'itens com saldo suficiente'],['Comprar',String(r.falta),'itens faltando ou fora do catálogo'],['Valor estimado','R$ '+nf(r.val),'pelo custo médio do estoque']].map(([a,b,c],i)=>'<article class="kpi-card'+(i?'':' featured')+'"><div class="kpi-top"><div class="kpi-label">'+a+'</div></div><div class="kpi-number">'+b+'</div><p class="kpi-subtitle">'+c+'</p></article>').join('')+'</div>'+
 '<div class="ob-split" style="margin-top:16px"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Itens da lista</h2><p>Saldo do almoxarifado ao lado de cada item.</p></div></div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Material</th><th class="ob-n">Quantidade</th><th class="ob-n">Em estoque</th><th class="ob-n">Falta</th><th>Observação</th><th></th></tr></thead><tbody>'+
 (l.itens.map((it,i)=>{const m=it.m?mats().find(x=>x.id===it.m):null,s=m&&st[m.id]?st[m.id]:null,disp=s?Math.max(0,s.q):0,falta=Math.max(0,(+it.q||0)-disp);return '<tr class="'+(falta>0?'fn-late':'ob-has')+'"><td class="ob-d">'+(m?esc(m.d)+'<small>'+m.id+'</small>':esc(it.desc)+'<small class="fn-neg">fora do catálogo</small>')+'</td><td class="ob-nw">'+(ed?'<input class="ob-pct" inputmode="decimal" data-ls-q="'+i+'" value="'+String(it.q).replace('.',',')+'">':qf(it.q))+' <small>'+esc(m?m.u:it.u||'')+'</small></td><td class="ob-n">'+(m?qf(disp):'—')+'</td><td class="ob-n">'+(falta>0?'<b class="fn-neg">'+qf(falta)+'</b>':'0')+'</td><td>'+(ed?'<input class="fn-in-t" data-ls-o="'+i+'" value="'+esc(it.obs||'')+'">':esc(it.obs||''))+'</td><td>'+(ed?'<button class="text-button" data-ls-rm="'+i+'">Remover</button>':'')+'</td></tr>';}).join('')||'<tr><td colspan="6">Lista vazia. Adicione itens ao lado.</td></tr>')+'</tbody></table></div>'+
 '<div class="ob-actions">'+(l.st==='Rascunho'||l.st==='Enviada para compras'?'<button class="button primary" data-ls-alm="'+l.id+'"'+(l.itens.some(it=>it.m)?'':' disabled')+'>'+ic('truck')+'Enviar separação ao almoxarifado</button>':'')+(r.falta?'<button class="button outline" data-ls-comp="'+l.id+'">'+ic('receipt')+'Gerar lista de compra ('+r.falta+')</button>':'')+'<button class="button outline" data-ls-tsv="'+l.id+'">'+ic('download')+'Copiar para Excel</button><button class="button outline" data-ls-print="'+l.id+'">Imprimir</button><button class="button outline" data-ls-dup="'+l.id+'">Duplicar</button>'+(l.st!=='Concluída'?'<button class="text-button" data-ls-done="'+l.id+'">Marcar concluída</button>':'')+'<button class="text-button" data-ls-del="'+l.id+'">Excluir</button></div></section>'+
 (l.hist&&l.hist.length?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Histórico</h2></div></div><ol class="at-hist ls-h">'+l.hist.map(h=>'<li><b>'+br(h.d)+'</b> '+esc(h.t)+'</li>').join('')+'</ol></section>':'')+'</div>'+
 '<aside class="ob-side">'+(ed?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Adicionar do catálogo</h2></div></div><div class="ls-add"><label class="search-field">'+ic('search')+'<input id="ls-busca" type="search" placeholder="Buscar material (ex.: cobre 1/2)" value="'+esc(V.busca)+'"></label><div id="ls-sug">'+sugHtml(sug)+'</div></div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Colar do Excel</h2><p>Uma linha por item: descrição, unidade e quantidade (separados por tabulação, ponto e vírgula ou " | ").</p></div></div><div class="ls-add"><textarea id="ls-paste" rows="6" placeholder="Tubo de cobre 1/2&quot;	RL	6&#10;Isolamento 3/8 x 9mm	M	50"></textarea><button class="button primary" data-ls-paste="'+l.id+'">Adicionar linhas</button></div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Item fora do catálogo</h2></div></div><form id="ls-free" class="fr-form" novalidate><div class="ob-form"><label class="ob-field cad-wide"><span>Descrição</span><input name="desc"></label><label class="ob-field"><span>Unidade</span><input name="u" value="UN"></label><label class="ob-field"><span>Quantidade</span><input name="q" inputmode="decimal"></label></div><div class="ob-actions"><button class="button outline" type="submit">Adicionar</button></div></form></section>':'<section class="panel ob-panel"><div class="panel-header"><div><h2>Lista enviada</h2><p>Para alterar, duplique a lista.</p></div></div></section>')+'</aside></div>';}
const sugHtml=sug=>sug.length?'<ul class="cp-list">'+sug.map(m=>'<li><div><strong>'+esc(m.d)+'</strong><small>'+m.id+' · '+m.u+'</small></div><button class="button outline fn-sm" data-ls-addm="'+m.id+'">+ Adicionar</button></li>').join('')+'</ul>':'<p class="ob-p">'+(V.busca.length>=2?'Nada encontrado. Use "Item fora do catálogo".':'Digite pelo menos 2 letras.')+'</p>';
function tsv(l,soFalta){const st=saldo(),rows=[['Lista','Obra','Código','Material','Unidade','Quantidade','Em estoque','Falta','Observação']];l.itens.forEach(it=>{const m=it.m?mats().find(x=>x.id===it.m):null,disp=m&&st[m.id]?Math.max(0,st[m.id].q):0,falta=Math.max(0,(+it.q||0)-disp);if(soFalta&&!falta)return;rows.push([l.id,l.cc,m?m.id:'',m?m.d:it.desc,m?m.u:it.u||'',nf(soFalta?falta:it.q,2),nf(disp,2),nf(falta,2),it.obs||'']);});return rows.map(r=>r.map(x=>String(x).replace(/\t|\n/g,' ')).join('\t')).join('\n');}
function printHtml(l){const st=saldo();return '<article class="rp-doc"><header class="rp-h"><div><small>ARMANT 360 · LISTA DE MATERIAIS</small><h1>'+esc(l.titulo)+'</h1><p>'+esc(l.id)+' · '+esc(l.cc)+' · '+esc(l.tipo)+(l.para?' · necessário até '+br(l.para):'')+'</p></div><img src="assets/armant-logo.png" alt="Armant" onerror="this.remove()"></header><table><thead><tr><th>#</th><th>Material</th><th>Un.</th><th>Qtd.</th><th>Estoque</th><th>Separado</th></tr></thead><tbody>'+l.itens.map((it,i)=>{const m=it.m?mats().find(x=>x.id===it.m):null;return '<tr><td>'+(i+1)+'</td><td>'+esc(m?m.d:it.desc)+(it.obs?' — '+esc(it.obs):'')+'</td><td>'+esc(m?m.u:it.u||'')+'</td><td>'+qf(it.q)+'</td><td>'+(m&&st[m.id]?qf(Math.max(0,st[m.id].q)):'—')+'</td><td>☐</td></tr>';}).join('')+'</tbody></table><footer class="rp-f">Emitida em '+br(hoje())+'. Separado por: ______________________   Conferido na obra por: ______________________</footer></article>';}

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),act=document.querySelector('.heading-actions');if(on){if(!('n' in chrome))chrome.n=notice?notice.innerHTML:'';if(notice)notice.innerHTML='<strong>Listas de materiais.</strong> Salvas neste navegador. O saldo vem do Almoxarifado.';if(act)act.style.visibility='hidden';}else if('n' in chrome){if(notice)notice.innerHTML=chrome.n;if(act)act.style.visibility='';delete chrome.n;}}
function nav(){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id==='operations'?'active':'')+'" title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}
const prevRender=render;
render=function(){const [v,a]=location.hash.slice(1).split('/');
 if(v==='listas'){V.id=a&&byId(a)?a:null;setChrome(true);nav();document.getElementById('breadcrumb').textContent='Operação & CSC · Listas de materiais';document.getElementById('page-title').innerHTML='Listas de materiais<span>.</span>';document.getElementById('page-subtitle').textContent='Confecção de listas por obra, com estoque e compra.';const c=document.getElementById('view');c.innerHTML=V.id?editor(byId(V.id)):lista();c.className='fade-in';return;}
 setChrome(false);prevRender();
 if(v==='operations'){const c=document.getElementById('view'),q=c.querySelector('.mt-quick');if(q&&!c.querySelector('[href="#listas"]'))q.insertAdjacentHTML('beforeend','<a class="cad-card" href="#listas"><strong>Listas de materiais</strong><span>Monte a lista da obra, compare com o estoque e gere a compra</span><em>Abrir '+ic('arrow')+'</em></a>');}};

/* ---------- eventos (prefixo ls-) ---------- */
const on=()=>location.hash.startsWith('#listas');
const hist=(l,t)=>{(l.hist=l.hist||[]).push({d:hoje(),t:t+((me()||{}).nome?' · '+me().nome:'')});};
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
function clip(txt,ok){(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say(ok)).catch(()=>say('Não foi possível copiar.'));}
function addItem(l,o){const ex=o.m&&l.itens.find(it=>it.m===o.m);if(ex)ex.q=(+ex.q||0)+(+o.q||0);else l.itens.push(o);}
document.addEventListener('submit',e=>{const f=e.target;if(!on())return;const g=k=>f.elements[k]?String(f.elements[k].value).trim():'';
 if(f.id==='ls-new'){e.preventDefault();if(!g('titulo')){f.querySelector('.cad-err').textContent='Dê um título à lista.';return;}L.seq++;const l={id:'LM-'+String(L.seq).padStart(4,'0'),cc:g('cc'),titulo:g('titulo'),tipo:g('tipo'),para:g('para'),st:'Rascunho',itens:[],criado:hoje(),por:(me()||{}).nome||''};hist(l,'Lista criada');L.listas.push(l);save();location.hash='#listas/'+l.id;return;}
 if(f.id==='ls-free'){e.preventDefault();const l=byId(V.id),q=num(g('q'));if(!l||!g('desc')||!(q>0)){say('Informe descrição e quantidade.');return;}const m=casar(g('desc'));addItem(l,m?{m:m.id,q,obs:''}:{desc:g('desc'),u:g('u')||'UN',q,obs:''});save();refresh();say(m?'Encontrei no catálogo: '+m.d+'.':'Item adicionado fora do catálogo.');}});
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||!on())return;const d=t.dataset;
 if(d.lsSt!=null){V.st=d.lsSt;refresh();return;}
 if(d.lsOpen){location.hash='#listas/'+d.lsOpen;return;}
 const l=byId(V.id);
 if(d.lsAddm&&l){addItem(l,{m:d.lsAddm,q:1,obs:''});save();refresh();say('Material adicionado. Ajuste a quantidade.');return;}
 if(d.lsRm!=null&&l){l.itens.splice(+d.lsRm,1);save();refresh();return;}
 if(d.lsPaste&&l){const txt=(document.getElementById('ls-paste')||{}).value||'';let n=0,cat=0;txt.split(/\r?\n/).forEach(r=>{const p=r.split(/\t|;| \| /).map(x=>x.trim()).filter(Boolean);if(!p.length)return;let desc=p[0],u='UN',q=1;if(p.length>=3){u=p[1];q=num(p[2]);}else if(p.length===2){q=num(p[1]);}if(!(q>0))q=1;const m=casar(desc);addItem(l,m?{m:m.id,q,obs:''}:{desc,u,q,obs:''});n++;if(m)cat++;});if(!n){say('Nenhuma linha reconhecida.');return;}hist(l,n+' linha(s) coladas');save();refresh();say(n+' item(ns) adicionados: '+cat+' casados com o catálogo, '+(n-cat)+' fora do catálogo.');return;}
 if(d.lsAlm){const l2=byId(d.lsAlm),M=MT();if(!l2||!M)return;const itens=l2.itens.filter(it=>it.m&&+it.q>0).map(it=>({m:it.m,q:+it.q}));const p=M.addPedido({cc:l2.cc,quem:(me()||{}).nome||'Operação & CSC',itens,para:l2.para||hoje(),obs:'Lista '+l2.id+' · '+l2.titulo});l2.st='Enviada ao almoxarifado';l2.ped=p.id;hist(l2,'Separação enviada ao almoxarifado ('+p.id+')');save();
  const n=NU(),A=AC();if(n&&A){const ids=A.users().filter(u=>u.setor==='Almoxarifado'||u.setor==='Suprimentos').map(u=>u.id);n.notify(ids,{tipo:'tarefa',titulo:'Separar lista '+l2.id+' · '+l2.cc,texto:itens.length+' material(is) · '+l2.titulo,link:'#materiais/entrega'});}refresh();say('Separação '+p.id+' enviada ao almoxarifado.');return;}
 if(d.lsComp){const l2=byId(d.lsComp);if(!l2)return;clip(tsv(l2,true),'Lista de compra copiada (só o que falta). Cole no Excel ou no e-mail ao fornecedor.');if(l2.st==='Rascunho'){l2.st='Enviada para compras';hist(l2,'Lista de compra gerada');save();refresh();}return;}
 if(d.lsTsv){const l2=byId(d.lsTsv);if(l2)clip(tsv(l2,false),'Lista copiada. Cole no Excel.');return;}
 if(d.lsPrint){const l2=byId(d.lsPrint);if(!l2)return;document.querySelectorAll('.rp-ov').forEach(x=>x.remove());document.body.insertAdjacentHTML('beforeend','<div class="rp-ov"><div class="rp-bar"><button class="button primary" data-rp="print">Imprimir ou salvar PDF</button><button class="button outline" data-rp="close">Fechar</button></div><div class="rp-wrap">'+printHtml(l2)+'</div></div>');return;}
 if(d.lsDup){const l2=byId(d.lsDup);if(!l2)return;L.seq++;const n={...JSON.parse(JSON.stringify(l2)),id:'LM-'+String(L.seq).padStart(4,'0'),titulo:l2.titulo+' (cópia)',st:'Rascunho',criado:hoje(),hist:[],ped:null};hist(n,'Duplicada de '+l2.id);L.listas.push(n);save();location.hash='#listas/'+n.id;return;}
 if(d.lsDone){const l2=byId(d.lsDone);if(l2){l2.st='Concluída';hist(l2,'Concluída');save();refresh();}return;}
 if(d.lsDel){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar exclusão';return;}L.listas=L.listas.filter(x=>x.id!==d.lsDel);save();location.hash='#listas';}});
document.addEventListener('input',e=>{const t=e.target;if(!on())return;
 if(t.id==='ls-q'){V.q=t.value;const pos=t.selectionStart;render();const q=document.getElementById('ls-q');if(q){q.focus();q.setSelectionRange(pos,pos);}return;}
 if(t.id==='ls-busca'){V.busca=t.value;const q=norm(V.busca),s=document.getElementById('ls-sug');if(s)s.innerHTML=sugHtml(q.length>=2?mats().filter(m=>norm(m.id+' '+m.d).includes(q)).slice(0,8):[]);return;}});
document.addEventListener('change',e=>{const t=e.target;if(!on())return;const l=byId(V.id);
 if(t.id==='ls-fcc'){V.cc=t.value;refresh();return;}
 if(t.dataset.lsQ!=null&&l){const q=num(t.value);if(q>0){l.itens[+t.dataset.lsQ].q=q;save();refresh();}else say('Quantidade inválida.');return;}
 if(t.dataset.lsO!=null&&l){l.itens[+t.dataset.lsO].obs=t.value.trim();save();}});

window.ArmantListas={version:'1.0',state:L};
render();
})();
