/* Armant 360 · Cadastros (extensão do painel)
   Carregar depois de obras.js:  <script src="cadastros.js" defer></script>
   Comercial → Cadastro de clientes (#clientes). Operação & CSC → Cadastro de Demanda Aprovada (#demanda/nova),
   que gera o código do centro de custo (CC-AAAA-NNN). O código é o código da obra: a ficha #cc/<código> reúne tudo dela. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const OBRA=(window.ARMANT_OBRA_DATA||{}).obra;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const BRL=v=>v?'R$ '+nf(v):'—';
const br=iso=>iso?iso.split('-').reverse().join('/'):'—';
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const num=v=>{const s=String(v||'').replace(/[R$\s]/g,'');if(!s)return 0;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s)||0;};

/* ---------- listas ---------- */
const DOCS=['Boletim de medição','Memória de cálculo','Diário de obra (RDO)','Relatório fotográfico','Nota fiscal','Guias INSS/FGTS','Certidões negativas (CND)','ART/RRT','As built','Termo de recebimento'];
let origemObras=false;
document.addEventListener('click',e=>{const a=e.target.closest&&(e.target.closest('[data-dem-obras]')||(location.hash==='#setor/engenharia'&&e.target.closest('.sx-btn[href="#demanda/nova"]')));if(a)origemObras=true;else if(e.target.closest&&e.target.closest('#navigation a,.sx-btn'))origemObras=false;},true);
const APROV=['Contrato assinado','Ordem de serviço','Nota de empenho','Pedido de compra','E-mail de aprovação do cliente','Aprovação interna'];
const UFS='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const ETAPAS=['Orçamento aprovado','Planejamento','Execução','Medição e pagamento','Documentação','Entrega'];
const etp=d=>Math.min(ETAPAS.length-1,d.etapa==null?1:d.etapa);

/* ---------- estado (salvo neste navegador) ---------- */
const SEED_CLI={id:'CLI-001',seed:1,razao:'Tribunal de Justiça do Estado do Rio Grande do Sul',sigla:'TJ-RS',cnpj:'',tipo:'Público',esfera:'Estadual',segmento:'Judiciário',cidade:'Porto Alegre',uf:'RS',contato:'',cargo:'',email:'',fone:'',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:['Boletim de medição','Memória de cálculo','Diário de obra (RDO)','Relatório fotográfico','Nota fiscal'],obs:'Premissas de pagamento e retenções a confirmar (as mesmas do Perfil do cliente na obra).',criado:'2026-10-28'};
const SEED_DEM={cc:'CC-2026-001',seed:1,cli:'CLI-001',nome:OBRA?OBRA.nome:'Reforma da climatização · Foro Regional do Alto Petrópolis',cidade:'Porto Alegre',uf:'RS',end:'',orc:'',aprovDoc:'Contrato assinado',aprovNum:OBRA?OBRA.contrato:'075/2026DEC',aprovData:'',valor:OBRA?OBRA.valor:0,prazo:OBRA?OBRA.prazo:360,inicio:OBRA?OBRA.inicio:'',medicao:'Periódica',ro:'',csc:'',etapa:2,obs:'Obra real. Dados da planilha CRON (período 04). Data da aprovação a confirmar.',criado:'2026-10-28'};
const C={cli:[],dem:[],seq:{},itens:{},anexos:{},resp:{}};
try{const s=JSON.parse(localStorage.getItem('a360cad')||'null');if(s){C.cli=Array.isArray(s.cli)?s.cli:[];C.dem=Array.isArray(s.dem)?s.dem:[];C.seq=s.seq||{};if(Array.isArray(s.forn))C.forn=s.forn;if(Array.isArray(s.neg))C.neg=s.neg;if(s.itens&&typeof s.itens==='object')C.itens=s.itens;if(s.anexos&&typeof s.anexos==='object')C.anexos=s.anexos;if(s.resp&&typeof s.resp==='object')C.resp=s.resp;}}catch(e){}
const save=()=>{try{localStorage.setItem('a360cad',JSON.stringify(C));}catch(e){}};
/* exemplos de obra real (dados dos documentos enviados: orçamento do Banrisul e planilha de medição da CMPA).
   Ficam marcados como exemplo; não são lançamentos de contrato. Cadastre ou corrija pelo sistema. */
const SEED_CLI_EX=[
 {id:'CLI-002',seed:1,exemplo:1,razao:'Banco do Estado do Rio Grande do Sul S.A. (Banrisul)',sigla:'Banrisul',cnpj:'',tipo:'Estatal',esfera:'Estadual',segmento:'Financeiro',cidade:'Porto Alegre',uf:'RS',contato:'',cargo:'',email:'',fone:'',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:['Orçamento aprovado','Ficha de liberação de acesso','Laudo técnico','Relatório fotográfico'],obs:'Exemplo de obra real. Premissas de pagamento a confirmar.',criado:'2026-10-30'},
 {id:'CLI-003',seed:1,exemplo:1,razao:'Câmara Municipal de Porto Alegre',sigla:'CMPA',cnpj:'89.522.437/0001-07',tipo:'Público',esfera:'Municipal',segmento:'Legislativo',cidade:'Porto Alegre',uf:'RS',contato:'',cargo:'',email:'',fone:'',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:['Planilha de medição','Memória de cálculo','Diário de obra (RDO)','Relatório fotográfico','Nota fiscal'],obs:'Exemplo de obra real. Contrato nº 1120. Premissas a confirmar.',criado:'2026-10-30'}
];
const SEED_DEM_EX=[
 {cc:'CC-2026-002',seed:1,exemplo:1,cli:'CLI-002',nome:'Agência Vale do Sol · climatização (substituição de equipamento)',cidade:'Vale do Sol',uf:'RS',end:'Rua Augusto Emmel, Centro',orc:'ORC 26/450',aprovDoc:'E-mail de aprovação do cliente',aprovNum:'ORC 26/450',aprovData:'',valor:28297.38,prazo:0,inicio:'',medicao:'Periódica',ro:'',csc:'',etapa:2,obs:'Exemplo de obra real. Valor do orçamento R$ 28.297,38 (BDI 25%). Laudo técnico R02 assinado em 15/10/2026. Início e prazo a definir.',criado:'2026-10-30'},
 {cc:'CC-2026-003',seed:1,exemplo:1,cli:'CLI-003',nome:'Câmara Municipal de Porto Alegre · instalações mecânicas, elétricas e de automação',cidade:'Porto Alegre',uf:'RS',end:'',orc:'',aprovDoc:'Contrato assinado',aprovNum:'Contrato nº 1120',aprovData:'',valor:399946.56,prazo:48,inicio:'2026-07-23',medicao:'Periódica',ro:'',csc:'',etapa:2,obs:'Exemplo de obra real. Medição 03 (período 23/07 a 09/09/2026). Medições 01 e 02 já aprovadas.',criado:'2026-10-30'}
];
/* BASE ÚNICA DE OBRAS: toda obra (real, exemplo, fictícia ou cadastrada) é uma demanda aprovada com centro de custo.
   As 12 obras fictícias de demonstração entram aqui também (marcadas ficticia:1), com o código OB-0xx como centro de custo,
   para que Obras, Kanban, Controle de obras, Cronograma, Campo, Almoxarifado, Financeiro e Banco de dados leiam a mesma lista. */
const SEED_CLI_FIC={id:'CLI-900',seed:1,ficticia:1,razao:'Clientes fictícios (demonstração)',sigla:'Fictício',cnpj:'',tipo:'Privado',esfera:'',segmento:'Demonstração',cidade:'',uf:'',contato:'',cargo:'',email:'',fone:'',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30};
const SEED_DEM_FIC=(typeof PROJECTS!=='undefined'?PROJECTS:[]).map(p=>{const D=(window.ARMANT_OBRAS_DEMO||[]).find(x=>x.id===p.id),o=D?D.data.obra:{},cu=String(p.city||'').split(' · ');
 return {cc:p.id,seed:1,ficticia:1,cli:'CLI-900',nome:p.name,cidade:cu[0]||'',uf:cu[1]||'',end:'',orc:'',aprovDoc:'Contrato assinado',aprovNum:o.contrato||'',aprovData:o.inicio||'2026-01-02',valor:p.contract,prazo:o.prazo||0,inicio:o.inicio||'',medicao:'Periódica',ro:'',csc:'',etapa:2,obs:'Obra fictícia de demonstração (dados inventados).',criado:'2026-10-28'};});
const clientes=()=>[SEED_CLI,...SEED_CLI_EX,...(SEED_DEM_FIC.length?[SEED_CLI_FIC]:[]),...C.cli];
const demandas=()=>[SEED_DEM,...SEED_DEM_EX,...SEED_DEM_FIC,...C.dem];
const cliById=id=>clientes().find(c=>c.id===id);
const demByCC=cc=>demandas().find(d=>d.cc===cc);
/* R.O. e CSC de cada obra: pessoas cadastradas (id do usuário). Fonte única: C.resp[cc] (nunca na demanda) */
const pessoas=()=>{const A=window.ArmantAcesso;return A&&A.users?A.users():[];};
const pNome=id=>{const u=pessoas().find(x=>x.id===id);return u?u.nome:(id||'');};
const roDe=cc=>{const o=C.resp[cc];return o&&o.ro||'';};
const cscDe=cc=>{const o=C.resp[cc];return o&&o.csc||'';};
/* migração: R.O./CSC que estavam guardados dentro da demanda passam para C.resp (uma fonte só) */
C.dem.forEach(d=>{if(d.ro||d.csc){C.resp[d.cc]={...(C.resp[d.cc]||{}),...(d.ro?{ro:d.ro}:{}),...(d.csc?{csc:d.csc}:{})};delete d.ro;delete d.csc;}});
function setResp(cc,k,uid){C.resp[cc]={...(C.resp[cc]||{}),[k]:uid};save();}
const pessoaOpts=(v,rotulo)=>{const us=pessoas(),tem=us.some(u=>u.id===v);return [['','— '+rotulo+' —']].concat(v&&!tem?[[v,v+' (texto antigo)']]:[]).concat(us.map(u=>[u.id,u.nome+' · '+(u.setor||'')]));};
const cliNome=id=>{const c=cliById(id);return c?(c.sigla||c.razao):'—';};

/* código do centro de custo: CC-AAAA-NNN, sequencial por ano da aprovação; nunca muda depois de gerado */
function nextCC(data){const y=(data||hoje()).slice(0,4),seq=demandas().filter(d=>d.cc.slice(3,7)===y).map(d=>+d.cc.slice(8)).reduce((a,b)=>Math.max(a,b),C.seq[y]||0);return 'CC-'+y+'-'+String(seq+1).padStart(3,'0');}
function nextCli(){const n=clientes().map(c=>+c.id.slice(4)).reduce((a,b)=>Math.max(a,b),0);return 'CLI-'+String(n+1).padStart(3,'0');}
function cnpjOk(v){const d=String(v).replace(/\D/g,'');if(!d)return true;if(d.length!==14||/^(\d)\1+$/.test(d))return false;
 const dv=n=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=+d[i]*p--;if(p<2)p=9;}const r=s%11;return r<2?0:11-r;};return dv(12)===+d[12]&&dv(13)===+d[13];}
const cnpjFmt=v=>{const d=String(v).replace(/\D/g,'');return d.length===14?d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):v;};

/* ---------- campos de formulário ---------- */
const fld=(name,label,val,o={})=>'<label class="ob-field'+(o.wide?' cad-wide':'')+'"><span>'+label+(o.req?' <b class="cad-req">*</b>':'')+'</span>'+
 (o.opts?'<select name="'+name+'">'+(o.blank?'<option value="">'+o.blank+'</option>':'')+o.opts.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return '<option value="'+esc(v)+'"'+(String(val)===String(v)?' selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select>'
 :o.area?'<textarea name="'+name+'" rows="3">'+esc(val)+'</textarea>'
 :'<input name="'+name+'" type="'+(o.type||'text')+'" value="'+esc(val)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.step?' step="'+o.step+'" min="0"':'')+(o.id?' id="'+o.id+'"':'')+'>')+(o.hint?'<small>'+o.hint+'</small>':'')+'</label>';
const grp=(t,body)=>'<fieldset class="cad-grp"><legend>'+t+'</legend><div class="ob-form">'+body+'</div></fieldset>';
const dl=rows=>'<dl class="ob-dl">'+rows.map(([k,v])=>'<dt>'+k+'</dt><dd>'+(v===''||v==null?'—':v)+'</dd>').join('')+'</dl>';
const panel=(title,sub,body,act)=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+(act||'')+'</div>'+body+'</section>';

/* ---------- Clientes ---------- */
function cliTable(list){if(!list.length)return '<div class="empty-state"><p>Nenhum cliente encontrado.</p></div>';
 return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Cidade</th><th>Medição</th><th class="ob-n">Obras (CC)</th></tr></thead><tbody>'+
 list.map(c=>{const n=demandas().filter(d=>d.cli===c.id).length;return '<tr><td class="ob-code">'+c.id+'</td><td class="ob-d"><a class="project-link" href="#clientes/'+c.id+'"><span><strong>'+esc(c.sigla||c.razao)+'</strong><small>'+esc(c.sigla?c.razao:(c.cnpj?cnpjFmt(c.cnpj):''))+'</small></span></a></td><td class="ob-nw">'+esc(c.tipo)+(c.esfera?' <small>'+esc(c.esfera)+'</small>':'')+'</td><td class="ob-nw">'+esc(c.cidade)+(c.uf?'/'+esc(c.uf):'')+'</td><td class="ob-nw">'+esc(c.medicao)+' <small>'+esc(c.period||'')+'</small></td><td class="ob-n">'+n+'</td></tr>';}).join('')+'</tbody></table></div>';}
function cliList(){return intro('Clientes.','Quem contrata a Armant e como cada um aprova, mede e paga. O perfil do cliente define o fluxo de medição, os prazos e os documentos exigidos.','briefcase','#commercial','← Voltar ao Comercial')+
 panel('Cadastro de clientes',clientes().length+' cadastrados','<div class="toolbar cad-tools"><label class="search-field">'+ic('search')+'<input id="cad-q" type="search" placeholder="Buscar cliente, CNPJ ou cidade..." value="'+esc(Q.cli)+'"></label></div><div id="cad-res">'+cliTable(cliFilter())+'</div>','<a class="button primary" href="#clientes/novo">+ Novo cliente</a>');}
const Q={cli:''};
function cliFilter(){const q=norm(Q.cli);return clientes().filter(c=>!q||norm([c.id,c.razao,c.sigla,c.cnpj,cnpjFmt(c.cnpj),c.cidade].join(' ')).includes(q));}
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function cliForm(c){const e=!!c;c=c||{tipo:'Privado',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:['Boletim de medição','Nota fiscal']};
 return intro(e?'Editar cliente '+c.id+'.':'Novo cliente.','Campos com * são obrigatórios. O código do cliente é gerado ao salvar.','briefcase',e?'#clientes/'+c.id:'#clientes','← Cancelar')+
 '<form id="cad-cli" class="cad-formwrap" data-id="'+(e?c.id:'')+'" novalidate>'+
 grp('Identificação',fld('razao','Razão social',c.razao,{req:1,wide:1})+fld('sigla','Nome curto ou sigla',c.sigla,{ph:'Ex.: TJ-RS'})+fld('cnpj','CNPJ',c.cnpj?cnpjFmt(c.cnpj):'',{ph:'00.000.000/0000-00'})+fld('tipo','Tipo',c.tipo,{opts:['Público','Privado']})+fld('esfera','Esfera (se público)',c.esfera,{opts:[['','—'],'Federal','Estadual','Municipal']})+fld('segmento','Segmento',c.segmento,{ph:'Ex.: Judiciário, saúde, varejo'}))+
 grp('Localização',fld('cidade','Cidade',c.cidade)+fld('uf','UF',c.uf,{opts:UFS,blank:'—'}))+
 grp('Contato principal',fld('contato','Nome',c.contato)+fld('cargo','Cargo ou setor',c.cargo,{ph:'Ex.: fiscal do contrato'})+fld('email','E-mail',c.email,{type:'email'})+fld('fone','Telefone',c.fone,{type:'tel'}))+
 grp('Perfil de medição e pagamento',fld('medicao','Medição',c.medicao,{opts:['Periódica','Por execução']})+fld('period','Periodicidade',c.period,{opts:['Mensal','Quinzenal','Semanal','Por marco','—']})+fld('dia','Dia de fechamento',c.dia,{type:'number',step:1})+fld('aprov','Dias para aprovar a medição',c.aprov,{type:'number',step:1})+fld('pag','Dias para pagar após aprovação',c.pag,{type:'number',step:1})+fld('inss','Retenção INSS (% da mão de obra)',c.inss,{type:'number',step:'0.01'})+fld('iss','Retenção ISS (%)',c.iss,{type:'number',step:'0.01'})+fld('gar','Retenção de garantia (%)',c.gar,{type:'number',step:'0.01'})+
  '<div class="ob-field cad-wide"><span>Documentos exigidos na medição</span><div class="cad-checks">'+DOCS.map(d=>'<label class="ob-check"><input type="checkbox" name="docs" value="'+esc(d)+'"'+((c.docs||[]).includes(d)?' checked':'')+'> '+esc(d)+'</label>').join('')+'</div></div>')+
 grp('Observações',fld('obs','Observações',c.obs,{area:1,wide:1}))+
 '<p class="cad-err" id="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(e?'Salvar alterações':'Cadastrar cliente')+'</button><a class="button outline" href="'+(e?'#clientes/'+c.id:'#clientes')+'">Cancelar</a></div></form>';}
function cliFicha(c){const ds=demandas().filter(d=>d.cli===c.id);
 return intro(esc(c.sigla||c.razao)+'.',c.id+' · '+esc(c.razao)+(c.cnpj?' · CNPJ '+cnpjFmt(c.cnpj):''),'briefcase','#clientes','← Voltar aos clientes')+
 '<div class="cad-two">'+panel('Dados do cliente','',dl([['Código',c.id],['Razão social',esc(c.razao)],['CNPJ',c.cnpj?cnpjFmt(c.cnpj):'a preencher'],['Tipo',esc(c.tipo)+(c.esfera?' · '+esc(c.esfera):'')],['Segmento',esc(c.segmento)],['Cidade',esc(c.cidade)+(c.uf?'/'+esc(c.uf):'')],['Contato',esc(c.contato)+(c.cargo?' · '+esc(c.cargo):'')],['E-mail',esc(c.email)],['Telefone',esc(c.fone)]])+(c.obs?'<p class="ob-p cad-obs">'+esc(c.obs)+'</p>':''))+
 panel('Perfil de medição e pagamento','Base para o caixa previsto e o checklist da medição',dl([['Medição',esc(c.medicao)+' · '+esc(c.period)],['Fechamento','dia '+c.dia],['Aprovação da medição',c.aprov+' dias'],['Pagamento',c.pag+' dias após aprovação'],['Retenções','INSS '+nf(c.inss,0)+'% M.O. · ISS '+nf(c.iss,0)+'% · garantia '+nf(c.gar,0)+'%']])+'<div class="cad-docs">'+(c.docs||[]).map(d=>'<span class="cad-chip">'+ic('check')+esc(d)+'</span>').join('')+'</div>')+'</div>'+
 panel('Obras deste cliente',ds.length+' centro(s) de custo',ds.length?demTable(ds):'<p class="ob-p">Nenhuma demanda aprovada ainda.</p>','<a class="button primary" href="#demanda/nova/'+c.id+'">+ Demanda aprovada</a>')+
 (c.seed?'<p class="area-note">Cliente da obra real em acompanhamento. Para editar, ajuste o Perfil do cliente dentro da obra.</p>':'<div class="ob-actions"><a class="button outline" href="#clientes/'+c.id+'/editar">Editar cliente</a>'+(ds.length?'':'<button class="button outline" id="cad-delcli" data-id="'+c.id+'">Excluir cliente</button>')+'</div>');}

/* ---------- Demandas aprovadas / centros de custo ---------- */
function demTable(list){return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Centro de custo</th><th>Obra</th><th>Cliente</th><th>Aprovação</th><th class="ob-n">Valor</th><th>Etapa</th></tr></thead><tbody>'+
 list.map(d=>'<tr><td class="ob-code"><a class="cad-cc" href="#cc/'+d.cc+'">'+d.cc+'</a></td><td class="ob-d"><a class="project-link" href="#cc/'+d.cc+'"><span><strong>'+esc(d.nome)+'</strong><small>'+esc(d.cidade)+(d.uf?'/'+esc(d.uf):'')+(d.seed?' · <b class="ob-tag-real">obra real</b>':'')+'</small></span></a></td><td class="ob-nw">'+esc(cliNome(d.cli))+'</td><td class="ob-nw">'+esc(d.aprovDoc)+'<small>'+esc(d.aprovNum||'')+(d.aprovData?' · '+br(d.aprovData):'')+'</small></td><td class="ob-n">'+BRL(d.valor)+'</td><td class="ob-nw"><span class="status'+(d.seed?'':' ob-mute')+'">'+ETAPAS[etp(d)]+'</span></td></tr>').join('')+'</tbody></table></div>';}
function demList(){return panel('Demandas aprovadas · centros de custo','Toda obra entra aqui depois de aprovada. O código do centro de custo é o código da obra.',demTable(demandas()),'<a class="button primary" id="cad-btn-dem" href="#demanda/nova">+ Cadastro de Demanda Aprovada</a>');}
function demForm(d,preCli,neg){const e=!!d;d=d||{cli:preCli||'',nome:neg?neg.titulo:'',valor:neg?neg.valor:0,obs:neg?'Origem: negociação '+neg.id+'.':'',aprovDoc:'Contrato assinado',aprovData:hoje(),medicao:(cliById(preCli)||{}).medicao||'Periódica'};
 const cl=clientes();
 return intro(e?'Editar '+d.cc+'.':'Cadastro de Demanda Aprovada.',e?'O código do centro de custo não muda.':'Ao salvar, o sistema gera o código do centro de custo. Ele passa a ser o código da obra: andamento, medições, aditivos, compras, presença e documentos ficam ligados a ele.','layers',e?'#cc/'+d.cc:origemObras?'#projects':'#operations','← Cancelar')+
 '<form id="cad-dem" class="cad-formwrap" data-cc="'+(e?d.cc:'')+'" data-neg="'+(neg?neg.id:'')+'" novalidate>'+
 '<div class="cad-ccbox"><span>'+(e?'Centro de custo':'Código que será gerado')+'</span><strong id="cad-ccprev">'+(e?d.cc:nextCC(d.aprovData))+'</strong><small>'+(e?'Gerado em '+br(d.criado):'Formato CC-AAAA-NNN: ano da aprovação + sequência do ano.')+'</small></div>'+(e?'':diBox())+
 grp('Cliente','<label class="ob-field cad-wide"><span>Cliente <b class="cad-req">*</b></span><select name="cli"><option value="">Selecione o cliente</option>'+cl.map(c=>'<option value="'+c.id+'"'+(d.cli===c.id?' selected':'')+'>'+esc((c.sigla?c.sigla+' · ':'')+c.razao)+'</option>').join('')+'</select><small class="cad-hint">Não está na lista? <a href="#clientes/novo">Cadastre o cliente</a> em Comercial.</small></label>')+
 grp('Obra',fld('nome','Nome da obra',d.nome,{req:1,wide:1,ph:'Ex.: Climatização do bloco B'})+fld('cidade','Cidade',d.cidade)+fld('uf','UF',d.uf,{opts:UFS,blank:'—'})+fld('end','Endereço',d.end,{wide:1}))+
 grp('Aprovação',fld('orc','Nº do orçamento de origem',d.orc,{ph:'Ex.: ORC-2026-118'})+fld('aprovDoc','O que aprovou a demanda',d.aprovDoc,{opts:APROV})+fld('aprovNum','Nº do documento',d.aprovNum,{ph:'Contrato, OS, empenho ou pedido'})+fld('aprovData','Data da aprovação',d.aprovData,{type:'date',req:1,id:'cad-aprovdata'}))+
 grp('Contrato',fld('valor','Valor aprovado (R$)',d.valor?nf(d.valor):'',{ph:'0,00',hint:'Com BDI'})+fld('prazo','Prazo (dias)',d.prazo,{type:'number',step:1})+fld('inicio','Início previsto',d.inicio,{type:'date'})+fld('medicao','Medição',d.medicao,{opts:['Periódica','Por execução'],hint:'Vem do perfil do cliente; pode ser trocada nesta obra.'}))+
 grp('Responsáveis',fld('ro','Responsável pela obra (R.O.)',roDe(d.cc),{opts:pessoaOpts(roDe(d.cc),'escolha o R.O.'),hint:'O R.O. define no Controle de obras as atividades a executar e manda para o campo.'})+fld('csc','Responsável no CSC',cscDe(d.cc),{opts:pessoaOpts(cscDe(d.cc),'escolha o CSC')}))+
 grp('Observações',fld('obs','Observações',d.obs,{area:1,wide:1}))+
 '<p class="cad-err" id="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(e?'Salvar alterações':'Cadastrar e gerar centro de custo')+'</button><a class="button outline" href="'+(e?'#cc/'+d.cc:origemObras?'#projects':'#operations')+'">Cancelar</a></div></form>';}
function ccFicha(d){const c=cliById(d.cli)||{},et=etp(d),real=!!d.seed;
 const L=[['Andamento','andamento','Avanço físico por item e grupo'],['Lançar andamento','avanco','Quantidades entregues por período'],['Relatório de andamento','relatorio','Tempo × lançamento'],['Medição e faturamento','medicao','Boletim, retenções e líquido'],['Aditivos','aditivos','Acréscimos e supressões'],['Caixa previsto','caixa','Entradas das medições'],['Prazo','prazo','Término previsto'],['Diário e presença','presenca','Quem esteve na obra em cada dia'],['Compras e suprimentos',null,'Pedidos e fornecedores da obra'],['Notas fiscais e despesas',null,'NFs de entrada e despesas de campo'],['Documentos',null,'Contrato, ARTs, RDOs, fotos e as built']];
 return intro(d.cc+' · '+esc(d.nome)+'.',esc(c.sigla||c.razao||'—')+' · '+esc(d.aprovDoc)+(d.aprovNum?' '+esc(d.aprovNum):'')+' · '+BRL(d.valor)+(d.prazo?' · '+d.prazo+' dias':'')+(d.inicio?' · início '+br(d.inicio):''),'layers','#operations','← Voltar à Operação & CSC')+
 '<section class="panel ob-panel"><div class="ob-cycle ob-cycle6">'+ETAPAS.map((s,i)=>'<div class="ob-step '+(i<et?'done':i===et?'now':'')+'"><span class="no">'+String(i+1).padStart(2,'0')+'</span><b>'+s+'</b><span>'+(i<et?'concluída':i===et?'etapa atual':'a seguir')+'</span></div>').join('')+'</div></section>'+
 '<div class="cad-two">'+panel('Dados da demanda','',dl([['Centro de custo','<span class="cad-cc">'+d.cc+'</span>'],['Cliente',c.id?'<a href="#clientes/'+c.id+'">'+esc(c.sigla||c.razao)+'</a>':'—'],['Obra',esc(d.nome)],['Local',esc([d.end,d.cidade&&(d.cidade+(d.uf?'/'+d.uf:''))].filter(Boolean).join(' · '))],['Orçamento de origem',esc(d.orc)||'a vincular'],['Aprovação',esc(d.aprovDoc)+(d.aprovNum?' · '+esc(d.aprovNum):'')+(d.aprovData?' · '+br(d.aprovData):'')],['Valor aprovado',BRL(d.valor)],['Prazo',d.prazo?d.prazo+' dias':''],['Início previsto',br(d.inicio)],['Medição',esc(d.medicao)],['R.O.',esc(pNome(roDe(d.cc)))||'<a href="#controle/'+d.cc+'">definir no Controle de obras</a>'],['CSC',esc(pNome(cscDe(d.cc)))],['Cadastrado em',br(d.criado)]])+(d.obs?'<p class="ob-p cad-obs">'+esc(d.obs)+'</p>':''))+
 panel('Perfil do cliente nesta obra','Herdado do cadastro do cliente',c.id?dl([['Medição',esc(d.medicao)+' · '+esc(c.period)],['Fechamento','dia '+c.dia],['Aprovação + pagamento',c.aprov+' + '+c.pag+' dias'],['Retenções','INSS '+nf(c.inss,0)+'% M.O. · ISS '+nf(c.iss,0)+'% · garantia '+nf(c.gar,0)+'%']])+'<div class="cad-docs">'+(c.docs||[]).map(x=>'<span class="cad-chip">'+ic('check')+esc(x)+'</span>').join('')+'</div>':'<p class="ob-p">Cliente não encontrado.</p>')+'</div>'+
 itensPanel(d)+docsPanel(d)+
 panel('Tudo desta obra, ligado ao '+d.cc,real?'Obra em execução: abra cada parte do controle.':'Próximo passo: importar a planilha do orçamento (EAP com quantidades e preços) para liberar o andamento e a medição.','<div class="cad-hub">'+L.map(([t,tab,s])=>{const on=real&&tab;return on?'<a class="cad-card" href="#obra/'+tab+'"><strong>'+t+'</strong><span>'+s+'</span><em>Abrir '+ic('arrow')+'</em></a>':'<div class="cad-card off"><strong>'+t+'</strong><span>'+s+'</span><em>'+(real?'em definição':'aguardando EAP')+'</em></div>';}).join('')+'</div>')+
 (real?'<p class="area-note">Obra real cadastrada a partir da planilha CRON. Código provisório até a Armant confirmar o padrão de centro de custo.</p>':'<div class="ob-actions"><a class="button outline" href="#cc/'+d.cc+'/editar">Editar dados</a><button class="button outline" id="cad-deldem" data-cc="'+d.cc+'">Excluir cadastro</button></div>');}

/* ---------- Atividades da demanda aprovada (atividade, quantidade, valor): banco que só o superadmin altera ---------- */
const itens=cc=>Array.isArray(C.itens[cc])?C.itens[cc]:[];
const souSuper=()=>{const A=window.ArmantAcesso;if(!A)return true;const r=A.real?A.real():null;return !!r&&r.nivel>=6;};
const IV={ed:null};
function itensPanel(d){const L=itens(d.cc),sup=souSuper(),tot=L.reduce((a,i)=>a+(+i.valor||0),0),eap=d.seed&&window.ARMANT_OBRA_DATA&&window.ARMANT_OBRA_DATA.items||[];
 const row=(i)=>IV.ed===i.id&&sup?'<tr class="cad-itrow"><td class="ob-code">'+esc(i.id)+'</td><td><input class="cad-iin" data-it-f="atividade" value="'+esc(i.atividade)+'"></td><td><input class="cad-iin ob-n" data-it-f="qtd" inputmode="decimal" value="'+(i.qtd!=null?nf(i.qtd,Math.abs(i.qtd-Math.round(i.qtd))<1e-6?0:2):'')+'"></td><td><input class="cad-iin" data-it-f="un" value="'+esc(i.un||'')+'"></td><td><input class="cad-iin ob-n" data-it-f="valor" inputmode="decimal" value="'+(i.valor?nf(i.valor):'')+'"></td><td></td><td class="ob-nw"><button class="text-button" data-it-save="'+i.id+'">Salvar</button> <button class="text-button" data-it-cancel>Cancelar</button></td></tr>'
  :'<tr><td class="ob-code">'+esc(i.cod||i.id)+'</td><td class="ob-d">'+esc(i.atividade)+(i.grupo?'<small>'+esc(i.grupo)+'</small>':'')+'</td><td class="ob-n">'+(i.qtd!=null?nf(i.qtd,Math.abs(i.qtd-Math.round(i.qtd))<1e-6?0:2):'—')+'</td><td class="ob-nw">'+esc(i.un||'')+'</td><td class="ob-n">'+BRL(i.valor)+'</td><td class="ob-n">'+(i.qtd&&i.valor?BRL(i.valor/i.qtd):'—')+'</td>'+(sup?'<td class="ob-nw"><button class="text-button" data-it-ed="'+i.id+'">Editar</button> <button class="text-button" data-it-del="'+i.id+'">Excluir</button></td>':'')+'</tr>';
 return panel('Atividades da demanda aprovada',L.length+' atividade(s) · total '+BRL(tot)+(d.valor?' · '+nf(tot/d.valor*100,1)+'% do valor aprovado':'')+(sup?' · você pode cadastrar e alterar':' · só o superadmin altera esta lista'),
  '<div class="table-wrap"><table class="ob-t cad-itens"><thead><tr><th>Cód.</th><th>Atividade</th><th class="ob-n">Quantidade</th><th>Un.</th><th class="ob-n">Valor</th><th class="ob-n">Valor unit.</th>'+(sup?'<th></th>':'')+'</tr></thead><tbody>'+
  (L.map(row).join('')||'<tr><td colspan="7" class="ob-p">Nenhuma atividade cadastrada ainda.</td></tr>')+'</tbody>'+(L.length?'<tfoot><tr><td></td><td><strong>Total</strong></td><td></td><td></td><td class="ob-n"><strong>'+BRL(tot)+'</strong></td><td></td>'+(sup?'<td></td>':'')+'</tr></tfoot>':'')+'</table></div>'+
  (sup?'<form id="cad-it" class="cad-itform" data-cc="'+d.cc+'" novalidate><label class="ob-field cad-wide"><span>Atividade <b class="cad-req">*</b></span><input name="atividade" placeholder="Ex.: Instalação de evaporadora cassete"></label><label class="ob-field"><span>Quantidade <b class="cad-req">*</b></span><input name="qtd" inputmode="decimal" placeholder="0"></label><label class="ob-field"><span>Un.</span><input name="un" placeholder="UN"></label><label class="ob-field"><span>Valor (R$) <b class="cad-req">*</b></span><input name="valor" inputmode="decimal" placeholder="0,00"></label><div class="ob-actions"><button class="button primary" type="submit">+ Adicionar atividade</button></div><p class="cad-err" id="cad-iterr" role="alert"></p></form>'+
   '<details class="cad-itpaste"><summary>Colar do Excel</summary><p class="area-note">Uma linha por atividade: <b>atividade, quantidade, valor</b> (ou atividade, quantidade, unidade, valor), separados por tabulação ou ponto e vírgula.</p><textarea id="cad-itp" rows="5" placeholder="Instalação de evaporadora	12	18.400,00"></textarea><div class="ob-actions"><button class="button outline fn-sm" data-it-paste="'+d.cc+'">Adicionar as linhas</button>'+(eap.length&&!L.length?'<button class="button outline fn-sm" data-it-eap="'+d.cc+'">Trazer da EAP da obra ('+eap.length+' serviços)</button>':'')+'</div></details>':'')
 ,'<a class="button outline fn-sm" href="#controle/'+d.cc+'">'+ic('check')+'Controle de obras</a>');}
const nextIt=cc=>'IT-'+String(itens(cc).reduce((a,i)=>Math.max(a,+String(i.id).slice(3)||0),0)+1).padStart(3,'0');

/* ---------- Importar e-mail de aprovação (.eml) e planilha do orçamento (.xlsx) para o Cadastro de Demanda Aprovada ---------- */
const DI={itens:[],anexos:[],info:[],cliSug:''};
const diReset=()=>{DI.itens=[];DI.anexos=[];DI.info=[];DI.cliSug='';};
/* e-mail: cabeçalhos, partes MIME, base64 e quoted-printable */
function b64bytes(s){const b=atob(s.replace(/\s+/g,''));const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function qpBytes(s){s=s.replace(/=\r?\n/g,'');const out=[];for(let i=0;i<s.length;i++){if(s[i]==='='&&/^[0-9A-F]{2}$/i.test(s.substr(i+1,2))){out.push(parseInt(s.substr(i+1,2),16));i+=2;}else out.push(s.charCodeAt(i)&255);}return new Uint8Array(out);}
function dec(bytes,cs){try{return new TextDecoder(cs||'utf-8').decode(bytes);}catch(e){return new TextDecoder('utf-8').decode(bytes);}}
function hdrDecode(v){return String(v||'').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi,(m,cs,enc,tx)=>enc.toUpperCase()==='B'?dec(b64bytes(tx),cs):dec(qpBytes(tx.replace(/_/g,' ')),cs)).replace(/\s+/g,' ').trim();}
function mimeSplit(raw){const i=raw.search(/\r?\n\r?\n/);const head=i<0?raw:raw.slice(0,i),body=i<0?'':raw.slice(i).replace(/^\r?\n\r?\n/,'');const H={};head.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/).forEach(l=>{const k=l.indexOf(':');if(k>0)H[l.slice(0,k).trim().toLowerCase()]=l.slice(k+1).trim();});return {H,body};}
function textoPlano(raw){const {H,body}=mimeSplit(raw),ct=H['content-type']||'text/plain',bd=(ct.match(/boundary="?([^";]+)"?/i)||[])[1];
 if(/^multipart\//i.test(ct)&&bd){const partes=body.split('--'+bd).slice(1).filter(p=>!/^--/.test(p));let html='';for(const p of partes){const t=textoPlano(p.replace(/^\r?\n/,''));if(t&&t.plain)return t;if(t&&t.html&&!html)html=t.html;}return html?{plain:'',html}:null;}
 const cs=(ct.match(/charset="?([^";]+)"?/i)||[])[1]||'utf-8',te=(H['content-transfer-encoding']||'').toLowerCase();
 const bytes=te==='base64'?b64bytes(body):te==='quoted-printable'?qpBytes(body):new TextEncoder().encode(body);const tx=dec(bytes,cs);
 if(/^text\/plain/i.test(ct))return {plain:tx};if(/^text\/html/i.test(ct))return {html:tx.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')};return null;}
const brNum=s=>num(String(s||'').replace(/R\$/,''));
function lerEml(raw){const {H}=mimeSplit(raw),t=textoPlano(raw)||{},txt=(t.plain||t.html||'').replace(/\r/g,''),
 msg=txt.split(/\n(?:De|From):\s/)[0],de=hdrDecode(H.from),assunto=hdrDecode(H.subject).replace(/^((RES|RE|ENC|FW|FWD|TR)\s*:\s*)+/i,''),
 data=(()=>{const d=new Date(H.date||'');return isNaN(d)?'':new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);})(),
 pega=re=>{const m=msg.match(re);return m?m[1].trim():'';};
 return {de,assunto,data,dominio:(de.match(/@([\w.-]+)/)||[])[1]||'',orc:(assunto.match(/\b(\d{2}\/\d{2,5})\b/)||[])[1]||'',
  nome:assunto.replace(/^\s*\d{2}\/\d{2,5}\s*[-–·]?\s*/,'').trim(),valor:brNum(pega(/Valor\s+Total\s*:?\s*(R\$\s*[\d.]+,\d{2})/i)),
  contrato:pega(/Contrato\s*(?:n[º°o.]*)?\s*:?\s*([\d][\d./-]+)/i),local:pega(/Local\s*:\s*([^\n]+)/i),
  aprovou:/aprova(mos|do|da)/i.test(msg),pedeInicio:/data\s+de\s+in[ií]cio/i.test(msg),trecho:msg.replace(/\[cid:[^\]]+\]/g,'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).slice(0,4).join(' / ').slice(0,400)};}
/* planilha de orçamento: acha as colunas pelo cabeçalho (descrição, quantidade, unidade, custo total) */
function carregarXLSX(){return window.XLSX?Promise.resolve(window.XLSX):new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=()=>ko(new Error('Não foi possível carregar o leitor de planilhas.'));document.head.appendChild(s);});}
function lerOrc(rows,nomeArq){const S=v=>typeof v==='string'?v.trim():'',N=v=>typeof v==='number'?v:brNum(v),col={};const vota=(k,c)=>{(col[k]=col[k]||{})[c]=(col[k][c]||0)+1;};
 rows.forEach(r=>(r||[]).forEach((v,c)=>{const s=S(v).toUpperCase();if(!s||s.length>24)return;if(/^DESCRI/.test(s))vota('d',c);if(/^QUANT\.?\s*TOTAL/.test(s))vota('qt',c);else if(/^QUANT/.test(s))vota('q',c);if(/^UNID/.test(s))vota('u',c);if(/^(CUSTO|VALOR|PRE[ÇC]O)\s+TOTAL$|^TOTAL$/.test(s))vota('t',c);}));
 const melhor=k=>col[k]?+Object.entries(col[k]).sort((a,b)=>b[1]-a[1])[0][0]:-1,cd=melhor('d'),cq=melhor('qt')>=0?melhor('qt'):melhor('q'),cu=melhor('u'),ct=melhor('t');
 const info={itens:[],objeto:'',endereco:'',processo:'',total:0,bdi:'',data:''};let grupo='';
 rows.forEach(r=>{r=r||[];const linha=r.map(S).join(' ');
  const m1=linha.match(/OBJETO:\s*(.+?)(?:\s{2,}|Processo|$)/i);if(m1&&!info.objeto)info.objeto=m1[1].trim();
  const m2=linha.match(/ENDERE[ÇC]O DE EXECU[^:]*:\s*(.+?)(?:\s{2,}|BDI|$)/i);if(m2&&!info.endereco)info.endereco=m2[1].trim();
  const m3=linha.match(/Processo\s*n[º°o.]*\s*([\d./-]+)/i);if(m3&&!info.processo)info.processo=m3[1];
  r.forEach((v,c)=>{const s=S(v).toUpperCase();if(s==='BDI'){const x=r.slice(c+1).find(y=>typeof y==='number');if(x!=null)info.bdi=x<1?nf(x*100,0)+'%':nf(x,0)+'%';}
   if(/^DATA DA PROPOSTA/.test(s)){const x=r.slice(c+1).find(y=>y!=null&&y!=='');if(x instanceof Date)info.data=x.toISOString().slice(0,10);else if(typeof x==='number')info.data=new Date(Math.round((x-25569)*864e5)).toISOString().slice(0,10);}
   if(/^VALOR TOTAL/.test(s)){const x=r.slice(c+1).filter(y=>typeof y==='number').pop();if(x)info.total=x;}});
  if(cd<0)return;const d=S(r[cd]);if(!d||d.length<3)return;if(/^TOTAL/i.test(d)||/^QUANT/i.test(d))return;
  const q=N(r[cq]),t=N(r[ct]);if(!(q>0)||!(t>0)){if(!(q>0)&&!(t>0)&&/ITENS|SERVI[ÇC]OS|MATERIA|M[ÃA]O|GRUPO|^[IVX]+\b/i.test(d+' '+S(r[0])))grupo=d;return;}
  info.itens.push({cod:S(r[cd-1]!=null?String(r[cd-1]):'').trim(),atividade:d.replace(/\s+/g,' '),qtd:q,un:cu>=0?S(r[cu]):'',valor:Math.round(t*100)/100,grupo});});
 const m=String(nomeArq||'').match(/ORC[_\s-]*(\d{2})[_\s/-]+(\d{2,5})/i);info.orc=m?m[1]+'/'+m[2]:'';return info;}
/* PDF da aprovação (contrato, ordem de serviço, empenho, pedido): lê o texto e acha número, valor, prazo, início e data */
let pdfJs=null;
function carregarPDF(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);if(pdfJs)return pdfJs;pdfJs=new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=()=>{pdfJs=null;ko(new Error('Não consegui carregar o leitor de PDF (precisa de internet).'));};document.head.appendChild(s);});return pdfJs;}
async function textoPDF(buf){const lib=await carregarPDF(),doc=await lib.getDocument({data:buf}).promise,linhas=[];
 for(let i=1;i<=Math.min(doc.numPages,30);i++){const pg=await doc.getPage(i),tc=await pg.getTextContent(),by={};tc.items.forEach(it=>{if(!it.str.trim())return;const y=Math.round(it.transform[5]/3);(by[y]=by[y]||[]).push(it);});
  Object.keys(by).sort((a,b)=>b-a).forEach(y=>linhas.push(by[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(t=>t.str.trim()).join(' ')));}
 return linhas.join('\n');}
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const isoBR=(d,m,a)=>a+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const UFRE='(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)';
function lerAprovacao(txt){const flat=String(txt||'').replace(/\s+/g,' '),r={};const pega=(re,i=1)=>{const m=flat.match(re);return m?m[i].trim():'';};
 r.tipo=/ORDEM\s+DE\s+(SERVI[ÇC]O|IN[ÍI]CIO)/i.test(flat)?'Ordem de serviço':/NOTA\s+DE\s+EMPENHO/i.test(flat)?'Nota de empenho':/(PEDIDO|ORDEM)\s+DE\s+COMPRA/i.test(flat)?'Pedido de compra':/CONTRATO/i.test(flat)?'Contrato assinado':'';
 r.contrato=pega(/CONTRATO\s*(?:N[º°o.]*|N[ÚU]MERO)?\s*:?\s*(\d[\d./-]*\d(?:\s*[A-Z]{2,4}\b)?)/i);
 r.os=pega(/ORDEM\s+DE\s+(?:SERVI[ÇC]O|IN[ÍI]CIO)\s*(?:N[º°o.]*)?\s*:?\s*(\d[\d./-]*\d)/i);
 r.empenho=pega(/(?:NOTA\s+DE\s+)?EMPENHO\s*(?:N[º°o.]*)?\s*:?\s*(\d{2,}[\d./A-Z-]*)/i);
 r.processo=pega(/PROCESSO\s*(?:SEI|ADMINISTRATIVO)?\s*(?:N[º°o.]*)?\s*:?\s*(\d[\d./-]+\d)/i);
 const vals=[...flat.matchAll(/R\$\s*([\d.]{1,15},\d{2})/g)].map(m=>brNum(m[1])).filter(v=>v>0);
 const vg=flat.match(/valor\s+(?:global|total|do\s+contrato|contratual|estimado)[^R]{0,80}R\$\s*([\d.]+,\d{2})/i);
 r.valor=vg?brNum(vg[1]):vals.length?Math.max(...vals):0;
 const pz=flat.match(/prazo[^.]{0,140}?(\d{1,4})\s*(?:\([^)]{1,40}\)\s*)?dias/i);r.prazo=pz?+pz[1]:0;
 const ini=flat.match(/(?:in[íi]cio\s+(?:dos\s+servi[çc]os|da\s+obra|das\s+obras|da\s+execu[çc][ãa]o|previsto)?|a\s+partir\s+de|com\s+in[íi]cio\s+em)[^.]{0,60}?(\d{2})\/(\d{2})\/(\d{4})/i);
 if(ini)r.inicio=isoBR(ini[1],ini[2],ini[3]);else{const ie=flat.match(/(?:in[íi]cio[^.]{0,40}?|a\s+partir\s+de\s+)(\d{1,2})\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i);if(ie){const mi=MESES.findIndex(x=>norm(x)===norm(ie[2]));if(mi>=0)r.inicio=isoBR(ie[1],mi+1,ie[3]);}}
 r.aContar=/a\s+contar\s+d[ao]\s+(?:emiss[ãa]o|recebimento|assinatura|ordem)/i.test(flat);
 const ext=[...flat.matchAll(/([A-ZÀ-Ú][A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+){0,3}),\s*(\d{1,2})\s+de\s+([A-Za-zçÇãÃ]+)\s+de\s+(\d{4})/g)].map(m=>({cid:m[1],d:isoBR(m[2],MESES.findIndex(x=>norm(x)===norm(m[3]))+1,m[4]),ok:MESES.some(x=>norm(x)===norm(m[3]))})).filter(x=>x.ok);
 const nums=[...flat.matchAll(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/g)].map(m=>isoBR(m[1],m[2],m[3]));
 r.data=ext.length?ext[ext.length-1].d:nums.length?nums.sort().pop():'';
 r.cnpjs=[...new Set((flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)||[]))];
 r.objeto=pega(/OBJETO\s*(?:DO\s+CONTRATO)?\s*:?\s*[-–]?\s*(.{10,240}?)(?:\.\s|;|CL[ÁA]USULA|PAR[ÁA]GRAFO|$)/i).replace(/^(o\s+presente\s+contrato\s+tem\s+por\s+objeto\s+(a|o)\s+)/i,'');
 const cu=flat.match(new RegExp('([A-ZÀ-Ú][a-zà-ú]+(?:\\s+(?:d[aeo]s?\\s+)?[A-ZÀ-Ú][a-zà-ú]+){0,3})\\s*[/-]\\s*'+UFRE+'\\b'));if(cu){r.cidade=cu[1];r.uf=cu[2];}else if(ext.length){r.cidade=ext[ext.length-1].cid.split(' ').slice(-3).join(' ');}
 return r;}
const casaCliente=(dom,txt)=>{const t=norm(dom+' '+txt);return clientes().find(c=>{const ks=[c.sigla,c.razao,(c.email||'').split('@')[1]].filter(Boolean).map(x=>norm(x).split(/[\s.]+/)[0]).filter(k=>k&&k.length>=4);return ks.some(k=>t.includes(k));});};
function setF(f,n,v,force){const el=f.elements[n];if(!el||v==null||v==='')return false;if(el.value&&!force)return false;el.value=v;return true;}
function diResumo(){const el=document.getElementById('cad-direl');if(!el)return;const tot=DI.itens.reduce((a,i)=>a+i.valor,0);
 el.innerHTML=(DI.info.length?'<ul class="cad-dili">'+DI.info.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')+(DI.cliSug?'<p><button type="button" class="button outline fn-sm" data-di-cli="'+esc(DI.cliSug)+'">Cadastrar '+esc(DI.cliSug.split('.')[0].toUpperCase())+' como cliente e selecionar</button></p>':'')+(DI.itens.length?'<p class="area-note"><b>'+DI.itens.length+' atividade(s)</b> do orçamento, total '+BRL(tot)+', entram na lista da demanda ao salvar.</p>':'')+(DI.anexos.length?'<div class="cad-docs">'+DI.anexos.map(a=>'<span class="cad-chip">'+ic('file')+esc(a.nome)+'</span>').join('')+'</div>':'');}
async function diArquivos(files,f){const N=window.ArmantNucleo;
 for(const file of files){const nome=file.name,ext=(nome.split('.').pop()||'').toLowerCase();
  try{
   if(ext==='eml'){const e=lerEml(await file.text());let n=0;
    n+=setF(f,'aprovDoc','E-mail de aprovação do cliente',true)?1:0;n+=setF(f,'aprovNum',e.contrato,true)?1:0;n+=setF(f,'aprovData',e.data,true)?1:0;n+=setF(f,'orc',e.orc?'ORC '+e.orc:'')?1:0;
    n+=setF(f,'valor',e.valor?nf(e.valor):'')?1:0;n+=setF(f,'nome',e.nome||e.local)?1:0;
    const c=casaCliente(e.dominio,e.assunto+' '+e.local);if(c){f.elements.cli.value=c.id;n++;}else DI.cliSug=e.dominio;
    const obs=['Aprovado por e-mail: '+e.de+(e.data?' em '+br(e.data):'')+'.',e.trecho?'"'+e.trecho+'"':'',e.pedeInicio?'PENDÊNCIA: o cliente pediu a data de início do serviço.':''].filter(Boolean).join('\n');
    f.elements.obs.value=(f.elements.obs.value?f.elements.obs.value+'\n':'')+obs;
    DI.info.push('E-mail de '+esc(e.de)+(e.data?' ('+br(e.data)+')':'')+': '+n+' campo(s) preenchido(s)'+(e.valor?' · valor '+BRL(e.valor):'')+(e.contrato?' · contrato '+esc(e.contrato):'')+(c?' · cliente '+esc(c.sigla||c.razao):' · <b>cliente não encontrado</b> ('+esc(e.dominio||'?')+'): <a href="#clientes/novo">cadastre em Comercial</a>')+(e.pedeInicio?' · <b>o cliente pediu a data de início</b>':''));
    const ccPrev=document.getElementById('cad-ccprev');if(ccPrev&&!f.dataset.cc&&f.elements.aprovData.value)ccPrev.textContent=nextCC(f.elements.aprovData.value);}
   else if(ext==='xlsx'||ext==='xls'||ext==='xlsm'){const X=await carregarXLSX(),wb=X.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});let best=null;
    wb.SheetNames.forEach(sn=>{const o=lerOrc(X.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null}),nome);if(!best||o.itens.length>best.itens.length)best=o;});
    if(!best||!best.itens.length){DI.info.push(esc(nome)+': não encontrei as colunas de descrição, quantidade e custo total.');}
    else{DI.itens=best.itens;setF(f,'orc',best.orc?'ORC '+best.orc:'');setF(f,'valor',best.total?nf(best.total):'');setF(f,'aprovNum',best.processo);
     if(best.endereco){const p=best.endereco.split(',').map(x=>x.trim()),uf=(best.endereco.match(/\b([A-Z]{2})\b(?=[^A-Z]*$|,\s*Brasil)/)||[])[1]||'';setF(f,'end',p[0]);const cid=(p[1]||'').replace(/\s*-\s*[A-Z]{2}\b.*$/,'').trim();setF(f,'cidade',cid);if(uf&&UFS.includes(uf))setF(f,'uf',uf);}
     if(!f.elements.nome.value&&best.objeto)f.elements.nome.value=best.objeto.slice(0,90);
     f.elements.obs.value=(f.elements.obs.value?f.elements.obs.value+'\n':'')+['Orçamento '+(best.orc||nome)+(best.data?' de '+br(best.data):''),best.objeto?'Objeto: '+best.objeto:'',best.bdi?'BDI '+best.bdi:''].filter(Boolean).join(' · ')+'.';
     const tot=best.itens.reduce((a,i)=>a+i.valor,0);DI.info.push('Orçamento '+esc(nome)+': '+best.itens.length+' atividade(s), soma '+BRL(tot)+(best.total&&Math.abs(best.total-tot)>0.05?' <b>(o total da planilha é '+BRL(best.total)+')</b>':' · confere com o total da planilha'));}}
   else if(ext==='pdf'){const txt=await textoPDF(new Uint8Array(await file.arrayBuffer()));
    if(txt.replace(/\s/g,'').length<60)DI.info.push(esc(nome)+': o PDF não tem texto (parece escaneado). Guardado como documento; preencha os campos à mão.');
    else{const a=lerAprovacao(txt);let n=0;
     n+=setF(f,'aprovDoc',a.tipo,true)?1:0;n+=setF(f,'aprovNum',a.contrato||a.os||a.empenho,true)?1:0;n+=setF(f,'aprovData',a.data,true)?1:0;
     n+=setF(f,'valor',a.valor?nf(a.valor):'')?1:0;n+=setF(f,'prazo',a.prazo||'')?1:0;n+=setF(f,'inicio',a.inicio)?1:0;
     if(a.objeto)n+=setF(f,'nome',a.objeto.slice(0,90))?1:0;n+=setF(f,'cidade',a.cidade)?1:0;if(a.uf&&UFS.includes(a.uf))n+=setF(f,'uf',a.uf)?1:0;
     const c=clientes().find(x=>x.cnpj&&a.cnpjs.includes(x.cnpj));if(c&&!f.elements.cli.value){f.elements.cli.value=c.id;n++;}
     f.elements.obs.value=(f.elements.obs.value?f.elements.obs.value+'\n':'')+['Lido do PDF '+nome+'.',a.processo?'Processo '+a.processo+'.':'',a.objeto?'Objeto: '+a.objeto+'.':'',!a.inicio?'PENDÊNCIA: data de início não está no documento'+(a.aContar?' (prazo conta a partir da ordem de serviço/assinatura)':'')+'.':''].filter(Boolean).join(' ');
     const ccPrev=document.getElementById('cad-ccprev');if(ccPrev&&!f.dataset.cc&&f.elements.aprovData.value)ccPrev.textContent=nextCC(f.elements.aprovData.value);
     DI.info.push('PDF '+esc(nome)+': '+n+' campo(s) preenchido(s)'+(a.tipo?' · '+esc(a.tipo):'')+((a.contrato||a.os||a.empenho)?' nº '+esc(a.contrato||a.os||a.empenho):'')+(a.valor?' · '+BRL(a.valor):'')+(a.prazo?' · '+a.prazo+' dias':'')+(a.inicio?' · <b>início '+br(a.inicio)+'</b>':' · <b>início não encontrado</b>: a obra fica em Planejamento até você informar')+(c?' · cliente '+esc(c.sigla||c.razao):a.cnpjs.length?' · CNPJ '+esc(a.cnpjs[0])+' não está nos clientes':''));}}
   else DI.info.push(esc(nome)+': guardado como documento da demanda.');
   if(N&&N.files){const id='ANX-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);await N.files.put({id,blob:file,mime:file.type||'application/octet-stream',nome});DI.anexos.push({id,nome,mime:file.type,size:file.size,em:hoje()});}
  }catch(err){DI.info.push(esc(nome)+': '+esc(err.message||'não foi possível ler.'));}}
 diResumo();}
const diBox=()=>'<div class="cad-dibox"><div><strong>'+ic('upload')+'Preencher pelo documento de aprovação</strong><p>Solte aqui o <b>PDF</b> da aprovação (contrato, ordem de serviço, empenho ou pedido), o e-mail do cliente (.eml) e a planilha do orçamento (.xlsx). O sistema lê e preenche número, valor, prazo, <b>início da obra</b>, cliente e a lista de atividades; confira antes de salvar.</p></div><label class="button outline fn-sm">Escolher arquivos<input type="file" id="cad-difile" multiple accept=".eml,.xlsx,.xls,.xlsm,.pdf,.doc,.docx,.jpg,.jpeg,.png" hidden></label><div id="cad-direl"></div></div>';
const anexos=cc=>Array.isArray(C.anexos&&C.anexos[cc])?C.anexos[cc]:[];
function docsPanel(d){const L=anexos(d.cc);return panel('Documentos da demanda',L.length?L.length+' arquivo(s): e-mail de aprovação, orçamento, laudos e fichas':'E-mail de aprovação, orçamento, laudos e fichas do cliente',
 '<div class="cad-hub cad-dochub">'+L.map(a=>'<button class="cad-card" data-di-open="'+esc(a.id)+'"><strong>'+esc(a.nome)+'</strong><span>'+br(a.em)+(a.size?' · '+Math.max(1,Math.round(a.size/1024))+' KB':'')+'</span><em>Abrir '+ic('arrow')+'</em></button>').join('')+'</div>'+(L.length?'':'<p class="ob-p">Nenhum documento ainda.</p>'),
 '<label class="button outline fn-sm">+ Anexar<input type="file" id="cad-diadd" data-cc="'+d.cc+'" multiple hidden></label>');}

/* ---------- Fornecedores (serviço, materiais, equipamentos) ---------- */
const FTIPOS=['Serviço','Materiais','Equipamentos'];
const FSIT=['Ativo','Em homologação','Bloqueado'];
const FDOCS=['Contrato social','Cartão CNPJ','CND federal','CND estadual','CND municipal','FGTS (CRF)','CNDT trabalhista','Alvará','Seguro de responsabilidade','PCMSO e PGR','ASOs da equipe','Treinamentos NR-10/NR-35','Catálogo e certificados (Inmetro)'];
const SEED_FORN=[['FOR-001','Trane Technologies','Trane',['Equipamentos'],'VRF TVR Smart, condensadoras e evaporadoras','Trane','Fabricante. OC 06366 na obra TJ-RS (8 parcelas).'],
 ['FOR-002','Refrigeração Dufrio','Dufrio',['Materiais','Equipamentos'],'Splits, tubos, isolamento, gás refrigerante','Hisense e outras','Distribuidor. OC 06431 na obra TJ-RS (classificada como aditivo).'],
 ['FOR-003','ABT Comercial Elétrica','ABT',['Materiais'],'Material elétrico, luminárias e lâmpadas LED','','OC 06432 na obra TJ-RS.'],
 ['FOR-004','CLOGE','CLOGE',['Serviço'],'Obra civil','','Proposta de obra civil na TJ-RS. Escopo a confirmar.'],
 ['FOR-005','IMPERMADE','IMPERMADE',['Serviço'],'Impermeabilização','','Terceiro na lista de acesso da TJ-RS. Escopo a confirmar.'],
 ['FOR-006','Iceclima','Iceclima',['Serviço'],'Mão de obra de climatização','','Terceiro de climatização na TJ-RS. Escopo a confirmar.']]
 .map(r=>({id:r[0],razao:r[1],fant:r[2],tipos:r[3],espec:r[4],marcas:r[5],obs:r[6],cnpj:'',cidade:'',uf:'',contato:'',email:'',fone:'',pag:'',fatdir:'',sit:'Ativo',docs:[],ex:1,criado:'2026-10-28'}));
if(!Array.isArray(C.forn))C.forn=SEED_FORN.map(x=>({...x}));
const fornById=id=>C.forn.find(f=>f.id===id);
const QF={q:'',tipo:''};
function fornFilter(){const q=norm(QF.q);return C.forn.filter(f=>(!QF.tipo||(f.tipos||[]).includes(QF.tipo))&&(!q||norm([f.id,f.razao,f.fant,f.cnpj,cnpjFmt(f.cnpj),f.espec,f.marcas,f.cidade].join(' ')).includes(q)));}
function fornTable(list){if(!list.length)return '<div class="empty-state"><p>Nenhum fornecedor encontrado.</p></div>';
 return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Código</th><th>Fornecedor</th><th>Fornece</th><th>Especialidade</th><th>Cidade</th><th>Situação</th></tr></thead><tbody>'+
 list.map(f=>'<tr><td class="ob-code">'+f.id+'</td><td class="ob-d"><a class="project-link" href="#fornecedores/'+f.id+'"><span><strong>'+esc(f.fant||f.razao)+'</strong><small>'+esc(f.fant?f.razao:'')+(f.cnpj?' · '+cnpjFmt(f.cnpj):'')+'</small></span></a></td><td class="ob-nw">'+(f.tipos||[]).map(t=>'<span class="cad-chip">'+t+'</span>').join(' ')+'</td><td class="ob-d">'+esc(f.espec)+(f.marcas?'<small>marcas: '+esc(f.marcas)+'</small>':'')+'</td><td class="ob-nw">'+esc(f.cidade)+(f.uf?'/'+esc(f.uf):'')+'</td><td class="ob-nw"><span class="status'+(f.sit==='Ativo'?'':f.sit==='Bloqueado'?' risk':' ob-mute')+'">'+esc(f.sit)+'</span></td></tr>').join('')+'</tbody></table></div>';}
function fornList(){return intro('Fornecedores.','Quem presta serviço e quem fornece materiais e equipamentos para as obras. A situação e os documentos indicam quem pode ser contratado.','truck','#operations','← Voltar à Operação & CSC')+
 panel('Cadastro de fornecedores',C.forn.length+' cadastrados','<div class="toolbar cad-tools"><div class="filter-chips"><button class="filter-chip '+(!QF.tipo?'active':'')+'" data-cad-ft="">Todos</button>'+FTIPOS.map(t=>'<button class="filter-chip '+(QF.tipo===t?'active':'')+'" data-cad-ft="'+t+'">'+(t==='Serviço'?'Serviço':t)+' · '+C.forn.filter(f=>(f.tipos||[]).includes(t)).length+'</button>').join('')+'</div><label class="search-field">'+ic('search')+'<input id="cad-fq" type="search" placeholder="Buscar fornecedor, CNPJ, especialidade..." value="'+esc(QF.q)+'"></label></div><div id="cad-fres" class="cad-res">'+fornTable(fornFilter())+'</div>','<a class="button primary" href="#fornecedores/novo">+ Novo fornecedor</a>');}
function fornForm(f){const e=!!f;f=f||{tipos:[],sit:'Em homologação',docs:[]};
 return intro(e?'Editar fornecedor '+f.id+'.':'Novo fornecedor.','Marque o que ele fornece: serviço (mão de obra, subcontratação), materiais, equipamentos ou mais de um.','truck',e?'#fornecedores/'+f.id:'#fornecedores','← Cancelar')+
 '<form id="cad-forn" class="cad-formwrap" data-id="'+(e?f.id:'')+'" novalidate>'+
 grp('Identificação',fld('razao','Razão social',f.razao,{req:1,wide:1})+fld('fant','Nome fantasia',f.fant)+fld('cnpj','CNPJ',f.cnpj?cnpjFmt(f.cnpj):'',{ph:'00.000.000/0000-00'})+fld('sit','Situação',f.sit,{opts:FSIT,hint:'Em homologação: documentos ainda em análise.'})+
  '<div class="ob-field cad-wide"><span>Fornece <b class="cad-req">*</b></span><div class="cad-checks">'+FTIPOS.map(t=>'<label class="ob-check"><input type="checkbox" name="tipos" value="'+t+'"'+((f.tipos||[]).includes(t)?' checked':'')+'> '+(t==='Serviço'?'Serviço (mão de obra, subcontratação)':t)+'</label>').join('')+'</div></div>'+
  fld('espec','Especialidade ou linha de produtos',f.espec,{wide:1,ph:'Ex.: instalação de VRF, tubos e isolamento, chillers'})+fld('marcas','Marcas (materiais e equipamentos)',f.marcas,{ph:'Ex.: Trane, Daikin, Hisense'}))+
 grp('Localização e contato',fld('cidade','Cidade',f.cidade)+fld('uf','UF',f.uf,{opts:UFS,blank:'—'})+fld('contato','Contato comercial',f.contato)+fld('email','E-mail',f.email,{type:'email'})+fld('fone','Telefone',f.fone,{type:'tel'}))+
 grp('Condições',fld('pag','Condição de pagamento',f.pag,{ph:'Ex.: 30/60/90, 8 parcelas'})+fld('fatdir','Faturamento direto ao cliente',f.fatdir,{opts:[['','—'],'Sim','Não']}))+
 grp('Documentos entregues','<div class="ob-field cad-wide"><div class="cad-checks">'+FDOCS.map(d=>'<label class="ob-check"><input type="checkbox" name="docs" value="'+esc(d)+'"'+((f.docs||[]).includes(d)?' checked':'')+'> '+esc(d)+'</label>').join('')+'</div><small class="cad-hint">Os arquivos vão para o Drive da empresa. Aqui fica só o registro do que foi entregue.</small></div>')+
 grp('Observações',fld('obs','Observações',f.obs,{area:1,wide:1}))+
 '<p class="cad-err" id="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(e?'Salvar alterações':'Cadastrar fornecedor')+'</button><a class="button outline" href="'+(e?'#fornecedores/'+f.id:'#fornecedores')+'">Cancelar</a></div></form>';}
function fornFicha(f){const MT=window.ArmantMateriais,movs=MT?MT.state.mov.filter(v=>v.tipo==='entrada'&&(v.fid===f.id||norm(v.forn)===norm(f.fant||'')||norm(v.forn)===norm(f.razao))):[],tot=movs.reduce((a,v)=>a+v.itens.reduce((s,it)=>s+it.q*(it.pu||0),0),0);
 const faltam=FDOCS.filter(d=>!(f.docs||[]).includes(d));
 return intro(esc(f.fant||f.razao)+'.',f.id+' · '+esc(f.razao)+(f.cnpj?' · CNPJ '+cnpjFmt(f.cnpj):'')+' · '+(f.tipos||[]).join(', '),'truck','#fornecedores','← Voltar aos fornecedores')+
 '<div class="cad-two">'+panel('Dados do fornecedor','',dl([['Código',f.id],['Razão social',esc(f.razao)],['CNPJ',f.cnpj?cnpjFmt(f.cnpj):'a preencher'],['Fornece',(f.tipos||[]).join(', ')],['Especialidade',esc(f.espec)],['Marcas',esc(f.marcas)],['Cidade',esc(f.cidade)+(f.uf?'/'+esc(f.uf):'')],['Contato',esc(f.contato)],['E-mail',esc(f.email)],['Telefone',esc(f.fone)],['Pagamento',esc(f.pag)],['Faturamento direto',esc(f.fatdir)],['Situação','<span class="status'+(f.sit==='Ativo'?'':f.sit==='Bloqueado'?' risk':' ob-mute')+'">'+esc(f.sit)+'</span>']])+(f.obs?'<p class="ob-p cad-obs">'+esc(f.obs)+'</p>':''))+
 panel('Documentos',(f.docs||[]).length+' de '+FDOCS.length+' entregues','<div class="cad-docs">'+(f.docs||[]).map(d=>'<span class="cad-chip">'+ic('check')+esc(d)+'</span>').join('')+'</div>'+(faltam.length?'<p class="ob-p cad-obs">Faltam: '+faltam.map(esc).join(', ')+'.</p>':''))+'</div>'+
 panel('Entradas de material deste fornecedor',movs.length+' lançamento(s) · R$ '+nf(tot),movs.length?'<div class="table-wrap"><table class="ob-t"><thead><tr><th>Data</th><th>Documento</th><th>Obra</th><th class="ob-n">Valor</th></tr></thead><tbody>'+movs.map(v=>'<tr><td class="ob-nw">'+br(v.data)+'</td><td class="ob-nw">'+esc(v.doc||v.id)+'</td><td class="ob-nw">'+esc(v.cc||'estoque geral')+'</td><td class="ob-n">R$ '+nf(v.itens.reduce((s,it)=>s+it.q*(it.pu||0),0))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="ob-p">Nenhuma entrada lançada em Materiais e estoque.</p>','<a class="button outline" href="#materiais/lancamento">Lançar materiais</a>')+
 '<div class="ob-actions"><a class="button outline" href="#fornecedores/'+f.id+'/editar">Editar fornecedor</a>'+(movs.length?'':'<button class="button outline" id="cad-delforn" data-id="'+f.id+'">Excluir fornecedor</button>')+'</div>';}
function fornQuick(){const n=t=>C.forn.filter(f=>(f.tipos||[]).includes(t)).length;return panel('Fornecedores',C.forn.length+' cadastrados · '+n('Serviço')+' de serviço · '+n('Materiais')+' de materiais · '+n('Equipamentos')+' de equipamentos',fornTable(C.forn.slice(-4)),'<a class="button primary" id="cad-btn-forn" href="#fornecedores">Cadastro de fornecedores</a>');}

/* ---------- Comercial: kanban das negociações ---------- */
const ETN=[['prosp','Prospecção','primeiro contato, edital ou indicação'],['visita','Visita técnica','levantamento no local'],['orc','Orçamento','em elaboração'],['prop','Proposta enviada','aguardando o cliente'],['neg','Negociação','ajustes de preço, prazo ou escopo'],['ganha','Ganha','vira demanda aprovada'],['perdida','Perdida','com motivo registrado']];
const ETNL=k=>(ETN.find(e=>e[0]===k)||['',k])[1];
const MOTIVOS=['Preço','Prazo','Escopo','Perdeu a licitação','Cliente desistiu','Sem retorno','Outro'];
const SEED_NEG={id:'NEG-001',cli:'CLI-001',titulo:OBRA?OBRA.nome:'Reforma da climatização · Foro Regional do Alto Petrópolis',valor:OBRA?OBRA.valor:0,etapa:'ganha',resp:'',prox:'',proxData:'',origem:'Licitação',cc:SEED_DEM.cc,motivo:'',obs:'Contrato '+(OBRA?OBRA.contrato:'075/2026DEC')+'. Obra real.',hist:[{e:'ganha',d:'2026-10-28'}],criado:'2026-10-28'};
if(!Array.isArray(C.neg))C.neg=[{...SEED_NEG}];
const negById=id=>C.neg.find(n=>n.id===id);
const desde=n=>{const h=(n.hist||[]).filter(x=>x.e===n.etapa).pop();return h?h.d:n.criado;};
const dias=iso=>iso?Math.max(0,Math.round((new Date(hoje()+'T12:00:00')-new Date(iso+'T12:00:00'))/864e5)):0;
const KQ={q:'',resp:''};
function negCard(n){const c=cliById(n.cli)||{},dd=dias(desde(n)),venc=n.proxData&&n.proxData<hoje()&&!['ganha','perdida'].includes(n.etapa),i=ETN.findIndex(e=>e[0]===n.etapa);
 return '<article class="kb-card'+(venc?' late':'')+'" draggable="true" data-kb-id="'+n.id+'"><a href="#negociacoes/'+n.id+'" class="kb-link"><strong>'+esc(c.sigla||c.razao||'Cliente?')+'</strong><span>'+esc(n.titulo)+'</span></a>'+
 '<div class="kb-meta"><b>'+(n.valor?BRL(n.valor):'sem valor')+'</b><small>'+dd+' d na etapa</small></div>'+
 (n.prox&&!['ganha','perdida'].includes(n.etapa)?'<p class="kb-next'+(venc?' late':'')+'">'+ic('clock')+esc(n.prox)+(n.proxData?' · '+br(n.proxData):'')+'</p>':'')+
 (n.etapa==='ganha'?(n.cc?'<a class="kb-cc" href="#cc/'+n.cc+'">'+n.cc+'</a>':'<a class="button primary kb-gen" href="#demanda/nova/'+n.cli+'/'+n.id+'">Gerar centro de custo</a>'):'')+
 (n.etapa==='perdida'&&n.motivo?'<p class="kb-next">Motivo: '+esc(n.motivo)+'</p>':'')+
 '<div class="kb-move">'+(i>0?'<button class="kb-btn" data-kb-mv="'+n.id+'" data-to="'+ETN[i-1][0]+'" aria-label="Voltar para '+ETN[i-1][1]+'">←</button>':'<span></span>')+(n.resp?'<small>'+esc(n.resp)+'</small>':'<small></small>')+(i<ETN.length-2?'<button class="kb-btn" data-kb-mv="'+n.id+'" data-to="'+ETN[i+1][0]+'" aria-label="Avançar para '+ETN[i+1][1]+'">→</button>':'<span></span>')+'</div></article>';}
function kanban(){const q=norm(KQ.q),L=C.neg.filter(n=>(!KQ.resp||n.resp===KQ.resp)&&(!q||norm([n.titulo,cliNome(n.cli),(cliById(n.cli)||{}).razao,n.resp].join(' ')).includes(q)));
 const ab=C.neg.filter(n=>!['ganha','perdida'].includes(n.etapa)),vab=ab.reduce((a,n)=>a+(+n.valor||0),0),g=C.neg.filter(n=>n.etapa==='ganha').length,p=C.neg.filter(n=>n.etapa==='perdida').length,resps=[...new Set(C.neg.map(n=>n.resp).filter(Boolean))];
 return panel('Negociações por etapa',ab.length+' em aberto · '+BRL(vab)+' em negociação · '+g+' ganha(s) · '+p+' perdida(s)'+(g+p?' · conversão '+nf(g/(g+p)*100,0)+'%':''),
 '<div class="toolbar cad-tools"><label class="search-field">'+ic('search')+'<input id="kb-q" type="search" placeholder="Buscar cliente ou negociação..." value="'+esc(KQ.q)+'"></label>'+(resps.length?'<label class="period-control ob-ctl"><select id="kb-resp" aria-label="Filtrar por responsável"><option value="">Todos os responsáveis</option>'+resps.map(r=>'<option'+(KQ.resp===r?' selected':'')+'>'+esc(r)+'</option>').join('')+'</select></label>':'')+'</div>'+
 '<div class="kb-board">'+ETN.map(([k,l,s])=>{const cs=L.filter(n=>n.etapa===k),v=cs.reduce((a,n)=>a+(+n.valor||0),0);return '<section class="kb-col kb-'+k+'" data-kb-col="'+k+'" aria-label="'+l+'"><header><div><strong>'+l+'</strong><small>'+s+'</small></div><span class="kb-n">'+cs.length+'</span></header><div class="kb-sum">'+(v?BRL(v):'—')+'</div><div class="kb-list">'+(cs.map(negCard).join('')||'<p class="kb-empty">Arraste uma negociação para cá</p>')+'</div></section>';}).join('')+'</div>'+
 '<p class="area-note">Arraste os cartões entre as colunas ou use as setas. Ao ganhar, gere o centro de custo: a negociação vira demanda aprovada em Operação & CSC.</p>',
 '<a class="button primary" id="kb-new" href="#negociacoes/nova">+ Nova negociação</a>');}
function negForm(n,pre){const e=!!n;n=n||{cli:pre||'',etapa:'prosp',origem:'Indicação'};
 return intro(e?n.id+' · '+esc(n.titulo)+'.':'Nova negociação.',e?'Cliente '+esc(cliNome(n.cli))+' · '+ETNL(n.etapa)+' há '+dias(desde(n))+' dias':'Escolha o cliente e a etapa em que a negociação está. Ela aparece no kanban do Comercial.','briefcase','#commercial','← Voltar ao Comercial')+
 '<form id="cad-neg" class="cad-formwrap" data-id="'+(e?n.id:'')+'" novalidate>'+
 grp('Negociação','<label class="ob-field cad-wide"><span>Cliente <b class="cad-req">*</b></span><select name="cli"><option value="">Selecione o cliente</option>'+clientes().map(c=>'<option value="'+c.id+'"'+(n.cli===c.id?' selected':'')+'>'+esc((c.sigla?c.sigla+' · ':'')+c.razao)+'</option>').join('')+'</select><small class="cad-hint">Não está na lista? <a href="#clientes/novo">Cadastre o cliente</a>.</small></label>'+
  fld('titulo','O que está sendo negociado',n.titulo,{req:1,wide:1,ph:'Ex.: Climatização do bloco B, PMOC anual'})+fld('valor','Valor estimado (R$)',n.valor?nf(n.valor):'',{ph:'0,00'})+fld('etapa','Etapa',n.etapa,{opts:ETN.map(x=>[x[0],x[1]])})+fld('origem','Origem',n.origem,{opts:['Licitação','Indicação','Cliente da base','Prospecção ativa','Site','Outro']})+fld('resp','Responsável comercial',n.resp))+
 grp('Próximo passo',fld('prox','Próxima ação',n.prox,{wide:1,ph:'Ex.: enviar proposta revisada'})+fld('proxData','Data da próxima ação',n.proxData,{type:'date'})+fld('motivo','Motivo da perda (se perdida)',n.motivo,{opts:[['','—'],...MOTIVOS]}))+
 grp('Observações',fld('obs','Observações',n.obs,{area:1,wide:1}))+
 (e&&(n.hist||[]).length?'<fieldset class="cad-grp"><legend>Histórico de etapas</legend><ol class="kb-hist">'+n.hist.map(h=>'<li><b>'+br(h.d)+'</b> '+ETNL(h.e)+'</li>').join('')+'</ol></fieldset>':'')+
 '<p class="cad-err" id="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+(e?'Salvar':'Criar negociação')+'</button><a class="button outline" href="#commercial">Cancelar</a>'+(e&&n.etapa==='ganha'&&!n.cc?'<a class="button outline" href="#demanda/nova/'+n.cli+'/'+n.id+'">Gerar centro de custo</a>':'')+(e&&n.cc?'<a class="button outline" href="#cc/'+n.cc+'">Abrir '+n.cc+'</a>':'')+(e&&!n.cc?'<button class="button outline" type="button" id="cad-delneg" data-id="'+n.id+'">Excluir</button>':'')+'</div></form>';}
function moveNeg(n,to){if(!n||n.etapa===to)return;n.etapa=to;(n.hist=n.hist||[]).push({e:to,d:hoje()});save();
 say(n.id+' → '+ETNL(to)+(to==='perdida'?'. Registre o motivo na ficha.':to==='ganha'&&!n.cc?'. Gere o centro de custo no cartão.':'.'));}

/* ---------- integração com o roteador ---------- */
function intro(t,p,i,back,bl){return '<a class="text-button ob-back" href="'+back+'">'+bl+'</a><div class="view-intro ob-intro"><div><span class="ob-pill-real">cadastro · salvo neste navegador</span><h2>'+t+'</h2><p>'+p+'</p></div>'+ic(i)+'</div>';}
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),pill=document.querySelector('.demo-pill'),act=document.querySelector('.heading-actions');
 if(on){if(!('notice' in chrome)){chrome.notice=notice?notice.innerHTML:'';chrome.pill=pill?pill.innerHTML:'';}
  if(notice)notice.innerHTML='<strong>Cadastro.</strong> O que você cadastra fica salvo neste navegador até existir um banco compartilhado. Não registre dados pessoais além do contato de trabalho.';
  if(pill)pill.innerHTML='<span></span> Cadastro';if(act)act.style.visibility='hidden';}
 else if('notice' in chrome){if(notice)notice.innerHTML=chrome.notice;if(pill)pill.innerHTML=chrome.pill;if(act)act.style.visibility='';}}
function nav(cur){const n=13+C.dem.length;document.getElementById('navigation').innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(cur===id?'active':'')+'" '+(cur===id?'aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+n+'</span>':'')+'</a>').join('');}
function head(crumb,title,sub,navId){setChrome(true);nav(navId);document.getElementById('breadcrumb').textContent=crumb;document.getElementById('page-title').innerHTML=title+'<span>.</span>';document.getElementById('page-subtitle').textContent=sub;}
function show(html){const c=document.getElementById('view');c.innerHTML=html;c.className='fade-in';}
function demRow(d,cols){return '<tr class="ob-real-row cad-row"><td><a class="project-link" href="#cc/'+d.cc+'"><span class="project-symbol">'+ic('layers')+'</span><span><strong>'+esc(d.nome)+'</strong><small>'+d.cc+' · '+esc(cliNome(d.cli))+' · <b class="ob-tag-real">'+ETAPAS[etp(d)].toLowerCase()+'</b></small></span></a></td><td>—</td><td><span class="status ob-mute">Aguardando EAP</span></td>'+(cols>3?'<td>sem dado</td><td>'+BRL(d.valor)+'</td>':'')+'</tr>';}
const prevRender=render;
render=function(){const h=location.hash.slice(1),[v,a,b]=h.split('/');
 if(v==='clientes'){const c=a&&a!=='novo'?cliById(a):null;
  if(a==='novo'){head('Comercial · Clientes','Novo cliente','Cadastro de quem contrata a Armant.','commercial');show(cliForm());return;}
  if(c&&b==='editar'&&!c.seed){head('Comercial · Clientes','Editar cliente','Dados e perfil de medição e pagamento.','commercial');show(cliForm(c));return;}
  if(c){head('Comercial · Clientes','Ficha do cliente','Dados, perfil de pagamento e obras do cliente.','commercial');show(cliFicha(c));return;}
  head('Comercial · Clientes','Clientes','Quem contrata a Armant e como cada um mede e paga.','commercial');show(cliList());return;}
 if(v==='negociacoes'){const n=a&&a!=='nova'?negById(a):null;
  if(n){head('Comercial · Negociações','Negociação '+n.id,'Etapa, próximo passo e histórico.','commercial');show(negForm(n));return;}
  head('Comercial · Negociações','Nova negociação','Entra no kanban do Comercial.','commercial');show(negForm(null,b&&cliById(b)?b:''));return;}
 if(v==='fornecedores'){const f=a&&a!=='novo'?fornById(a):null;
  if(a==='novo'){head('Operação & CSC · Fornecedores','Novo fornecedor','Serviço, materiais e equipamentos.','operations');show(fornForm());return;}
  if(f&&b==='editar'){head('Operação & CSC · Fornecedores','Editar fornecedor','Dados, documentos e situação.','operations');show(fornForm(f));return;}
  if(f){head('Operação & CSC · Fornecedores','Ficha do fornecedor','Dados, documentos e entradas de material.','operations');show(fornFicha(f));return;}
  head('Operação & CSC · Fornecedores','Fornecedores','Serviço, materiais e equipamentos.','operations');show(fornList());return;}
 if(v==='demanda'&&a==='nova'){diReset();head('Operação & CSC · Demanda aprovada','Demanda aprovada','Cadastro que gera o centro de custo da obra.','operations');show(demForm(null,b&&cliById(b)?b:'',negById(h.split('/')[3]||'')));return;}
 if(v==='cc'){const d=demByCC(a);if(d){
  if(b==='editar'&&!d.seed){head('Operação & CSC · '+d.cc,'Editar demanda','O código do centro de custo não muda.','operations');show(demForm(d));return;}
  head('Operação & CSC · '+d.cc,'Centro de custo '+d.cc,'Tudo desta obra, em um só código.','operations');show(ccFicha(d));return;}}
 setChrome(false);prevRender();const c=document.getElementById('view');
 if(v!=='obra')nav(NAV.some(n=>n[0]===h)?h:'overview');
 const vi=c.querySelector(':scope > .view-intro');
 if(v==='operations'&&vi)vi.insertAdjacentHTML('afterend',demList()+fornQuick());
 if(v==='commercial'&&vi)vi.insertAdjacentHTML('afterend','<div id="kb-wrap">'+kanban()+'</div>'+ciPanel()+panel('Clientes',clientes().length+' cadastrados · perfil de medição, pagamento e documentos de cada um',cliTable(clientes().slice(-5)),'<a class="button primary" id="cad-btn-cli" href="#clientes">Cadastro de clientes</a>'));
 if(v==='obra'){const pill=c.querySelector('.ob-intro .ob-pill-real');if(pill&&!c.querySelector('.cad-ccpill'))pill.insertAdjacentHTML('afterend',' <a class="ob-pill-real cad-ccpill" href="#cc/'+SEED_DEM.cc+'">centro de custo '+SEED_DEM.cc+'</a>');}
 if(v==='overview'||v===''||v==='projects'){c.querySelectorAll('.table-panel table').forEach(tb=>{const r=tb.querySelector('.ob-real-row');if(!r)return;const sm=r.querySelector('small');if(sm&&!sm.textContent.includes(SEED_DEM.cc))sm.insertAdjacentHTML('afterbegin',SEED_DEM.cc+' · ');
  if(v==='projects'&&!tb.querySelector('.cad-row')){const cols=tb.querySelectorAll('thead th').length;r.insertAdjacentHTML('afterend',[...SEED_DEM_EX,...C.dem].slice().reverse().map(d=>demRow(d,cols)).join(''));}});
  c.querySelectorAll('.table-panel table').forEach(colunaRO);}};
/* coluna "Responsável (R.O.)" na lista de obras: quem foi escolhido em Controle de obras; sem R.O., link para definir */
/* quem pode escolher o R.O.: gestão (nível 4 ou mais) ou superadmin */
const podeRO=()=>{const A=window.ArmantAcesso;if(!A||!A.user)return true;const u=A.user();return !!u&&(u.nivel>=4||souSuper());};
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.cadSetro)return;if(!podeRO())return;setResp(t.dataset.cadSetro,'ro',t.value);const u=pessoas().find(x=>x.id===t.value);say(t.value?'R.O. de '+t.dataset.cadSetro+': '+(u?u.nome:t.value)+'.':'R.O. removido de '+t.dataset.cadSetro+'.');render();});
function nomeRO(cc){const id=roDe(cc);if(!id)return '';const u=pessoas().find(x=>x.id===id);return u?u.nome:id;}
function celulaRO(tr){const a=tr.querySelector('a.project-link'),bt=tr.querySelector('[data-project]');let cc='';
 if(a){const h=a.getAttribute('href')||'';cc=h==='#obra'?SEED_DEM.cc:h.startsWith('#cc/')?h.slice(4):'';}
 if(bt)cc=bt.dataset.project;
 if(cc){const n=nomeRO(cc);if(podeRO())return '<td class="cad-ro"><select class="cad-ro-sel'+(n?'':' vazio')+'" data-cad-setro="'+cc+'" aria-label="R.O. da obra '+cc+'"><option value="">'+(n?'— sem R.O. —':'definir R.O. ▾')+'</option>'+pessoas().map(u=>'<option value="'+u.id+'"'+(roDe(cc)===u.id?' selected':'')+'>'+esc(u.nome)+(u.setor?' · '+esc(u.setor):'')+'</option>').join('')+'</select></td>';
  return '<td class="cad-ro">'+(n?'<span class="cad-ro-n">'+esc(n)+'</span>':'<span class="cad-ro-def">sem R.O.</span>')+'</td>';}
 return '<td class="cad-ro">—</td>';}
function colunaRO(tb){const th=tb.querySelector('thead tr');if(!th||tb.querySelector('.cad-roh'))return;
 const f=th.querySelector('th');if(f)f.insertAdjacentHTML('afterend','<th scope="col" class="cad-roh">Responsável (R.O.)</th>');
 tb.querySelectorAll('tbody tr').forEach(tr=>{const td=tr.querySelector('td');if(!td||td.colSpan>1)return;td.insertAdjacentHTML('afterend',celulaRO(tr));});
 tb.querySelectorAll('tbody td[colspan]').forEach(td=>{td.colSpan=td.colSpan+1;});}

/* ---------- eventos (prefixo cad-) ---------- */
const val=(f,n)=>{const el=f.elements[n];return el?String(el.value).trim():'';};
function err(m,f,n){const p=document.getElementById('cad-err');if(p)p.textContent=m;if(f&&n&&f.elements[n])f.elements[n].focus();return false;}
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='cad-neg')return;e.preventDefault();const id=f.dataset.id;
 if(!val(f,'cli'))return err('Selecione o cliente.',f,'cli');if(!val(f,'titulo'))return err('Informe o que está sendo negociado.',f,'titulo');
 const valor=num(val(f,'valor'));if(val(f,'valor')&&!(valor>0))return err('Valor inválido. Use o formato 1.234.567,89.',f,'valor');
 const o={cli:val(f,'cli'),titulo:val(f,'titulo'),valor,origem:val(f,'origem'),resp:val(f,'resp'),prox:val(f,'prox'),proxData:val(f,'proxData'),motivo:val(f,'motivo'),obs:val(f,'obs')},et=val(f,'etapa');
 if(et==='perdida'&&!o.motivo)return err('Informe o motivo da perda.',f,'motivo');
 let n=id?negById(id):null;if(n){Object.assign(n,o);if(n.etapa!==et){n.etapa=et;(n.hist=n.hist||[]).push({e:et,d:hoje()});}}
 else{n={id:'NEG-'+String(C.neg.reduce((a,x)=>Math.max(a,+x.id.slice(4)),0)+1).padStart(3,'0'),etapa:et,hist:[{e:et,d:hoje()}],criado:hoje(),cc:'',...o};C.neg.push(n);}
 save();say(id?'Negociação salva.':'Negociação criada: '+n.id+' em '+ETNL(et)+'.');location.hash='#commercial';});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='cad-forn')return;e.preventDefault();const id=f.dataset.id,cnpj=val(f,'cnpj').replace(/\D/g,''),tipos=[...f.querySelectorAll('input[name=tipos]:checked')].map(x=>x.value);
 if(!val(f,'razao'))return err('Informe a razão social.',f,'razao');
 if(!tipos.length)return err('Marque o que o fornecedor fornece: serviço, materiais ou equipamentos.');
 if(!cnpjOk(cnpj))return err('CNPJ inválido. Confira os 14 dígitos.',f,'cnpj');
 if(cnpj&&C.forn.some(x=>x.cnpj===cnpj&&x.id!==id))return err('Já existe um fornecedor com este CNPJ.',f,'cnpj');
 const em=val(f,'email');if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return err('E-mail inválido.',f,'email');
 const o={razao:val(f,'razao'),fant:val(f,'fant'),cnpj,sit:val(f,'sit'),tipos,espec:val(f,'espec'),marcas:val(f,'marcas'),cidade:val(f,'cidade'),uf:val(f,'uf'),contato:val(f,'contato'),email:em,fone:val(f,'fone'),pag:val(f,'pag'),fatdir:val(f,'fatdir'),docs:[...f.querySelectorAll('input[name=docs]:checked')].map(x=>x.value),obs:val(f,'obs')};
 let x=id?fornById(id):null;if(x){Object.assign(x,o);delete x.ex;}else{x={id:'FOR-'+String(C.forn.reduce((a,y)=>Math.max(a,+y.id.slice(4)),0)+1).padStart(3,'0'),criado:hoje(),...o};C.forn.push(x);}
 save();say(id?'Fornecedor atualizado.':'Fornecedor cadastrado: '+x.id+'.');location.hash='#fornecedores/'+x.id;});
/* ---------- Comercial: importar planilha (CSV ou Excel) de clientes e de negociações ---------- */
const CI={plano:null,arq:''};
const nk=x=>norm(String(x==null?'':x)).replace(/[^a-z0-9]+/g,' ').trim();
const CIA={razao:['razao social','razao','cliente','nome do cliente','empresa','contratante'],sigla:['sigla','nome fantasia','fantasia','apelido'],cnpj:['cnpj','cnpj cpf','documento'],tipo:['tipo','natureza'],segmento:['segmento','ramo','area'],cidade:['cidade','municipio'],uf:['uf','estado'],contato:['contato','pessoa de contato','responsavel do cliente'],email:['email','e mail'],fone:['telefone','fone','celular','whatsapp'],
 titulo:['titulo','oportunidade','negociacao','proposta','obra','objeto'],valor:['valor','valor estimado','valor da proposta','valor total','valor r'],etapa:['etapa','status','fase','situacao'],resp:['responsavel','vendedor','comercial','responsavel armant'],prox:['proximo passo','proxima acao','acao'],proxData:['data do proximo passo','data da proxima acao','data proxima acao','prazo'],origem:['origem','canal','fonte'],obs:['observacao','observacoes','obs']};
function ciCSV(txt){txt=txt.replace(/^﻿/,'');const l1=txt.split(/\r?\n/)[0]||'',sep=[';','\t',','].sort((a,b)=>l1.split(b).length-l1.split(a).length)[0],rows=[];let row=[],cel='',q=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];if(q){if(ch==='"'){if(txt[i+1]==='"'){cel+='"';i++;}else q=false;}else cel+=ch;}else if(ch==='"'&&cel==='')q=true;else if(ch===sep){row.push(cel);cel='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;row.push(cel);rows.push(row);row=[];cel='';}else cel+=ch;}
 if(cel!==''||row.length){row.push(cel);rows.push(row);}return rows.filter(r=>r.some(c=>String(c).trim()!==''));}
function ciTabela(rows,nome){let hi=-1,ix={};for(let r=0;r<Math.min(rows.length,10);r++){const h=(rows[r]||[]).map(nk),m={};Object.entries(CIA).forEach(([k,al])=>{const i=h.findIndex(x=>al.includes(x));if(i>=0)m[k]=i;});if(Object.keys(m).length>=2){hi=r;ix=m;break;}}
 if(hi<0)return null;const tipo=ix.titulo!=null?'neg':(ix.razao!=null||ix.cnpj!=null)?'cli':null;if(!tipo)return null;
 const L=rows.slice(hi+1).map((r,i)=>{const o={lin:hi+i+2};Object.entries(ix).forEach(([k,c])=>{const v=r[c];o[k]=v instanceof Date?v.toISOString().slice(0,10):String(v==null?'':v).trim();});return o;}).filter(o=>o.razao||o.cnpj||o.titulo);
 return {nome,tipo,L};}
const ciEtapa=t=>{t=nk(t);return /ganh|fechad|aprovad|vencid/.test(t)?'ganha':/perd|cancel|desist/.test(t)?'perdida':/negoci/.test(t)?'neg':/proposta|enviad/.test(t)?'prop':/orcament|orc\b/.test(t)?'orc':/visita/.test(t)?'visita':'prosp';};
const ciData=v=>{v=String(v||'').trim();let m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(m)return (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');if(/^\d{5}$/.test(v))return new Date(Math.round((+v-25569)*864e5)).toISOString().slice(0,10);return '';};
const ciNum=v=>typeof v==='number'?v:num(String(v||'').replace(/R\$\s*/,''));
/* plano: o que entra, o que atualiza e o que fica de fora (com o motivo) */
function ciPlanejar(tabs){const P={cliNovos:[],cliAtual:[],negNovas:[],avisos:[]},achaCli=(nome,cnpj)=>{const d=String(cnpj||'').replace(/\D/g,'');return clientes().find(c=>(d&&c.cnpj===d))||clientes().find(c=>nome&&(nk(c.razao)===nk(nome)||(c.sigla&&nk(c.sigla)===nk(nome))))||P.cliNovos.find(c=>(d&&c.cnpj===d)||(nome&&nk(c.razao)===nk(nome)));};
 const novoCli=(x,origem)=>{const d=String(x.cnpj||'').replace(/\D/g,'');let cnpj=d;if(d&&!cnpjOk(d)){P.avisos.push(origem+': CNPJ '+x.cnpj+' inválido, cliente entra sem CNPJ.');cnpj='';}
  const c={razao:x.razao,sigla:x.sigla||'',cnpj,tipo:/publ|prefeit|tribunal|camara|governo|munic|estad|federal/i.test(x.tipo+' '+x.razao)?'Público':'Privado',esfera:'',segmento:x.segmento||'',cidade:x.cidade||'',uf:UFS.includes(String(x.uf||'').toUpperCase())?String(x.uf).toUpperCase():'',contato:x.contato||'',cargo:'',email:/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email||'')?x.email:'',fone:x.fone||'',medicao:'Periódica',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:[],obs:'Importado de planilha.'};P.cliNovos.push(c);return c;};
 tabs.forEach(T=>T.L.forEach(x=>{const org=T.nome+' linha '+x.lin;
  if(T.tipo==='cli'){if(!x.razao){P.avisos.push(org+': sem razão social.');return;}const c=achaCli(x.razao,x.cnpj);
   if(!c){novoCli(x,org);return;}if(P.cliNovos.includes(c))return;if(c.seed){P.avisos.push(org+': '+c.razao+' já está cadastrado (cliente base do sistema); nada muda pela planilha.');return;}const ch={};['sigla','segmento','cidade','contato','email','fone'].forEach(k=>{if(x[k]&&!c[k])ch[k]=x[k];});if(x.uf&&!c.uf&&UFS.includes(x.uf.toUpperCase()))ch.uf=x.uf.toUpperCase();if(Object.keys(ch).length&&!P.cliAtual.some(z=>z.c===c))P.cliAtual.push({c,ch});return;}
  if(!x.titulo){P.avisos.push(org+': sem título da negociação.');return;}let c=achaCli(x.razao,x.cnpj);if(!c){if(!x.razao){P.avisos.push(org+': sem cliente.');return;}c=novoCli(x,org);}
  if((C.neg||[]).some(n=>nk(n.titulo)===nk(x.titulo)&&n.cli===c.id)||P.negNovas.some(n=>nk(n.titulo)===nk(x.titulo)&&n.c===c)){P.avisos.push(org+': "'+x.titulo+'" já existe para este cliente.');return;}
  const v=ciNum(x.valor);P.negNovas.push({c,titulo:x.titulo,valor:v>0?v:0,etapa:ciEtapa(x.etapa),resp:x.resp||'',prox:x.prox||'',proxData:ciData(x.proxData),origem:x.origem||'Planilha',obs:x.obs||''});}));
 return P;}
async function ciLer(file){const nm=file.name.toLowerCase();let tabs=[];
 if(nm.endsWith('.csv')||nm.endsWith('.txt'))tabs=[ciTabela(ciCSV(await file.text()),file.name)];
 else if(/\.xlsx?$|\.xlsm$/.test(nm)){const X=await carregarXLSX(),wb=X.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});tabs=wb.SheetNames.map(n=>ciTabela(X.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''}),n));}
 else throw new Error('Envie uma planilha .csv ou .xlsx.');
 tabs=tabs.filter(Boolean);if(!tabs.length)throw new Error('Não achei as colunas. Use os modelos: clientes (Razão social, CNPJ, Cidade, UF…) ou negociações (Título, Cliente, Valor, Etapa…).');
 return {arq:file.name,tabs,plano:ciPlanejar(tabs)};}
function ciAplicar(){if(!CI.plano)return;const P=ciPlanejar(CI.plano.tabs);
 P.cliNovos.forEach(c=>{c.id=nextCli();c.criado=hoje();C.cli.push(c);});
 P.cliAtual.forEach(({c,ch})=>{const x=C.cli.find(y=>y.id===c.id);if(x)Object.assign(x,ch);});
 P.negNovas.forEach(n=>{const id='NEG-'+String((C.neg||[]).reduce((a,x)=>Math.max(a,+String(x.id).slice(4)||0),0)+1).padStart(3,'0');C.neg.push({id,cli:n.c.id,titulo:n.titulo,valor:n.valor,etapa:n.etapa,hist:[{e:n.etapa,d:hoje()}],criado:hoje(),cc:'',resp:n.resp,prox:n.prox,proxData:n.proxData,origem:n.origem,motivo:'',obs:n.obs});});
 save();CI.plano=null;say('Importado: '+P.cliNovos.length+' cliente(s) novo(s), '+P.cliAtual.length+' atualizado(s), '+P.negNovas.length+' negociação(ões).');render();}
async function ciBaixar(nome,txt){try{const dl=window.claude&&typeof window.claude.use==='function'?await window.claude.use('downloads'):null;if(dl){await dl.save({filename:nome,data:new Blob([txt],{type:'text/csv;charset=utf-8'})});return;}}catch(e){if(e&&e.code==='declined')return;}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);}
const ciCel=v=>{const t=String(v==null?'':v);return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
const ciCSVout=rows=>'﻿'+rows.map(r=>r.map(ciCel).join(';')).join('\r\n');
const CI_MODELOS={clientes:[['Razão social','Sigla','CNPJ','Tipo','Segmento','Cidade','UF','Contato','E-mail','Telefone'],['Hospital Exemplo Ltda.','Hosp. Exemplo','','Privado','Saúde','Porto Alegre','RS','Fulano de Tal','fulano@exemplo.com.br','(51) 99999-0000']],
 negociacoes:[['Título','Cliente','CNPJ','Valor','Etapa','Responsável','Próximo passo','Data do próximo passo','Origem','Observação'],['Climatização do bloco B','Hospital Exemplo Ltda.','','250000,00','Proposta enviada','Valentim','Ligar para o cliente','15/11/2026','Indicação','']]};
function ciExportar(qual){if(qual==='clientes')return [CI_MODELOS.clientes[0]].concat(clientes().filter(c=>!c.ficticia).map(c=>[c.razao,c.sigla||'',c.cnpj||'',c.tipo||'',c.segmento||'',c.cidade||'',c.uf||'',c.contato||'',c.email||'',c.fone||'']));
 return [CI_MODELOS.negociacoes[0]].concat((C.neg||[]).map(n=>{const c=cliById(n.cli)||{};return [n.titulo,c.razao||'',c.cnpj||'',String(n.valor||0).replace('.',','),ETNL(n.etapa),n.resp||'',n.prox||'',n.proxData?br(n.proxData):'',n.origem||'',n.obs||''];}));}
function ciPanel(){const P=CI.plano;
 return '<section class="panel ob-panel ci-panel" id="ci-panel"><div class="panel-header"><div><h2>Importar planilha (CSV ou Excel)</h2><p>Clientes e negociações de uma vez. O sistema reconhece as colunas, mostra o que vai entrar e só grava quando você confirma.</p></div></div>'+
 '<div class="mt-io"><label class="mt-drop"><input type="file" id="ci-file" accept=".csv,.xlsx,.xls,.xlsm,text/csv" hidden>'+ic('upload')+'<span><strong>Escolher planilha (.csv ou .xlsx)</strong><small>Clientes: Razão social, Sigla, CNPJ, Tipo, Segmento, Cidade, UF, Contato, E-mail, Telefone. Negociações: Título, Cliente, CNPJ, Valor, Etapa, Responsável, Próximo passo, Data, Origem. Uma planilha do Excel pode ter as duas abas. Cliente que não existe é cadastrado junto.</small></span></label>'+
 '<div class="ob-actions"><button class="button outline fn-sm" data-ci-mod="clientes">Modelo de clientes (CSV)</button><button class="button outline fn-sm" data-ci-mod="negociacoes">Modelo de negociações (CSV)</button><button class="text-button" data-ci-exp="clientes">Exportar clientes</button><button class="text-button" data-ci-exp="negociacoes">Exportar negociações</button></div>'+
 (P?ciPrev():'')+'</div></section>';}
function ciPrev(){const I=CI.plano,P=I.plano;return '<div class="mt-impprev"><p><b>'+esc(I.arq)+'</b> · '+I.tabs.map(t=>esc(t.nome)+': '+t.L.length+' linha(s) de '+(t.tipo==='cli'?'clientes':'negociações')).join(' · ')+'</p><ul><li>'+P.cliNovos.length+' cliente(s) novo(s)'+(P.cliNovos.length?': '+P.cliNovos.slice(0,5).map(c=>esc(c.razao)).join(', ')+(P.cliNovos.length>5?'…':''):'')+'</li><li>'+P.cliAtual.length+' cliente(s) com dados completados</li><li>'+P.negNovas.length+' negociação(ões) nova(s)'+(P.negNovas.length?' · '+BRL(P.negNovas.reduce((a,n)=>a+n.valor,0))+' · '+[...new Set(P.negNovas.map(n=>ETNL(n.etapa)))].join(', '):'')+'</li></ul>'+(P.avisos.length?'<p class="ob-alert warn">'+P.avisos.slice(0,8).map(esc).join('<br>')+(P.avisos.length>8?'<br>… e mais '+(P.avisos.length-8):'')+'</p>':'')+
 '<div class="ob-actions"><button class="button primary" id="ci-ok" '+(P.cliNovos.length+P.cliAtual.length+P.negNovas.length?'':'disabled')+'>Importar</button><button class="text-button" id="ci-x">Cancelar</button></div></div>';}
document.addEventListener('change',e=>{if(e.target.id!=='ci-file')return;const f=e.target.files[0];e.target.value='';if(!f)return;ciLer(f).then(I=>{CI.plano=I;CI.arq=I.arq;const el=document.getElementById('ci-panel');if(el)el.outerHTML=ciPanel();say('Planilha lida: confira e clique em Importar.');}).catch(err=>say(err.message||'Não foi possível ler a planilha.'));});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#ci-ok,#ci-x,[data-ci-mod],[data-ci-exp]');if(!b)return;
 if(b.id==='ci-ok'){ciAplicar();return;}if(b.id==='ci-x'){CI.plano=null;const el=document.getElementById('ci-panel');if(el)el.outerHTML=ciPanel();return;}
 if(b.dataset.ciMod){ciBaixar('modelo-'+b.dataset.ciMod+'-armant360.csv',ciCSVout(CI_MODELOS[b.dataset.ciMod]));return;}
 if(b.dataset.ciExp){ciBaixar(b.dataset.ciExp+'-armant360-'+hoje()+'.csv',ciCSVout(ciExportar(b.dataset.ciExp)));}});
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='cad-cli'&&f.id!=='cad-dem')return;e.preventDefault();
 if(f.id==='cad-cli'){const id=f.dataset.id,cnpj=val(f,'cnpj').replace(/\D/g,'');
  if(!val(f,'razao'))return err('Informe a razão social.',f,'razao');
  if(!cnpjOk(cnpj))return err('CNPJ inválido. Confira os 14 dígitos.',f,'cnpj');
  if(cnpj&&clientes().some(c=>c.cnpj===cnpj&&c.id!==id))return err('Já existe um cliente com este CNPJ.',f,'cnpj');
  const em=val(f,'email');if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return err('E-mail inválido.',f,'email');
  const o={razao:val(f,'razao'),sigla:val(f,'sigla'),cnpj,tipo:val(f,'tipo'),esfera:val(f,'tipo')==='Público'?val(f,'esfera'):'',segmento:val(f,'segmento'),cidade:val(f,'cidade'),uf:val(f,'uf'),contato:val(f,'contato'),cargo:val(f,'cargo'),email:em,fone:val(f,'fone'),
   medicao:val(f,'medicao'),period:val(f,'period'),dia:num(val(f,'dia')),aprov:num(val(f,'aprov')),pag:num(val(f,'pag')),inss:num(val(f,'inss')),iss:num(val(f,'iss')),gar:num(val(f,'gar')),docs:[...f.querySelectorAll('input[name=docs]:checked')].map(x=>x.value),obs:val(f,'obs')};
  if(o.dia<1||o.dia>31)return err('Dia de fechamento deve ficar entre 1 e 31.',f,'dia');
  let c=id?C.cli.find(x=>x.id===id):null;if(c)Object.assign(c,o);else{c={id:nextCli(),criado:hoje(),...o};C.cli.push(c);}
  save();say(id?'Cliente atualizado.':'Cliente cadastrado: '+c.id+'.');location.hash='#clientes/'+c.id;return;}
 const cc=f.dataset.cc;
 if(!val(f,'cli'))return err('Selecione o cliente.',f,'cli');
 if(!val(f,'nome'))return err('Informe o nome da obra.',f,'nome');
 if(!val(f,'aprovData'))return err('Informe a data da aprovação.',f,'aprovData');
 const valor=num(val(f,'valor'));if(val(f,'valor')&&!(valor>0))return err('Valor inválido. Use o formato 1.234.567,89.',f,'valor');
 const o={cli:val(f,'cli'),nome:val(f,'nome'),cidade:val(f,'cidade'),uf:val(f,'uf'),end:val(f,'end'),orc:val(f,'orc'),aprovDoc:val(f,'aprovDoc'),aprovNum:val(f,'aprovNum'),aprovData:val(f,'aprovData'),valor,prazo:num(val(f,'prazo')),inicio:val(f,'inicio'),medicao:val(f,'medicao'),obs:val(f,'obs')};
 let d=cc?C.dem.find(x=>x.cc===cc):null;if(d)Object.assign(d,o);else{d={cc:nextCC(o.aprovData),etapa:1,criado:hoje(),...o};C.dem.push(d);C.seq[d.cc.slice(3,7)]=+d.cc.slice(8);}
 C.resp[d.cc]={...(C.resp[d.cc]||{}),ro:val(f,'ro'),csc:val(f,'csc')};
 if(!cc&&(DI.itens.length||DI.anexos.length)){if(DI.itens.length)C.itens[d.cc]=DI.itens.map((x,i)=>({id:'IT-'+String(i+1).padStart(3,'0'),...x,criado:hoje(),origem:'orçamento'}));if(DI.anexos.length)C.anexos[d.cc]=DI.anexos.slice();diReset();}
 if(!cc&&f.dataset.neg){const n=negById(f.dataset.neg);if(n){n.cc=d.cc;if(n.etapa!=='ganha')moveNeg(n,'ganha');}}
 save();if(!cc&&origemObras){origemObras=false;const H=hoje(),fase=!d.inicio?'Planejamento (início a definir)':d.inicio>H?'Planejamento até '+br(d.inicio):'Mobilização (início '+br(d.inicio)+')';say('Obra '+d.cc+' criada: '+fase+'.');location.hash='#projects';return;}
 say(cc?'Demanda atualizada.':'Centro de custo gerado: '+d.cc+'. Este é o código da obra.');location.hash='#cc/'+d.cc;});
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='cad-fq'){QF.q=t.value;const r=document.getElementById('cad-fres');if(r)r.innerHTML=fornTable(fornFilter());}
 if(t.id==='cad-q'){Q.cli=t.value;const r=document.getElementById('cad-res');if(r)r.innerHTML=cliTable(cliFilter());}
 if(t.id==='cad-aprovdata'){const f=t.form,p=document.getElementById('cad-ccprev');if(p&&f&&!f.dataset.cc)p.textContent=nextCC(t.value);}
 if(t.form&&t.form.id==='cad-dem'&&t.name==='cli'&&!t.form.dataset.cc){const c=cliById(t.value);if(c&&t.form.elements.medicao)t.form.elements.medicao.value=c.medicao;}});
const kbRefresh=()=>{const w=document.getElementById('kb-wrap');if(w)w.innerHTML=kanban();};
document.addEventListener('click',e=>{const mv=e.target.closest('[data-kb-mv]');if(mv){moveNeg(negById(mv.dataset.kbMv),mv.dataset.to);kbRefresh();}});
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-kb-id]');if(!c)return;e.dataTransfer.setData('text/plain',c.dataset.kbId);e.dataTransfer.effectAllowed='move';c.classList.add('drag');});
document.addEventListener('dragend',e=>{document.querySelectorAll('.kb-card.drag,.kb-col.over').forEach(x=>x.classList.remove('drag','over'));});
document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('[data-kb-col]');if(!col)return;e.preventDefault();document.querySelectorAll('.kb-col.over').forEach(x=>x!==col&&x.classList.remove('over'));col.classList.add('over');});
document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('[data-kb-col]');if(!col)return;e.preventDefault();const id=e.dataTransfer.getData('text/plain');moveNeg(negById(id),col.dataset.kbCol);kbRefresh();});
document.addEventListener('input',e=>{if(e.target.id==='kb-q'){KQ.q=e.target.value;const pos=e.target.selectionStart;kbRefresh();const q=document.getElementById('kb-q');if(q){q.focus();q.setSelectionRange(pos,pos);}}});
document.addEventListener('change',e=>{if(e.target.id==='kb-resp'){KQ.resp=e.target.value;kbRefresh();}});
document.addEventListener('click',e=>{const ft=e.target.closest('[data-cad-ft]');if(ft){QF.tipo=ft.dataset.cadFt;show(fornList());return;}});
document.addEventListener('click',e=>{const t=e.target.closest('#cad-delcli,#cad-deldem,#cad-delforn,#cad-delneg');if(!t)return;
 if(t.dataset.confirm!=='1'){t.dataset.confirm='1';const old=t.textContent;t.textContent='Confirmar exclusão';setTimeout(()=>{t.dataset.confirm='';t.textContent=old;},4000);return;}
 if(t.id==='cad-delneg'){C.neg=C.neg.filter(n=>n.id!==t.dataset.id);save();say('Negociação excluída.');location.hash='#commercial';return;}
 if(t.id==='cad-delforn'){C.forn=C.forn.filter(f=>f.id!==t.dataset.id);save();say('Fornecedor excluído.');location.hash='#fornecedores';return;}
 if(t.id==='cad-delcli'){C.cli=C.cli.filter(c=>c.id!==t.dataset.id);save();say('Cliente excluído.');location.hash='#clientes';}
 else{C.dem=C.dem.filter(d=>d.cc!==t.dataset.cc);save();say('Cadastro excluído. O código '+t.dataset.cc+' não será reutilizado.');location.hash='#operations';}});

/* atividades da demanda: só o superadmin cria, altera e exclui */
const itRefresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
const itNum=v=>{const x=num(v);return x>0?x:NaN;};
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='cad-it')return;e.preventDefault();const er=m=>{const p=document.getElementById('cad-iterr');if(p)p.textContent=m;};
 if(!souSuper())return er('Só o superadmin altera esta lista.');const cc=f.dataset.cc,g=n=>String(f.elements[n].value).trim(),q=itNum(g('qtd')),v=itNum(g('valor'));
 if(!g('atividade'))return er('Informe a atividade.');if(!(q>0))return er('Quantidade inválida.');if(!(v>0))return er('Valor inválido. Use o formato 1.234,56.');
 (C.itens[cc]=itens(cc).slice()).push({id:nextIt(cc),atividade:g('atividade'),qtd:q,un:g('un'),valor:v,criado:hoje()});save();itRefresh();say('Atividade adicionada à demanda '+cc+'.');});
document.addEventListener('click',e=>{const t=e.target.closest('[data-it-ed],[data-it-del],[data-it-save],[data-it-cancel],[data-it-paste],[data-it-eap]');if(!t)return;if(!souSuper()){say('Só o superadmin altera esta lista.');return;}
 const d=t.dataset,cc=(location.hash.split('/')[1]||'');
 if(d.itEd){IV.ed=d.itEd;itRefresh();return;}
 if(d.itCancel!==undefined){IV.ed=null;itRefresh();return;}
 if(d.itSave){const tr=t.closest('tr'),g=k=>tr.querySelector('[data-it-f="'+k+'"]').value.trim(),i=itens(cc).find(x=>x.id===d.itSave);if(!i)return;const q=itNum(g('qtd')),v=itNum(g('valor'));
  if(!g('atividade')||!(q>0)||!(v>0)){say('Preencha atividade, quantidade e valor válidos.');return;}Object.assign(i,{atividade:g('atividade'),qtd:q,un:g('un'),valor:v,alterado:hoje()});IV.ed=null;save();itRefresh();say('Atividade '+i.id+' salva.');return;}
 if(d.itDel){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';return;}C.itens[cc]=itens(cc).filter(x=>x.id!==d.itDel);save();itRefresh();say('Atividade excluída da demanda.');return;}
 if(d.itPaste){const tx=(document.getElementById('cad-itp')||{}).value||'',out=[],bad=[];
  tx.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach((l,n)=>{const c=l.split(/\t|;/).map(x=>x.trim());const [a,q,u,v]=c.length>=4?[c[0],c[1],c[2],c[3]]:[c[0],c[1],'',c[2]];const qq=itNum(q),vv=itNum(v);if(a&&qq>0&&vv>0)out.push({atividade:a,qtd:qq,un:u,valor:vv});else bad.push(n+1);});
  if(!out.length){say('Nenhuma linha válida. Use: atividade, quantidade, valor.');return;}const L=C.itens[d.itPaste]=itens(d.itPaste).slice();out.forEach(o=>L.push({id:nextIt(d.itPaste),...o,criado:hoje()}));save();itRefresh();say(out.length+' atividade(s) adicionada(s)'+(bad.length?'; linhas ignoradas: '+bad.join(', '):'')+'.');return;}
 if(d.itEap){const E=(window.ARMANT_OBRA_DATA||{}).items||[],L=C.itens[d.itEap]=[];E.forEach(x=>{if(x.q>0)L.push({id:nextIt(d.itEap),cod:x.c,atividade:x.d,qtd:x.q,un:x.u||'',valor:Math.round((x.t||0)*100)/100,criado:hoje()});});save();itRefresh();say(L.length+' serviços da EAP trazidos para a lista da demanda.');}});

document.addEventListener('change',e=>{const t=e.target;
 if(t.id==='cad-difile'&&t.files&&t.files.length){const f=t.form||document.getElementById('cad-dem');diArquivos([...t.files],f).then(()=>{t.value='';});return;}
 if(t.id==='cad-diadd'&&t.files&&t.files.length){const N=window.ArmantNucleo,cc=t.dataset.cc;if(!N||!N.files){say('Sem armazenamento de arquivos neste navegador.');return;}
  Promise.all([...t.files].map(async file=>{const id='ANX-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);await N.files.put({id,blob:file,mime:file.type||'application/octet-stream',nome:file.name});return {id,nome:file.name,mime:file.type,size:file.size,em:hoje()};}))
  .then(L=>{C.anexos[cc]=anexos(cc).concat(L);save();itRefresh();say(L.length+' documento(s) anexado(s) ao '+cc+'.');}).catch(()=>say('Não foi possível guardar o arquivo.'));}});
document.addEventListener('dragover',e=>{const b=e.target.closest&&e.target.closest('.cad-dibox');if(b){e.preventDefault();b.classList.add('over');}});
document.addEventListener('dragleave',e=>{const b=e.target.closest&&e.target.closest('.cad-dibox');if(b)b.classList.remove('over');});
document.addEventListener('drop',e=>{const b=e.target.closest&&e.target.closest('.cad-dibox');if(!b)return;e.preventDefault();b.classList.remove('over');const f=document.getElementById('cad-dem');if(f&&e.dataTransfer.files.length)diArquivos([...e.dataTransfer.files],f);});
document.addEventListener('click',async e=>{const t=e.target.closest('[data-di-open],[data-di-cli]');if(!t)return;
 if(t.dataset.diCli){const dom=t.dataset.diCli,sig=dom.split('.')[0].toUpperCase(),f=document.getElementById('cad-dem');let c=clientes().find(x=>norm(x.sigla)===norm(sig));
  if(!c){c={id:nextCli(),criado:hoje(),razao:sig,sigla:sig,cnpj:'',tipo:'Público',esfera:'',segmento:'',cidade:'',uf:'',contato:'',cargo:'',email:'@'+dom,fone:'',medicao:'Por execução',period:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,docs:[],obs:'Criado a partir do e-mail de aprovação. Complete razão social e CNPJ.'};C.cli.push(c);save();}
  DI.cliSug='';if(f){f.querySelector('select[name=cli]').insertAdjacentHTML('beforeend',f.querySelector('select[name=cli] option[value="'+c.id+'"]')?'':'<option value="'+c.id+'">'+esc(c.sigla)+'</option>');f.elements.cli.value=c.id;}diResumo();say('Cliente '+c.sigla+' cadastrado ('+c.id+'). Complete o cadastro depois em Comercial.');return;}
 const N=window.ArmantNucleo;if(!N||!N.files)return;try{const o=await N.files.get(t.dataset.diOpen);if(!o||!o.blob)throw new Error();const u=URL.createObjectURL(o.blob),a=document.createElement('a');a.href=u;a.download=o.nome||t.dataset.diOpen;if(/pdf|image/.test(o.mime||''))a.target='_blank',a.removeAttribute('download');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}catch(err){say('Arquivo não encontrado neste aparelho.');}});

window.ArmantCadastros={version:'1.5',importarComercial:ciLer,state:C,nextCC,demandas,cliNome,clientes,fornecedores:()=>C.forn,itens,anexos,roDe,cscDe,setResp};
render();
})();
