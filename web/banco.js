/* Armant 360 · Banco de dados (só superadmin)
   Carregar depois dos módulos e antes de acesso.js:  <script src="banco.js" defer></script>
   #banco              visão geral: todas as bases (tabelas), registros e tamanho
   #banco/t/<tabela>   uma base aberta como tabela, com busca e exportação (Excel .xlsx e CSV)
   #banco/obra/<cc>    tudo o que está ligado a um centro de custo (o "banco de dados da obra")
   Dados pessoais sensíveis (CPF, RG, fotos, arquivos) não aparecem aqui. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nf=(v,dg=0)=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
if(!NAV.some(x=>x[0]==='banco')){const at=NAV.findIndex(x=>x[0]==='overview');NAV.splice(at+1,0,['banco','Banco de dados','layers']);}
const AC=()=>window.ArmantAcesso;
const souSuper=()=>{const A=AC();if(!A||!A.user)return true;const u=A.real?A.real():A.user();return !!u&&u.nivel>=6;};

/* registro → só campos simples; nada de CPF, RG, senha, foto ou arquivo */
const PROIBIDO=/cpf|^rg$|rg_|senha|password|foto|img|imagem|arquivo|blob|anexo|assin/i;
function plano(o){const r={};Object.entries(o||{}).forEach(([k,v])=>{if(PROIBIDO.test(k))return;if(v==null)return;
 if(Array.isArray(v)){r[k]=v.length&&typeof v[0]!=='object'?v.join(', '):v.length+' item(ns)';return;}
 if(typeof v==='object'){Object.entries(v).forEach(([k2,v2])=>{if(!PROIBIDO.test(k2)&&(typeof v2!=='object'||v2==null))r[k+'.'+k2]=v2;});return;}
 if(typeof v==='string'&&v.startsWith('data:'))return;r[k]=v;});return r;}
const st=(api,k)=>{const A=window[api];return A&&A.state&&Array.isArray(A.state[k])?A.state[k]:[];};
const CAD=()=>window.ArmantCadastros||{},MT=()=>window.ArmantMateriais||null;
const CATA=()=>window.ArmantCatalogoAreas||null;
const AREA=a=>{const A=CATA()&&CATA().areas().find(y=>y.id===a);return A?A.nome:a;};
/* pessoas são guardadas pelo id; a tabela mostra o nome lido do cadastro de pessoas */
const pessoaNome=id=>{const u=(AC()&&AC().users?AC().users():[]).find(x=>x.id===id);return u?u.nome:(id||'');};
/* tabelas: [id, nome, grupo, linhas(), campo do centro de custo] */
const TABS=[
 ['demandas','Obras · base única (demandas aprovadas)','Engenharia',()=>(CAD().demandas?CAD().demandas():[]).map(d=>({cc:d.cc,nome:d.nome,cliente:CAD().cliNome?CAD().cliNome(d.cli):d.cli,cidade:d.cidade,uf:d.uf,documento:d.aprovDoc,numero:d.aprovNum,aprovacao:d.aprovData,valor:d.valor,prazo:d.prazo,inicio:d.inicio,ro:pessoaNome(CAD().roDe?CAD().roDe(d.cc):d.ro),tipo:d.ficticia?'fictícia':d.exemplo?'exemplo real':'real'})),'cc'],
 ['itens','Itens das demandas (orçamento)','Engenharia',()=>{const I=(CAD().state||{}).itens||{};return Object.entries(I).flatMap(([cc,L])=>(L||[]).map(x=>({cc,...plano(x)})));},'cc'],
 ['eap','Serviços da obra real (EAP TJ-RS)','Engenharia',()=>{const O=window.ArmantObras;return O&&O.items?O.items.map(i=>({cc:'CC-2026-001',codigo:i.c,descricao:i.d,un:i.u,qtd:i.q,total:i.t,mao_de_obra:i.mo,material:i.mat,executado_pct:Math.round(Math.min(1,O.doneQ(i)/i.q)*1000)/10})):[];},'cc'],
 ['clientes','Clientes','Comercial e Orçamento',()=>(CAD().clientes?CAD().clientes():[]).map(plano),null],
 ['fornecedores','Fornecedores','Suprimentos e Almoxarifado',()=>(CAD().fornecedores?CAD().fornecedores():[]).map(plano),null],
 ['usuarios','Pessoas e acessos','RH e Frota',()=>(AC()&&AC().users?AC().users():[]).map(u=>({id:u.id,nome:u.nome,email:u.email,setor:u.setor,funcao:u.funcao,nivel:u.nivel,obras:(u.obras||[]).join(', '),ativo:u.ativo===false?'não':'sim'})),null],
 ['materiais','Materiais (catálogo)','Suprimentos e Almoxarifado',()=>MT()?MT().materiais().map(m=>({codigo:m.id,descricao:m.d,un:m.u,categoria:m.cat,minimo:m.min||0})):[],null],
 ['estoques','Estoques (depósitos)','Suprimentos e Almoxarifado',()=>MT()?MT().estoques().map(plano):[],null],
 ['saldos','Saldo por estoque','Suprimentos e Almoxarifado',()=>{if(!MT()||!MT().tabelas)return [];const t=MT().tabelas().Estoque,h=t[0];return t.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));},null],
 ['movs','Movimentações de material','Suprimentos e Almoxarifado',()=>{if(!MT()||!MT().tabelas)return [];const t=MT().tabelas()['Movimentações'],h=t[0];return t.slice(1).map(r=>{const o=Object.fromEntries(h.map((k,i)=>[k,r[i]]));o.cc=o['Centro de custo']||'';delete o['Centro de custo'];return o;});},'cc'],
 ['pedidos','Pedidos de material do campo','Suprimentos e Almoxarifado',()=>MT()?MT().state.ped.map(p=>({id:p.id,data:p.data,cc:p.cc,quem:p.quem,situacao:p.st,itens:(p.itens||[]).map(i=>i.q+' × '+i.m).join('; '),obs:p.obs||''})):[],'cc'],
 ['listas','Listas de materiais','Suprimentos e Almoxarifado',()=>st('ArmantListas','listas').map(plano),'cc'],
 ['negociacoes','Negociações (propostas)','Comercial e Orçamento',()=>((CAD().state||{}).neg||[]).map(plano),null],
 ['financeiro','Lançamentos financeiros','Financeiro',()=>{const F=window.ArmantFinanceiro;return F&&F.todos?F.todos('2100-12-31').map(t=>({id:t.id,tipo:t.tipo==='rec'?'a receber':'a pagar',descricao:t.desc,parte:t.parte,cc:t.cc,categoria:t.cat,valor:t.valor,emissao:t.emissao,vencimento:t.venc,situacao:t.status})):[];},'cc'],
 ['contas','Contas bancárias','Financeiro',()=>st('ArmantFinanceiro','contas').map(plano),null],
 ['atividades','Atividades (Controle de obras)','Engenharia',()=>st('ArmantControle','at').map(plano),'cc'],
 ['tarefas','Tarefas do app de campo','Engenharia',()=>st('ArmantCampo','tar').map(t=>({id:t.id,data:t.data,cc:t.cc,titulo:t.titulo,responsavel:t.resp,situacao:t.st,item:t.item||'',fotos:t.res&&t.res.fotos?t.res.fotos.length:0,legendas:t.res&&t.res.legs?t.res.legs.filter(Boolean).join(' | '):''})),'cc'],
 ['presenca','Presença na obra','Engenharia',()=>st('ArmantCampo','pres').map(plano),'cc'],
 ['diarios','Fim de serviço e diários','Engenharia',()=>st('ArmantCampo','fim').concat(st('ArmantCampo','dia')).map(plano),'cc'],
 ['veiculos','Veículos','RH e Frota',()=>st('ArmantFrota','vei').map(plano),null],
 ['usos','Diário de bordo','RH e Frota',()=>st('ArmantFrota','uso').map(plano),'cc'],
 ['abast','Abastecimentos','RH e Frota',()=>st('ArmantFrota','abs').map(plano),'cc'],
 ['viagens','Viagens (RH)','RH e Frota',()=>st('ArmantRH','via').map(plano),'cc'],
 ['cat_fornecedores','Fornecedores de referência','Catálogo por área',()=>CATA()?CATA().fornecedores().map(x=>({id:x.id,area:AREA(x.area),nome:x.nome,cidade:x.cidade,uf:x.uf,tipo:x.tipo,vende:x.vende,status:x.status,fonte:x.fonte})):[],null],
 ['cat_materiais','Materiais de referência','Catálogo por área',()=>CATA()?CATA().materiais().flatMap(x=>x.itens.map(i=>({id:x.id,area:AREA(x.area),categoria:x.categoria,material:i}))):[],null],
 ['cat_equipamentos','Equipamentos de referência','Catálogo por área',()=>CATA()?CATA().equipamentos().map(x=>({id:x.id,area:AREA(x.area),nome:x.nome,tipo:x.tipo,obs:x.obs})):[],null],
 ['cat_servicos','Serviços de referência','Catálogo por área',()=>CATA()?CATA().servicos().map(x=>({id:x.id,area:AREA(x.area),nome:x.nome,unidade:x.unidade})):[],null]];
const SETORES_BD=['Engenharia','Comercial e Orçamento','Suprimentos e Almoxarifado','Financeiro','RH e Frota','Catálogo por área'];
const tab=id=>TABS.find(t=>t[0]===id);
const linhas=t=>{try{return t[3]()||[];}catch(e){return [];}};
const colunas=L=>{const s=[];L.slice(0,300).forEach(r=>Object.keys(r).forEach(k=>{if(!s.includes(k))s.push(k);}));return s;};
const ccDe=(t,r)=>t[4]?String(r[t[4]]||''):'';
const bytes=()=>{let n=0,k=0;try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(/^a360/.test(key)){k++;n+=key.length+(localStorage.getItem(key)||'').length;}}}catch(e){}return {n:n*2,k};};
const tam=b=>b>1048576?nf(b/1048576,1)+' MB':nf(b/1024,0)+' KB';
const V={q:''};
const cel=v=>typeof v==='number'?nf(v,Math.abs(v-Math.round(v))<1e-9?0:2):esc(v);
function tabelaHTML(L,cols,max){return '<div class="table-wrap bd-tw"><table class="ob-t bd-t"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
 (L.slice(0,max).map(r=>'<tr>'+cols.map(c=>'<td'+(typeof r[c]==='number'?' class="ob-n"':'')+'>'+cel(r[c])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+Math.max(1,cols.length)+'">Nenhum registro.</td></tr>')+'</tbody></table></div>'+(L.length>max?'<p class="area-note">Mostrando '+max+' de '+nf(L.length)+'. A exportação leva todos.</p>':'');}

/* exportar: Excel (.xlsx, uma aba por tabela) e CSV */
let xl=null;const loadXLSX=()=>window.XLSX?Promise.resolve(window.XLSX):(xl=xl||new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=()=>{xl=null;ko(new Error('Não consegui carregar o Excel (precisa de internet). Use CSV.'));};document.head.appendChild(s);}));
async function baixar(nome,data,tipo){try{const dl=window.claude&&typeof window.claude.use==='function'?await window.claude.use('downloads'):null;if(dl){await dl.save({filename:nome,data:new Blob([data],{type:tipo})});return true;}}catch(e){if(e&&e.code==='declined')return false;}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:tipo}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);return true;}
const aoa=L=>{const c=colunas(L);return [c].concat(L.map(r=>c.map(k=>r[k]==null?'':r[k])));};
const csv=rows=>'﻿'+rows.map(r=>r.map(v=>{if(typeof v==='number')return String(v).replace('.',',');const t=String(v);return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;}).join(';')).join('\r\n');
async function exportar(fmt,lista,nome){try{
 if(fmt==='csv'){const [t,L]=lista[0];if(await baixar('armant360-'+t[0]+'-'+hoje()+'.csv',csv(aoa(L)),'text/csv;charset=utf-8'))say(t[1]+' exportado em CSV.');return;}
 const X=await loadXLSX(),wb=X.utils.book_new(),usados=new Set();lista.forEach(([t,L])=>{let n=t[1].replace(/[\\/?*[\]:]/g,'').slice(0,31);while(usados.has(n))n=n.slice(0,28)+'_'+usados.size;usados.add(n);X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(aoa(L)),n);});
 if(await baixar(nome+'-'+hoje()+'.xlsx',new Uint8Array(X.write(wb,{bookType:'xlsx',type:'array'})),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))say('Excel exportado: '+lista.length+' tabela(s).');}catch(err){say(err.message||'Não foi possível exportar.');}}

const intro=(t,s)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">só superadmin</span><h2>'+t+'</h2><p>'+s+'</p></div>'+ic('layers')+'</div>';
const abas=cur=>'<div class="ob-tabs" role="tablist">'+[['','Visão geral'],['obra','Por obra']].map(([k,l])=>'<a role="tab" href="#banco'+(k?'/'+k:'')+'" class="'+(cur===k?'active':'')+'">'+l+'</a>').join('')+'</div>';
function geral(){const T=TABS.map(t=>[t,linhas(t)]),tot=T.reduce((a,x)=>a+x[1].length,0),b=bytes(),ccs=(CAD().demandas?CAD().demandas():[]).length,G=SETORES_BD.filter(g=>TABS.some(t=>t[2]===g));
 return intro('Banco de dados.','Bancos de dados unificados por setor. Cada obra existe uma vez só (base única de obras) e todas as telas leem dela; em "Por obra" aparece tudo o que está ligado a cada centro de custo. Exporte para Excel ou CSV.')+abas('')+
 '<div class="kpi-grid">'+[['Tabelas',TABS.length,'bases organizadas'],['Registros',nf(tot),'em todas as tabelas'],['Obras (centros de custo)',ccs,'cada uma com o seu banco'],['Tamanho',tam(b.n),b.k+' chave(s) neste navegador']].map(([l,v,s],i)=>'<article class="kpi-card'+(i?'':' featured')+'"><div class="kpi-top"><div class="kpi-label">'+ic('layers')+esc(l)+'</div></div><div class="kpi-number">'+v+'</div><p class="kpi-subtitle">'+s+'</p></article>').join('')+'</div>'+
 '<div class="ob-actions bd-act"><button class="button primary" data-bd-exp="tudo">'+ic('download')+'Exportar tudo (Excel, uma aba por tabela)</button><a class="button outline" href="#auditoria" data-bd-console>Painel do superadmin (console de dados)</a></div>'+
 G.map(g=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+esc(g)+'</h2></div></div><div class="bd-grid">'+T.filter(x=>x[0][2]===g).map(([t,L])=>'<a class="bd-card" href="#banco/t/'+t[0]+'"><strong>'+esc(t[1])+'</strong><span class="bd-n">'+nf(L.length)+'</span><small>'+(t[4]?'ligada à obra (centro de custo)':'base geral')+'</small></a>').join('')+'</div></section>').join('')+
 '<p class="area-note">Hoje os dados ficam neste navegador e, com o back-end ligado, no Supabase (fase 1: uma linha por módulo). O próximo passo é a fase 2: cada tabela daqui vira uma tabela própria no banco, com o centro de custo como chave para separar o banco de cada obra.</p>';}
function tabela(id){const t=tab(id);if(!t)return intro('Tabela não encontrada.','')+abas('');const L=linhas(t),q=norm(V.q),F=q?L.filter(r=>norm(Object.values(r).join(' ')).includes(q)):L,cols=colunas(L);
 return intro(esc(t[1])+'.',esc(t[2])+' · '+nf(L.length)+' registro(s)'+(t[4]?' · cada registro tem o centro de custo da obra':''))+abas('')+
 '<div class="toolbar cad-tools"><label class="search-field">'+ic('search')+'<input id="bd-q" type="search" placeholder="Buscar nesta tabela..." value="'+esc(V.q)+'"></label><div class="ob-actions"><button class="button outline" data-bd-exp="xlsx" data-t="'+t[0]+'">'+ic('download')+'Excel</button><button class="button outline" data-bd-exp="csv" data-t="'+t[0]+'">CSV</button></div></div>'+
 '<section class="panel ob-panel">'+(q?'<p class="area-note bd-cnt">'+nf(F.length)+' de '+nf(L.length)+' registro(s) com "'+esc(V.q)+'"</p>':'')+tabelaHTML(F,cols,300)+'</section>';}
function porObra(cc){const D=CAD().demandas?CAD().demandas():[];if(!cc&&D.length)cc=D[0].cc;const d=D.find(x=>x.cc===cc);
 const T=TABS.filter(t=>t[4]).map(t=>[t,linhas(t).filter(r=>ccDe(t,r)===cc)]);
 return intro('Banco de dados por obra.','Tudo o que está ligado a um centro de custo: orçamento, serviços, materiais que saíram, pedidos, tarefas, presença, financeiro e frota.')+abas('obra')+
 '<div class="toolbar cad-tools"><label class="ob-field bd-sel"><span>Obra (centro de custo)</span><select id="bd-cc">'+D.map(x=>'<option value="'+esc(x.cc)+'"'+(x.cc===cc?' selected':'')+'>'+esc(x.cc+' · '+x.nome)+'</option>').join('')+'</select></label><div class="ob-actions"><button class="button primary" data-bd-exp="obra" data-cc="'+esc(cc||'')+'">'+ic('download')+'Exportar esta obra (Excel)</button></div></div>'+
 (d?'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+esc(d.cc)+' · '+esc(d.nome)+'</h2><p>'+T.reduce((a,x)=>a+x[1].length,0)+' registro(s) em '+T.filter(x=>x[1].length).length+' tabela(s)</p></div></div></section>':'')+
 T.map(([t,L])=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+esc(t[1])+'</h2><p>'+nf(L.length)+' registro(s)</p></div>'+(L.length?'<a class="text-button" href="#banco/t/'+t[0]+'">Tabela completa '+ic('arrow')+'</a>':'')+'</div>'+(L.length?tabelaHTML(L,colunas(L),20):'<p class="ob-p">Nada nesta obra ainda.</p>')+'</section>').join('');}

const prevRender=render;
render=function(){const p=location.hash.slice(1).split('/');if(p[0]!=='banco')return prevRender();
 const c=document.getElementById('view'),n=document.getElementById('navigation');if(n)n.querySelectorAll('.nav-item').forEach(a=>{const on=a.getAttribute('href')==='#banco';a.classList.toggle('active',on);});
 document.getElementById('breadcrumb').textContent='Armant 360 · Banco de dados';document.getElementById('page-title').innerHTML='Banco de dados<span>.</span>';document.getElementById('page-subtitle').textContent='Todas as bases do sistema, organizadas em tabelas. Acesso só do superadmin.';
 if(!souSuper()){c.innerHTML='<section class="panel ob-panel"><p class="ob-p">O banco de dados é acessado só pelo superadmin.</p></section>';return;}
 c.innerHTML=p[1]==='t'?tabela(p[2]):p[1]==='obra'?porObra(p[2]):geral();c.className='fade-in';};
document.addEventListener('click',e=>{if(!location.hash.startsWith('#banco'))return;const b=e.target.closest('[data-bd-exp]');if(!b)return;if(!souSuper())return;const k=b.dataset.bdExp;
 if(k==='tudo')exportar('xlsx',TABS.map(t=>[t,linhas(t)]),'armant360-banco-de-dados');
 else if(k==='obra'){const cc=b.dataset.cc;exportar('xlsx',TABS.filter(t=>t[4]).map(t=>[t,linhas(t).filter(r=>ccDe(t,r)===cc)]),'armant360-obra-'+cc);}
 else{const t=tab(b.dataset.t);if(t)exportar(k,[[t,linhas(t)]],'armant360-'+t[0]);}});
document.addEventListener('change',e=>{if(e.target.id==='bd-cc')location.hash='#banco/obra/'+e.target.value;});
document.addEventListener('input',e=>{if(e.target.id!=='bd-q')return;V.q=e.target.value;const pos=e.target.selectionStart;render();const q=document.getElementById('bd-q');if(q){q.focus();q.setSelectionRange(pos,pos);}});
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#banco/t/'))V.q='';});
window.ArmantBanco={version:'1.0',tabelas:()=>TABS.map(t=>({id:t[0],nome:t[1],grupo:t[2],registros:linhas(t).length,porObra:!!t[4]})),linhas:id=>{const t=tab(id);return t?linhas(t):[];}};
})();
