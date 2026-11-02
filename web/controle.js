/* Armant 360 · Controle de obras (extensão do painel)
   Carregar depois de campo.js:  <script src="controle.js" defer></script>
   Operação & CSC → #controle: painel geral com as atividades de todas as obras juntas;
   #controle/<CC>: painel de uma obra, onde se definem as atividades a executar (da lista da demanda aprovada ou livres).
   Classificação: Urgente, Em andamento, Com restrição, Concluído e Atrasado (automático: passou do prazo sem concluir). */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{},NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null;
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
const itensDem=cc=>typeof CAD.itens==='function'?CAD.itens(cc):[];
const me=()=>AC()?AC().user():null;
const users=()=>AC()&&AC().users?AC().users():[];
const uNome=id=>{const u=users().find(x=>x.id===id);return u?u.nome:(id||'—');};

/* ---------- classificação ---------- */
const CLS=[['urgente','Urgente','prioridade máxima'],['atrasado','Atrasado','passou do prazo'],['restricao','Com restrição','depende de algo para seguir'],['andamento','Em andamento','sendo executada'],['concluido','Concluído','entregue']];
const CL=Object.fromEntries(CLS.map(([k,l])=>[k,l]));
const ESCOLHA=CLS.filter(c=>c[0]!=='atrasado'); // atrasado é automático
const efetiva=a=>a.cls==='concluido'?'concluido':(a.prazo&&a.prazo<hoje()?'atrasado':a.cls);

/* ---------- estado (salvo neste navegador; no servidor, chave a360ctrl) ---------- */
const S={at:[],seq:0};
try{const s=JSON.parse(localStorage.getItem('a360ctrl')||'null');if(s){S.at=Array.isArray(s.at)?s.at:[];S.seq=s.seq||0;}}catch(e){}
const save=()=>{try{localStorage.setItem('a360ctrl',JSON.stringify(S));return true;}catch(e){say('Não foi possível salvar neste navegador.');return false;}};
const byId=id=>S.at.find(x=>x.id===id);
const V={vista:'quadro',f:'',cc:'',resp:'',q:'',ed:null};
/* cada obra tem um R.O.: ele decide as atividades da obra (como a gestão de Operação & CSC e Obras) */
const roDe=cc=>typeof CAD.roDe==='function'?CAD.roDe(cc):'';
const gestor=()=>{const A=AC();return !A||A.can('operations')||A.can('projects');};
const souRO=cc=>!!(me()&&cc&&roDe(cc)===me().id);
const podeEditar=cc=>gestor()||souRO(cc);
const podeMudar=a=>podeEditar(a.cc)||(me()&&a.resp===me().id);
const CA=()=>window.ArmantCampo||null;
const campoDe=id=>CA()&&CA().tarefas?CA().tarefas(id):[];
/* quem gerencia (Operação & CSC ou Obras) vê tudo; os demais veem só as atividades em que são responsáveis */
const vis=()=>gestor()?S.at:S.at.filter(a=>souRO(a.cc)||(me()&&a.resp===me().id));
const hist=(a,t)=>{(a.hist=a.hist||[]).push({d:hoje(),t:t+(me()?' · '+me().nome:'')});};

function avisarResp(a,novo){const N=NU();if(!N||!a.resp)return;
 N.notify(a.resp,{tipo:'tarefa',email:true,titulo:(novo?'Nova atividade':'Atividade atribuída a você')+' · '+a.cc+': '+(a.titulo.length>70?a.titulo.slice(0,70)+'…':a.titulo),
  texto0:a.titulo,
  texto:[a.titulo.length>70?a.titulo:'',a.qtd?'Quantidade: '+qf(a.qtd)+(a.un?' '+a.un:''):'',a.inicio?'Início '+br(a.inicio):'',a.prazo?'Prazo '+br(a.prazo):'',CL[a.cls]].filter(Boolean).join(' · '),link:'#controle/'+a.cc});}

/* ---------- telas ---------- */
const intro=(t,p)=>'<div class="view-intro ob-intro"><div><span class="ob-pill-real">controle de obras</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic('check')+'</div>';
const chip=k=>'<span class="ct-chip ct-'+k+'">'+CL[k]+'</span>';
function filtrar(base){const q=norm(V.q);return base.filter(a=>(!V.f||efetiva(a)===V.f)&&(!V.resp||a.resp===V.resp)&&(!q||norm(a.titulo+' '+a.obs+' '+a.restricao+' '+a.cc+' '+uNome(a.resp)).includes(q)));}
const conta=L=>{const c={total:L.length};CLS.forEach(([k])=>c[k]=0);L.forEach(a=>c[efetiva(a)]++);return c;};
function kpis(L){const c=conta(L);return '<div class="kpi-grid ct-kpis">'+'<article class="kpi-card featured ct-k'+(V.f?'':' on')+'" data-ct-f=""><div class="kpi-top"><div class="kpi-label">Atividades</div></div><div class="kpi-number">'+c.total+'</div><p class="kpi-subtitle">'+(c.total?Math.round(c.concluido/c.total*100)+'% concluídas':'nenhuma ainda')+'</p></article>'+
 CLS.map(([k,l,s])=>'<article class="kpi-card ct-k ct-k-'+k+(V.f===k?' on':'')+'" data-ct-f="'+k+'" role="button" tabindex="0"><div class="kpi-top"><div class="kpi-label">'+l+'</div></div><div class="kpi-number">'+c[k]+'</div><p class="kpi-subtitle">'+s+'</p></article>').join('')+'</div>';}
function toolbar(cc){const rs=[...new Set(vis().filter(a=>!cc||a.cc===cc).map(a=>a.resp).filter(Boolean))];
 return '<div class="toolbar cad-tools ct-tools"><label class="search-field">'+ic('search')+'<input id="ct-q" type="search" placeholder="Buscar atividade, restrição ou pessoa" value="'+esc(V.q)+'"></label>'+
 (cc?'':'<select id="ct-cc" aria-label="Obra"><option value="">Todas as obras</option>'+demandas().map(d=>'<option value="'+d.cc+'"'+(V.cc===d.cc?' selected':'')+'>'+d.cc+' · '+esc(d.nome.slice(0,40))+'</option>').join('')+'</select>')+
 '<select id="ct-resp" aria-label="Responsável"><option value="">Todos os responsáveis</option>'+rs.map(id=>'<option value="'+esc(id)+'"'+(V.resp===id?' selected':'')+'>'+esc(uNome(id))+'</option>').join('')+'</select>'+
 '<div class="ct-seg" role="group" aria-label="Visualização"><button class="'+(V.vista==='quadro'?'on':'')+'" data-ct-vista="quadro">Quadro</button><button class="'+(V.vista==='lista'?'on':'')+'" data-ct-vista="lista">Lista</button></div></div>';}
function campoInfo(a){const T=campoDe(a.id),feitas=T.filter(t=>t.st==='feito').length;
 return (T.length?'<small class="ct-campo">'+ic('clipboard')+'No campo: '+T.length+' tarefa(s) · '+feitas+' feita(s) · última '+br(T[T.length-1].data)+'</small>':'')+(podeEditar(a.cc)&&a.cls!=='concluido'&&CA()?'<button class="text-button ct-mcampo" data-ct-campo="'+a.id+'">→ Mandar para o campo</button>':'');}
function card(a,geral){const k=efetiva(a),late=k==='atrasado';
 return '<article class="kb-card ct-card ct-b-'+k+'" draggable="'+(podeMudar(a)?'true':'false')+'" data-ct-id="'+a.id+'"><div class="ct-ch">'+(geral?'<a class="kb-cc" href="#controle/'+a.cc+'">'+a.cc+'</a>':'')+(late&&a.cls!=='andamento'?chip(a.cls):'')+'</div>'+
 '<strong title="'+esc(a.titulo)+'">'+esc(a.titulo)+'</strong>'+(a.qtd?'<small>'+qf(a.qtd)+' '+esc(a.un||'')+'</small>':'')+
 '<small>'+ic('users')+esc(uNome(a.resp))+'</small><small class="'+(late?'fn-neg':'')+'">'+(a.inicio?br(a.inicio)+' → ':'Prazo ')+br(a.prazo)+'</small>'+
 (a.cls==='restricao'&&a.restricao?'<p class="ct-rest">'+esc(a.restricao)+'</p>':'')+
 (podeMudar(a)?'<div class="ct-act"><select data-ct-cls="'+a.id+'" aria-label="Classificação">'+ESCOLHA.map(([v,l])=>'<option value="'+v+'"'+(a.cls===v?' selected':'')+'>'+l+'</option>').join('')+'</select>'+(podeEditar(a.cc)?'<button class="text-button" data-ct-ed="'+a.id+'">Editar</button>':'')+'</div>':'')+campoInfo(a)+'</article>';}
function quadro(L,geral){return '<div class="kb-board ct-board">'+CLS.map(([k,l,s])=>{const C=L.filter(a=>efetiva(a)===k);return '<section class="kb-col ct-col ct-col-'+k+'" data-ct-col="'+k+'"><header><div><strong>'+l+'</strong><small>'+s+'</small></div><span class="kb-n">'+C.length+'</span></header>'+(C.map(a=>card(a,geral)).join('')||'<p class="kb-empty">—</p>')+'</section>';}).join('')+'</div>';}
function lista(L,geral){return '<div class="table-wrap"><table class="ob-t"><thead><tr>'+(geral?'<th>Obra</th>':'')+'<th>Atividade</th><th class="ob-n">Qtd.</th><th>Responsável</th><th>Início</th><th>Prazo</th><th>Classificação</th><th></th></tr></thead><tbody>'+
 (L.map(a=>{const k=efetiva(a);return '<tr>'+(geral?'<td class="ob-nw"><a href="#controle/'+a.cc+'">'+a.cc+'</a></td>':'')+'<td class="ob-d">'+esc(a.titulo)+(a.cls==='restricao'&&a.restricao?'<small>Restrição: '+esc(a.restricao)+'</small>':'')+(a.obs?'<small>'+esc(a.obs)+'</small>':'')+'</td><td class="ob-n">'+(a.qtd?qf(a.qtd)+' '+esc(a.un||''):'—')+'</td><td class="ob-nw">'+esc(uNome(a.resp))+'</td><td class="ob-nw">'+br(a.inicio)+'</td><td class="ob-nw'+(k==='atrasado'?' fn-neg':'')+'">'+br(a.prazo)+'</td><td class="ob-nw">'+chip(k)+(k!==a.cls&&a.cls!=='andamento'?' '+chip(a.cls):'')+'</td><td class="ob-nw">'+(podeEditar(a.cc)&&a.cls!=='concluido'&&CA()?'<button class="text-button" data-ct-campo="'+a.id+'">Mandar ao campo</button> ':'')+(podeEditar(a.cc)?'<button class="text-button" data-ct-ed="'+a.id+'">Editar</button>':'')+'</td></tr>';}).join('')||'<tr><td colspan="8" class="ob-p">Nenhuma atividade neste filtro.</td></tr>')+'</tbody></table></div>';}
function porObra(){const ds=demandas().filter(d=>gestor()||souRO(d.cc)||vis().some(a=>a.cc===d.cc));return '<div class="table-wrap"><table class="ob-t ct-obras"><thead><tr><th>Obra</th><th>R.O.</th><th class="ob-n">Atividades</th>'+CLS.map(([k,l])=>'<th class="ob-n">'+l+'</th>').join('')+'<th>Concluído</th></tr></thead><tbody>'+
 ds.map(d=>{const L=vis().filter(a=>a.cc===d.cc),c=conta(L),p=c.total?Math.round(c.concluido/c.total*100):0;return '<tr><td class="ob-d"><a class="project-link" href="#controle/'+d.cc+'"><span><strong>'+d.cc+'</strong><small>'+esc(d.nome)+'</small></span></a></td><td class="ob-nw">'+(roDe(d.cc)?esc(uNome(roDe(d.cc))):'<span class="fn-neg">sem R.O.</span>')+'</td><td class="ob-n">'+c.total+'</td>'+CLS.map(([k])=>'<td class="ob-n'+(c[k]&&(k==='atrasado'||k==='urgente')?' fn-neg':'')+'">'+(c[k]||'·')+'</td>').join('')+'<td><div class="ct-bar"><span style="width:'+p+'%"></span></div><small>'+p+'%</small></td></tr>';}).join('')+'</tbody></table></div>';}
function form(a,cc){const e=!!a;a=a||{cc,cls:'andamento',inicio:hoje()};const its=itensDem(a.cc),us=users();
 return '<form id="ct-form" class="fr-form" data-id="'+(e?a.id:'')+'" novalidate><div class="ob-form">'+
 (cc||e?'<input type="hidden" name="cc" value="'+esc(a.cc)+'">':'<label class="ob-field cad-wide"><span>Obra <b class="cad-req">*</b></span><select name="cc">'+demandas().map(d=>'<option value="'+d.cc+'">'+d.cc+' · '+esc(d.nome.slice(0,40))+'</option>').join('')+'</select></label>')+
 (its.length?'<label class="ob-field cad-wide"><span>Da lista da demanda aprovada</span><select name="item" id="ct-item"><option value="">— atividade livre —</option>'+its.map(i=>'<option value="'+esc(i.id)+'"'+(a.item===i.id?' selected':'')+' data-t="'+esc(i.atividade)+'" data-q="'+(i.qtd||'')+'" data-u="'+esc(i.un||'')+'">'+esc((i.cod?i.cod+' · ':'')+i.atividade.slice(0,70))+'</option>').join('')+'</select><small>Escolha para preencher a atividade e a quantidade.</small></label>':'')+
 '<label class="ob-field cad-wide"><span>Atividade <b class="cad-req">*</b></span><input name="titulo" value="'+esc(a.titulo||'')+'" placeholder="Ex.: Instalar evaporadoras do 2º pavimento"></label>'+
 '<label class="ob-field"><span>Quantidade</span><input name="qtd" inputmode="decimal" value="'+(a.qtd?qf(a.qtd):'')+'"></label><label class="ob-field"><span>Unidade</span><input name="un" value="'+esc(a.un||'')+'" placeholder="UN, M, M²"></label>'+
 '<label class="ob-field cad-wide"><span>Responsável <b class="cad-req">*</b></span><select name="resp"><option value="">Selecione</option>'+us.map(u=>'<option value="'+u.id+'"'+(a.resp===u.id?' selected':'')+'>'+esc(u.nome)+' · '+esc(u.setor||'')+'</option>').join('')+'</select><small>A pessoa recebe aviso no app e por e-mail.</small></label>'+
 '<label class="ob-field"><span>Início</span><input name="inicio" type="date" value="'+esc(a.inicio||'')+'"></label><label class="ob-field"><span>Prazo <b class="cad-req">*</b></span><input name="prazo" type="date" value="'+esc(a.prazo||'')+'"></label>'+
 '<label class="ob-field cad-wide"><span>Classificação</span><select name="cls" id="ct-cls">'+ESCOLHA.map(([v,l])=>'<option value="'+v+'"'+(a.cls===v?' selected':'')+'>'+l+'</option>').join('')+'</select><small>Atrasado é automático: passou do prazo sem concluir.</small></label>'+
 '<label class="ob-field cad-wide ct-restf"'+(a.cls==='restricao'?'':' hidden')+'><span>Qual é a restrição? <b class="cad-req">*</b></span><textarea name="restricao" rows="2" placeholder="Ex.: aguardando liberação da área pela fiscalização">'+esc(a.restricao||'')+'</textarea></label>'+
 '<label class="ob-field cad-wide"><span>Observação</span><textarea name="obs" rows="2">'+esc(a.obs||'')+'</textarea></label></div>'+
 '<p class="cad-err" id="ct-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(e?'Salvar':'Adicionar atividade')+'</button>'+(e?'<button class="button outline" type="button" data-ct-x>Cancelar</button><button class="text-button" type="button" data-ct-del="'+a.id+'">Excluir</button>':'')+'</div></form>';}
/* Painel do R.O.: as obras em que a pessoa é R.O., o que está aberto e o que já foi para o campo */
const PR={u:''};
function painelRO(){const g=gestor(),uid=g&&PR.u?PR.u:(me()?me().id:''),ds=demandas().filter(d=>roDe(d.cc)===uid),ros=[...new Set(demandas().map(d=>roDe(d.cc)).filter(Boolean))],ordem={urgente:0,atrasado:1,restricao:2,andamento:3,concluido:4};
 const hojeT=CA()?CA().tarefas().filter(t=>t.data===hoje()&&ds.some(d=>d.cc===t.cc)):[];
 return '<a class="text-button ob-back" href="#controle">← Controle de todas as obras</a>'+intro('Painel do R.O.'+(uid?' · '+esc(uNome(uid)):'')+'.','Cada obra tem um R.O. Aqui ele vê as obras dele, decide as atividades a executar e manda para o campo as tarefas do dia.')+
 (g?'<div class="toolbar cad-tools ct-tools"><select id="ct-rou" aria-label="Ver o painel de"><option value="">Meu painel</option>'+ros.map(id=>'<option value="'+esc(id)+'"'+(PR.u===id?' selected':'')+'>'+esc(uNome(id))+'</option>').join('')+'</select></div>':'')+
 (ds.length?'<div class="kpi-grid ct-kpis ct-kpi4">'+[['Obras',ds.length,'em que é R.O.'],['Atividades abertas',S.at.filter(a=>ds.some(d=>d.cc===a.cc)&&a.cls!=='concluido').length,'a executar'],['Atrasadas',S.at.filter(a=>ds.some(d=>d.cc===a.cc)&&efetiva(a)==='atrasado').length,'passaram do prazo'],['No campo hoje',hojeT.length,hojeT.filter(t=>t.st==='feito').length+' feita(s)']].map(([a,b,c],i)=>'<article class="kpi-card'+(i?'':' featured')+'"><div class="kpi-top"><div class="kpi-label">'+a+'</div></div><div class="kpi-number">'+b+'</div><p class="kpi-subtitle">'+c+'</p></article>').join('')+'</div>'+
  ds.map(d=>{const L=S.at.filter(a=>a.cc===d.cc&&a.cls!=='concluido').sort((x,y)=>(ordem[efetiva(x)]-ordem[efetiva(y)])||String(x.prazo).localeCompare(String(y.prazo))),c=conta(S.at.filter(a=>a.cc===d.cc));
   return '<section class="panel ob-panel ct-ropanel"><div class="panel-header"><div><h2>'+d.cc+' · '+esc(d.nome)+'</h2><p>'+(c.total?CLS.map(([k,l])=>c[k]?l+' '+c[k]:'').filter(Boolean).join(' · '):'nenhuma atividade definida')+'</p></div><a class="button primary fn-sm" href="#controle/'+d.cc+'">Definir atividades</a></div>'+
   (L.length?lista(L,false):'<p class="ob-p">Nada aberto nesta obra. Defina as próximas atividades.</p>')+'</section>';}).join('')
 :'<section class="panel ob-panel"><p class="ob-p">'+(uid?esc(uNome(uid))+' ainda não é R.O. de nenhuma obra.':'Entre com seu usuário.')+' O R.O. é definido no Cadastro de Demanda Aprovada ou no painel da obra, no Controle de obras.</p></section>');}
function modalCampo(a){const us=users(),des=us.filter(u=>(u.obras||[]).includes(a.cc)),outros=us.filter(u=>!des.includes(u));
 document.querySelectorAll('.ct-modal').forEach(x=>x.remove());
 document.body.insertAdjacentHTML('beforeend','<div class="fn-drawer ct-modal"><div class="fn-dback" data-ct-mx></div><aside class="fn-dpanel"><header><h2>Mandar para o campo</h2><button class="icon-button" data-ct-mx aria-label="Fechar">'+ic('close')+'</button></header><div class="fn-dbody"><p class="area-note">'+esc(a.cc)+' · '+esc(a.titulo)+'</p>'+
 '<form id="ct-cform" class="fr-form" data-id="'+a.id+'" novalidate><div class="ob-form"><label class="ob-field"><span>Dia</span><input name="data" type="date" value="'+hoje()+'" min="'+hoje()+'"></label><label class="ob-field"><span>Hora</span><input name="hora" type="time"></label>'+
 '<label class="ob-field cad-wide"><span>Quem executa no campo <b class="cad-req">*</b></span><select name="resp"><option value="">Selecione</option>'+(des.length?'<optgroup label="Designados para '+esc(a.cc)+'">'+des.map(u=>'<option value="'+u.id+'">'+esc(u.nome)+'</option>').join('')+'</optgroup>':'')+'<optgroup label="Outras pessoas">'+outros.map(u=>'<option value="'+u.id+'">'+esc(u.nome)+'</option>').join('')+'</optgroup></select></label>'+
 '<label class="ob-field cad-wide"><span>Equipe (opcional, Ctrl+clique para mais de uma)</span><select name="equipe" multiple size="3">'+(window.ArmantAcesso?window.ArmantAcesso.users():[]).map(u=>'<option value="'+u.id+'">'+esc(u.nome)+'</option>').join('')+'</select></label>'+
 '<label class="ob-field"><span>Meta do dia</span><input name="qtd" inputmode="decimal" value="'+(a.qtd?qf(a.qtd):'')+'"></label><label class="ob-field"><span>Prioridade</span><select name="prio">'+['Normal','Alta','Urgente'].map(x=>'<option'+((efetiva(a)==='urgente'||efetiva(a)==='atrasado')&&x==='Urgente'?' selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label class="ob-field cad-wide"><span>Orientação para a equipe</span><textarea name="desc" rows="3">'+esc([a.obs,a.cls==='restricao'&&a.restricao?'Atenção: '+a.restricao:''].filter(Boolean).join('\n'))+'</textarea></label>'+
 '<label class="ob-check cad-wide"><input type="checkbox" name="foto" checked> Pedir foto ao concluir</label></div><p class="cad-err" id="ct-cerr" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">Programar no app de campo</button><button class="button outline" type="button" data-ct-mx>Cancelar</button></div></form></div></aside></div>');}
function geral(){const base=vis().filter(a=>!V.cc||a.cc===V.cc),L=filtrar(base);
 return intro('Controle de obras.','Todas as obras juntas: o que está urgente, em andamento, com restrição, concluído e atrasado. Clique em uma classificação para filtrar e em uma obra para definir as atividades dela.')+kpis(base)+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Por obra</h2><p>Cada obra tem um R.O., que define as atividades a executar</p></div><a class="button primary fn-sm" href="#controle/ro">'+ic('users')+'Painel do R.O.</a></div>'+porObra()+'</section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Atividades'+(V.f?' · '+CL[V.f]:'')+'</h2><p>'+L.length+' de '+base.length+'</p></div></div>'+toolbar()+(V.vista==='quadro'?quadro(L,true):lista(L,true))+'</section>';}
function obra(d){const base=vis().filter(a=>a.cc===d.cc),L=filtrar(base),its=itensDem(d.cc),ro=roDe(d.cc),us=users();
 return '<a class="text-button ob-back" href="#controle">← Controle de todas as obras</a>'+intro(d.cc+' · '+esc(d.nome)+'.','R.O. da obra: <b>'+(ro?esc(uNome(ro)):'não definido')+'</b>. O R.O. define as atividades a executar, com responsável, prazo e classificação, e manda para o campo. '+(its.length?its.length+' atividade(s) na lista da demanda aprovada para escolher.':'Dica: o superadmin pode cadastrar a lista de atividades da demanda (atividade, quantidade e valor) na ficha do centro de custo.'))+kpis(base)+
 (gestor()?'<section class="panel ob-panel ct-ro"><div class="panel-header"><div><h2>R.O. desta obra</h2><p>Quem decide as tarefas a executar</p></div><select id="ct-setro" data-cc="'+d.cc+'" aria-label="R.O. da obra"><option value="">— escolha o R.O. —</option>'+us.map(u=>'<option value="'+u.id+'"'+(u.id===ro?' selected':'')+'>'+esc(u.nome)+' · '+esc(u.setor||'')+'</option>').join('')+'</select></div></section>':'')+
 (podeEditar(d.cc)?'<details class="panel ob-panel ct-novo" id="ct-side"'+(V.ed||!base.length||V.abrir?' open':'')+'><summary class="panel-header"><div><h2>'+(V.ed?'Editar atividade '+esc(V.ed):'+ Nova atividade')+'</h2><p>'+(V.ed?'Altere e salve':'Atividade, quantidade, responsável, prazo e classificação')+'</p></div></summary>'+form(V.ed?byId(V.ed):null,d.cc)+'</details>':'<p class="area-note">Você pode mudar a classificação das atividades em que é responsável.</p>')+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Atividades'+(V.f?' · '+CL[V.f]:'')+'</h2><p>'+L.length+' de '+base.length+'</p></div><a class="button outline fn-sm" href="#cc/'+d.cc+'">Ficha do '+d.cc+'</a></div>'+toolbar(d.cc)+(V.vista==='quadro'?quadro(L,false):lista(L,false))+'</section>';}

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),act=document.querySelector('.heading-actions');if(on){if(!('n' in chrome))chrome.n=notice?notice.innerHTML:'';if(notice)notice.innerHTML='<strong>Controle de obras.</strong> Atividades por obra e o geral de todas as obras.';if(act)act.style.visibility='hidden';}else if('n' in chrome){if(notice)notice.innerHTML=chrome.n;if(act)act.style.visibility='';delete chrome.n;}}
function nav(){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id==='operations'?'active':'')+'" title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}
let ultimo='';
const prevRender=render;
render=function(){const [v,a]=location.hash.slice(1).split('/');
 if(v==='controle'&&a==='ro'){setChrome(true);nav();ultimo='ro';document.getElementById('breadcrumb').textContent='Operação & CSC · Controle de obras · Painel do R.O.';document.getElementById('page-title').innerHTML='Painel do R.O.<span>.</span>';document.getElementById('page-subtitle').textContent='Obras, atividades e tarefas do campo de cada R.O.';const c=document.getElementById('view');c.innerHTML=painelRO();c.className='fade-in';return;}
 if(v==='controle'){const d=a?demByCC(a):null;const chave=d?d.cc:'';if(chave!==ultimo){V.ed=null;V.f='';V.resp='';V.abrir=false;ultimo=chave;}
  setChrome(true);nav();document.getElementById('breadcrumb').textContent='Operação & CSC · Controle de obras'+(d?' · '+d.cc:'');document.getElementById('page-title').innerHTML='Controle de obras<span>.</span>';document.getElementById('page-subtitle').textContent=d?'Atividades a executar nesta obra.':'Geral de todas as obras.';
  const c=document.getElementById('view');c.innerHTML=d?obra(d):geral();c.className='fade-in';return;}
 setChrome(false);prevRender();
 const c=document.getElementById('view');
 if(v==='operations'){const q=c.querySelector('.mt-quick');if(q&&!c.querySelector('.mt-quick [href="#controle"]'))q.insertAdjacentHTML('afterbegin','<a class="cad-card ct-hub" href="#controle"><strong>Controle de obras</strong><span>Atividades por obra e o geral: urgentes, em andamento, com restrição, concluídas e atrasadas</span><em>Abrir '+ic('arrow')+'</em></a>');}
 if(v==='cc'&&a&&!c.querySelector('.ct-ccbtn')){const back=c.querySelector('.ob-back');if(back&&demByCC(a)){const L=vis().filter(x=>x.cc===a),k=conta(L);back.insertAdjacentHTML('afterend','<a class="button outline fn-sm ct-ccbtn" href="#controle/'+a+'">'+ic('check')+'Controle de obras · '+k.total+' atividade(s)'+(k.atrasado?' · '+k.atrasado+' atrasada(s)':'')+'</a>');}}};

/* ---------- eventos (prefixo ct-) ---------- */
const on=()=>location.hash.startsWith('#controle');
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
function mudarCls(a,cls){if(!a||!podeMudar(a)||a.cls===cls)return;if(cls==='restricao'&&!a.restricao){V.ed=a.id;refresh();say('Descreva a restrição e salve.');const f=document.getElementById('ct-form');if(f){f.elements.cls.value='restricao';f.querySelector('.ct-restf').hidden=false;f.elements.restricao.focus();}return;}
 const antes=a.cls;a.cls=cls;if(cls==='concluido')a.concl=hoje();else delete a.concl;hist(a,CL[antes]+' → '+CL[cls]);save();
 const N=NU(),u=me();if(N&&a.por&&u&&a.por!==u.id)N.notify(a.por,{tipo:'aviso',titulo:a.cc+' · '+a.titulo+': '+CL[cls].toLowerCase(),texto:u.nome+' mudou a classificação.',link:'#controle/'+a.cc,pop:false});
 refresh();say('Atividade: '+CL[cls]+'.');}
document.addEventListener('click',e=>{if(!on())return;const t=e.target.closest('[data-ct-f],[data-ct-vista],[data-ct-ed],[data-ct-x],[data-ct-del],[data-ct-campo],[data-ct-mx]');if(!t)return;const d=t.dataset;
 if(d.ctCampo){const a=byId(d.ctCampo);if(!a||!podeEditar(a.cc))return;if(!CA()||!CA().programar){say('App de campo indisponível.');return;}modalCampo(a);return;}
 if(d.ctMx!==undefined){document.querySelectorAll('.ct-modal').forEach(x=>x.remove());return;}
 if(d.ctF!=null){V.f=V.f===d.ctF?'':d.ctF;refresh();return;}
 if(d.ctVista){V.vista=d.ctVista;refresh();return;}
 if(d.ctEd){const a=byId(d.ctEd);if(!a)return;if(!location.hash.startsWith('#controle/'+a.cc)){V.ed=a.id;ultimo=a.cc;location.hash='#controle/'+a.cc;return;}V.ed=a.id;refresh();const s=document.getElementById('ct-side');if(s)s.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(d.ctX!==undefined){V.ed=null;refresh();return;}
 if(d.ctDel){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar exclusão';return;}const a=byId(d.ctDel);S.at=S.at.filter(x=>x.id!==d.ctDel);V.ed=null;save();refresh();say('Atividade excluída'+(a?': '+a.titulo:'')+'.');}});
document.addEventListener('toggle',e=>{if(e.target.id==='ct-side'&&!V.ed)V.abrir=e.target.open;},true);
document.addEventListener('keydown',e=>{if(!on()||(e.key!=='Enter'&&e.key!==' '))return;const k=e.target.closest&&e.target.closest('[data-ct-f]');if(k){e.preventDefault();k.click();}});
document.addEventListener('change',e=>{if(!on())return;const t=e.target;
 if(t.dataset.ctCls){mudarCls(byId(t.dataset.ctCls),t.value);return;}
 if(t.id==='ct-cc'){V.cc=t.value;refresh();return;}
 if(t.id==='ct-rou'){PR.u=t.value;refresh();return;}
 if(t.id==='ct-setro'){if(!gestor()||typeof CAD.setResp!=='function')return;CAD.setResp(t.dataset.cc,'ro',t.value);const N=NU();if(N&&t.value)N.notify(t.value,{tipo:'tarefa',email:true,titulo:'Você é o R.O. da obra '+t.dataset.cc,texto:'Defina as atividades a executar no Controle de obras.',link:'#controle/'+t.dataset.cc});refresh();say(t.value?uNome(t.value)+' agora é o R.O. de '+t.dataset.cc+'. Ele foi avisado.':'R.O. removido.');return;}
 if(t.id==='ct-resp'){V.resp=t.value;refresh();return;}
 if(t.id==='ct-cls'){const r=t.form.querySelector('.ct-restf');if(r)r.hidden=t.value!=='restricao';return;}
 if(t.id==='ct-item'){const o=t.selectedOptions[0],f=t.form;if(o&&o.value){if(!f.elements.titulo.value)f.elements.titulo.value=o.dataset.t;else if(f.elements.titulo.value!==o.dataset.t)f.elements.titulo.value=o.dataset.t;if(o.dataset.q&&!f.elements.qtd.value)f.elements.qtd.value=qf(+o.dataset.q);if(o.dataset.u&&!f.elements.un.value)f.elements.un.value=o.dataset.u;}}});
document.addEventListener('input',e=>{if(!on()||e.target.id!=='ct-q')return;V.q=e.target.value;const pos=e.target.selectionStart;refresh();const q=document.getElementById('ct-q');if(q){q.focus();q.setSelectionRange(pos,pos);}});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='ct-cform')return;e.preventDefault();const a=byId(f.dataset.id),g=n=>f.elements[n]?String(f.elements[n].value).trim():'',er=m=>{const p=document.getElementById('ct-cerr');if(p)p.textContent=m;};
 if(!a||!podeEditar(a.cc))return er('Sem permissão.');if(!g('resp'))return er('Escolha quem executa no campo.');if(!g('data')||g('data')<hoje())return er('Escolha hoje ou um dia futuro.');
 const q=num(g('qtd'));const t=CA().programar({cc:a.cc,titulo:a.titulo,desc:g('desc'),resp:g('resp'),equipe:[...f.elements.equipe.selectedOptions].map(o=>o.value),qtd:q>0?q:null,prio:g('prio'),data:g('data'),hora:g('hora'),foto:f.elements.foto.checked,atv:a.id,por:'R.O. '+(me()?me().nome:'')});
 if(!t)return er('Não foi possível salvar no app de campo.');hist(a,'mandada ao campo: '+uNome(g('resp'))+' em '+br(g('data')));save();document.querySelectorAll('.ct-modal').forEach(x=>x.remove());refresh();say('Tarefa '+t.id+' programada para '+uNome(g('resp'))+' em '+br(g('data'))+'. Aparece no app de campo.');});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='ct-form')return;e.preventDefault();const g=n=>f.elements[n]?String(f.elements[n].value).trim():'';const er=m=>{const p=document.getElementById('ct-err');if(p)p.textContent=m;};
 if(!podeEditar(g('cc')))return er('Só o R.O. desta obra e a gestão de Operação & CSC/Obras editam as atividades.');
 if(!g('cc')||!demByCC(g('cc')))return er('Escolha a obra.');if(!g('titulo'))return er('Informe a atividade.');if(!g('resp'))return er('Escolha o responsável.');if(!g('prazo'))return er('Informe o prazo.');
 if(g('inicio')&&g('prazo')<g('inicio'))return er('O prazo não pode ser antes do início.');
 const qtd=num(g('qtd'));if(g('qtd')&&!(qtd>0))return er('Quantidade inválida.');
 if(g('cls')==='restricao'&&!g('restricao'))return er('Descreva a restrição.');
 const o={cc:g('cc'),item:g('item'),titulo:g('titulo'),qtd:qtd>0?qtd:null,un:g('un'),resp:g('resp'),inicio:g('inicio'),prazo:g('prazo'),cls:g('cls')||'andamento',restricao:g('cls')==='restricao'?g('restricao'):'',obs:g('obs')};
 const id=f.dataset.id;let a=id?byId(id):null,novo=!a,trocou=false;
 if(a){trocou=a.resp!==o.resp;const antes=a.cls;Object.assign(a,o);if(antes!==o.cls)hist(a,CL[antes]+' → '+CL[o.cls]);else hist(a,'editada');if(o.cls==='concluido'&&!a.concl)a.concl=hoje();}
 else{S.seq++;a={id:'ATV-'+String(S.seq).padStart(4,'0'),criado:hoje(),por:me()?me().id:'',...o};hist(a,'criada');S.at.push(a);}
 if(!save())return;if(novo||trocou)avisarResp(a,novo);V.ed=null;if(novo)V.abrir=true;refresh();say(novo?'Atividade '+a.id+' criada. '+uNome(a.resp)+' foi avisado(a).':'Atividade salva.'+(trocou?' '+uNome(a.resp)+' foi avisado(a).':''));});
/* arrastar entre as colunas do quadro muda a classificação */
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-ct-id]');if(!c)return;e.dataTransfer.setData('text/ct',c.dataset.ctId);e.dataTransfer.effectAllowed='move';c.classList.add('drag');});
document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('[data-ct-col]');if(!col||col.dataset.ctCol==='atrasado')return;e.preventDefault();});
document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('[data-ct-col]');if(!col)return;const id=e.dataTransfer.getData('text/ct');if(!id)return;e.preventDefault();if(col.dataset.ctCol==='atrasado'){say('Atrasado é automático: ajuste o prazo ou conclua a atividade.');return;}mudarCls(byId(id),col.dataset.ctCol);});

window.ArmantControle={version:'1.0',state:S,atividades:cc=>S.at.filter(a=>!cc||a.cc===cc),classificacao:efetiva,CLASSES:CLS,save};
})();
