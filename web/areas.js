/* Armant 360 · RH e PMOC no menu (extensão do painel)
   Carregar por último:  <script src="areas.js" defer></script>
   Páginas de escopo, ainda sem lançamento de dados: os módulos estão em levantamento. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const ic=n=>typeof icon==='function'?icon(n):'';
[['rh','RH','users'],['pmoc','PMOC','wrench']].forEach(n=>{const at=NAV.findIndex(x=>x[0]==='catalog');if(!NAV.some(x=>x[0]===n[0]))NAV.splice(at<0?NAV.length:at,0,n);});

const AREAS={
 rh:{crumb:'RH',title:'RH',sub:'Pessoas, documentos e alocação nas obras.',icon:'users',
  h2:'RH: quem está apto, onde e até quando.',p:'Ligar cada pessoa às obras (centros de custo), aos treinamentos obrigatórios e ao diário de presença. Sem colaborador apto e documentado, a equipe não entra na obra.',
  blocos:[['Cadastro de colaboradores','Função, equipe, empresa (Armant ou terceiro), contato de trabalho e situação.'],['Documentos e validade','ASO, NR-10, NR-35, NR-18, ficha de EPI e integração do cliente, com alerta de vencimento.'],['Alocação por obra','Quem está em cada centro de custo e em que período.'],['Presença e horas','Vem do Diário e presença da obra: dias trabalhados e horas por pessoa e por obra.'],['EPIs entregues','Entrega de EPI por pessoa, ligada ao estoque de materiais.'],['Terceiros','Equipe das subcontratadas do cadastro de fornecedores, com os mesmos documentos exigidos.']],
  links:[['#obra/presenca','Diário e presença da obra TJ-RS'],['#fornecedores','Fornecedores de serviço'],['#materiais/estoque','Estoque (EPIs)']],
  aviso:'RH guarda dados pessoais (LGPD). Precisa de login, acesso por perfil e banco protegido antes de receber dados reais. Não lançar CPF, endereço ou exames neste protótipo.'},
 pmoc:{crumb:'PMOC',title:'PMOC',sub:'Plano de manutenção, operação e controle dos sistemas de climatização.',icon:'wrench',
  h2:'PMOC: manutenção preventiva com prova.',p:'Controlar os contratos de manutenção de climatização: equipamentos de cada cliente, rotinas do plano, ordens de serviço, evidências e responsável técnico. O PMOC é exigido pela Lei 13.589/2018.',
  blocos:[['Contratos de manutenção','Cliente, locais atendidos, vigência, valor e SLA. Usa o cadastro de clientes.'],['Equipamentos por local','TAG, tipo, marca, modelo, capacidade, área atendida e data de instalação.'],['Plano de rotinas','Atividades mensais, trimestrais, semestrais e anuais por tipo de equipamento.'],['Ordens de serviço','Preventivas geradas pelo plano e corretivas abertas por chamado, com checklist e fotos.'],['Qualidade do ar e laudos','Análises periódicas e laudos anexados (os arquivos ficam no Drive da empresa).'],['Responsável técnico e ART','Engenheiro responsável, ART e relatório técnico por período.'],['Materiais e peças','Saída do estoque por OS, ligada ao contrato do cliente.'],['Indicadores','Preventivas no prazo, chamados no SLA e custo por equipamento.']],
  links:[['#clientes','Cadastro de clientes'],['#materiais/estoque','Estoque de materiais'],['#operations','Indicador "Preventivas no prazo" (fictício)']],
  aviso:'Obras entregues podem virar contrato de PMOC: os equipamentos instalados (por TAG) podem passar direto da obra para o plano de manutenção.'}};

function page(k){const A=AREAS[k];
 return '<div class="view-intro"><div><span class="ob-pill-real">em levantamento</span><h2>'+A.h2+'</h2><p>'+A.p+'</p></div>'+ic(A.icon)+'</div>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>O que este módulo vai ter</h2><p>Proposta para validar com a equipe. Nada aqui recebe dados ainda.</p></div><span class="count-pill">em definição</span></div><div class="cad-hub">'+A.blocos.map(([t,s])=>'<div class="cad-card off"><strong>'+t+'</strong><span>'+s+'</span><em>a definir</em></div>').join('')+'</div></section>'+
 '<div class="cad-two" style="margin-top:16px"><section class="panel ob-panel"><div class="panel-header"><div><h2>Já ligado no sistema</h2><p>O que o módulo vai reaproveitar</p></div></div><div class="cad-hub">'+A.links.map(([h,t])=>'<a class="cad-card" href="'+h+'"><strong>'+t+'</strong><em>Abrir '+ic('arrow')+'</em></a>').join('')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Atenção</h2><p>Antes de começar</p></div></div><p class="ob-alert warn">'+A.aviso+'</p><p class="ob-p cad-obs">As perguntas para desenhar este módulo estão no bloco de perguntas em aberto.</p></section></div>';}

const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),pill=document.querySelector('.demo-pill'),act=document.querySelector('.heading-actions');
 if(on){if(!('notice' in chrome)){chrome.notice=notice?notice.innerHTML:'';chrome.pill=pill?pill.innerHTML:'';}
  if(notice)notice.innerHTML='<strong>Módulo em levantamento.</strong> Esta página mostra o escopo proposto. Ainda não recebe dados.';
  if(pill)pill.innerHTML='<span></span> Em levantamento';if(act)act.style.visibility='hidden';}
 else if('notice' in chrome){if(notice)notice.innerHTML=chrome.notice;if(pill)pill.innerHTML=chrome.pill;if(act)act.style.visibility='';}}
function nav(cur){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';
 n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(cur===id?'active':'')+'" '+(cur===id?'aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}
const prevRender=render;
render=function(){const v=location.hash.slice(1).split('/')[0];
 if(AREAS[v]){const A=AREAS[v];setChrome(true);nav(v);document.getElementById('breadcrumb').textContent=A.crumb;document.getElementById('page-title').innerHTML=A.title+'<span>.</span>';document.getElementById('page-subtitle').textContent=A.sub;
  const c=document.getElementById('view');c.innerHTML=page(v);c.className='fade-in';return;}
 setChrome(false);prevRender();};
window.ArmantAreas={version:'1.0'};
render();
})();
