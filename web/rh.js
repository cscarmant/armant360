/* Armant 360 · RH: solicitação de viagens e documentos (extensão do painel)
   Carregar depois de areas.js e nucleo.js:  <script src="rh.js" defer></script>
   #meurh (todos): pedir viagem e enviar os próprios documentos.
   #rh (equipe de RH e diretoria): aprovar viagens, ver e conferir documentos de todos, com validade.
   Arquivos guardados neste navegador (IndexedDB); metadados no registro. Dados pessoais: LGPD. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null,FIN=()=>window.ArmantFinanceiro||null,CAD=window.ArmantCadastros||{};
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const num=v=>{const s=String(v==null?'':v).replace(/[R$\s]/g,'');if(!s)return NaN;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);};
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const br=iso=>iso?iso.slice(0,10).split('-').reverse().join('/'):'—';
const dd=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const me=()=>AC()?AC().user():null;
const users=()=>AC()?AC().users():[];
const uNome=id=>(users().find(u=>u.id===id)||{}).nome||'—';
/* histórico guarda o id de quem decidiu; se a pessoa saiu do cadastro, usa o nome gravado na época */
const hNome=h=>(h.uid&&(users().find(u=>u.id===h.uid)||{}).nome)||h.nome||'—';
const demandas=()=>typeof CAD.demandas==='function'?CAD.demandas():[];
if(!NAV.some(x=>x[0]==='meurh')){const at=NAV.findIndex(x=>x[0]==='rh');NAV.splice(at<0?NAV.length:at+1,0,['meurh','Meu RH','users']);}

/* ---------- estado ---------- */
const VST={solicitada:'Aguardando gestor',aprovada:'Aprovada pelo gestor',reservada:'Reservas feitas (RH)',reprovada:'Reprovada',concluida:'Concluída',cancelada:'Cancelada'};
const TRANS=['Carro da empresa','Carro próprio (reembolso de km)','Ônibus','Avião','Outro'];
const DOCT=['ASO (atestado de saúde)','NR-10 (eletricidade)','NR-35 (altura)','NR-18 (construção)','NR-12 (máquinas)','CNH','Integração do cliente','Ficha de EPI','Contrato de trabalho','Certificado de curso','Comprovante de vacina','Outro'];
const R={via:[],docs:[],seq:{v:0,d:0}};
try{const s=JSON.parse(localStorage.getItem('a360rh')||'null');if(s){R.via=Array.isArray(s.via)?s.via:[];R.docs=Array.isArray(s.docs)?s.docs:[];R.seq={...R.seq,...(s.seq||{})};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360rh',JSON.stringify(R));}catch(e){}};
const V={tab:'viagens',mtab:'viagens',uf:'',vf:''};
const gestorDe=u=>{const us=users().filter(x=>x.id!==u.id);return us.filter(x=>x.nivel>u.nivel&&(x.setor===u.setor||x.nivel>=5)).sort((a,b)=>a.nivel-b.nivel);};
const rhTeam=()=>users().filter(u=>u.setor==='RH'||u.nivel>=6).map(u=>u.id);
const podeAprovar=(u,v)=>{const s=users().find(x=>x.id===v.uid);return u&&s&&u.id!==s.id&&u.nivel>s.nivel&&(u.setor===s.setor||u.nivel>=5);};
const validade=d=>!d.val?'sem':d.val<hoje()?'vencido':dd(hoje(),d.val)<=30?'vence':'ok';
const VTXT={sem:'sem validade',vencido:'vencido',vence:'vence em breve',ok:'em dia'};

/* ---------- partes de tela ---------- */
const intro=(t,p,i)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">RH · salvo neste navegador</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic(i||'users')+'</div>';
const kc=(l,v,s,f)=>'<article class="kpi-card'+(f?' featured':'')+'"><div class="kpi-top"><div class="kpi-label">'+l+'</div></div><div class="kpi-number">'+v+'</div><p class="kpi-subtitle">'+s+'</p></article>';
function viaCard(v,modo){const u=me();return '<article class="at-card '+(v.st==='reprovada'||v.st==='cancelada'?'recusada':v.st==='concluida'?'concluida':'nova')+'"><div class="at-h"><div><strong>'+esc(v.destino)+'</strong><small>'+esc(uNome(v.uid))+' · '+br(v.ida)+' a '+br(v.volta)+' · '+esc(v.trans)+(v.cc?' · '+esc(v.cc):'')+(v.adiant?' · adiantamento R$ '+nf(v.adiant):'')+'</small></div><span class="status'+(v.st==='reprovada'?' risk':v.st==='concluida'||v.st==='reservada'?' fn-ok':v.st==='solicitada'?'':' ob-mute')+'">'+VST[v.st]+'</span></div><p>'+esc(v.motivo)+(v.hosp?' · precisa de hospedagem':'')+(v.obs?' · '+esc(v.obs):'')+'</p>'+
 (v.hist&&v.hist.length?'<ol class="at-hist">'+v.hist.map(h=>'<li><b>'+br(h.t)+'</b> '+esc(hNome(h))+': '+esc(VST[h.st]||h.st)+(h.com?' — '+esc(h.com):'')+'</li>').join('')+'</ol>':'')+
 '<div class="at-act">'+(v.st==='solicitada'&&podeAprovar(u,v)?'<button class="button primary fn-sm" data-rh-v="aprovada" data-id="'+v.id+'">Aprovar</button><button class="button outline fn-sm" data-rh-v="reprovada" data-id="'+v.id+'">Reprovar</button>':'')+
 (modo==='rh'&&v.st==='aprovada'?'<button class="button primary fn-sm" data-rh-v="reservada" data-id="'+v.id+'">Reservas feitas</button>':'')+(modo==='rh'&&v.st==='reservada'?'<button class="button outline fn-sm" data-rh-v="concluida" data-id="'+v.id+'">Concluir (prestação de contas)</button>':'')+
 (v.uid===u.id&&(v.st==='solicitada'||v.st==='aprovada')?'<button class="text-button" data-rh-v="cancelada" data-id="'+v.id+'">Cancelar pedido</button>':'')+'</div></article>';}
function viaForm(){const u=me(),g=gestorDe(u);return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Solicitar viagem</h2><p>'+(g.length?'Vai para aprovação de '+esc(g[0].nome)+' e depois para o RH.':'Seu pedido vai direto para o RH.')+'</p></div></div><form id="rh-via" class="fr-form" novalidate><div class="ob-form"><label class="ob-field cad-wide"><span>Destino <b class="cad-req">*</b></span><input name="destino" placeholder="Cidade/UF ou endereço"></label><label class="ob-field"><span>Ida <b class="cad-req">*</b></span><input name="ida" type="date"></label><label class="ob-field"><span>Volta <b class="cad-req">*</b></span><input name="volta" type="date"></label>'+
 '<label class="ob-field cad-wide"><span>Motivo <b class="cad-req">*</b></span><input name="motivo" placeholder="Ex.: visita técnica, start-up de equipamento"></label><label class="ob-field cad-wide"><span>Obra (opcional)</span><select name="cc"><option value="">—</option>'+demandas().map(d=>'<option value="'+d.cc+'">'+d.cc+' · '+esc(d.nome.slice(0,36))+'</option>').join('')+'</select></label>'+
 '<label class="ob-field"><span>Transporte</span><select name="trans">'+TRANS.map(t=>'<option>'+t+'</option>').join('')+'</select></label><label class="ob-field"><span>Adiantamento (R$)</span><input name="adiant" inputmode="decimal" placeholder="0,00"></label><label class="ob-check fn-chk cad-wide"><input type="checkbox" name="hosp"> Preciso de hospedagem</label><label class="ob-field cad-wide"><span>Observação</span><input name="obs" placeholder="Ex.: levar ferramentas, horário de voo preferido"></label></div><p class="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Enviar solicitação</button></div></form></section>';}
function docForm(uidFixo){const us=users();return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Enviar documento</h2><p>PDF ou foto, até 8 MB. Fica guardado e o RH é avisado.</p></div></div><form id="rh-doc" class="fr-form" novalidate><div class="ob-form">'+(uidFixo?'<input type="hidden" name="uid" value="'+uidFixo+'">':'<label class="ob-field cad-wide"><span>Colaborador</span><select name="uid">'+us.map(x=>'<option value="'+x.id+'">'+esc(x.nome)+' · '+esc(x.setor)+'</option>').join('')+'</select></label>')+
 '<label class="ob-field cad-wide"><span>Tipo de documento <b class="cad-req">*</b></span><select name="tipo">'+DOCT.map(t=>'<option>'+t+'</option>').join('')+'</select></label><label class="ob-field"><span>Válido até</span><input name="val" type="date"></label><label class="ob-field"><span>Observação</span><input name="obs"></label>'+
 '<label class="cad-wide rh-drop">📎 <span id="rh-fname">Escolher arquivo (PDF ou imagem)</span><input type="file" name="arq" id="rh-file" accept="application/pdf,image/*" capture="environment" hidden></label></div><p class="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Enviar e guardar</button></div></form></section>';}
function docTable(L,showUser,canDel){return '<div class="table-wrap"><table class="ob-t"><thead><tr>'+(showUser?'<th>Colaborador</th>':'')+'<th>Documento</th><th>Arquivo</th><th>Validade</th><th>Enviado</th><th></th></tr></thead><tbody>'+
 (L.map(d=>{const v=validade(d);return '<tr class="'+(v==='vencido'?'fn-late':'')+'">'+(showUser?'<td class="ob-nw">'+esc(uNome(d.uid))+'</td>':'')+'<td class="ob-d"><strong>'+esc(d.tipo)+'</strong>'+(d.obs?'<small>'+esc(d.obs)+'</small>':'')+'</td><td class="ob-d">'+esc(d.nome)+'<small>'+Math.round(d.size/1024)+' KB</small></td><td class="ob-nw">'+(d.val?br(d.val):'—')+'<small><span class="status rh-'+v+'">'+VTXT[v]+'</span></small></td><td class="ob-nw">'+br(d.em)+'<small>por '+esc(uNome(d.por))+'</small></td><td class="ob-nw"><button class="text-button" data-rh-ver="'+d.id+'">Abrir</button>'+(canDel?' <button class="text-button" data-rh-del="'+d.id+'">Excluir</button>':'')+'</td></tr>';}).join('')||'<tr><td colspan="6">Nenhum documento enviado.</td></tr>')+'</tbody></table></div>';}

/* ---------- Meu RH (todos) ---------- */
function meuRH(){const u=me(),mv=R.via.filter(v=>v.uid===u.id).slice().reverse(),md=R.docs.filter(d=>d.uid===u.id),aprovar=R.via.filter(v=>v.st==='solicitada'&&podeAprovar(u,v)),venc=md.filter(d=>['vencido','vence'].includes(validade(d)));
 const tabs='<div class="ob-tabs" role="tablist">'+[['viagens','Minhas viagens'],['documentos','Meus documentos']].concat(aprovar.length?[['aprovar','Aprovar viagens ('+aprovar.length+')']]:[]).map(([k,l])=>'<a role="tab" href="#meurh/'+k+'" class="'+(V.mtab===k?'active':'')+'">'+l+'</a>').join('')+'</div>';
 let body='';
 if(V.mtab==='documentos')body='<div class="ob-split"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Meus documentos</h2><p>'+md.length+' enviado(s)'+(venc.length?' · '+venc.length+' vencido(s) ou vencendo':'')+'</p></div></div>'+docTable(md,false,true)+'</section></div><aside class="ob-side">'+docForm(u.id)+'</aside></div>';
 else if(V.mtab==='aprovar')body='<section class="panel ob-panel"><div class="panel-header"><div><h2>Viagens aguardando sua aprovação</h2></div></div><div class="at-list">'+(aprovar.map(v=>viaCard(v,'gestor')).join('')||'<p class="ob-p">Nada para aprovar.</p>')+'</div></section>';
 else body='<div class="ob-split"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Minhas viagens</h2></div></div><div class="at-list">'+(mv.map(v=>viaCard(v,'eu')).join('')||'<p class="ob-p">Nenhuma solicitação.</p>')+'</div></section></div><aside class="ob-side">'+viaForm()+'</aside></div>';
 return intro('Meu RH.','Peça viagens a trabalho e envie seus documentos (ASO, NRs, CNH, integração). Seu gestor aprova a viagem e o RH organiza.','users')+'<div class="kpi-grid">'+kc('Viagens em aberto',String(mv.filter(v=>['solicitada','aprovada','reservada'].includes(v.st)).length),'aguardando ou marcadas',1)+kc('Documentos',String(md.length),'enviados')+kc('A renovar',String(venc.length),'vencidos ou vencendo em 30 dias')+kc('Para aprovar',String(aprovar.length),'viagens da sua equipe')+'</div>'+tabs+body;}

/* ---------- RH (equipe de RH) ---------- */
function pageRH(){const all=R.via.slice().reverse(),fv=all.filter(v=>!V.vf||v.st===V.vf),docs=R.docs.filter(d=>!V.uf||d.uid===V.uf),venc=R.docs.filter(d=>['vencido','vence'].includes(validade(d))),us=users();
 const falta=us.map(u=>{const tem=new Set(R.docs.filter(d=>d.uid===u.id&&validade(d)!=='vencido').map(d=>d.tipo));const exig=u.setor==='Campo'||u.nivel<=2?['ASO (atestado de saúde)','NR-35 (altura)','NR-10 (eletricidade)','Ficha de EPI']:['ASO (atestado de saúde)'];return {u,f:exig.filter(x=>!tem.has(x))};}).filter(x=>x.f.length);
 const tabs='<div class="ob-tabs" role="tablist">'+[['viagens','Solicitações de viagem'],['documentos','Documentos'],['escopo','Próximas funções']].map(([k,l])=>'<a role="tab" href="#rh/'+k+'" class="'+(V.tab===k?'active':'')+'">'+l+'</a>').join('')+'</div>';
 let body='';
 if(V.tab==='documentos')body='<div class="ob-split"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Documentos da equipe</h2><p>'+R.docs.length+' guardado(s) · '+venc.length+' vencido(s) ou vencendo</p></div><label class="period-control ob-ctl"><select id="rh-uf"><option value="">Todos</option>'+us.map(u=>'<option value="'+u.id+'"'+(V.uf===u.id?' selected':'')+'>'+esc(u.nome)+'</option>').join('')+'</select></label></div>'+docTable(docs.slice().reverse(),true,true)+'</section>'+
  (falta.length?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Pendências de documento</h2><p>Sugestão: campo precisa de ASO, NR-35, NR-10 e ficha de EPI válidos; escritório, de ASO. Ajustar com o RH.</p></div></div><div class="at-list">'+falta.map(x=>'<div class="at-card nova"><div class="at-h"><div><strong>'+esc(x.u.nome)+'</strong><small>'+esc(x.u.setor)+'</small></div><span class="status risk">'+x.f.length+' faltando</span></div><p>'+x.f.map(esc).join(', ')+'</p></div>').join('')+'</div></section>':'')+'</div><aside class="ob-side">'+docForm('')+'</aside></div>';
 else if(V.tab==='escopo')body='<section class="panel ob-panel"><div class="panel-header"><div><h2>Próximas funções do RH</h2><p>Para validar com a equipe</p></div></div><div class="cad-hub">'+[['Cadastro de colaboradores','Função, equipe, empresa, contato de trabalho'],['Alocação por obra','Quem está em cada centro de custo'],['Presença e horas','Vem do App de campo'],['EPIs entregues','Ligado ao Almoxarifado'],['Treinamentos','Agenda e certificados com validade'],['Terceiros','Documentos das subcontratadas']].map(([t,s])=>'<div class="cad-card off"><strong>'+t+'</strong><span>'+s+'</span><em>a definir</em></div>').join('')+'</div></section>';
 else body='<section class="panel ob-panel"><div class="panel-header"><div><h2>Solicitações de viagem</h2><p>'+all.length+' no total</p></div><div class="filter-chips">'+[['','Todas'],...Object.entries(VST)].map(([k,l])=>'<button class="filter-chip '+(V.vf===k?'active':'')+'" data-rh-vf="'+k+'">'+l+'</button>').join('')+'</div></div><div class="at-list">'+(fv.map(v=>viaCard(v,'rh')).join('')||'<p class="ob-p">Nenhuma solicitação.</p>')+'</div></section>';
 return intro('RH.','Viagens a aprovar e reservar, documentos de cada colaborador com validade e pendências. Dados pessoais: acesso restrito ao RH e à diretoria.','users')+'<div class="kpi-grid">'+kc('Viagens para reservar',String(R.via.filter(v=>v.st==='aprovada').length),'aprovadas pelo gestor',1)+kc('Aguardando gestor',String(R.via.filter(v=>v.st==='solicitada').length),'solicitações')+kc('Documentos vencidos',String(R.docs.filter(d=>validade(d)==='vencido').length),venc.length+' vencendo em 30 dias')+kc('Pessoas com pendência',String(falta.length),'documentos obrigatórios')+'</div>'+tabs+body;}

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),act=document.querySelector('.heading-actions');if(on){if(!('n' in chrome))chrome.n=notice?notice.innerHTML:'';if(notice)notice.innerHTML='<strong>RH.</strong> Pedidos e documentos ficam neste navegador. Documentos pessoais exigem login e banco protegido antes do uso real (LGPD).';if(act)act.style.visibility='hidden';}else if('n' in chrome){if(notice)notice.innerHTML=chrome.n;if(act)act.style.visibility='';delete chrome.n;}}
function nav(cur){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id===cur?'active':'')+'" title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}
const prevRender=render;
render=function(){const [v,a]=location.hash.slice(1).split('/'),u=me();
 if((v==='rh'||v==='meurh')&&u){if(v==='rh')V.tab=a||V.tab;else V.mtab=a||V.mtab;setChrome(true);nav(v);document.getElementById('breadcrumb').textContent=v==='rh'?'RH':'Meu RH';document.getElementById('page-title').innerHTML=(v==='rh'?'RH':'Meu RH')+'<span>.</span>';document.getElementById('page-subtitle').textContent=v==='rh'?'Viagens, documentos e pendências da equipe.':'Viagens e documentos.';const c=document.getElementById('view');c.innerHTML=v==='rh'?pageRH():meuRH();c.className='fade-in';return;}
 setChrome(false);prevRender();};

/* ---------- eventos (prefixo rh-) ---------- */
const on=()=>/^#(rh|meurh)/.test(location.hash);
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
let arq=null;
document.addEventListener('change',e=>{const t=e.target;if(!on())return;if(t.id==='rh-file'){arq=t.files[0]||null;const s=document.getElementById('rh-fname');if(s)s.textContent=arq?arq.name+' · '+Math.round(arq.size/1024)+' KB':'Escolher arquivo';return;}if(t.id==='rh-uf'){V.uf=t.value;refresh();}});
document.addEventListener('submit',async e=>{const f=e.target;if(!on()||!['rh-via','rh-doc'].includes(f.id))return;e.preventDefault();const g=k=>f.elements[k]?String(f.elements[k].value).trim():'',er=m=>{f.querySelector('.cad-err').textContent=m;},u=me(),n=NU();
 if(f.id==='rh-via'){if(!g('destino')||!g('ida')||!g('volta')||!g('motivo'))return er('Preencha destino, datas e motivo.');if(g('volta')<g('ida'))return er('A volta não pode ser antes da ida.');const ad=num(g('adiant'));
  R.seq.v++;const v={id:'VIA-'+String(R.seq.v).padStart(4,'0'),uid:u.id,destino:g('destino'),ida:g('ida'),volta:g('volta'),motivo:g('motivo'),cc:g('cc'),trans:g('trans'),adiant:ad>0?ad:0,hosp:f.elements.hosp.checked,obs:g('obs'),st:'solicitada',em:hoje(),hist:[]};const gs=gestorDe(u);if(!gs.length){v.st='aprovada';v.hist.push({t:hoje(),nome:'Sistema',st:'aprovada',com:'sem gestor acima: direto ao RH'});}R.via.push(v);save();
  if(n){if(gs.length)n.notify(gs[0].id,{tipo:'tarefa',titulo:'Aprovar viagem de '+u.nome,texto:v.destino+' · '+br(v.ida)+' a '+br(v.volta)+' · '+v.motivo,link:'#meurh/aprovar'});else n.notify(rhTeam(),{tipo:'tarefa',titulo:'Viagem para reservar: '+u.nome,texto:v.destino+' · '+br(v.ida),link:'#rh/viagens'});}
  refresh();say('Viagem solicitada'+(gs.length?': '+gs[0].nome+' vai aprovar.':': enviada ao RH.'));return;}
 if(f.id==='rh-doc'){if(!arq)return er('Escolha o arquivo.');if(arq.size>8*1024*1024)return er('Arquivo maior que 8 MB. Reduza ou tire outra foto.');if(!/pdf|image/.test(arq.type))return er('Envie PDF ou imagem.');const uid=g('uid')||u.id;
  R.seq.d++;const id='DOC-'+String(R.seq.d).padStart(5,'0');try{if(!n)throw new Error();await n.files.put({id,blob:arq,mime:arq.type,nome:arq.name});}catch(err){R.seq.d--;return er('Não foi possível guardar o arquivo neste navegador.');}
  R.docs.push({id,uid,tipo:g('tipo'),val:g('val'),obs:g('obs'),nome:arq.name,size:arq.size,mime:arq.type,em:hoje(),por:u.id});save();arq=null;if(n&&uid===u.id)n.notify(rhTeam(),{tipo:'aviso',titulo:'Documento enviado: '+g('tipo'),texto:u.nome,link:'#rh/documentos',pop:false});refresh();say('Documento guardado.');}});
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t||!on())return;const d=t.dataset,u=me(),n=NU();
 if(d.rhVf!=null){V.vf=d.rhVf;refresh();return;}
 if(d.rhV){const v=R.via.find(x=>x.id===d.id);if(!v)return;let com='';if(d.rhV==='reprovada'&&!d.ok){const c=t.closest('.at-card');c.querySelectorAll('.at-com').forEach(x=>x.remove());c.insertAdjacentHTML('beforeend','<div class="at-com"><textarea id="rh-ct" rows="2" placeholder="Motivo da reprovação"></textarea><button class="button primary fn-sm" data-rh-v="reprovada" data-id="'+v.id+'" data-ok="1">Confirmar</button></div>');return;}
  if(d.ok){com=(document.getElementById('rh-ct')||{}).value||'';if(!com.trim()){say('Informe o motivo.');return;}}
  v.st=d.rhV;(v.hist=v.hist||[]).push({t:hoje(),uid:u.id,nome:u.nome,st:d.rhV,com});save();
  if(n){n.notify(v.uid,{tipo:'aviso',titulo:'Viagem '+VST[d.rhV].toLowerCase()+': '+v.destino,texto:com||br(v.ida)+' a '+br(v.volta),link:'#meurh/viagens',pop:d.rhV!=='cancelada'});if(d.rhV==='aprovada')n.notify(rhTeam(),{tipo:'tarefa',titulo:'Viagem para reservar: '+uNome(v.uid),texto:v.destino+' · '+br(v.ida)+' a '+br(v.volta)+(v.hosp?' · hospedagem':''),link:'#rh/viagens'});}
  if(d.rhV==='aprovada'&&v.adiant>0&&FIN()&&FIN().lancarExterno)FIN().lancarExterno({ref:v.id,orig:'rh',cat:'Despesas de campo',desc:'Adiantamento de viagem · '+uNome(v.uid)+' · '+v.destino,parte:uNome(v.uid),cc:v.cc||'',valor:v.adiant,data:hoje(),venc:v.ida,doc:v.id});
  refresh();say('Viagem: '+VST[d.rhV].toLowerCase()+'.'+(d.rhV==='aprovada'&&v.adiant>0?' Adiantamento lançado em contas a pagar.':''));return;}
 if(d.rhVer){const x=R.docs.find(y=>y.id===d.rhVer);if(!x||!n)return;try{const f=await n.files.get(x.id);if(!f||!f.blob)throw new Error();const url=URL.createObjectURL(f.blob);document.querySelectorAll('.pg-zoom').forEach(z=>z.remove());
  document.body.insertAdjacentHTML('beforeend','<div class="pg-zoom rh-view"><div class="rh-vbox">'+(x.mime.startsWith('image')?'<img src="'+url+'" alt="'+esc(x.tipo)+'">':'<iframe src="'+url+'" title="'+esc(x.nome)+'"></iframe>')+'</div><div class="rh-vact"><a class="cp-btn" href="'+url+'" download="'+esc(x.nome)+'">Baixar</a><button class="cp-btn alt" data-pg-zx>Fechar</button></div></div>');}catch(err){say('Arquivo não encontrado neste navegador.');}return;}
 if(d.rhDel){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';return;}R.docs=R.docs.filter(x=>x.id!==d.rhDel);save();try{await n.files.del(d.rhDel);}catch(err){}refresh();say('Documento excluído.');}});

window.ArmantRH={version:'1.0',state:R};
render();
})();
