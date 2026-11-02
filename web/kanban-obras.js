/* Armant 360 · Kanban do status das obras (topo de Engenharia → Obras, rota #projects)
   Carregar depois de cadastros.js:  <script src="kanban-obras.js" defer></script>
   Colunas: Planejamento → Mobilização → Em execução → Entrega → Concluída.
   O status sai do avanço físico de cada obra; arrastar um cartão para outra coluna fixa o status à mão (salvo em a360kanban). */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const P=v=>(v*100).toLocaleString('pt-BR',{maximumFractionDigits:0})+'%';
const BRk=v=>v>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi':'R$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil';
const COLS=[['plan','Planejamento','orçamento aprovado, sem início'],['mob','Mobilização','início e canteiro'],['exec','Em execução','serviços e medições'],['ent','Entrega','testes, as built e termos'],['fim','Concluída','recebida pelo cliente']];
let FIX={};try{FIX=JSON.parse(localStorage.getItem('a360kanban')||'{}')||{};}catch(e){}
const gravar=()=>{try{localStorage.setItem('a360kanban',JSON.stringify(FIX));}catch(e){}};
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const auto=(adv,iniciou)=>adv==null?(iniciou?'mob':'plan'):adv>=0.999?'fim':adv>=0.85?'ent':adv>=0.08?'exec':iniciou||adv>0?'mob':'plan';
function nomeRO(cc){const C=window.ArmantCadastros,A=window.ArmantAcesso;const id=C&&C.roDe?C.roDe(cc):'';if(!id)return '';const u=A&&A.users?A.users().find(x=>x.id===id):null;return u?u.nome:id;}
/* todas as obras vêm da base única (demandas aprovadas): a real, os exemplos, as fictícias e as cadastradas */
function obras(){const L=[],C=window.ArmantCadastros,OB=window.ArmantObras,H=hoje();
 const dem=C&&C.demandas?C.demandas():[];
 dem.forEach((d,i)=>{let adv=null,href='#cc/'+d.cc,risco='';
  if(i===0&&OB&&OB.obra){adv=OB.EXT()/OB.obra.valor;href='#obra';}
  if(d.ficticia){const p=typeof PROJECTS!=='undefined'?PROJECTS.find(x=>x.id===d.cc):null;if(p){adv=p.advance/100;risco=p.status==='risk'?'Desvio de '+p.delay+' dias':'';}href=window.ArmantObrasDemo&&window.ArmantObrasDemo[d.cc]?'#obra/'+d.cc:'#cc/'+d.cc;}
  L.push({k:d.cc,nome:d.nome,sub:d.cc+(d.cidade?' · '+d.cidade+(d.uf?' · '+d.uf:''):''),href,adv,ini:d.inicio||'',iniciou:d.ficticia?true:!!(d.inicio&&d.inicio<=H),valor:+d.valor||0,ro:nomeRO(d.cc)||'',fic:!!d.ficticia,ex:!!d.exemplo,risco});});
 L.forEach(o=>{o.col=FIX[o.k]&&COLS.some(c=>c[0]===FIX[o.k])?FIX[o.k]:auto(o.adv,o.iniciou);o.manual=!!FIX[o.k];});return L;}
function cartao(o){return '<article class="kb-ob'+(o.risco?' risco':'')+'" draggable="true" data-kbo="'+esc(o.k)+'"><a href="'+o.href+'" class="kb-ob-t"><strong>'+esc(o.nome)+'</strong><small>'+esc(o.sub)+'</small></a>'+
 ((o.col==='plan'||o.col==='mob')&&!o.fic?'<small class="kb-ob-ini">'+(o.ini?'início '+o.ini.split('-').reverse().join('/'):'início a definir')+'</small>':'')+(o.adv!=null?'<div class="advance"><span class="advance-track"><span style="width:'+Math.min(100,o.adv*100)+'%"></span></span>'+P(o.adv)+'</div>':'<small class="kb-ob-sem">sem avanço lançado</small>')+
 '<div class="kb-ob-tags">'+(o.fic?'<b class="ob-tag-fict">fictícia</b>':o.ex?'<b class="ob-tag-real">exemplo real</b>':'<b class="ob-tag-real">obra real</b>')+(o.risco?'<span class="status risk">'+esc(o.risco)+'</span>':'')+(o.manual?'<button class="text-button kb-ob-auto" data-kbo-auto="'+esc(o.k)+'" title="Voltar ao status calculado pelo avanço">manual ✕</button>':'')+'</div>'+
 '<div class="kb-ob-pe"><span>'+(o.ro?'R.O.: '+esc(o.ro):'<em>sem R.O.</em>')+'</span><span>'+(o.valor?BRk(o.valor):'')+'</span></div>'+
 '<label class="kb-ob-mv"><span class="sr-only">Mudar status</span><select data-kbo-sel="'+esc(o.k)+'">'+COLS.map(c=>'<option value="'+c[0]+'"'+(c[0]===o.col?' selected':'')+'>'+c[1]+'</option>').join('')+'</select></label></article>';}
function quadro(){const L=obras();
 return '<section class="panel ob-panel kb-obras" id="kb-obras"><div class="panel-header"><div><h2>Status das obras</h2><p>'+L.length+' obra(s) · demanda aprovada entra em Planejamento; no dia do início passa a Mobilização e segue pelo avanço físico. Arraste o cartão (ou use a caixa no cartão) para ajustar à mão.</p></div><a class="button primary kb-dem" href="#demanda/nova" data-dem-obras>'+ic('upload')+'Inserir demanda aprovada</a></div>'+
 '<div class="kb-cols">'+COLS.map(([id,n,s])=>{const C=L.filter(o=>o.col===id);return '<div class="kb-col" data-kbc="'+id+'"><div class="kb-col-h"><strong>'+n+'</strong><span class="kb-n">'+C.length+'</span><small>'+s+'</small></div><div class="kb-col-b">'+(C.map(cartao).join('')||'<p class="kb-vazio">Nenhuma obra</p>')+'</div></div>';}).join('')+'</div></section>';}
const prevRender=render;
/* chave para alternar entre o kanban e o painel geral (indicadores e tabela), lembrada neste navegador */
let VISTA='kanban';try{VISTA=localStorage.getItem('a360obrasvista')==='painel'?'painel':'kanban';}catch(e){}
const chave=()=>'<div class="kb-vista" id="kb-vista"><span class="'+(VISTA==='painel'?'on':'')+'">Painel geral</span><button type="button" class="kb-sw" role="switch" aria-checked="'+(VISTA==='kanban')+'" aria-label="Mostrar o kanban das obras" data-kb-vista><i></i></button><span class="'+(VISTA==='kanban'?'on':'')+'">Kanban</span></div>';
render=function(){const r=prevRender();const v=location.hash.slice(1).split('/')[0];
 if(v==='projects'){const c=document.getElementById('view');if(c&&!c.querySelector('#kb-vista')){const intro=c.querySelector(':scope > .view-intro');
   const html=chave()+(VISTA==='kanban'?quadro():'');if(intro)intro.insertAdjacentHTML('afterend',html);else c.insertAdjacentHTML('afterbegin',html);}
  if(c)c.classList.toggle('kb-modo-kanban',VISTA==='kanban');}
 else{const c=document.getElementById('view');if(c)c.classList.remove('kb-modo-kanban');}
 return r;};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-kb-vista]');if(!b)return;VISTA=VISTA==='kanban'?'painel':'kanban';try{localStorage.setItem('a360obrasvista',VISTA);}catch(x){}render();});
const redesenha=()=>{const q=document.getElementById('kb-obras');if(q)q.outerHTML=quadro();};
function mover(k,col){const o=obras().find(x=>x.k===k);if(!o)return;if(col===auto(o.adv,o.iniciou))delete FIX[k];else FIX[k]=col;gravar();redesenha();say(o.nome+' → '+COLS.find(c=>c[0]===col)[1]+'.');}
let arrastando=null;
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-kbo]');if(!c)return;arrastando=c.dataset.kbo;c.classList.add('arr');try{e.dataTransfer.setData('text/plain',arrastando);e.dataTransfer.effectAllowed='move';}catch(x){}});
document.addEventListener('dragend',e=>{const c=e.target.closest&&e.target.closest('[data-kbo]');if(c)c.classList.remove('arr');document.querySelectorAll('.kb-col.over').forEach(x=>x.classList.remove('over'));arrastando=null;});
document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('[data-kbc]');if(!col||!arrastando)return;e.preventDefault();document.querySelectorAll('.kb-col.over').forEach(x=>x!==col&&x.classList.remove('over'));col.classList.add('over');});
document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('[data-kbc]');if(!col||!arrastando)return;e.preventDefault();const k=arrastando;arrastando=null;mover(k,col.dataset.kbc);});
document.addEventListener('change',e=>{const s=e.target;if(s.dataset&&s.dataset.kboSel)mover(s.dataset.kboSel,s.value);});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-kbo-auto]');if(!b)return;e.preventDefault();delete FIX[b.dataset.kboAuto];gravar();redesenha();say('Status voltou a ser calculado pelo avanço.');});
window.ArmantKanbanObras={version:'1.0',obras,colunas:COLS,mover};
})();
