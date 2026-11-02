/* Armant 360 · Modo simples (carregar por último, depois de acesso.js)
   1ª tela: só botões grandes, um por setor. Cada setor abre botões grandes para as suas telas.
   Botão "Modo simples" no topo (ao lado da ajuda) troca entre o modo simples e o completo.
   Os botões aparecem só para quem tem acesso ao módulo (regras de Usuários e acessos). */
(function(){
'use strict';
if(typeof render!=='function'||typeof NAV==='undefined') return;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AC=()=>window.ArmantAcesso||null;
const logado=()=>!!(AC()&&AC().user&&AC().user());
const pode=m=>{const A=AC();return !A||!A.user||!A.user()?true:A.can(m);};
let simples=true;try{simples=localStorage.getItem('a360simples')!=='0';}catch(e){}
const gravar=v=>{simples=v;try{localStorage.setItem('a360simples',v?'1':'0');}catch(e){}};

/* setores e o que cada um abre: [atalho, nome, ícone, módulo que libera] */
const SETORES=[
 {id:'direcao',nome:'Direção',ic:'chart',botoes:[['#finance','Financeiro','wallet','finance'],['#timeline','Caixa e prazos','chart','timeline'],['#catalog','Indicadores','book','catalog']]},
 {id:'engenharia',nome:'Engenharia',ic:'building',botoes:[['#projects','Obras','building','projects'],['#controle','Atividades','check','controle'],['#ro','Menu do R.O.','clipboard','ro'],['#campo','Campo','users','campo'],['#fluxo','Fluxo de obras','layers','projects'],['#demanda/nova','Inserir demanda aprovada','upload','operations']]},
 {id:'comercial',nome:'Comercial',ic:'briefcase',botoes:[['#clientes','Clientes','users','commercial'],['#negociacoes','Negociações','layers','commercial'],['#commercial','Painel comercial','chart','commercial']]},
 {id:'orcamento',nome:'Orçamento',ic:'book',botoes:[['#operations','Demanda aprovada','layers','operations']]},
 {id:'rh',nome:'RH',ic:'users',botoes:[['#rh','Pessoas','users','rh'],['#meurh','Meu RH','users','meurh'],['#frota','Frota','truck','frota']]},
 {id:'operacional',nome:'Operacional',ic:'wrench',botoes:[['#pmoc','PMOC','wrench','pmoc']]},
 {id:'suprimentos',nome:'Suprimentos',ic:'truck',botoes:[['#compras','Compras','receipt','compras'],['#fornecedores','Fornecedores','building','operations'],['#listas','Listas','book','operations']]},
 {id:'almoxarifado',nome:'Almoxarifado',ic:'layers',botoes:[['#materiais/estoque','Estoque','layers','almox'],['#materiais/entrega','Saídas','truck','almox'],['#materiais/lancamento','Entrada','check','almox'],['#materiais/catalogo','Materiais','book','almox'],['#materiais/movs','Movimentações','receipt','almox']]}
];
const setorVisivel=s=>s.botoes.some(b=>pode(b[3]));
/* botão Voltar: volta à tela anterior; se não houver (link aberto direto), vai ao setor da tela ou ao Início */
const EXTRA={obra:'engenharia',fluxo:'engenharia',cc:'orcamento',demanda:'orcamento',doc:'engenharia',pmoc:'operacional'};
const SEM_BARRA=['','inicio','setor','overview','acesso-login'];
let passos=0,ultimoSetor='';
window.addEventListener('hashchange',()=>{passos++;const p=location.hash.slice(1).split('/');if(p[0]==='setor')ultimoSetor=p[1]||'';});
function setorDa(h){const p=h.slice(1).split('/'),v=p[0];if(ultimoSetor){const s=SETORES.find(x=>x.id===ultimoSetor);if(s&&s.botoes.some(b=>b[0].slice(1).split('/')[0]===v))return s;}
 return SETORES.find(s=>s.botoes.some(b=>b[0].slice(1).split('/')[0]===v))||SETORES.find(s=>s.id===EXTRA[v])||null;}
function barra(){const c=document.getElementById('view');if(!c||!logado())return;const v=location.hash.slice(1).split('/')[0];
 const tem=c.querySelector(':scope > .sx-nav');if(SEM_BARRA.includes(v)){if(tem)tem.remove();return;}if(tem)return;
 const s=setorDa(location.hash);
 c.insertAdjacentHTML('afterbegin','<nav class="sx-nav" aria-label="Navegação"><button class="sx-nav-b" data-sx-voltar data-alvo="'+(s&&simples?'#setor/'+s.id:'#overview')+'">← Voltar</button>'+(simples?(s?'<a class="sx-nav-l" href="#setor/'+s.id+'">'+esc(s.nome)+'</a>':'')+'<a class="sx-nav-l" href="#inicio">Início</a>':'')+'</nav>');}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sx-voltar]');if(!b)return;e.preventDefault();if(passos>0&&history.length>1){passos=Math.max(0,passos-2);history.back();}else location.hash=b.dataset.alvo||'#inicio';});
const botao=(h,n,i)=>'<a class="sx-btn" href="'+h+'"><span class="sx-ic">'+ic(i)+'</span><strong>'+esc(n)+'</strong></a>';

function telaInicio(){const vis=SETORES.filter(setorVisivel);
 return '<div class="sx-wrap"><div class="sx-grid sx-setores">'+(vis.length?vis.map(s=>'<a class="sx-btn sx-setor" href="#setor/'+s.id+'"><span class="sx-ic">'+ic(s.ic)+'</span><strong>'+esc(s.nome)+'</strong></a>').join(''):'<p class="sx-vazio">Você ainda não tem acesso a nenhum setor.</p>')+'</div></div>';}
function telaSetor(id){const s=SETORES.find(x=>x.id===id);if(!s||!setorVisivel(s))return '<div class="sx-wrap"><p class="sx-vazio">Setor não encontrado.</p><a class="sx-voltar" href="#inicio">← Início</a></div>';
 return '<div class="sx-wrap"><div class="sx-grid">'+s.botoes.filter(b=>pode(b[3])).map(b=>botao(b[0],b[1],b[2])).join('')+'</div><a class="sx-voltar" href="#inicio">← Início</a></div>';}

/* botão de troca de modo, ao lado da ajuda no topo */
function botaoModo(){const topo=document.querySelector('.topbar-right');if(!topo)return;let b=document.getElementById('sx-modo');
 if(!b){b=document.createElement('button');b.id='sx-modo';b.className='sx-modo';b.setAttribute('data-sx-modo','');topo.insertBefore(b,topo.firstChild);}
 b.textContent=simples?'Modo simples: ligado':'Modo simples: desligado';b.setAttribute('aria-pressed',simples?'true':'false');b.title=simples?'Clique para ver o menu completo':'Clique para usar só os botões grandes';}

/* menu lateral no modo simples: Início, Dia a Dia e Chat */
function menuSimples(){const n=document.getElementById('navigation');if(!n)return;
 const itens=[['#inicio','Início','grid',null],['#atribuidas','Dia a Dia','check','atribuidas'],['#comunicados','Central da comunicação','sparkles','comunicados'],['#banco','Banco de dados','layers','banco']];
 const h=(location.hash||'#inicio').split('/')[0];
 n.innerHTML=itens.filter(x=>!x[3]||pode(x[3])).map(([hr,l,i])=>'<a href="'+hr+'" class="nav-item'+(h===hr?' active':'')+'"'+(h===hr?' aria-current="page"':'')+'>'+ic(i)+'<span>'+l+'</span></a>').join('');}

/* menu completo: Central da comunicação logo abaixo do Dia a Dia */
{const i=NAV.findIndex(x=>x[0]==='comunicados');if(i>=0){const it=NAV.splice(i,1)[0];it[1]='Central da comunicação';const j=NAV.findIndex(x=>x[0]==='atribuidas');NAV.splice(j<0?NAV.length:j+1,0,it);}}
const prevRender=render;
render=function(){
 document.body.classList.toggle('sx-on',simples&&logado());
 botaoModo();
 if(!simples||!logado()){const r=prevRender();barra();return r;}
 const partes=location.hash.slice(1).split('/'),h=partes[0];
 /* só o início e os setores têm tela de botões; as demais telas seguem como estão */
 if(!(h===''||h==='inicio'||h==='setor'||h==='obras'||h==='suprimentos')){const r=prevRender();menuSimples();barra();return r;}
 if(h==='obras'){location.hash='#setor/engenharia';return;}
 if(h==='suprimentos'){location.hash='#setor/suprimentos';return;}
 const c=document.getElementById('view');if(!c)return prevRender();
 const t=document.getElementById('page-title'),b=document.getElementById('breadcrumb'),s=document.getElementById('page-subtitle');
 let titulo='Armant 360',cami='Início',corpo=telaInicio();
 if(h==='setor'){const sec=SETORES.find(x=>x.id===partes[1]);titulo=sec?sec.nome:'Setor';cami='Armant 360 / '+titulo;corpo=telaSetor(partes[1]);}
 if(t)t.innerHTML=esc(titulo)+'<span>.</span>';if(b)b.textContent=cami;if(s)s.textContent='';
 const cab=document.querySelector('.page-heading');if(cab)cab.style.display=(h===''||h==='inicio')?'none':'';
 const nota=document.querySelector('.demo-notice');if(nota)nota.style.display='none';
 const acoes=document.querySelector('.heading-actions');if(acoes)acoes.style.display='none';
 menuSimples();
 c.innerHTML=corpo;c.className='fade-in';
};

/* ao entrar (abrir o site, login ou ENTRAR DEMO) a pessoa cai no Início, e não no último endereço */
const ENTRADAS=['','#','#atribuidas','#overview'];
function irInicio(){if(simples&&logado()&&ENTRADAS.includes(location.hash))location.hash='#inicio';}
let entrando=false;
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#ac-entrar-demo,#ac-google'))entrando=true;},true);
document.addEventListener('submit',e=>{if(e.target&&e.target.id==='ac-login')entrando=true;},true);
window.addEventListener('hashchange',()=>{if(entrando&&logado()){entrando=false;setTimeout(irInicio,0);}});
window.addEventListener('load',()=>setTimeout(irInicio,300));

/* outros módulos podem redesenhar o topo e a barra lateral: o botão de modo volta a aparecer */
if(window.MutationObserver){let fila=null;new MutationObserver(()=>{if(fila)return;fila=setTimeout(()=>{fila=null;botaoModo();if(simples&&logado())document.body.classList.add('sx-on');barra();},50);}).observe(document.body,{childList:true,subtree:true});}

/* troca de modo: no simples vai para o início; no completo, para a visão geral */
document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('[data-sx-modo]'))return;gravar(!simples);location.hash=simples?'#inicio':'#overview';location.reload();});
window.addEventListener('load',()=>setTimeout(()=>{render();},0));
window.addEventListener('hashchange',()=>setTimeout(()=>{if(simples)render();},0));

window.ArmantSimples={version:'2.0',ligado:()=>simples,ligar:()=>{gravar(true);location.hash='#inicio';location.reload();},desligar:()=>{gravar(false);location.hash='#overview';location.reload();}};
})();
