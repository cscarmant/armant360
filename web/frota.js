/* Armant 360 · Controle de frota (extensão do painel)
   Carregar depois de financeiro.js:  <script src="frota.js" defer></script>
   Menu Frota (#frota/<aba>): veículos, diário de bordo (uso por obra e motorista), abastecimentos,
   manutenções e documentos. Custos entram no Financeiro (contas a pagar, por centro de custo). */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{},FIN=()=>window.ArmantFinanceiro||null;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const BRL=v=>'R$ '+nf(v);
const br=iso=>iso?iso.split('-').reverse().join('/'):'—';
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const addD=(iso,n)=>{const x=new Date(iso+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const dd=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const num=v=>{const s=String(v==null?'':v).replace(/[R$\s]/g,'');if(!s)return NaN;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);};
const demandas=()=>typeof CAD.demandas==='function'?CAD.demandas():[];
const at=NAV.findIndex(x=>x[0]==='catalog');if(!NAV.some(x=>x[0]==='frota'))NAV.splice(at<0?NAV.length:at,0,['frota','Frota','truck']);

/* ---------- estado ---------- */
const TIPOS=['Utilitário','Picape','Carro','Caminhão','Van','Moto','Outro'];
const COMB=['Diesel','Gasolina','Etanol','Flex','GNV','Elétrico'];
const DOCS=['IPVA','Licenciamento','Seguro','Tacógrafo','ANTT','Outro'];
const MAN=['Preventiva','Corretiva','Pneus','Revisão programada','Funilaria','Outro'];
const FR={vei:[],uso:[],abs:[],man:[],doc:[],seq:{v:0,u:0,a:0,m:0,d:0}};
try{const s=JSON.parse(localStorage.getItem('a360frota')||'null');if(s){['vei','uso','abs','man','doc'].forEach(k=>{if(Array.isArray(s[k]))FR[k]=s[k];});FR.seq={...FR.seq,...(s.seq||{})};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360frota',JSON.stringify(FR));}catch(e){}};
const V={tab:'veiculos',vf:''};
const veic=id=>FR.vei.find(v=>v.id===id);
/* pessoas (motorista e responsável) são guardadas pelo id do cadastro de acesso; a tela mostra o nome */
const pessoasF=()=>window.ArmantAcesso&&window.ArmantAcesso.users?window.ArmantAcesso.users():[];
const pNomeF=id=>{const u=pessoasF().find(x=>x.id===id);return u?u.nome:(id||'');};
const pessoasOpts=sel=>'<option value="">— escolha a pessoa —</option>'+pessoasF().map(u=>'<option value="'+u.id+'"'+(sel===u.id?' selected':'')+'>'+esc(u.nome)+'</option>').join('');
const vNome=id=>{const v=veic(id);return v?v.placa+' · '+v.modelo:'—';};
const nid=(k,p)=>{FR.seq[k]++;return p+'-'+String(FR.seq[k]).padStart(4,'0');};
/* km atual = maior km informado em uso, abastecimento ou manutenção */
function kmAtual(id){const v=veic(id);let k=+(v&&v.km0)||0;FR.uso.forEach(u=>{if(u.v===id)k=Math.max(k,+u.kmF||0);});FR.abs.forEach(a=>{if(a.v===id)k=Math.max(k,+a.km||0);});FR.man.forEach(m=>{if(m.v===id)k=Math.max(k,+m.km||0);});return k;}
/* consumo médio pelos abastecimentos de tanque cheio, em ordem de km */
function consumo(id){const L=FR.abs.filter(a=>a.v===id&&a.km>0).sort((a,b)=>a.km-b.km);let km=0,l=0;for(let i=1;i<L.length;i++){km+=L[i].km-L[i-1].km;l+=+L[i].litros;}return l>0?km/l:null;}
function custos(id,desde){const f=x=>x.v===id&&(!desde||x.data>=desde);return {comb:FR.abs.filter(f).reduce((a,x)=>a+(+x.valor||0),0),man:FR.man.filter(f).reduce((a,x)=>a+(+x.valor||0),0),doc:FR.doc.filter(x=>x.v===id&&x.pago&&(!desde||x.venc>=desde)).reduce((a,x)=>a+(+x.valor||0),0)};}
function alertas(){const out=[];FR.doc.filter(d=>!d.pago).forEach(d=>{const n=dd(hoje(),d.venc);if(n<=30)out.push({k:n<0?'bad':'warn',t:d.tipo+' de '+vNome(d.v)+(n<0?' venceu há '+(-n)+' dias':' vence em '+n+' dias')+' ('+br(d.venc)+')',ref:'documentos'});});
 FR.vei.filter(v=>v.ativo!==false).forEach(v=>{const km=kmAtual(v.id);const ult=FR.man.filter(m=>m.v===v.id&&m.proxKm).sort((a,b)=>b.data.localeCompare(a.data))[0];if(ult&&km>=ult.proxKm-500)out.push({k:km>=ult.proxKm?'bad':'warn',t:'Revisão de '+v.placa+(km>=ult.proxKm?' passou do km '+nf(ult.proxKm,0):' em '+nf(ult.proxKm-km,0)+' km')+' (agora '+nf(km,0)+' km)',ref:'manutencoes'});
  const ud=FR.man.filter(m=>m.v===v.id&&m.proxData&&!m.feita).sort((a,b)=>a.proxData.localeCompare(b.proxData))[0];if(ud&&dd(hoje(),ud.proxData)<=15)out.push({k:ud.proxData<hoje()?'bad':'warn',t:'Manutenção agendada de '+v.placa+' em '+br(ud.proxData),ref:'manutencoes'});});return out;}
/* custo vai para o Financeiro (pago na hora ou a pagar) */
function fin(ref,o){const F=FIN();if(!F||typeof F.lancarExterno!=='function')return;F.lancarExterno({ref,orig:'frota',cat:'Veículos e combustível',...o});}
function finDel(ref){const F=FIN();if(F&&typeof F.removerExterno==='function')F.removerExterno(ref);}

/* ---------- interface ---------- */
const panel=(title,sub,body,act)=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+(act||'')+'</div>'+body+'</section>';
function card(label,value,sub,foot,opt={}){return '<article class="kpi-card '+(opt.featured?'featured':'')+'"><div class="kpi-top"><div class="kpi-label">'+ic(opt.icon||'truck')+esc(label)+'</div></div><div class="kpi-number">'+value+'</div><p class="kpi-subtitle">'+sub+'</p><div class="kpi-footer"><span class="trend '+(opt.warn?'warning':'')+'">'+ic(opt.warn?'clock':'up')+foot+'</span></div></article>';}
const TABS=[['veiculos','Veículos'],['uso','Diário de bordo'],['abastecimentos','Abastecimentos'],['manutencoes','Manutenções'],['documentos','Documentos'],['custos','Custos']];
const vOpts=sel=>'<option value="">Selecione o veículo</option>'+FR.vei.filter(v=>v.ativo!==false||v.id===sel).map(v=>'<option value="'+v.id+'"'+(sel===v.id?' selected':'')+'>'+esc(v.placa+' · '+v.modelo)+'</option>').join('');
const ccOpts=sel=>'<option value="">Sem obra (uso administrativo)</option>'+demandas().map(d=>'<option value="'+d.cc+'"'+(sel===d.cc?' selected':'')+'>'+d.cc+' · '+esc(d.nome.slice(0,45))+'</option>').join('');
const fld=(k,l,v,o={})=>'<label class="ob-field'+(o.wide?' cad-wide':'')+'"><span>'+l+(o.req?' <b class="cad-req">*</b>':'')+'</span>'+(o.html||'<input name="'+k+'" type="'+(o.type||'text')+'" value="'+esc(v==null?'':v)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.mode?' inputmode="'+o.mode+'"':'')+'>')+(o.hint?'<small>'+o.hint+'</small>':'')+'</label>';
const sel=(k,arr,v)=>'<select name="'+k+'">'+arr.map(x=>'<option'+(x===v?' selected':'')+'>'+x+'</option>').join('')+'</select>';
const vFilter=()=>'<label class="period-control ob-ctl"><select id="fr-vf" aria-label="Filtrar por veículo"><option value="">Todos os veículos</option>'+FR.vei.map(v=>'<option value="'+v.id+'"'+(V.vf===v.id?' selected':'')+'>'+esc(v.placa)+'</option>').join('')+'</select></label>';
const vf=L=>L.filter(x=>!V.vf||x.v===V.vf);
const delBtn=(k,id)=>'<button class="text-button" data-fr-del="'+k+'" data-id="'+id+'">Excluir</button>';
function formBox(id,title,body,btn){return '<section class="panel ob-panel"><div class="panel-header"><div><h2>'+title+'</h2></div></div><form id="'+id+'" class="fr-form" novalidate><div class="ob-form">'+body+'</div><p class="cad-err" role="alert"></p><div class="ob-actions"><button class="button primary" type="submit">'+ic('check')+btn+'</button></div></form></section>';}
const noVei='<p class="ob-alert warn">Cadastre um veículo primeiro na aba Veículos.</p>';

function T_veiculos(){const ativos=FR.vei.filter(v=>v.ativo!==false),m30=addD(hoje(),-30),c30=ativos.reduce((a,v)=>{const c=custos(v.id,m30);return a+c.comb+c.man+c.doc;},0),al=alertas(),km30=FR.uso.filter(u=>u.data>=m30).reduce((a,u)=>a+Math.max(0,(+u.kmF||0)-(+u.kmI||0)),0);
 return '<div class="kpi-grid">'+card('Veículos ativos',String(ativos.length),FR.vei.length-ativos.length?(FR.vei.length-ativos.length)+' inativo(s)':'frota cadastrada','—',{featured:1})+card('Custo nos últimos 30 dias',BRL(c30),'combustível + manutenção + documentos','vai para o Financeiro',{icon:'wallet'})+card('Km rodados em 30 dias',nf(km30,0)+' km',FR.uso.filter(u=>u.data>=m30).length+' registro(s) no diário','por obra e motorista',{icon:'chart'})+card('Alertas',String(al.length),al.length?'documentos e revisões':'nada pendente',al.length?'ver abaixo':'em dia',{icon:'clock',warn:al.length>0})+'</div>'+
 (al.length?'<section class="fn-alerts">'+al.map(a=>'<div class="ob-alert '+a.k+'"><span>'+esc(a.t)+'</span><a class="text-button" href="#frota/'+a.ref+'">Abrir '+ic('arrow')+'</a></div>').join('')+'</section>':'')+
 '<div class="ob-split"><div class="ob-main">'+panel('Veículos',FR.vei.length+' cadastrado(s)',FR.vei.length?'<div class="table-wrap"><table class="ob-t"><thead><tr><th>Placa</th><th>Veículo</th><th>Responsável</th><th class="ob-n">Km atual</th><th class="ob-n">Consumo</th><th class="ob-n">Custo total</th><th>Situação</th><th></th></tr></thead><tbody>'+
  FR.vei.map(v=>{const c=custos(v.id),cm=consumo(v.id);return '<tr><td class="ob-code"><strong>'+esc(v.placa)+'</strong></td><td class="ob-d">'+esc(v.modelo)+'<small>'+esc([v.tipo,v.ano,v.comb].filter(Boolean).join(' · '))+'</small></td><td>'+esc(pNomeF(v.resp)||'—')+'</td><td class="ob-n">'+nf(kmAtual(v.id),0)+'</td><td class="ob-n">'+(cm?nf(cm,1)+' km/l':'—')+'</td><td class="ob-n">'+BRL(c.comb+c.man+c.doc)+'</td><td><span class="status'+(v.ativo===false?' ob-mute':'')+'">'+(v.ativo===false?'inativo':'ativo')+'</span></td><td class="ob-nw"><button class="text-button" data-fr-tog="'+v.id+'">'+(v.ativo===false?'Reativar':'Inativar')+'</button> '+(FR.uso.concat(FR.abs,FR.man,FR.doc).some(x=>x.v===v.id)?'':delBtn('vei',v.id))+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class="ob-p">Nenhum veículo cadastrado.</p>')+'</div>'+
 '<aside class="ob-side">'+formBox('fr-vei','Novo veículo',fld('placa','Placa','',{req:1,ph:'ABC1D23'})+fld('modelo','Marca e modelo','',{req:1,ph:'Ex.: Fiat Strada'})+fld('tipo','Tipo','',{html:sel('tipo',TIPOS,'Utilitário')})+fld('ano','Ano','',{type:'number'})+fld('comb','Combustível','',{html:sel('comb',COMB,'Flex')})+fld('km0','Km atual','',{mode:'numeric'})+fld('resp','Responsável','',{html:'<select name="resp">'+pessoasOpts('')+'</select>'})+fld('renavam','Renavam',''),'Cadastrar veículo')+'</aside></div>';}
function T_uso(){const L=vf(FR.uso).slice().sort((a,b)=>b.data.localeCompare(a.data)||b.n-a.n);
 return '<div class="ob-split"><div class="ob-main">'+panel('Diário de bordo','Quem usou, para qual obra, de onde para onde e quantos km.',
 '<div class="toolbar cad-tools">'+vFilter()+'</div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Obra</th><th>Trajeto</th><th class="ob-n">Km</th><th></th></tr></thead><tbody>'+
 (L.map(u=>'<tr><td class="ob-nw">'+br(u.data)+'</td><td class="ob-nw">'+esc(vNome(u.v))+'</td><td>'+esc(pNomeF(u.mot))+'</td><td class="ob-nw">'+(u.cc?'<a class="cad-cc" href="#cc/'+u.cc+'">'+u.cc+'</a>':'adm.')+'</td><td class="ob-d">'+esc(u.trajeto||'—')+(u.obs?'<small>'+esc(u.obs)+'</small>':'')+'</td><td class="ob-n">'+nf(u.kmF-u.kmI,0)+'<small>'+nf(u.kmI,0)+' → '+nf(u.kmF,0)+'</small></td><td>'+delBtn('uso',u.id)+'</td></tr>').join('')||'<tr><td colspan="7">Nenhum registro.</td></tr>')+'</tbody></table></div>')+'</div>'+
 '<aside class="ob-side">'+(FR.vei.length?formBox('fr-uso','Registrar uso',fld('v','Veículo','',{req:1,html:'<select name="v">'+vOpts(V.vf)+'</select>'})+fld('data','Data',hoje(),{type:'date'})+fld('mot','Motorista','',{req:1,html:'<select name="mot">'+pessoasOpts('')+'</select>'})+fld('cc','Obra','',{html:'<select name="cc">'+ccOpts('')+'</select>'})+fld('kmI','Km de saída',V.vf?kmAtual(V.vf):'',{req:1,mode:'numeric'})+fld('kmF','Km de chegada','',{req:1,mode:'numeric'})+fld('trajeto','Trajeto','',{wide:1,ph:'Ex.: base → obra TJ-RS → Dufrio'})+fld('obs','Observação','',{wide:1}),'Registrar uso'):noVei)+'</aside></div>';}
function T_abs(){const L=vf(FR.abs).slice().sort((a,b)=>b.data.localeCompare(a.data)),tot=L.reduce((a,x)=>a+(+x.valor||0),0),lt=L.reduce((a,x)=>a+(+x.litros||0),0);
 return '<div class="ob-split"><div class="ob-main">'+panel('Abastecimentos',L.length+' registro(s) · '+nf(lt,1)+' litros · '+BRL(tot)+(lt?' · média '+BRL(tot/lt)+'/litro':''),
 '<div class="toolbar cad-tools">'+vFilter()+'</div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Data</th><th>Veículo</th><th>Posto</th><th>Obra</th><th class="ob-n">Km</th><th class="ob-n">Litros</th><th class="ob-n">Preço/l</th><th class="ob-n">Valor</th><th>Fotos</th><th></th></tr></thead><tbody>'+
 (L.map(a=>'<tr><td class="ob-nw">'+br(a.data)+'</td><td class="ob-nw">'+esc(vNome(a.v))+'</td><td>'+esc(a.posto||'—')+'<small>'+esc(pNomeF(a.mot))+'</small></td><td class="ob-nw">'+(a.cc||'adm.')+'</td><td class="ob-n">'+nf(a.km,0)+'</td><td class="ob-n">'+nf(a.litros,2)+'</td><td class="ob-n">'+BRL(a.valor/a.litros)+(a.preco?'<small'+(a.difPreco?' class="fn-neg" title="Diferença de '+a.difPreco+'% entre o cupom e a bomba"':'')+'>bomba '+BRL(a.preco)+'</small>':'')+'</td><td class="ob-n"><strong>'+BRL(a.valor)+'</strong></td><td class="ob-nw fr-fotos">'+(a.foto?'<button class="fr-th" data-fr-foto="'+a.id+'|foto" title="Cupom"><img src="'+a.foto+'" alt="Cupom"></button>':'')+(a.fotoPreco?'<button class="fr-th" data-fr-foto="'+a.id+'|fotoPreco" title="Preço na bomba"><img src="'+a.fotoPreco+'" alt="Preço na bomba"></button>':'')+(!a.foto&&!a.fotoPreco?'<small>—</small>':'')+'</td><td>'+delBtn('abs',a.id)+'</td></tr>').join('')||'<tr><td colspan="10">Nenhum abastecimento.</td></tr>')+'</tbody></table></div>')+'</div>'+
 '<aside class="ob-side">'+(FR.vei.length?formBox('fr-abs','Registrar abastecimento',fld('v','Veículo','',{req:1,html:'<select name="v">'+vOpts(V.vf)+'</select>'})+fld('data','Data',hoje(),{type:'date'})+fld('km','Km no painel','',{req:1,mode:'numeric'})+fld('litros','Litros','',{req:1,mode:'decimal'})+fld('valor','Valor total (R$)','',{req:1,mode:'decimal'})+fld('posto','Posto','')+fld('mot','Motorista','',{html:'<select name="mot">'+pessoasOpts('')+'</select>'})+fld('cc','Obra','',{html:'<select name="cc">'+ccOpts('')+'</select>'})+'<label class="ob-check fn-chk"><input type="checkbox" name="pago" checked> Pago na hora (cartão ou dinheiro)</label>','Registrar abastecimento'):noVei)+'</aside></div>';}
function T_man(){const L=vf(FR.man).slice().sort((a,b)=>b.data.localeCompare(a.data));
 return '<div class="ob-split"><div class="ob-main">'+panel('Manutenções','Preventivas, corretivas, pneus e revisões. Informe a próxima revisão para receber o alerta.',
 '<div class="toolbar cad-tools">'+vFilter()+'</div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Data</th><th>Veículo</th><th>Serviço</th><th>Oficina</th><th class="ob-n">Km</th><th>Próxima</th><th class="ob-n">Valor</th><th></th></tr></thead><tbody>'+
 (L.map(m=>'<tr><td class="ob-nw">'+br(m.data)+'</td><td class="ob-nw">'+esc(vNome(m.v))+'</td><td class="ob-d"><span class="status'+(m.tipo==='Corretiva'?' risk':'')+'">'+esc(m.tipo)+'</span><small>'+esc(m.desc||'')+'</small></td><td>'+esc(m.oficina||'—')+'</td><td class="ob-n">'+(m.km?nf(m.km,0):'—')+'</td><td class="ob-nw">'+[m.proxKm?nf(m.proxKm,0)+' km':'',m.proxData?br(m.proxData):''].filter(Boolean).join(' · ')+'</td><td class="ob-n"><strong>'+BRL(m.valor)+'</strong></td><td>'+delBtn('man',m.id)+'</td></tr>').join('')||'<tr><td colspan="8">Nenhuma manutenção.</td></tr>')+'</tbody></table></div>')+'</div>'+
 '<aside class="ob-side">'+(FR.vei.length?formBox('fr-man','Registrar manutenção',fld('v','Veículo','',{req:1,html:'<select name="v">'+vOpts(V.vf)+'</select>'})+fld('data','Data',hoje(),{type:'date'})+fld('tipo','Tipo','',{html:sel('tipo',MAN,'Preventiva')})+fld('desc','O que foi feito','',{wide:1,ph:'Ex.: troca de óleo e filtros'})+fld('oficina','Oficina','')+fld('km','Km','',{mode:'numeric'})+fld('valor','Valor (R$)','',{req:1,mode:'decimal'})+fld('venc','Vencimento do pagamento',addD(hoje(),30),{type:'date'})+fld('proxKm','Próxima revisão (km)','',{mode:'numeric'})+fld('proxData','Próxima revisão (data)','',{type:'date'}),'Registrar manutenção'):noVei)+'</aside></div>';}
function T_doc(){const L=vf(FR.doc).slice().sort((a,b)=>a.venc.localeCompare(b.venc));
 return '<div class="ob-split"><div class="ob-main">'+panel('Documentos e vencimentos','IPVA, licenciamento e seguro com alerta 30 dias antes.',
 '<div class="toolbar cad-tools">'+vFilter()+'</div><div class="table-wrap"><table class="ob-t"><thead><tr><th>Vencimento</th><th>Veículo</th><th>Documento</th><th class="ob-n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>'+
 (L.map(d=>{const n=dd(hoje(),d.venc);return '<tr class="'+(!d.pago&&n<0?'fn-late':'')+'"><td class="ob-nw">'+br(d.venc)+'<small>'+(d.pago?'pago':n<0?'venceu há '+(-n)+' d':'em '+n+' d')+'</small></td><td class="ob-nw">'+esc(vNome(d.v))+'</td><td class="ob-d">'+esc(d.tipo)+'<small>'+esc(d.obs||'')+'</small></td><td class="ob-n">'+BRL(d.valor)+'</td><td><span class="status'+(d.pago?' fn-ok':n<0?' risk':n<=30?' risk':'')+'">'+(d.pago?'pago':n<0?'vencido':n<=30?'vence logo':'em dia')+'</span></td><td class="ob-nw">'+(d.pago?'':'<button class="text-button" data-fr-pay="'+d.id+'">Marcar pago</button> ')+delBtn('doc',d.id)+'</td></tr>';}).join('')||'<tr><td colspan="6">Nenhum documento.</td></tr>')+'</tbody></table></div>')+'</div>'+
 '<aside class="ob-side">'+(FR.vei.length?formBox('fr-doc','Novo vencimento',fld('v','Veículo','',{req:1,html:'<select name="v">'+vOpts(V.vf)+'</select>'})+fld('tipo','Documento','',{html:sel('tipo',DOCS,'IPVA')})+fld('venc','Vencimento','',{type:'date',req:1})+fld('valor','Valor (R$)','',{mode:'decimal'})+fld('obs','Observação','',{wide:1,ph:'Ex.: apólice 123, 3 parcelas'}),'Cadastrar vencimento'):noVei)+'</aside></div>';}
function T_custos(){const rows=FR.vei.map(v=>{const c=custos(v.id),km=FR.uso.filter(u=>u.v===v.id).reduce((a,u)=>a+Math.max(0,u.kmF-u.kmI),0),t=c.comb+c.man+c.doc;return {v,c,km,t};}),byCC={};
 FR.uso.forEach(u=>{const k=u.cc||'adm.';byCC[k]=byCC[k]||{km:0,n:0};byCC[k].km+=Math.max(0,u.kmF-u.kmI);byCC[k].n++;});FR.abs.forEach(a=>{const k=a.cc||'adm.';byCC[k]=byCC[k]||{km:0,n:0};byCC[k].comb=(byCC[k].comb||0)+(+a.valor||0);});
 const totKm=Object.values(byCC).reduce((a,x)=>a+x.km,0),totT=rows.reduce((a,r)=>a+r.t,0);
 return panel('Custo por veículo','Combustível, manutenção e documentos pagos. Custo por km = custo total ÷ km do diário de bordo.','<div class="table-wrap"><table class="ob-t"><thead><tr><th>Veículo</th><th class="ob-n">Combustível</th><th class="ob-n">Manutenção</th><th class="ob-n">Documentos</th><th class="ob-n">Total</th><th class="ob-n">Km no diário</th><th class="ob-n">Custo por km</th></tr></thead><tbody>'+(rows.map(r=>'<tr><td class="ob-d"><strong>'+esc(r.v.placa)+'</strong><small>'+esc(r.v.modelo)+'</small></td><td class="ob-n">'+BRL(r.c.comb)+'</td><td class="ob-n">'+BRL(r.c.man)+'</td><td class="ob-n">'+BRL(r.c.doc)+'</td><td class="ob-n"><strong>'+BRL(r.t)+'</strong></td><td class="ob-n">'+nf(r.km,0)+'</td><td class="ob-n">'+(r.km?BRL(r.t/r.km):'—')+'</td></tr>').join('')||'<tr><td colspan="7">Nenhum veículo.</td></tr>')+'</tbody></table></div>')+
 panel('Uso por obra','Km rodados e combustível por centro de custo. Rateio sugerido do custo da frota pelos km.','<div class="table-wrap"><table class="ob-t"><thead><tr><th>Obra</th><th class="ob-n">Viagens</th><th class="ob-n">Km</th><th class="ob-n">% dos km</th><th class="ob-n">Combustível lançado</th><th class="ob-n">Rateio sugerido</th></tr></thead><tbody>'+(Object.entries(byCC).map(([k,x])=>'<tr><td>'+(k==='adm.'?'Administrativo':'<a class="cad-cc" href="#cc/'+k+'">'+k+'</a>')+'</td><td class="ob-n">'+x.n+'</td><td class="ob-n">'+nf(x.km,0)+'</td><td class="ob-n">'+(totKm?nf(x.km/totKm*100,0)+'%':'—')+'</td><td class="ob-n">'+BRL(x.comb||0)+'</td><td class="ob-n">'+(totKm?BRL(totT*x.km/totKm):'—')+'</td></tr>').join('')||'<tr><td colspan="6">Nenhum uso registrado.</td></tr>')+'</tbody></table></div>');}

const TB={veiculos:T_veiculos,uso:T_uso,abastecimentos:T_abs,manutencoes:T_man,documentos:T_doc,custos:T_custos};
function page(){return '<div class="view-intro ob-intro"><div><span class="ob-pill-real">frota · salvo neste navegador</span><h2>Cada veículo, cada km, cada real.</h2><p>Diário de bordo por obra e motorista, abastecimentos com consumo, manutenções com aviso de revisão e documentos com aviso de vencimento. Os custos entram no Financeiro.</p></div>'+ic('truck')+'</div>'+
 '<div class="ob-tabs" role="tablist">'+TABS.map(([k,l])=>'<a role="tab" href="#frota/'+k+'" aria-selected="'+(V.tab===k)+'" class="'+(V.tab===k?'active':'')+'">'+l+'</a>').join('')+'</div><div id="fr-tab" class="fr-tab">'+TB[V.tab]()+'</div>';}
const refresh=()=>{const el=document.getElementById('fr-tab');if(el){const y=window.scrollY;el.innerHTML=TB[V.tab]();window.scrollTo(0,y);}};
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),pill=document.querySelector('.demo-pill'),act=document.querySelector('.heading-actions');
 if(on){if(!('notice' in chrome)){chrome.notice=notice?notice.innerHTML:'';chrome.pill=pill?pill.innerHTML:'';}
  if(notice)notice.innerHTML='<strong>Frota.</strong> Registros salvos neste navegador até existir um banco compartilhado. Placas e Renavam são dados da empresa; não registre CPF ou CNH de motoristas aqui.';
  if(pill)pill.innerHTML='<span></span> Frota';if(act)act.style.visibility='hidden';}
 else if('notice' in chrome){if(notice)notice.innerHTML=chrome.notice;if(pill)pill.innerHTML=chrome.pill;if(act)act.style.visibility='';}}
function nav(){const n=document.getElementById('navigation'),cnt=n&&n.querySelector('.nav-count')?n.querySelector('.nav-count').textContent:'13';
 n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id==='frota'?'active':'')+'" '+(id==='frota'?'aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}
const prevRender=render;
render=function(){const [v,a]=location.hash.slice(1).split('/');
 if(v==='frota'){V.tab=a&&TB[a]?a:'veiculos';setChrome(true);nav();document.getElementById('breadcrumb').textContent='Frota · '+TABS.find(t=>t[0]===V.tab)[1];document.getElementById('page-title').innerHTML='Frota<span>.</span>';document.getElementById('page-subtitle').textContent='Veículos, uso por obra, combustível, manutenção e documentos.';
  const c=document.getElementById('view');c.innerHTML=page();c.className='fade-in';return;}
 setChrome(false);prevRender();};

/* ---------- eventos (prefixo fr-) ---------- */
const onFr=()=>location.hash.startsWith('#frota');
const fv=(f,k)=>f.elements[k]?String(f.elements[k].value).trim():'';
const ferr=(f,m)=>{const p=f.querySelector('.cad-err');if(p)p.textContent=m;return false;};
/* registros usados também pelo app de campo */
function addUso(o){const u={id:nid('u','USO'),n:FR.seq.u,...o};FR.uso.push(u);save();return u;}
function addAbs(o){const a={id:nid('a','ABS'),...o};FR.abs.push(a);fin(a.id,{desc:'Combustível · '+vNome(a.v)+(a.posto?' · '+a.posto:''),parte:a.posto||'',cc:a.cc||'',valor:+a.valor,data:a.data,venc:a.data,pago:!!a.pago,doc:a.id});save();return a;}
document.addEventListener('submit',e=>{const f=e.target;if(!f.classList.contains('fr-form'))return;e.preventDefault();
 if(f.id==='fr-vei'){const placa=fv(f,'placa').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa))return ferr(f,'Placa inválida. Use o formato ABC1234 ou ABC1D23.');if(FR.vei.some(v=>v.placa===placa))return ferr(f,'Esta placa já está cadastrada.');if(!fv(f,'modelo'))return ferr(f,'Informe a marca e o modelo.');
  const km=num(fv(f,'km0'));FR.vei.push({id:nid('v','VEI'),placa,modelo:fv(f,'modelo'),tipo:fv(f,'tipo'),ano:fv(f,'ano'),comb:fv(f,'comb'),km0:km>0?km:0,resp:fv(f,'resp'),renavam:fv(f,'renavam'),ativo:true});save();refresh();say('Veículo '+placa+' cadastrado.');return;}
 const v=fv(f,'v');if(!v)return ferr(f,'Selecione o veículo.');
 if(f.id==='fr-uso'){const kmI=num(fv(f,'kmI')),kmF=num(fv(f,'kmF'));if(!fv(f,'mot'))return ferr(f,'Informe o motorista.');if(!(kmI>=0)||!(kmF>=kmI))return ferr(f,'Km de chegada deve ser maior ou igual ao de saída.');if(kmF-kmI>2000)return ferr(f,'Mais de 2.000 km em um registro: confira os números.');
  addUso({v,data:fv(f,'data')||hoje(),mot:fv(f,'mot'),cc:fv(f,'cc'),kmI,kmF,trajeto:fv(f,'trajeto'),obs:fv(f,'obs')});V.vf=V.vf||'';refresh();say('Uso registrado: '+nf(kmF-kmI,0)+' km.');return;}
 if(f.id==='fr-abs'){const km=num(fv(f,'km')),l=num(fv(f,'litros')),val=num(fv(f,'valor'));if(!(km>0))return ferr(f,'Informe o km do painel.');if(!(l>0))return ferr(f,'Informe os litros.');if(!(val>0))return ferr(f,'Informe o valor.');
  if(km<kmAtual(v)-1)return ferr(f,'O km informado é menor que o último registrado ('+nf(kmAtual(v),0)+').');
  addAbs({v,data:fv(f,'data')||hoje(),km,litros:l,valor:val,posto:fv(f,'posto'),mot:fv(f,'mot'),cc:fv(f,'cc'),pago:f.elements.pago.checked});refresh();const cm=consumo(v);say('Abastecimento registrado'+(cm?': média de '+nf(cm,1)+' km/l':'')+'. Lançado no Financeiro.');return;}
 if(f.id==='fr-man'){const val=num(fv(f,'valor'));if(!(val>=0))return ferr(f,'Informe o valor.');const m={id:nid('m','MAN'),v,data:fv(f,'data')||hoje(),tipo:fv(f,'tipo'),desc:fv(f,'desc'),oficina:fv(f,'oficina'),km:num(fv(f,'km'))||0,valor:val,proxKm:num(fv(f,'proxKm'))||0,proxData:fv(f,'proxData')};FR.man.push(m);
  if(val>0)fin(m.id,{desc:m.tipo+' · '+vNome(v)+(m.desc?' · '+m.desc:''),parte:m.oficina,valor:val,data:m.data,venc:fv(f,'venc')||m.data,doc:m.id});save();refresh();say('Manutenção registrada'+(val>0?' e lançada em contas a pagar':'')+'.');return;}
 if(f.id==='fr-doc'){const venc=fv(f,'venc');if(!venc)return ferr(f,'Informe o vencimento.');const val=num(fv(f,'valor'))||0;const d={id:nid('d','DOC'),v,tipo:fv(f,'tipo'),venc,valor:val,obs:fv(f,'obs'),pago:false};FR.doc.push(d);
  if(val>0)fin(d.id,{desc:d.tipo+' · '+vNome(v),valor:val,data:hoje(),venc,doc:d.id});save();refresh();say('Vencimento cadastrado'+(val>0?' e lançado em contas a pagar':'')+'.');return;}});
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||!onFr())return;const d=t.dataset;
 if(d.frFoto){const [id,k]=d.frFoto.split('|'),a=FR.abs.find(x=>x.id===id);if(!a||!a[k])return;document.body.insertAdjacentHTML('beforeend','<div class="fr-lb" role="dialog" aria-label="'+(k==='foto'?'Cupom':'Preço na bomba')+'"><figure><img src="'+a[k]+'" alt=""><figcaption>'+(k==='foto'?'Cupom':'Preço na bomba')+' · '+esc(vNome(a.v))+' · '+br(a.data)+(a.posto?' · '+esc(a.posto):'')+'</figcaption></figure><button class="button outline fn-sm" data-fr-lbx>Fechar</button></div>');return;}
 if(d.frLbx!==undefined){document.querySelectorAll('.fr-lb').forEach(x=>x.remove());return;}
 if(d.frTog){const v=veic(d.frTog);if(v){v.ativo=v.ativo===false;save();refresh();}return;}
 if(d.frPay){const x=FR.doc.find(y=>y.id===d.frPay);if(x){x.pago=true;if(x.valor>0)fin(x.id,{desc:x.tipo+' · '+vNome(x.v),valor:x.valor,data:hoje(),venc:x.venc,pago:true,doc:x.id});save();refresh();say(x.tipo+' marcado como pago.');}return;}
 if(d.frDel){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';setTimeout(()=>{t.dataset.confirm='';t.textContent='Excluir';},4000);return;}
  FR[d.frDel]=FR[d.frDel].filter(x=>x.id!==d.id);finDel(d.id);save();refresh();say('Registro excluído.');}});
document.addEventListener('change',e=>{const t=e.target;if(!onFr())return;if(t.id==='fr-vf'){V.vf=t.value;refresh();}
 if(t.form&&t.form.id==='fr-uso'&&t.name==='v'&&t.value){const k=t.form.elements.kmI;if(k&&!k.value)k.value=kmAtual(t.value);}});

window.ArmantFrota={version:'1.0',state:FR,veiculos:()=>FR.vei.filter(v=>v.ativo!==false),kmAtual,addUso,addAbs};
render();
})();
