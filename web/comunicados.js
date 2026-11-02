/* Armant 360 · Gestão de comunicados (extensão do painel)
   Carregar depois de ro.js e antes de nucleo.js:  <script src="comunicados.js" defer></script>
   #comunicados  Recebidos: comunicados para mim, com "Li e estou ciente".
                 Enviar e Grupos (gestão): cria grupos no app (por setor, obra, nível ou pessoas escolhidas),
                 envia comunicados para um ou mais grupos e acompanha quem leu e quem deu ciente.
   Cada grupo vira uma conversa no Chat (grp:<id>). Comunicados aparecem no Dia a Dia e no App de campo.
   Estado salvo na chave a360com (no servidor, módulo a360com). */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{},NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const agora=()=>new Date().toISOString();
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const brt=t=>{if(!t)return '—';const d=new Date(t);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});};
const demandas=()=>typeof CAD.demandas==='function'?CAD.demandas():[];
const me=()=>AC()?AC().user():null;
const users=()=>AC()&&AC().users?AC().users():[];
const uNome=id=>{const u=users().find(x=>x.id===id);return u?u.nome:(id||'—');};
const SETORES=['Diretoria','Comercial','Operação & CSC','Engenharia','Suprimentos','Financeiro','RH','Frota','Almoxarifado','Manutenção (PMOC)','Campo'];
const PRIO=[['normal','Normal'],['importante','Importante'],['urgente','Urgente']];
const PL=Object.fromEntries(PRIO);

if(!NAV.some(x=>x[0]==='comunicados')){const at=NAV.findIndex(x=>x[0]==='chat');NAV.splice(at<0?NAV.length:at+1,0,['comunicados','Central da comunicação','sparkles']);}

/* ---------- estado ---------- */
const S={grp:[],com:[],seq:{g:0,c:0}};
try{const s=JSON.parse(localStorage.getItem('a360com')||'null');if(s){S.grp=Array.isArray(s.grp)?s.grp:[];S.com=Array.isArray(s.com)?s.com:[];S.seq={g:0,c:0,...(s.seq||{})};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360com',JSON.stringify(S));return true;}catch(e){say('Não foi possível salvar neste navegador.');return false;}};
/* gestão: nível 4 ou mais, RH ou Diretoria (o superadmin pode mudar a regra do módulo em Usuários e acessos) */
const gestor=()=>{const u=me();return !u||u.nivel>=4||['RH','Diretoria'].includes(u.setor);};
const grpById=id=>S.grp.find(g=>g.id===id);
function membros(g){if(!g)return [];const r=g.regra||{},us=users();
 return us.filter(u=>(g.pessoas||[]).includes(u.id)||(r.todos)||((r.setores||[]).includes(u.setor))||((r.obras||[]).some(cc=>(u.obras||[]).includes(cc)))||(r.nivel&&u.nivel>=r.nivel)).filter(u=>!(g.fora||[]).includes(u.id));}
const souMembro=(g,u)=>!!u&&membros(g).some(x=>x.id===u.id);
const meusGrupos=u=>S.grp.filter(g=>g.ativo!==false&&souMembro(g,u||me()));
const paraMim=c=>{const u=me();return !!u&&(c.para||[]).includes(u.id);};
const pendente=(c,u)=>c.ciente&&!(c.cientes||{})[u.id];
const regraTxt=g=>{const r=g.regra||{},p=[];if(r.todos)p.push('toda a empresa');if((r.setores||[]).length)p.push('setor: '+r.setores.join(', '));if((r.obras||[]).length)p.push('obra: '+r.obras.join(', '));if(r.nivel)p.push('nível '+r.nivel+' ou mais');if((g.pessoas||[]).length)p.push(g.pessoas.length+' pessoa(s) escolhida(s)');return p.join(' · ')||'sem regra';};

/* ---------- telas ---------- */
const V={aba:'recebidos',ed:null,ver:null,q:''};
const intro=(t,p)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">comunicados</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic('sparkles')+'</div>';
const abas=()=>'<div class="filter-chips co-tabs">'+[['recebidos','Recebidos'+(()=>{const n=recebidos().filter(c=>pendente(c,me())).length;return n?' ('+n+')':'';})()],...(gestor()?[['enviar','Enviar comunicado'],['enviados','Enviados'],['grupos','Grupos ('+S.grp.filter(g=>g.ativo!==false).length+')']]:[])].map(([k,l])=>'<button class="filter-chip'+(V.aba===k?' active':'')+'" data-co-aba="'+k+'">'+l+'</button>').join('')+'</div>';
const recebidos=()=>S.com.filter(paraMim).slice().reverse();
function cartao(c,full){const u=me(),li=(c.lidos||{})[u.id],ci=(c.cientes||{})[u.id],gs=(c.grupos||[]).map(id=>(grpById(id)||{}).nome||id).join(', ');
 return '<article class="co-card '+c.prio+(c.ciente&&!ci?' pend':'')+'" data-co-card="'+c.id+'"><header><div><span class="co-prio '+c.prio+'">'+PL[c.prio]+'</span><strong>'+esc(c.titulo)+'</strong><small>'+esc(uNome(c.de))+' · '+brt(c.em)+' · para '+esc(gs)+'</small></div></header><div class="co-txt">'+esc(c.texto).replace(/\n/g,'<br>')+'</div>'+
  '<footer>'+(c.ciente?(ci?'<span class="co-ok">✓ Ciente em '+brt(ci)+'</span>':'<button class="button primary fn-sm" data-co-ciente="'+c.id+'">Li e estou ciente</button>'):'<span class="co-mut">'+(li?'Lido em '+brt(li):'')+'</span>')+'</footer></article>';}
function pRecebidos(){const L=recebidos(),pend=L.filter(c=>pendente(c,me()));
 return (pend.length?'<p class="area-note co-alert">'+pend.length+' comunicado(s) aguardando o seu ciente.</p>':'')+(L.length?'<div class="co-list">'+L.map(c=>cartao(c)).join('')+'</div>':'<p class="area-note">Nenhum comunicado para você ainda.</p>');}
function grupoForm(g){const r=(g&&g.regra)||{},ds=demandas(),us=users();
 const chk=(name,vals,sel)=>'<div class="co-chks">'+vals.map(([v,l])=>'<label class="ob-check"><input type="checkbox" name="'+name+'" value="'+esc(v)+'"'+(sel.includes(v)?' checked':'')+'> '+esc(l)+'</label>').join('')+'</div>';
 return '<form id="co-gform" class="fr-form" data-id="'+(g?g.id:'')+'"><div class="ob-form"><label class="ob-field cad-wide"><span>Nome do grupo <b class="cad-req">*</b></span><input name="nome" value="'+esc(g?g.nome:'')+'" placeholder="Ex.: Equipe de campo TJ-RS, Segurança do trabalho"></label>'+
  '<label class="ob-field cad-wide"><span>Descrição</span><input name="desc" value="'+esc(g?g.desc||'':'')+'"></label>'+
  '<div class="ob-field cad-wide"><span>Quem entra automaticamente</span><label class="ob-check"><input type="checkbox" name="todos"'+(r.todos?' checked':'')+'> Toda a empresa</label></div>'+
  '<div class="ob-field cad-wide"><span>Por setor</span>'+chk('setores',SETORES.map(s=>[s,s]),r.setores||[])+'</div>'+
  '<div class="ob-field cad-wide"><span>Por obra (quem está designado na obra)</span>'+(ds.length?chk('obras',ds.map(d=>[d.cc,d.cc+' · '+String(d.nome||'').slice(0,40)]),r.obras||[]):'<small>Nenhuma obra cadastrada.</small>')+'</div>'+
  '<label class="ob-field"><span>Por nível (a partir de)</span><select name="nivel"><option value="">—</option>'+(AC()&&AC().NIVEIS?AC().NIVEIS:[]).map(([n,l])=>'<option value="'+n+'"'+(+r.nivel===n?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
  '<div class="ob-field cad-wide"><span>Pessoas escolhidas</span><input type="search" class="co-q" data-co-pq placeholder="Buscar pessoa">'+'<div class="co-chks co-pes">'+us.map(u=>'<label class="ob-check" data-co-pt="'+esc(norm(u.nome+' '+u.setor))+'"><input type="checkbox" name="pessoas" value="'+u.id+'"'+((g&&g.pessoas||[]).includes(u.id)?' checked':'')+'> '+esc(u.nome)+' <small>'+esc(u.setor||'')+'</small></label>').join('')+'</div></div>'+
  '<label class="ob-field cad-wide co-chat"><input type="checkbox" name="chat"'+(!g||g.chat!==false?' checked':'')+'> Criar conversa do grupo no Chat</label></div>'+
  '<p class="cad-err" id="co-gerr" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(g?'Salvar grupo':'Criar grupo')+'</button>'+(g?'<button class="text-button" type="button" data-co-gx>Cancelar</button>':'')+'</div></form>';}
function pGrupos(){const L=S.grp.filter(g=>g.ativo!==false),ed=V.ed?grpById(V.ed):null;
 return '<div class="ob-split"><div class="ob-main"><section class="panel ob-panel"><div class="panel-header"><div><h2>Grupos no app</h2><p>'+L.length+' grupo(s). Os membros são atualizados sozinhos pela regra (setor, obra, nível) e pelas pessoas escolhidas.</p></div></div>'+
  (L.length?'<div class="table-wrap"><table class="ob-t"><thead><tr><th>Grupo</th><th>Quem entra</th><th>Membros</th><th></th></tr></thead><tbody>'+L.map(g=>{const ms=membros(g);return '<tr><td class="ob-d"><strong>'+esc(g.nome)+'</strong>'+(g.desc?'<small>'+esc(g.desc)+'</small>':'')+'</td><td class="ob-d"><small>'+esc(regraTxt(g))+'</small></td><td class="ob-d"><details><summary>'+ms.length+' pessoa(s)</summary><small>'+ms.map(u=>esc(u.nome)).join(', ')+'</small></details></td><td class="ob-nw">'+(g.chat!==false?'<a class="text-button" href="#chat/grp:'+g.id+'">Chat</a> ':'')+'<button class="text-button" data-co-ged="'+g.id+'">Editar</button> <button class="text-button" data-co-gdel="'+g.id+'">Arquivar</button></td></tr>';}).join('')+'</tbody></table></div>':'<p class="area-note">Nenhum grupo ainda. Crie o primeiro ao lado: por exemplo "Equipe de campo" (setor Campo) ou "Obra CC-2026-001".</p>')+
  '</section></div><aside class="ob-side"><section class="panel ob-panel"><div class="panel-header"><div><h2>'+(ed?'Editar grupo':'Novo grupo')+'</h2></div></div>'+grupoForm(ed)+'</section></aside></div>';}
function pEnviar(){const L=S.grp.filter(g=>g.ativo!==false);
 if(!L.length)return '<p class="area-note">Crie um grupo primeiro (aba Grupos).</p>';
 return '<section class="panel ob-panel co-env"><div class="panel-header"><div><h2>Novo comunicado</h2><p>Vai para o Dia a Dia, para as notificações, para o chat do grupo e para o App de campo. Importante e urgente também saem por e-mail.</p></div></div><form id="co-cform" class="fr-form"><div class="ob-form">'+
  '<label class="ob-field cad-wide"><span>Título <b class="cad-req">*</b></span><input name="titulo" maxlength="120"></label>'+
  '<label class="ob-field cad-wide"><span>Texto <b class="cad-req">*</b></span><textarea name="texto" rows="6" maxlength="4000"></textarea></label>'+
  '<div class="ob-field cad-wide"><span>Para os grupos <b class="cad-req">*</b></span><div class="co-chks">'+L.map(g=>'<label class="ob-check"><input type="checkbox" name="grupos" value="'+g.id+'"> '+esc(g.nome)+' <small>('+membros(g).length+')</small></label>').join('')+'</div></div>'+
  '<label class="ob-field"><span>Prioridade</span><select name="prio">'+PRIO.map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label>'+
  '<label class="ob-field co-chat"><input type="checkbox" name="ciente" checked> Pedir "Li e estou ciente"</label></div>'+
  '<p class="cad-err" id="co-cerr" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Enviar comunicado</button></div></form></section>';}
function pEnviados(){const L=S.com.slice().reverse(),u=me();
 if(!L.length)return '<p class="area-note">Nenhum comunicado enviado.</p>';
 return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Enviados</h2><p>Quem leu e quem deu ciente</p></div></div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Comunicado</th><th>Para</th><th>Leram</th><th>Ciente</th><th></th></tr></thead><tbody>'+
  L.map(c=>{const n=(c.para||[]).length,li=Object.keys(c.lidos||{}).length,ci=Object.keys(c.cientes||{}).length,falta=(c.para||[]).filter(id=>c.ciente?!(c.cientes||{})[id]:!(c.lidos||{})[id]);
   return '<tr><td class="ob-d"><span class="co-prio '+c.prio+'">'+PL[c.prio]+'</span> <strong>'+esc(c.titulo)+'</strong><small>'+esc(uNome(c.de))+' · '+brt(c.em)+'</small></td><td class="ob-d"><small>'+esc((c.grupos||[]).map(id=>(grpById(id)||{}).nome||id).join(', '))+'</small></td><td class="ob-n">'+li+' / '+n+'</td><td class="ob-n">'+(c.ciente?ci+' / '+n:'—')+'</td><td class="ob-d">'+(falta.length?'<details><summary>'+falta.length+' pendente(s)</summary><small>'+falta.map(uNome).map(esc).join(', ')+'</small></details>'+(c.de===(u&&u.id)||gestor()?'<button class="text-button" data-co-cobrar="'+c.id+'">Lembrar pendentes</button>':''):'<span class="co-ok">✓ todos</span>')+'</td></tr>';}).join('')+'</tbody></table></div></section>';}

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),act=document.querySelector('.heading-actions');if(on){if(!('n' in chrome))chrome.n=notice?notice.innerHTML:'';if(notice)notice.innerHTML='<strong>Comunicados.</strong> Grupos no app e comunicados com confirmação de leitura.';if(act)act.style.visibility='hidden';}else if('n' in chrome){if(notice)notice.innerHTML=chrome.n;if(act)act.style.visibility='';delete chrome.n;}}
function nav(){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13',p=me()?recebidos().filter(c=>pendente(c,me())).length:0;n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id==='comunicados'?'active':'')+'"'+(id==='comunicados'?' aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+(id==='comunicados'&&p?'<span class="nav-count">'+p+'</span>':'')+'</a>').join('');}
function marcarLidos(){const u=me();if(!u)return;let m=false;recebidos().forEach(c=>{if(!(c.lidos||{})[u.id]){(c.lidos=c.lidos||{})[u.id]=agora();m=true;}});if(m)save();}
const prevRender=render;
render=function(){const [v]=location.hash.slice(1).split('/');
 if(v==='comunicados'){if(!gestor()&&V.aba!=='recebidos')V.aba='recebidos';setChrome(true);nav();
  document.getElementById('breadcrumb').textContent='Armant 360 · Central da comunicação';document.getElementById('page-title').innerHTML='Central da comunicação<span>.</span>';document.getElementById('page-subtitle').textContent='Grupos no app e comunicados com confirmação de leitura.';
  const c=document.getElementById('view');c.innerHTML=intro('Gestão de comunicados.','Crie grupos (por setor, obra, nível ou pessoas escolhidas) e envie comunicados. Cada pessoa recebe no Dia a Dia, nas notificações, no chat do grupo e no App de campo, e confirma com "Li e estou ciente".')+abas()+
   (V.aba==='grupos'?pGrupos():V.aba==='enviar'?pEnviar():V.aba==='enviados'?pEnviados():pRecebidos());c.className='fade-in';if(V.aba==='recebidos')marcarLidos();return;}
 setChrome(false);prevRender();
 /* App de campo: comunicados pendentes no topo da tela inicial */
 if(v==='campo'&&location.hash.replace(/\/$/,'')==='#campo'){const u=me(),main=document.querySelector('#view .cp-main');if(u&&main&&!main.querySelector('.co-cp')){const L=recebidos().filter(c=>pendente(c,u)||!(c.lidos||{})[u.id]).slice(0,3);
  if(L.length)main.insertAdjacentHTML('afterbegin','<section class="cp-card co-cp"><h2>📣 Comunicados</h2>'+L.map(c=>'<div class="co-cpi '+c.prio+'"><strong>'+esc(c.titulo)+'</strong><p>'+esc(c.texto.length>220?c.texto.slice(0,220)+'…':c.texto)+'</p>'+(c.ciente&&!(c.cientes||{})[u.id]?'<button class="cp-btn" data-co-ciente="'+c.id+'">Li e estou ciente</button>':'<button class="cp-link" data-co-lido="'+c.id+'">Ok, li</button>')+'</div>').join('')+'</section>');}}};

/* ---------- ações ---------- */
const on=()=>location.hash.startsWith('#comunicados');
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
function ciente(id){const c=S.com.find(x=>x.id===id),u=me();if(!c||!u||!paraMim(c))return;(c.cientes=c.cientes||{})[u.id]=agora();(c.lidos=c.lidos||{})[u.id]=c.lidos[u.id]||agora();save();refresh();say('Ciente registrado.');}
document.addEventListener('click',e=>{const t=e.target.closest('[data-co-ciente],[data-co-lido]');if(t){if(t.dataset.coCiente)ciente(t.dataset.coCiente);else{const c=S.com.find(x=>x.id===t.dataset.coLido),u=me();if(c&&u){(c.lidos=c.lidos||{})[u.id]=agora();save();refresh();}}return;}
 if(!on())return;const b=e.target.closest('[data-co-aba],[data-co-ged],[data-co-gdel],[data-co-gx],[data-co-cobrar]');if(!b)return;const d=b.dataset;
 if(d.coAba){V.aba=d.coAba;V.ed=null;refresh();return;}
 if(!gestor())return;
 if(d.coGed){V.ed=d.coGed;refresh();return;}
 if(d.coGx!==undefined){V.ed=null;refresh();return;}
 if(d.coGdel){if(b.dataset.confirm!=='1'){b.dataset.confirm='1';b.textContent='Confirmar';return;}const g=grpById(d.coGdel);if(g){g.ativo=false;save();refresh();say('Grupo '+g.nome+' arquivado. Os comunicados antigos continuam no histórico.');}return;}
 if(d.coCobrar){const c=S.com.find(x=>x.id===d.coCobrar);if(!c)return;const falta=(c.para||[]).filter(id=>c.ciente?!(c.cientes||{})[id]:!(c.lidos||{})[id]);const N=NU();if(N)N.notify(falta,{tipo:'destaque',email:true,titulo:'Lembrete: comunicado "'+c.titulo+'"',texto:c.ciente?'Leia e confirme com "Li e estou ciente".':'Leia o comunicado.',link:'#comunicados'});c.cobrado=(c.cobrado||0)+1;save();refresh();say('Lembrete enviado a '+falta.length+' pessoa(s).');}});
document.addEventListener('input',e=>{if(!on())return;const q=e.target.closest('[data-co-pq]');if(!q)return;const v=norm(q.value);q.parentElement.querySelectorAll('[data-co-pt]').forEach(l=>l.hidden=!!v&&!l.dataset.coPt.includes(v));});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='co-gform'&&f.id!=='co-cform')return;e.preventDefault();if(!gestor())return;const g=n=>f.elements[n]?String(f.elements[n].value||'').trim():'',all=n=>[...f.querySelectorAll('input[name="'+n+'"]:checked')].map(x=>x.value);
 if(f.id==='co-gform'){const er=m=>{document.getElementById('co-gerr').textContent=m;};if(!g('nome'))return er('Dê um nome ao grupo.');
  const regra={todos:f.elements.todos.checked,setores:all('setores'),obras:all('obras'),nivel:+g('nivel')||0},pessoas=all('pessoas');
  if(!regra.todos&&!regra.setores.length&&!regra.obras.length&&!regra.nivel&&!pessoas.length)return er('Escolha quem entra: setor, obra, nível ou pessoas.');
  if(S.grp.some(x=>x.ativo!==false&&norm(x.nome)===norm(g('nome'))&&x.id!==f.dataset.id))return er('Já existe um grupo com este nome.');
  let G=f.dataset.id?grpById(f.dataset.id):null;const novo=!G;
  if(!G){S.seq.g++;G={id:'GRP-'+String(S.seq.g).padStart(3,'0'),criado:agora(),por:me()?me().id:'',ativo:true};S.grp.push(G);}
  Object.assign(G,{nome:g('nome'),desc:g('desc'),regra,pessoas,chat:f.elements.chat.checked});save();
  const N=NU();if(novo&&N&&G.chat&&N.sendMsg)N.sendMsg('grp:'+G.id,'👥 Grupo "'+G.nome+'" criado por '+(me()?me().nome:'')+'.',true);
  V.ed=null;refresh();say((novo?'Grupo criado':'Grupo salvo')+': '+membros(G).length+' membro(s).');return;}
 const er=m=>{document.getElementById('co-cerr').textContent=m;};const gs=all('grupos');
 if(!g('titulo'))return er('Informe o título.');if(!g('texto'))return er('Escreva o comunicado.');if(!gs.length)return er('Escolha ao menos um grupo.');
 const para=[...new Set(gs.flatMap(id=>membros(grpById(id)).map(u=>u.id)))];if(!para.length)return er('Os grupos escolhidos não têm membros.');
 S.seq.c++;const c={id:'COM-'+String(S.seq.c).padStart(4,'0'),titulo:g('titulo'),texto:g('texto'),grupos:gs,para,prio:g('prio')||'normal',ciente:f.elements.ciente.checked,de:me()?me().id:'',em:agora(),lidos:{},cientes:{}};
 const u=me();if(u&&para.includes(u.id))c.lidos[u.id]=c.em;S.com.push(c);save();
 const N=NU();if(N){N.notify(para,{tipo:'destaque',email:c.prio!=='normal',titulo:(c.prio==='urgente'?'URGENTE · ':'')+'Comunicado: '+c.titulo,texto:c.texto.slice(0,180),link:'#comunicados',pop:c.prio!=='normal'});
  gs.forEach(id=>{const G=grpById(id);if(G&&G.chat!==false&&N.sendMsg)N.sendMsg('grp:'+id,'📣 Comunicado'+(c.prio!=='normal'?' ('+PL[c.prio].toLowerCase()+')':'')+': '+c.titulo+'\n'+c.texto+(c.ciente?'\nConfirme em Comunicados: "Li e estou ciente".':''),true);});}
 V.aba='enviados';refresh();say('Comunicado enviado a '+para.length+' pessoa(s).');});

window.ArmantComunicados={version:'1.0',state:S,grupos:()=>S.grp.filter(g=>g.ativo!==false),grupo:grpById,membros:id=>membros(grpById(id)),meusGrupos,
 pendentes:u=>{u=u||me();return u?S.com.filter(c=>(c.para||[]).includes(u.id)&&pendente(c,u)):[];},ciente};
})();
