/* Armant 360 · Materiais e estoque (extensão do painel)
   Carregar depois de cadastros.js:  <script src="materiais.js" defer></script>
   Operação & CSC → #materiais/<aba>: Saídas (para o centro de custo da obra, devolução e transferência entre estoques),
   Lançamento de materiais (entrada), Estoque (um ou vários estoques/depósitos), Movimentações e Cadastro de materiais
   (um a um ou vários de uma vez). Exporta e importa a base em Excel (.xlsx) e CSV. Internamente a saída continua com tipo 'entrega'. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{};
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const qf=v=>nf(v,Math.abs(v-Math.round(v))<1e-6?0:2);
const BRL=v=>'R$ '+nf(v||0);
const br=iso=>iso?iso.split('-').reverse().join('/'):'—';
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const num=v=>{const s=String(v==null?'':v).replace(/[R$\s]/g,'');if(!s)return NaN;return +(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);};
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const demandas=()=>typeof CAD.demandas==='function'?CAD.demandas():[];
const fornL=()=>(typeof CAD.fornecedores==='function'?CAD.fornecedores():[]).filter(f=>(f.tipos||[]).some(t=>t!=='Serviço')&&f.sit!=='Bloqueado');
const fornId=n=>{const f=fornL().find(x=>norm(x.fant||x.razao)===norm(n)||norm(x.razao)===norm(n));return f?f.id:'';};
const ccNome=cc=>{const d=demandas().find(x=>x.cc===cc);return d?d.nome:'';};

/* ---------- catálogo inicial (exemplo de climatização; ajustar ao catálogo real) ---------- */
const CATS=['Tubulação','Isolamento','Refrigerante','Elétrica','Dreno','Suportes e fixação','EPI','Consumíveis','Outros'];
const UNS=['UN','M','KG','CX','RL','PC','L','PAR','JG'];
const SEED=[['Tubo de cobre 1/4" (rolo 15 m)','RL','Tubulação',4],['Tubo de cobre 3/8" (rolo 15 m)','RL','Tubulação',4],['Tubo de cobre 1/2" (rolo 15 m)','RL','Tubulação',4],['Tubo de cobre 5/8" (rolo 15 m)','RL','Tubulação',2],['Tubo de cobre 3/4" (rolo 15 m)','RL','Tubulação',2],
 ['Isolamento elastomérico 1/4" × 9 mm','M','Isolamento',40],['Isolamento elastomérico 3/8" × 9 mm','M','Isolamento',40],['Isolamento elastomérico 1/2" × 13 mm','M','Isolamento',30],['Isolamento elastomérico 5/8" × 13 mm','M','Isolamento',30],
 ['Gás refrigerante R-410A (cilindro 11,3 kg)','UN','Refrigerante',2],['Gás refrigerante R-32 (cilindro 9 kg)','UN','Refrigerante',1],['Vareta de solda foscoper','KG','Consumíveis',1],
 ['Cabo PP 4 × 2,5 mm²','M','Elétrica',50],['Cabo PP 3 × 1,5 mm²','M','Elétrica',50],['Disjuntor bipolar 25 A','UN','Elétrica',4],
 ['Tubo PVC 3/4" para dreno (barra 6 m)','PC','Dreno',6],['Mangueira cristal 3/4"','M','Dreno',20],['Suporte de condensadora 400 mm (par)','PAR','Suportes e fixação',4],['Fita PVC para acabamento','RL','Consumíveis',10],['Bucha e parafuso 10 mm','CX','Suportes e fixação',2]];
const SEED_MAT=SEED.map((r,i)=>({id:'MAT-'+String(i+1).padStart(3,'0'),d:r[0],u:r[1],cat:r[2],min:r[3],ex:1}));

/* ---------- estado (salvo neste navegador) ---------- */
{const at=NAV.findIndex(x=>x[0]==='operations');if(!NAV.some(x=>x[0]==='materiais'))NAV.splice(at<0?NAV.length:at+1,0,['materiais','Almoxarifado','layers']);}
const M={mat:null,mov:[],map:{},ped:[],dep:[],seq:{mov:0,rom:0,ped:0}};
try{const s=JSON.parse(localStorage.getItem('a360mat')||'null');if(s){M.mat=Array.isArray(s.mat)?s.mat:null;M.mov=Array.isArray(s.mov)?s.mov:[];M.seq={mov:0,rom:0,...(s.seq||{})};M.map=s.map||{};M.ped=Array.isArray(s.ped)?s.ped:[];M.dep=Array.isArray(s.dep)?s.dep:[];M.base=s.base||null;M.semBase=!!s.semBase;}}catch(e){}
if(!M.dep.length)M.dep=[{id:'DEP-01',nome:'Almoxarifado central',local:'Sede'}];
if(!M.mat)M.mat=SEED_MAT.map(x=>({...x}));
M.mat.forEach(m=>{if(m.cat&&!CATS.includes(m.cat))CATS.push(m.cat);if(m.u&&!UNS.includes(m.u))UNS.push(m.u);});
/* exemplo de foto: ilustração simples por categoria, marcada como exemplo (não é foto real) */
const COR_CAT={'Tubulação':'#2f6f8f','Isolamento':'#7a8f3a','Refrigerante':'#2a8f7a','Elétrica':'#b8862a','Dreno':'#4a6fa5','Suportes e fixação':'#6b6b6b','EPI':'#c25b1f','Consumíveis':'#8a4f9a','Outros':'#5b7a80'};
function exemploImg(m){const cor=COR_CAT[m.cat]||'#5b7a80';const palavras=String(m.d).split(/\s+/);const l1=palavras.slice(0,3).join(' '),l2=palavras.slice(3,6).join(' ');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="'+cor+'"/><rect x="16" y="16" width="208" height="208" rx="18" fill="none" stroke="#ffffff55" stroke-width="2"/><text x="120" y="108" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#fff">'+esc(l1)+'</text><text x="120" y="134" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#ffffffdd">'+esc(l2)+'</text><text x="120" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#ffffffaa">EXEMPLO</text></svg>';
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
M.mat.forEach(m=>{if(m.ex&&!m.foto){m.foto=exemploImg(m);m.fotoEx=true;}});
const save=()=>{try{localStorage.setItem('a360mat',JSON.stringify(M));}catch(e){}};
/* foto do material: reduzida no aparelho (720 px) antes de guardar */
function reduzirFoto(file){return new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const k=Math.min(1,720/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);ok(cv.toDataURL('image/jpeg',0.8));};img.onerror=()=>ko(new Error('imagem inválida'));img.src=r.result;};r.onerror=()=>ko(new Error('arquivo'));r.readAsDataURL(file);});}
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.mtFoto||!t.files||!t.files[0])return;const m=M.mat.find(x=>x.id===t.dataset.mtFoto);if(!m)return;try{m.foto=await reduzirFoto(t.files[0]);delete m.fotoEx;save();refresh();say('Foto do material salva.');}catch(err){say('Não foi possível ler a foto.');}});
document.addEventListener('click',e=>{const z=e.target.closest&&e.target.closest('[data-mt-zoom]');if(!z)return;const m=M.mat.find(x=>x.id===z.dataset.mtZoom);if(!m||!m.foto)return;document.querySelectorAll('.mt-lb').forEach(x=>x.remove());document.body.insertAdjacentHTML('beforeend','<div class="mt-lb" role="dialog" aria-label="Foto do material"><figure><img src="'+m.foto+'" alt=""><figcaption>'+esc(m.d)+' · '+m.id+(m.fotoEx?' · ilustração de exemplo':'')+'</figcaption></figure><button class="button outline" data-mt-lbx>Fechar</button></div>');});
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-mt-lbx]'))document.querySelectorAll('.mt-lb').forEach(x=>x.remove());});
const matById=id=>M.mat.find(m=>m.id===id);
const TIPOS={entrada:'Entrada',entrega:'Saída para obra',devolucao:'Devolução da obra',transf:'Transferência entre estoques'};
/* estoques (depósitos): cada movimento sai ou entra num estoque; sem estoque gravado = Almoxarifado central */
const DEP0='DEP-01',depOf=v=>v.dep||DEP0,depById=id=>M.dep.find(x=>x.id===id),depNome=id=>{const d=depById(id);return d?d.nome:(id||'—');};
const depOpts=(sel,vazio)=>(vazio?'<option value="">'+vazio+'</option>':'')+M.dep.map(d=>'<option value="'+d.id+'"'+(sel===d.id?' selected':'')+'>'+esc(d.nome)+(d.local?' · '+esc(d.local):'')+'</option>').join('');
const F={tab:'entrega',q:'',cat:'',ftipo:'',fcc:'',dep:'',draft:{},bulk:null,imp:null};
/* pessoas (quem enviou, recebeu ou pediu) são guardadas pelo id do cadastro de acesso; a tela mostra o nome */
const pessoasM=()=>window.ArmantAcesso&&window.ArmantAcesso.users?window.ArmantAcesso.users():[];
const pNomeM=id=>{const u=pessoasM().find(x=>x.id===id);return u?u.nome:(id||'');};
const pessoaSel=(k,l,v,o={})=>inp(k,l,v,{...o,html:'<select data-mt-h="'+k+'"><option value="">— escolha a pessoa —</option>'+pessoasM().map(u=>'<option value="'+u.id+'"'+(v===u.id?' selected':'')+'>'+esc(u.nome)+'</option>').join('')+'</select>'});
const blank=tipo=>({tipo,data:hoje(),doc:'',forn:'',cc:'',resp:'',rec:'',obs:'',dep:F.dep||DEP0,dep2:'',itens:[{m:'',q:'',pu:''}]});
const draft=tipo=>F.draft[tipo]||(F.draft[tipo]=blank(tipo));

/* saldo e custo médio ponderado, em ordem cronológica */
/* dep: só aquele estoque; sem dep: todos os estoques somados (transferência não muda o total) */
function ledger(skipId,dep){const st={};M.mat.forEach(m=>st[m.id]={q:0,cm:0,ent:0,sai:0});
 M.mov.filter(v=>v.id!==skipId).slice().sort((a,b)=>a.data.localeCompare(b.data)||a.n-b.n).forEach(v=>{const o=depOf(v);let sg;
  if(v.tipo==='transf'){if(!dep)return;sg=o===dep?-1:v.dep2===dep?1:0;}else{if(dep&&o!==dep)return;sg=v.tipo==='entrega'?-1:1;}
  if(!sg)return;
  v.itens.forEach(it=>{const s=st[it.m];if(!s)return;
   if(v.tipo==='entrada'||(v.tipo==='transf'&&sg>0)){const pu=it.pu||0,nq=s.q+it.q;s.cm=nq>0?(s.q*s.cm+it.q*pu)/nq:pu;s.q=nq;s.ent+=it.q;}
   else if(sg>0){s.q+=it.q;s.ent+=it.q;}
   else{s.q-=it.q;s.sai+=it.q;}});});return st;}
const saiDe=t=>t==='entrega'||t==='transf';
const movValor=v=>v.itens.reduce((a,it)=>a+it.q*(it.pu||0),0);
function porObra(){const o={};M.mov.forEach(v=>{if(v.tipo==='entrada'||!v.cc)return;const sg=v.tipo==='entrega'?1:-1;const x=o[v.cc]||(o[v.cc]={q:0,v:0,n:0,ult:''});x.v+=sg*movValor(v);x.n++;if(v.data>x.ult)x.ult=v.data;});return o;}

/* ---------- peças de interface ---------- */
const panel=(title,sub,body,act)=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+(act||'')+'</div>'+body+'</section>';
function card(label,value,sub,foot,opt={}){return '<article class="kpi-card '+(opt.featured?'featured':'')+'"><div class="kpi-top"><div class="kpi-label">'+ic(opt.icon||'chart')+esc(label)+'</div></div><div class="kpi-number">'+value+'</div><p class="kpi-subtitle">'+sub+'</p><div class="kpi-footer"><span class="'+(opt.warn?'warn':'')+'">'+foot+'</span></div></article>';}
const TABS=[['entrega','Saídas'],['lancamento','Lançamento de materiais'],['estoque','Estoque'],['movs','Movimentações'],['catalogo','Cadastro de materiais']];
const ccOpts=sel=>'<option value="">Selecione o centro de custo</option>'+demandas().map(d=>'<option value="'+d.cc+'"'+(sel===d.cc?' selected':'')+'>'+d.cc+' · '+esc(d.nome)+'</option>').join('');
const matOpts=sel=>'<option value="">Selecione o material</option>'+CATS.map(c=>{const ms=M.mat.filter(m=>m.cat===c);return ms.length?'<optgroup label="'+c+'">'+ms.map(m=>'<option value="'+m.id+'"'+(sel===m.id?' selected':'')+'>'+m.id+' · '+esc(m.d)+' ('+m.u+')</option>').join('')+'</optgroup>':'';}).join('');
const inp=(k,label,val,o={})=>'<label class="ob-field'+(o.wide?' cad-wide':'')+'"><span>'+label+(o.req?' <b class="cad-req">*</b>':'')+'</span>'+(o.html||'<input data-mt-h="'+k+'" type="'+(o.type||'text')+'" value="'+esc(val)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+'>')+(o.hint?'<small>'+o.hint+'</small>':'')+'</label>';

/* ---------- importação de nota fiscal (XML da NF-e ou PDF do DANFE) ---------- */
const N2=v=>{const x=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(x)?0:x;};
const brN=s=>{s=String(s||'').trim();return s?+(s.replace(/\./g,'').replace(',','.')):0;};
const toBR=v=>String(v).replace('.',',');
function guessCat(d){d=norm(d);return /cobre|tubo de cobre|tubul/.test(d)?'Tubulação':/isol|elastom|armaflex/.test(d)?'Isolamento':/r-?410|r-?32|r-?22|gas refrig|fluido/.test(d)?'Refrigerante':/cabo|fio|disjunt|eletr|tomada|conduite/.test(d)?'Elétrica':/dreno|pvc|mangueira/.test(d)?'Dreno':/suporte|parafuso|bucha|chumb|abracadeira/.test(d)?'Suportes e fixação':/luva|capacete|oculos|epi|bota/.test(d)?'EPI':'Outros';}
function guessUn(u){u=String(u||'').toUpperCase().replace(/[^A-Z]/g,'');const m={METRO:'M',METROS:'M',BARRA:'BR',BR:'BR',UNIDADE:'UN',QUILO:'KG',LITRO:'L',UN:'UN',UND:'UN',UNID:'UN',PC:'PC',PCA:'PC',PECA:'PC',M:'M',MT:'M',MTS:'M',KG:'KG',CX:'CX',RL:'RL',ROLO:'RL',L:'L',LT:'L',PAR:'PAR',PR:'PAR',JG:'JG',JOGO:'JG'};return m[u]||u||'UN';}
const toks=d=>new Set(norm(d).replace(/(\d)\s+(m|mm|kg|hp|a|v)\b/g,'$1$2').replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w&&!['de','da','do','x','com','para','e'].includes(w)));
function sim(a,b){const A=toks(a),B=toks(b);let i=0;A.forEach(w=>{if(B.has(w))i++;});return i/Math.max(1,A.size+B.size-i);}
function matchMat(cnpj,cod,desc){const k=cnpj+'|'+cod;if(M.map[k]&&matById(M.map[k]))return M.map[k];let best=null,bs=0;M.mat.forEach(x=>{const v=sim(desc,x.d);if(v>bs){bs=v;best=x;}});return best&&bs>=0.6?best.id:'__new';}
function parseXML(txt){const x=new DOMParser().parseFromString(txt,'application/xml');if(x.getElementsByTagName('parsererror').length)throw new Error('O arquivo não é um XML válido.');
 const g=(el,tag)=>{const e=el&&el.getElementsByTagName(tag)[0];return e?e.textContent.trim():'';};const inf=x.getElementsByTagName('infNFe')[0];
 if(!inf){if(x.getElementsByTagName('CompNfse').length||x.getElementsByTagName('Nfse').length||x.getElementsByTagName('infNFSe').length)throw new Error('Este XML é de NFS-e (nota de serviço). A importação de materiais lê NF-e (modelo 55).');throw new Error('Não encontrei a NF-e neste XML (tag infNFe).');}
 const ide=inf.getElementsByTagName('ide')[0],emit=inf.getElementsByTagName('emit')[0],tot=inf.getElementsByTagName('ICMSTot')[0];
 const itens=[...inf.getElementsByTagName('det')].map(d=>{const p=d.getElementsByTagName('prod')[0];return {c:g(p,'cProd'),d:g(p,'xProd'),ncm:g(p,'NCM'),cfop:g(p,'CFOP'),u:g(p,'uCom'),q:N2(g(p,'qCom')),pu:N2(g(p,'vUnCom')),v:N2(g(p,'vProd'))};});
 return {fonte:'XML',chave:(inf.getAttribute('Id')||'').replace(/^NFe/,'')||g(x,'chNFe'),num:g(ide,'nNF'),serie:g(ide,'serie'),data:(g(ide,'dhEmi')||g(ide,'dEmi')).slice(0,10),cnpj:g(emit,'CNPJ')||g(emit,'CPF'),nome:g(emit,'xFant')||g(emit,'xNome'),razao:g(emit,'xNome'),vnf:N2(g(tot,'vNF')),vprod:N2(g(tot,'vProd')),itens};}
let pdfLib=null;
function loadPdf(){if(pdfLib)return pdfLib;pdfLib=new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=()=>{pdfLib=null;ko(new Error('Não consegui carregar o leitor de PDF (precisa de internet).'));};document.head.appendChild(s);});return pdfLib;}
async function parsePDF(buf){const lib=await loadPdf(),doc=await lib.getDocument({data:buf}).promise,rows=[];
 for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p),tc=await pg.getTextContent(),by={};tc.items.forEach(it=>{if(!it.str.trim())return;const y=Math.round(it.transform[5]/3);(by[y]=by[y]||[]).push(it);});
  Object.keys(by).sort((a,b)=>b-a).forEach(y=>rows.push(by[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' ')));}
 const all=rows.join('\n'),flat=all.replace(/\s+/g,' ');
 if(flat.length<40)throw new Error('O PDF não tem texto (pode ser uma imagem escaneada). Use o XML da nota.');
 const ch=(flat.match(/(\d{4}\s?){10}\d{4}/)||[''])[0].replace(/\s/g,'');
 const num=(flat.match(/N[ºo°.]\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}|\d{1,9})/i)||[])[1]||(ch?String(+ch.slice(25,34)):'');
 const serie=(flat.match(/S[ÉE]RIE\s*:?\s*(\d{1,3})/i)||[])[1]||(ch?String(+ch.slice(22,25)):'');
 const dt=(flat.match(/EMISS[ÃA]O\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)||flat.match(/(\d{2})\/(\d{2})\/(\d{4})/)||[]);
 const cnpj=((flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)||[''])[0]).replace(/\D/g,'')||(ch?ch.slice(6,20):'');
 const vnf=brN((flat.match(/VALOR TOTAL DA NOTA\s*:?\s*(?:R\$\s*)?([\d.]+,\d{2})/i)||[])[1]);
 const nome=((all.match(/RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS/i)||[])[1]||(rows.find(r=>/LTDA|S\.?A\.?|EIRELI|ME\b/i.test(r)&&!/RECEBEMOS/i.test(r))||'')).trim().slice(0,80);
 const re=/^(\S{1,20})\s+(.+?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Za-z]{1,6})\s+([\d.]*\d,\d{1,4})\s+([\d.]*\d,\d{2,10})\s+([\d.]*\d,\d{2})/;
 const itens=rows.map(r=>r.match(re)).filter(Boolean).map(m=>({c:m[1],d:m[2],ncm:m[3],cfop:m[5],u:m[6],q:brN(m[7]),pu:brN(m[8]),v:brN(m[9])}));
 return {fonte:'PDF',chave:ch,num,serie,data:dt.length?dt[3]+'-'+dt[2]+'-'+dt[1]:'',cnpj,nome,razao:nome,vnf,vprod:itens.reduce((a,i)=>a+i.v,0),itens};}
function applyNF(nf){if(nf.chave&&M.mov.some(v=>v.chave===nf.chave)){say('Esta nota já foi lançada ('+M.mov.find(v=>v.chave===nf.chave).id+').');return;}
 const d=draft('entrada'),f=fornL().find(x=>(x.cnpj&&x.cnpj===nf.cnpj))||null;
 d.forn=f?(f.fant||f.razao):(nf.nome||d.forn);d.doc='NF '+(nf.num||'?')+(nf.serie?' série '+nf.serie:'');if(nf.data)d.data=nf.data;d.nf={...nf,itens:undefined,n:nf.itens.length};d.chave=nf.chave||'';
 if(nf.itens.length)d.itens=nf.itens.map(i=>({m:matchMat(nf.cnpj,i.c,i.d),q:toBR(i.q),pu:toBR(+i.pu.toFixed(4)),nf:{c:i.c,d:i.d,u:i.u,ncm:i.ncm,cfop:i.cfop}}));
 F.lastNF=nf;refresh();
 const novos=d.itens.filter(i=>i.m==='__new').length;
 say('Nota '+(nf.num||'')+' lida do '+nf.fonte+': '+nf.itens.length+' item(ns)'+(novos?', '+novos+' sem material correspondente (serão cadastrados ou escolha um existente)':'')+(f?'':nf.cnpj?'. Fornecedor não está no cadastro.':'')+(nf.itens.length?'':'. Itens não reconhecidos no PDF: lance manualmente ou use o XML.'));}
async function importFile(file){if(!file)return;const nm=file.name.toLowerCase();try{
 if(nm.endsWith('.xml')||file.type.includes('xml'))applyNF(parseXML(await file.text()));
 else if(nm.endsWith('.pdf')||file.type==='application/pdf'){say('Lendo o PDF…');applyNF(await parsePDF(new Uint8Array(await file.arrayBuffer())));}
 else say('Envie o XML da NF-e ou o PDF do DANFE.');}catch(err){say(err.message||'Não foi possível ler a nota.');}}
function nfBox(){const d=draft('entrada'),nf=d.nf;
 return '<div class="mt-nf"><label class="mt-drop" id="mt-drop"><input type="file" id="mt-nffile" accept=".xml,.pdf,application/xml,text/xml,application/pdf" hidden>'+ic('download')+'<span><strong>Importar nota fiscal</strong><small>Arraste aqui ou clique para escolher o XML da NF-e ou o PDF do DANFE. O XML é lido por completo; no PDF, os itens são reconhecidos quando o texto é legível.</small></span></label>'+
 (nf?'<div class="mt-nfinfo"><b>NF '+esc(nf.num||'?')+(nf.serie?' · série '+esc(nf.serie):'')+'</b> · '+esc(nf.razao||nf.nome||'')+(nf.cnpj?' · CNPJ '+esc(nf.cnpj.length===14?nf.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):nf.cnpj):'')+' · emissão '+br(nf.data)+' · total da nota '+BRL(nf.vnf)+' · lida do '+nf.fonte+(nf.chave?'<small>chave '+esc(nf.chave.replace(/(\d{4})/g,'$1 ').trim())+'</small>':'')+(nf.vnf&&Math.abs(nf.vnf-nf.vprod)>0.01&&nf.vprod?'<small>Diferença de '+BRL(nf.vnf-nf.vprod)+' entre o total da nota e os produtos (frete, IPI, ST ou desconto).</small>':'')+'<button class="text-button" id="mt-nfclear">Desfazer importação</button></div>':'')+'</div>';}

/* ---------- formulário de movimento (entrada, entrega, devolução) ---------- */
function linhas(tipo){const d=draft(tipo),st=ledger(null,d.dep||DEP0),isE=tipo==='entrada';
 return '<div class="table-wrap"><table class="ob-t mt-lines"><thead><tr><th>Material</th><th class="ob-n">Em estoque</th><th>Quantidade</th>'+(isE?'<th>Preço unitário (R$)</th>':'<th class="ob-n">Custo médio</th>')+'<th class="ob-n">Valor</th><th></th></tr></thead><tbody>'+
 d.itens.map((it,i)=>{const nw=it.m==='__new'&&it.nf,m=matById(it.m)||(nw?{id:'novo',u:guessUn(it.nf.u)}:null),s=m?(st[m.id]||{q:0,cm:0}):null,q=num(it.q),pu=isE?num(it.pu):(s?s.cm:0),bad=it.q!==''&&(!(q>0)||(saiDe(tipo)&&s&&q>s.q+1e-9))||(isE&&it.pu!==''&&!(pu>=0));
  return '<tr class="'+(bad?'ob-err':(m&&q>0?'ob-has':''))+'"><td class="mt-sel"><select data-mt-l="'+i+'" data-k="m" aria-label="Material da linha '+(i+1)+'">'+(it.nf?'<option value="__new"'+(it.m==='__new'?' selected':'')+'>+ Cadastrar novo: '+esc(it.nf.d.slice(0,60))+' ('+esc(guessUn(it.nf.u))+')</option>':'')+matOpts(it.m)+'</select>'+(it.nf?'<small class="mt-nfl">NF: '+esc(it.nf.c)+' · '+esc(it.nf.d)+(it.nf.ncm?' · NCM '+esc(it.nf.ncm):'')+'</small>':'')+'</td><td class="ob-n">'+(s?qf(s.q)+' <small>'+m.u+'</small>':'—')+'</td>'+
  '<td class="ob-nw"><input class="ob-pct" inputmode="decimal" data-mt-l="'+i+'" data-k="q" value="'+esc(it.q)+'" placeholder="0"> <small>'+(m?m.u:'')+'</small></td>'+
  (isE?'<td><input class="ob-pct mt-pu" inputmode="decimal" data-mt-l="'+i+'" data-k="pu" value="'+esc(it.pu)+'" placeholder="0,00"></td>':'<td class="ob-n">'+(s&&s.cm?BRL(s.cm):'—')+'</td>')+
  '<td class="ob-n" data-mt-v="'+i+'">'+(q>0&&pu>=0&&!bad?BRL(q*pu):'—')+'</td><td><button class="text-button" data-mt-rm="'+i+'" aria-label="Remover linha '+(i+1)+'">Remover</button></td></tr>';}).join('')+
 '</tbody></table></div>';}
function movCheck(tipo){const d=draft(tipo),st=ledger(null,d.dep||DEP0),e=[];let n=0,val=0;
 if(!d.data)e.push('Informe a data.');if(!depById(d.dep||DEP0))e.push('Selecione o estoque.');
 if(tipo==='transf'){if(!d.dep2)e.push('Selecione o estoque de destino.');else if(d.dep2===(d.dep||DEP0))e.push('O estoque de destino deve ser diferente do de origem.');}
 else if(tipo!=='entrada'&&!d.cc)e.push('Selecione o centro de custo da obra.');if(tipo==='entrada'&&!d.forn)e.push('Informe o fornecedor.');if(tipo==='entrega'&&!d.rec)e.push('Informe quem recebeu na obra.');
 const used={};d.itens.forEach((it,i)=>{if(!it.m&&it.q==='')return;const m=matById(it.m)||(it.m==='__new'&&it.nf&&tipo==='entrada'?{id:'__new'+i,u:guessUn(it.nf.u)}:null),q=num(it.q);if(m&&!st[m.id])st[m.id]={q:0,cm:0};if(!m){e.push('Linha '+(i+1)+': selecione o material.');return;}if(!(q>0)){e.push('Linha '+(i+1)+': quantidade inválida.');return;}
  used[m.id]=(used[m.id]||0)+q;if(saiDe(tipo)&&used[m.id]>st[m.id].q+1e-9)e.push(m.id+': quantidade acima do saldo em '+depNome(d.dep||DEP0)+' ('+qf(st[m.id].q)+' '+m.u+').');
  const pu=tipo==='entrada'?num(it.pu):st[m.id].cm;if(tipo==='entrada'&&!(pu>=0))e.push('Linha '+(i+1)+': informe o preço unitário.');n++;val+=q*(pu||0);});
 if(!n)e.push('Inclua pelo menos um material.');return {e,n,val};}
function pedPanel(){const L=M.ped.filter(p=>p.st==='aberto');if(!L.length)return '';
 return panel('Pedidos das obras',L.length+' pedido(s) aguardando · feitos pelo app de campo','<div class="table-wrap"><table class="ob-t"><thead><tr><th>Pedido</th><th>Obra</th><th>Quem pediu</th><th>Materiais</th><th></th></tr></thead><tbody>'+L.map(p=>'<tr><td class="ob-nw">'+p.id+'<small>'+br(p.data)+(p.para?' · para '+br(p.para):'')+'</small></td><td class="ob-nw"><a class="cad-cc" href="#cc/'+p.cc+'">'+p.cc+'</a></td><td>'+esc(pNomeM(p.quem))+'</td><td class="ob-d">'+p.itens.map(it=>{const m=matById(it.m);return qf(it.q)+' '+(m?m.u+' '+esc(m.d):esc(it.m));}).join('<br>')+(p.obs?'<small>'+esc(p.obs)+'</small>':'')+'</td><td class="ob-nw"><button class="button primary fn-sm" data-mt-ped="'+p.id+'">Atender</button> <button class="text-button" data-mt-pedx="'+p.id+'">Recusar</button></td></tr>').join('')+'</tbody></table></div>');}
function movForm(tipo){const d=draft(tipo),isE=tipo==='entrada',ck=movCheck(tipo);
 const head=isE?inp('data','Data do recebimento',d.data,{type:'date',req:1})+inp('forn','Fornecedor',d.forn,{req:1,html:'<input data-mt-h="forn" list="mt-fl" value="'+esc(d.forn)+'" placeholder="Comece a digitar"><datalist id="mt-fl">'+fornL().map(f=>'<option value="'+esc(f.fant||f.razao)+'">'+esc(f.razao)+'</option>').join('')+'</datalist>',hint:'Da lista de fornecedores (materiais e equipamentos). <a href="#fornecedores/novo">Cadastrar fornecedor</a>'})+inp('doc','Nota fiscal ou ordem de compra',d.doc,{ph:'Ex.: NF 12345 · OC 06431'})+inp('dep','Entra no estoque',d.dep,{req:1,html:'<select data-mt-h="dep">'+depOpts(d.dep||DEP0)+'</select>'})+inp('cc','Comprado para (opcional)',d.cc,{html:'<select data-mt-h="cc">'+ccOpts(d.cc).replace('Selecione o centro de custo','Estoque geral (sem obra)')+'</select>',hint:'Só referência: o material entra no almoxarifado.'})+pessoaSel('rec','Recebido por',d.rec)
  :tipo==='transf'?inp('data','Data da transferência',d.data,{type:'date',req:1})+inp('dep','Sai do estoque',d.dep,{req:1,html:'<select data-mt-h="dep">'+depOpts(d.dep||DEP0)+'</select>'})+inp('dep2','Vai para o estoque',d.dep2,{req:1,html:'<select data-mt-h="dep2">'+depOpts(d.dep2,'Selecione o destino')+'</select>'})+pessoaSel('resp','Enviado por',d.resp)+pessoaSel('rec','Recebido por',d.rec)+inp('doc','Documento',d.doc,{ph:'Ex.: guia de transferência'})
  :inp('data',tipo==='entrega'?'Data da saída':'Data da devolução',d.data,{type:'date',req:1})+inp('dep',tipo==='entrega'?'Sai do estoque':'Volta para o estoque',d.dep,{req:1,html:'<select data-mt-h="dep">'+depOpts(d.dep||DEP0)+'</select>'})+inp('cc','Obra (centro de custo)',d.cc,{req:1,html:'<select data-mt-h="cc">'+ccOpts(d.cc)+'</select>'})+pessoaSel('resp',tipo==='entrega'?'Entregue por (almoxarifado)':'Recebido no almoxarifado por',d.resp)+pessoaSel('rec',tipo==='entrega'?'Recebido na obra por':'Devolvido por',d.rec,{req:tipo==='entrega'})+inp('doc','Documento',d.doc,{ph:tipo==='entrega'?'Romaneio gerado ao registrar':'Ex.: sobra de obra'});
 return (tipo==='entrega'?pedPanel():'')+'<div class="ob-split"><div class="ob-main">'+panel(isE?'Lançamento de materiais':tipo==='entrega'?'Saída de materiais':tipo==='transf'?'Transferência entre estoques':'Devolução da obra',isE?'Entrada no estoque: o que chegou do fornecedor. Atualiza o saldo e o custo médio.':tipo==='entrega'?'Saída do estoque para a obra. O material fica ligado ao centro de custo e sai do estoque pelo custo médio.':tipo==='transf'?'Leva material de um estoque para outro. O saldo total não muda; muda onde ele está.':'Sobra que volta da obra para o estoque. Volta ao saldo e reduz o custo da obra.',
  (isE?nfBox():'')+'<div class="ob-form mt-head">'+head+inp('obs','Observação',d.obs,{wide:1})+'</div><div id="mt-lines">'+linhas(tipo)+'</div><div class="ob-actions"><button class="button outline" id="mt-add">+ Adicionar material</button><a class="text-button" href="#materiais/catalogo">Material novo? Cadastre aqui</a></div>',
  tipo!=='entrada'?'<div class="filter-chips">'+['entrega','devolucao','transf'].map(t=>'<button class="filter-chip '+(tipo===t?'active':'')+'" data-mt-tipo="'+t+'">'+({entrega:'Saída',devolucao:'Devolução',transf:'Transferência'}[t])+'</button>').join('')+'</div>':'')+'</div><aside class="ob-side" id="mt-side">'+movSide(tipo,ck)+'</aside></div>';}
function movSide(tipo,ck){ck=ck||movCheck(tipo);const d=draft(tipo),isE=tipo==='entrada';
 return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Resumo</h2><p>'+TIPOS[tipo]+'</p></div></div><dl class="ob-dl"><dt>Data</dt><dd>'+br(d.data)+'</dd><dt>'+(tipo==='transf'?'De → para':'Estoque')+'</dt><dd>'+esc(depNome(d.dep||DEP0))+(tipo==='transf'?' → '+esc(d.dep2?depNome(d.dep2):'?'):'')+'</dd>'+(d.cc&&tipo!=='transf'?'<dt>Obra</dt><dd>'+d.cc+'</dd>':'')+'<dt>Materiais</dt><dd>'+ck.n+'</dd><dt>'+(isE?'Valor da entrada':'Valor pelo custo médio')+'</dt><dd>'+BRL(ck.val)+'</dd>'+(tipo==='entrega'?'<dt>Romaneio</dt><dd>ROM-'+String(M.seq.rom+1).padStart(4,'0')+'</dd>':'')+'</dl>'+
 (ck.e.length&&ck.n?'<p class="ob-alert bad">'+ck.e.map(esc).join('<br>')+'</p>':ck.e.length?'<p class="ob-alert warn">'+ck.e.map(esc).join('<br>')+'</p>':'<p class="ob-alert ok">Pronto para registrar.</p>')+
 '<div class="ob-actions"><button class="button primary" id="mt-save" data-tipo="'+tipo+'" '+(ck.e.length?'disabled':'')+'>'+ic('check')+(isE?'Registrar entrada':tipo==='entrega'?'Registrar saída':tipo==='transf'?'Registrar transferência':'Registrar devolução')+'</button><button class="button outline" id="mt-clear" data-tipo="'+tipo+'">Limpar</button></div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Últimos registros</h2><p>'+TIPOS[tipo]+'</p></div><a class="text-button" href="#materiais/movs">Todos '+ic('arrow')+'</a></div><dl class="ob-dl">'+(M.mov.filter(v=>v.tipo===tipo).slice(-5).reverse().map(v=>'<dt>'+br(v.data)+' · '+esc(v.tipo==='entrada'?v.forn:v.tipo==='transf'?depNome(depOf(v))+' → '+depNome(v.dep2):v.cc)+'<small>'+esc(v.doc||v.id)+'</small></dt><dd>'+BRL(movValor(v))+'</dd>').join('')||'<dt>Nenhum ainda</dt><dd></dd>')+'</dl></section>';}

/* ---------- estoque ---------- */
function T_estoque(){if(F.dep&&!depById(F.dep))F.dep='';const st=ledger(null,F.dep||undefined),porDep=!F.dep&&M.dep.length>1?M.dep.map(d=>[d,ledger(null,d.id)]):null,ms=M.mat.filter(m=>(!F.cat||m.cat===F.cat)&&(!F.q||norm(m.id+' '+m.d).includes(norm(F.q))));
 const val=M.mat.reduce((a,m)=>a+Math.max(0,st[m.id].q)*st[m.id].cm,0),baixo=M.mat.filter(m=>st[m.id].q<m.min).length,com=M.mat.filter(m=>st[m.id].q>0).length,po=porObra();
 return '<div class="kpi-grid">'+card('Valor em estoque',BRL(val),'pelo custo médio',F.dep?esc(depNome(F.dep)):M.dep.length+' estoque(s)',{featured:1,icon:'wallet'})+card('Materiais com saldo',String(com),'de '+M.mat.length+' cadastrados','—',{icon:'layers'})+card('Abaixo do mínimo',String(baixo),'repor ou comprar',baixo?'atenção':'tudo em ordem',{icon:'truck',warn:baixo>0})+card('Entregue às obras',BRL(Object.values(po).reduce((a,x)=>a+x.v,0)),Object.keys(po).length+' centro(s) de custo','menos devoluções',{icon:'building'})+'</div>'+
 panel('Estoque · '+esc(F.dep?depNome(F.dep):'todos os estoques'),'Saldo = entradas + devoluções − saídas'+(F.dep?' ± transferências deste estoque':'')+'.','<div class="filter-chips mt-deps" aria-label="Estoque"><button class="filter-chip '+(!F.dep?'active':'')+'" data-mt-dep="">Todos os estoques</button>'+M.dep.map(d=>'<button class="filter-chip '+(F.dep===d.id?'active':'')+'" data-mt-dep="'+d.id+'">'+esc(d.nome)+'</button>').join('')+'</div><div class="toolbar cad-tools"><div class="filter-chips"><button class="filter-chip '+(!F.cat?'active':'')+'" data-mt-cat="">Todos</button>'+CATS.filter(c=>M.mat.some(m=>m.cat===c)).map(c=>'<button class="filter-chip '+(F.cat===c?'active':'')+'" data-mt-cat="'+c+'">'+c+'</button>').join('')+'</div><label class="search-field">'+ic('search')+'<input id="mt-q" type="search" placeholder="Buscar material..." value="'+esc(F.q)+'"></label></div>'+
 '<div class="table-wrap"><table class="ob-t mt-tab"><thead><tr><th>Foto</th><th>Código</th><th>Material</th><th class="ob-n">Entradas</th><th class="ob-n">Saídas</th><th class="ob-n">Saldo</th><th class="ob-n">Mínimo</th><th class="ob-n">Custo médio</th><th class="ob-n">Valor</th><th>Situação</th></tr></thead><tbody>'+
 (ms.map(m=>{const s=st[m.id],low=s.q<m.min;return '<tr><td class="mt-fto">'+(m.foto?'<button class="mt-thb" data-mt-zoom="'+m.id+'" aria-label="Ver foto de '+esc(m.d)+'"><img src="'+m.foto+'" alt=""></button>':'<label class="mt-add" title="Adicionar foto">+ foto<input type="file" accept="image/*" capture="environment" data-mt-foto="'+m.id+'" hidden></label>')+'</td><td class="ob-code">'+m.id+'</td><td class="ob-d">'+esc(m.d)+'<small>'+m.cat+'</small></td><td class="ob-n">'+qf(s.ent)+'</td><td class="ob-n">'+qf(s.sai)+'</td><td class="ob-n"><strong>'+qf(s.q)+'</strong> <small>'+m.u+'</small>'+(porDep?'<small class="mt-pordep">'+porDep.filter(([,l])=>Math.abs(l[m.id].q)>1e-9).map(([d,l])=>esc(d.nome)+': '+qf(l[m.id].q)).join(' · ')+'</small>':'')+'</td><td class="ob-n">'+qf(m.min)+'</td><td class="ob-n">'+(s.cm?BRL(s.cm):'—')+'</td><td class="ob-n">'+(s.q>0?BRL(s.q*s.cm):'—')+'</td><td class="ob-nw"><span class="status'+(low?' risk':'')+'">'+(s.q<=0?'sem estoque':low?'abaixo do mínimo':'ok')+'</span></td></tr>';}).join('')||'<tr><td colspan="9">Nenhum material com esse filtro.</td></tr>')+'</tbody></table></div>')+
 panel('Materiais por obra','Entregas menos devoluções, por centro de custo, pelo custo médio na data.',Object.keys(po).length?'<div class="table-wrap"><table class="ob-t"><thead><tr><th>Centro de custo</th><th>Obra</th><th class="ob-n">Movimentos</th><th>Última entrega</th><th class="ob-n">Valor líquido</th></tr></thead><tbody>'+Object.entries(po).map(([cc,x])=>'<tr><td class="ob-code"><a class="cad-cc" href="#cc/'+cc+'">'+cc+'</a></td><td class="ob-d">'+esc(ccNome(cc))+'</td><td class="ob-n">'+x.n+'</td><td class="ob-nw">'+br(x.ult)+'</td><td class="ob-n"><strong>'+BRL(x.v)+'</strong></td></tr>').join('')+'</tbody></table></div>':'<p class="ob-p">Nenhuma saída registrada ainda.</p>')+depPanel()+ioPanel();}
/* estoques (depósitos): cadastro simples; só exclui o que não tem movimento */
function depPanel(){return panel('Estoques',M.dep.length+' estoque(s) · cada entrada, saída, devolução e transferência diz de qual estoque é','<div class="table-wrap"><table class="ob-t"><thead><tr><th>Código</th><th>Estoque</th><th>Local</th><th class="ob-n">Valor em estoque</th><th class="ob-n">Movimentos</th><th></th></tr></thead><tbody>'+
 M.dep.map(d=>{const l=ledger(null,d.id),v=M.mat.reduce((a,m)=>a+Math.max(0,l[m.id].q)*l[m.id].cm,0),n=M.mov.filter(x=>depOf(x)===d.id||x.dep2===d.id).length;return '<tr><td class="ob-code">'+d.id+'</td><td class="ob-d"><strong>'+esc(d.nome)+'</strong></td><td>'+esc(d.local||'—')+'</td><td class="ob-n">'+BRL(v)+'</td><td class="ob-n">'+n+'</td><td>'+(n||M.dep.length<2?'':'<button class="text-button" data-mt-ddel="'+d.id+'">Excluir</button>')+'</td></tr>';}).join('')+'</tbody></table></div>'+
 '<div class="ob-form mt-depnew"><label class="ob-field"><span>Novo estoque <b class="cad-req">*</b></span><input id="mt-dn" placeholder="Ex.: Depósito da obra CMPA"></label><label class="ob-field"><span>Local</span><input id="mt-dl" placeholder="Ex.: Porto Alegre · contêiner 2"></label><div class="ob-actions"><button class="button outline" id="mt-dsave">+ Adicionar estoque</button></div></div>');}

/* ---------- movimentações ---------- */
function movFilt(){return M.mov.filter(v=>(!F.ftipo||v.tipo===F.ftipo)&&(!F.fcc||v.cc===F.fcc)).slice().sort((a,b)=>b.data.localeCompare(a.data)||b.n-a.n);}
function T_movs(){const L=movFilt();
 return panel('Movimentações','Histórico de entradas, saídas, devoluções e transferências, com data, estoque, documento, obra e valor.','<div class="toolbar cad-tools"><div class="filter-chips"><button class="filter-chip '+(!F.ftipo?'active':'')+'" data-mt-ft="">Todas</button>'+Object.entries(TIPOS).map(([k,l])=>'<button class="filter-chip '+(F.ftipo===k?'active':'')+'" data-mt-ft="'+k+'">'+l+'</button>').join('')+'</div><label class="period-control ob-ctl"><select id="mt-fcc" aria-label="Filtrar por obra">'+ccOpts(F.fcc).replace('Selecione o centro de custo','Todas as obras')+'</select></label></div>'+
 '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Data</th><th>Tipo</th><th>Documento</th><th>Origem → destino</th><th>Materiais</th><th class="ob-n">Valor</th><th></th></tr></thead><tbody>'+
 (L.map(v=>'<tr><td class="ob-nw">'+br(v.data)+'<small>registro '+br(v.reg)+'</small></td><td class="ob-nw"><span class="status'+(v.tipo==='entrega'?'':' ob-mute')+'">'+TIPOS[v.tipo]+'</span></td><td class="ob-nw">'+esc(v.doc||'—')+'<small>'+v.id+'</small></td><td class="ob-d">'+(v.tipo==='entrada'?esc(v.forn)+' → '+esc(depNome(depOf(v))):v.tipo==='entrega'?esc(depNome(depOf(v)))+' → <a class="cad-cc" href="#cc/'+v.cc+'">'+v.cc+'</a>':v.tipo==='transf'?esc(depNome(depOf(v)))+' → '+esc(depNome(v.dep2)):'<a class="cad-cc" href="#cc/'+v.cc+'">'+v.cc+'</a> → '+esc(depNome(depOf(v))))+'<small>'+esc([v.resp&&('por '+pNomeM(v.resp)),v.rec&&('recebido: '+pNomeM(v.rec)),v.conf&&('conferido na obra por '+v.conf.nome+' em '+br(v.conf.data)),v.obs].filter(Boolean).join(' · '))+'</small></td><td class="ob-d">'+v.itens.map(it=>{const m=matById(it.m);return qf(it.q)+' '+(m?m.u+' '+esc(m.d):it.m);}).join('<br>')+'</td><td class="ob-n"><strong>'+BRL(movValor(v))+'</strong></td><td class="ob-nw"><button class="text-button" data-mt-copy="'+v.id+'">Copiar</button> <button class="text-button" data-mt-del="'+v.id+'">Excluir</button></td></tr>').join('')||'<tr><td colspan="7">Nenhuma movimentação com esse filtro.</td></tr>')+'</tbody></table></div>'+
 '<div class="ob-actions"><button class="button outline" id="mt-tsv" '+(L.length?'':'disabled')+'>'+ic('download')+'Copiar para Excel</button></div>');}
function movTSV(list){const L=['Data\tTipo\tMovimento\tEstoque\tEstoque destino\tDocumento\tFornecedor\tCentro de custo\tObra\tCódigo\tMaterial\tQtd.\tUn.\tPreço/custo unit.\tValor\tResponsável\tRecebido por\tObservação'];
 list.forEach(v=>v.itens.forEach(it=>{const m=matById(it.m)||{};L.push([br(v.data),TIPOS[v.tipo],v.id,depNome(depOf(v)),v.dep2?depNome(v.dep2):'',v.doc,v.forn,v.cc,ccNome(v.cc),it.m,m.d||'',nf(it.q,2),m.u||'',nf(it.pu||0),nf(it.q*(it.pu||0)),pNomeM(v.resp),pNomeM(v.rec),v.obs].map(x=>String(x==null?'':x).replace(/\t|\n/g,' ')).join('\t'));}));return L.join('\n');}

/* ---------- cadastro de materiais ---------- */
function T_catalogo(){const st=ledger(),nx='MAT-'+String(M.mat.reduce((a,m)=>Math.max(a,+m.id.slice(4)),0)+1).padStart(3,'0');
 return '<div class="ob-split"><div class="ob-main">'+panel('Cadastro de materiais',M.mat.length+' materiais · os marcados como exemplo vieram do catálogo inicial de climatização',
 '<div class="table-wrap"><table class="ob-t mt-tab"><thead><tr><th>Foto</th><th>Código</th><th>Material</th><th>Categoria</th><th>Un.</th><th class="ob-n">Mínimo</th><th class="ob-n">Saldo</th><th></th></tr></thead><tbody>'+M.mat.map(m=>{const used=M.mov.some(v=>v.itens.some(it=>it.m===m.id));return '<tr><td class="mt-fto">'+(m.foto?'<button class="mt-thb" data-mt-zoom="'+m.id+'" aria-label="Ver foto"><img src="'+m.foto+'" alt=""></button><label class="mt-troca">trocar<input type="file" accept="image/*" capture="environment" data-mt-foto="'+m.id+'" hidden></label>':'<label class="mt-add">+ foto<input type="file" accept="image/*" capture="environment" data-mt-foto="'+m.id+'" hidden></label>')+'</td><td class="ob-code">'+m.id+'</td><td class="ob-d">'+esc(m.d)+(m.ex?' <small>exemplo</small>':'')+'</td><td class="ob-nw">'+m.cat+'</td><td>'+m.u+'</td><td class="ob-n"><input class="ob-pct" inputmode="decimal" data-mt-min="'+m.id+'" value="'+qf(m.min)+'" aria-label="Estoque mínimo '+m.id+'"></td><td class="ob-n">'+qf(st[m.id].q)+'</td><td>'+(used?'<small>com movimento</small>':'<button class="text-button" data-mt-mdel="'+m.id+'">Excluir</button>')+'</td></tr>';}).join('')+'</tbody></table></div>')+'</div>'+
 '<aside class="ob-side"><section class="panel ob-panel"><div class="panel-header"><div><h2>Novo material</h2><p>Código gerado: '+nx+'</p></div></div><div class="ob-form mt-new"><label class="ob-field cad-wide"><span>Descrição <b class="cad-req">*</b></span><input id="mt-nd" placeholder="Ex.: Tubo de cobre 7/8&quot; (barra 5 m)"></label><label class="ob-field"><span>Unidade</span><select id="mt-nu">'+UNS.map(u=>'<option>'+u+'</option>').join('')+'</select></label><label class="ob-field"><span>Categoria</span><select id="mt-nc">'+CATS.map(c=>'<option>'+c+'</option>').join('')+'</select></label><label class="ob-field"><span>Estoque mínimo</span><input id="mt-nm" inputmode="decimal" value="0"></label></div><div class="ob-actions"><button class="button primary" id="mt-nsave">Cadastrar material</button></div></section>'+bulkPanel()+'</aside></div>'+ioPanel();}
/* cadastrar vários materiais de uma vez: uma linha por material (colar do Excel ou digitar) */
function bulkParse(txt){const vistos=new Set(),out=[];String(txt||'').split(/\r?\n/).forEach((ln,i)=>{if(!ln.trim())return;const c=ln.split(ln.includes('\t')?'\t':ln.includes(';')?';':'|').map(x=>x.trim());
 const d=c[0]||'',u=guessUn(c[1]||'UN'),cat=CATS.find(x=>norm(x)===norm(c[2]||''))||guessCat(d),mn=num(c[3]),k=norm(d);let erro='';
 if(!d)erro='sem descrição';else if(/^descri/.test(k))return;else if(M.mat.some(m=>norm(m.d)===k))erro='já cadastrado';else if(vistos.has(k))erro='repetido na lista';vistos.add(k);
 out.push({lin:i+1,d,u,cat,min:mn>0?mn:0,erro});});return out;}
function bulkPanel(){const B=F.bulk,ok=B?B.filter(x=>!x.erro):[];
 return '<section class="panel ob-panel mt-bulk"><div class="panel-header"><div><h2>Cadastrar vários</h2><p>Uma linha por material: <b>descrição; unidade; categoria; mínimo</b>. Pode colar direto do Excel.</p></div></div><div class="ob-form"><label class="ob-field cad-wide"><span>Materiais</span><textarea id="mt-bulk" rows="6" placeholder="Tubo de cobre 7/8&quot; (barra 5 m); PC; Tubulação; 2&#10;Luva de raspa; PAR; EPI; 10&#10;Abraçadeira nylon 200 mm; CX; Suportes e fixação">'+esc(F.bulkTxt||'')+'</textarea></label></div><div class="ob-actions"><button class="button outline" id="mt-bulkprev">Conferir</button></div>'+
 (B?'<div class="table-wrap"><table class="ob-t"><thead><tr><th>Linha</th><th>Descrição</th><th>Un.</th><th>Categoria</th><th class="ob-n">Mín.</th><th></th></tr></thead><tbody>'+B.map(x=>'<tr class="'+(x.erro?'ob-err':'ob-has')+'"><td>'+x.lin+'</td><td class="ob-d">'+esc(x.d)+'</td><td>'+x.u+'</td><td>'+x.cat+'</td><td class="ob-n">'+qf(x.min)+'</td><td>'+(x.erro?'<small>'+x.erro+'</small>':'ok')+'</td></tr>').join('')+'</tbody></table></div><div class="ob-actions"><button class="button primary" id="mt-bulkok" '+(ok.length?'':'disabled')+'>Cadastrar '+ok.length+' material(is)</button><button class="text-button" id="mt-bulkx">Cancelar</button></div>':'')+'</section>';}

/* ---------- exportar e importar a base (Excel .xlsx e CSV) ---------- */
let xlsxLib=null;
function loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxLib)return xlsxLib;xlsxLib=new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=()=>{xlsxLib=null;ko(new Error('Não consegui carregar o leitor de Excel (precisa de internet). Use CSV.'));};document.head.appendChild(s);});return xlsxLib;}
async function baixar(nome,data,tipo){try{const dl=window.claude&&typeof window.claude.use==='function'?await window.claude.use('downloads'):null;if(dl){await dl.save({filename:nome,data:new Blob([data],{type:tipo})});return true;}}catch(e){if(e&&e.code==='declined')return false;}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:tipo}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);return true;}
/* tabelas exportadas: a de Materiais volta pela importação (Código, Descrição, Unidade, Categoria, Mínimo); a de Estoque traz o saldo por estoque */
function tabelas(){const r2=v=>Math.round(v*100)/100,L=Object.fromEntries(M.dep.map(d=>[d.id,ledger(null,d.id)]));
 const mat=[['Código','Descrição','Unidade','Categoria','Mínimo']].concat(M.mat.map(m=>[m.id,m.d,m.u,m.cat,m.min||0]));
 const est=[['Código','Descrição','Unidade','Estoque','Saldo','Custo médio','Valor']];M.dep.forEach(d=>M.mat.forEach(m=>{const s=L[d.id][m.id];if(Math.abs(s.q)>1e-9)est.push([m.id,m.d,m.u,d.nome,r2(s.q),r2(s.cm),r2(Math.max(0,s.q)*s.cm)]);}));
 const mov=[['Data','Tipo','Movimento','Estoque','Estoque destino','Documento','Fornecedor','Centro de custo','Código','Material','Quantidade','Unidade','Preço/custo unitário','Valor']];
 M.mov.slice().sort((a,b)=>a.data.localeCompare(b.data)||a.n-b.n).forEach(v=>v.itens.forEach(it=>{const m=matById(it.m)||{};mov.push([v.data,TIPOS[v.tipo],v.id,depNome(depOf(v)),v.dep2?depNome(v.dep2):'',v.doc||'',v.forn||'',v.cc||'',it.m,m.d||'',it.q,m.u||'',r2(it.pu||0),r2(it.q*(it.pu||0))]);}));
 const dep=[['Código','Estoque','Local']].concat(M.dep.map(d=>[d.id,d.nome,d.local||'']));
 return {Materiais:mat,Estoque:est,'Movimentações':mov,Estoques:dep};}
const csvCel=v=>{if(typeof v==='number')return String(v).replace('.',',');const t=String(v==null?'':v);return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
const toCSV=rows=>'﻿'+rows.map(r=>r.map(csvCel).join(';')).join('\r\n');
async function exportar(fmt,qual){const T=tabelas(),dia=hoje();
 if(fmt==='csv'){const nome={materiais:'Materiais',estoque:'Estoque',movs:'Movimentações'}[qual]||'Materiais';const ok=await baixar('armant360-'+norm(nome).replace(/[^a-z]/g,'')+'-'+dia+'.csv',toCSV(T[nome]),'text/csv;charset=utf-8');if(ok)say(nome+' exportado em CSV ('+(T[nome].length-1)+' linha(s)).');return;}
 try{const X=await loadXLSX(),wb=X.utils.book_new();Object.entries(T).forEach(([n,rows])=>{const ws=X.utils.aoa_to_sheet(rows);ws['!cols']=rows[0].map((h,i)=>({wch:Math.min(50,Math.max(10,...rows.slice(0,200).map(r=>String(r[i]==null?'':r[i]).length)))}));X.utils.book_append_sheet(wb,ws,n);});
  const buf=X.write(wb,{bookType:'xlsx',type:'array'});const ok=await baixar('armant360-almoxarifado-'+dia+'.xlsx',new Uint8Array(buf),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');if(ok)say('Planilha exportada: Materiais, Estoque, Movimentações e Estoques.');}catch(err){say(err.message||'Não foi possível gerar o Excel.');}}
/* leitura: CSV (ponto e vírgula, vírgula ou tabulação) ou Excel; cada aba vira uma tabela */
function parseCSV(txt){txt=txt.replace(/^﻿/,'');const l1=txt.split(/\r?\n/)[0]||'',sep=[';','\t',','].sort((a,b)=>l1.split(b).length-l1.split(a).length)[0],rows=[];let row=[],cel='',q=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];if(q){if(ch==='"'){if(txt[i+1]==='"'){cel+='"';i++;}else q=false;}else cel+=ch;}
  else if(ch==='"'&&cel==='')q=true;else if(ch===sep){row.push(cel);cel='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;row.push(cel);rows.push(row);row=[];cel='';}else cel+=ch;}
 if(cel!==''||row.length){row.push(cel);rows.push(row);}return rows.filter(r=>r.some(c=>String(c).trim()!==''));}
const COLS={cod:['codigo','cod. material','cod material','codigo do material','cod','cod.'],d:['descricao','nome / descricao','nome/descricao','descricao do material','material','nome','item'],u:['unidade','un','un.','und'],cat:['categoria','desc. familia','familia','grupo'],sub:['sub. familia','subfamilia','sub familia'],cb:['cod. barras','codigo de barras','cod barras','ean'],min:['minimo','estoque minimo','min','min.'],
 saldo:['saldo','estoque atual','saldo inicial','quantidade','qtd','qtd.','saldo atual'],cm:['custo medio','preco de custo (r$)','preco de custo','custo','custo unitario','preco','preco unitario','valor unitario','preco/custo unitario'],pv:['preco de venda (r$)','preco de venda'],dep:['estoque','localizacao','deposito','local de estoque','local','almoxarifado']};
/* famílias da planilha da Armant com acento e grafia única */
const CAT_FIX={'peca':'Peças','pecas':'Peças','eletrica':'Elétrica','fixacao':'Fixação','manutencao reparo operacao':'Manutenção, reparo e operação','hidraulica':'Hidráulica','cobre':'Cobre','gas':'Gás','gasm':'Gás','isolantes':'Isolantes','instalacao':'Instalação','equipamentos':'Equipamentos','insumo':'Insumos','ferragens':'Ferragens','dutos':'Dutos','mat. civil':'Material civil','metalicos':'Metálicos','outros':'Outros','embalagem para transporte':'Embalagem','epi':'EPI','ventilacao':'Ventilação'};
const catDe=(c,d)=>{const k=norm(String(c||'')).trim();if(!k)return guessCat(d);const ex=CATS.find(x=>norm(x)===k);if(ex)return ex;if(CAT_FIX[k])return CAT_FIX[k];return String(c).trim().toLowerCase().replace(/(^|\s)\S/g,x=>x.toUpperCase());};
const DEP_CENTRAL=['almoxarifado geral','almoxarifado central','geral','central','almoxarifado','almox'],DEP_SEMLOCAL=['sem local','sem localizacao','0','-','nao definido'];
function lerTabela(rows,nome){if(!rows||rows.length<2)return [];const h=rows[0].map(x=>norm(String(x||'')).trim()),ix={};Object.entries(COLS).forEach(([k,al])=>{for(const a of al){const i=h.indexOf(a);if(i>=0){ix[k]=i;break;}}});
 if(ix.d==null&&ix.cod==null)return [];return rows.slice(1).map((r,i)=>{const g=k=>ix[k]==null?'':r[ix[k]];return {tab:nome,lin:i+2,cod:String(g('cod')||'').trim(),d:String(g('d')||'').trim(),u:String(g('u')||'').trim(),cat:String(g('cat')||'').trim(),min:g('min'),saldo:g('saldo'),cm:g('cm'),dep:String(g('dep')||'').trim(),sub:String(g('sub')||'').trim(),cb:String(g('cb')||'').trim(),pv:g('pv'),temSaldo:ix.saldo!=null};}).filter(x=>x.cod||x.d);}
const nval=v=>typeof v==='number'?v:num(v);
/* plano de importação: o que é novo, o que muda no cadastro e quanto entra de saldo (só aumenta: ajuste de inventário) */
function planejar(linhas){const P={novos:[],muda:[],saldo:[],avisos:[],deps:[]},porDesc=new Map(),L={},idx=new Map(M.mat.map(y=>[norm(y.d),y]));
 const depDe=nome=>{if(!nome||DEP_CENTRAL.includes(norm(nome).trim()))return DEP0;if(DEP_SEMLOCAL.includes(norm(nome).trim()))nome='Sem local definido';const d=M.dep.find(x=>norm(x.nome)===norm(nome)||x.id===nome);if(d)return d.id;let n=P.deps.find(x=>norm(x.nome)===norm(nome));if(!n){n={id:'novo:'+nome,nome};P.deps.push(n);}return n.id;};
 const ld=dep=>L[dep]||(L[dep]=dep.startsWith('novo:')?null:ledger(null,dep));
 linhas.forEach(x=>{let m=x.cod?matById(x.cod):null;if(!m&&x.d)m=idx.get(norm(x.d));if(!m&&x.d)m=porDesc.get(norm(x.d));
  if(!m){if(!x.d){P.avisos.push(x.tab+' linha '+x.lin+': código '+x.cod+' não existe e não tem descrição.');return;}
   m={novo:true,cod:x.cod&&!matById(x.cod)&&!P.novos.some(z=>z.cod===x.cod)?x.cod:'',d:x.d,u:guessUn(x.u||'UN'),cat:catDe(x.cat,x.d),sub:x.sub||'',cb:x.cb||'',pv:nval(x.pv)>0?nval(x.pv):0,min:Math.max(0,nval(x.min)||0)};P.novos.push(m);porDesc.set(norm(x.d),m);}
  else if(!m.novo){const ch={};if(x.u&&guessUn(x.u)!==m.u)ch.u=guessUn(x.u);const c=x.cat?catDe(x.cat,x.d):'';if(c&&c!==m.cat)ch.cat=c;if(x.cb&&x.cb!==m.cb)ch.cb=x.cb;if(x.sub&&x.sub!==m.sub)ch.sub=x.sub;const mn=nval(x.min);if(x.min!==''&&mn>=0&&mn!==m.min)ch.min=mn;
   if(Object.keys(ch).length&&!P.muda.some(z=>z.m===m))P.muda.push({m,ch});}
  if(x.temSaldo&&x.saldo!==''&&x.saldo!=null){const q=nval(x.saldo);if(!(q>=0)){P.avisos.push(x.tab+' linha '+x.lin+': saldo inválido.');return;}
   const dep=depDe(x.dep),l=ld(dep),atual=m.novo||!l?0:l[m.id].q,dif=q-atual,cm=nval(x.cm);
   if(dif>1e-9)P.saldo.push({m,dep,q:dif,pu:cm>=0?cm:(m.novo||!l?0:l[m.id].cm)});else if(dif<-1e-9)P.avisos.push((m.id||m.d)+': planilha tem '+qf(q)+', o sistema tem '+qf(atual)+' em '+depNome(dep)+'. Saldo menor não é baixado pela importação: registre a saída.');}});
 return P;}
async function lerArquivo(file){const nm=file.name.toLowerCase();let tabs=[];
 if(nm.endsWith('.csv')||nm.endsWith('.txt')||file.type.includes('csv'))tabs=[{nome:file.name,rows:parseCSV(await file.text())}];
 else if(nm.endsWith('.xlsx')||nm.endsWith('.xls')){const X=await loadXLSX(),wb=X.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});tabs=wb.SheetNames.filter(n=>!/movimenta/i.test(norm(n))&&!/^estoques$/i.test(n)).map(n=>({nome:n,rows:X.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})}));}
 else throw new Error('Envie uma planilha .xlsx ou .csv.');
 const linhas=tabs.flatMap(t=>lerTabela(t.rows,t.nome));if(!linhas.length)throw new Error('Não achei a coluna Descrição (ou Código) na planilha.');return {arquivo:file.name,linhas,plano:planejar(linhas)};}
function aplicarImport(){const I=F.imp;if(!I)return;const P=aplicarLinhas(I.linhas,I.arquivo,I.tirarEx,I.base?{data:BASE.data,base:true}:{});F.imp=null;refresh();say('Importado: '+P.novos.length+' material(is) novo(s), '+P.muda.length+' atualizado(s), '+P.saldo.length+' saldo(s) lançado(s)'+(P.deps.length?', '+P.deps.length+' estoque(s) novo(s)':'')+'.');}
/* grava o plano (planilha importada ou base oficial do estoque) */
function aplicarLinhas(linhas,arquivo,tirarEx,o){o=o||{};const P=planejar(linhas),nid=()=>'MAT-'+String(M.mat.reduce((a,m)=>/^MAT-\d+$/.test(m.id)?Math.max(a,+m.id.slice(4)):a,0)+1).padStart(3,'0');
 if(tirarEx){const usados=new Set(M.mov.flatMap(v=>v.itens.map(it=>it.m)));M.mat=M.mat.filter(m=>!m.ex||usados.has(m.id));}
 const depMap={};P.deps.forEach(d=>{const id='DEP-'+String(M.dep.reduce((a,x)=>Math.max(a,+x.id.slice(4)||0),0)+1).padStart(2,'0');M.dep.push({id,nome:d.nome,local:''});depMap[d.id]=id;});
 P.novos.forEach(m=>{m.id=m.cod||nid();const o={id:m.id,d:m.d,u:m.u,cat:m.cat,min:m.min};if(m.sub)o.sub=m.sub;if(m.cb)o.cb=m.cb;if(m.pv)o.pv=m.pv;M.mat.push(o);if(!CATS.includes(m.cat))CATS.push(m.cat);if(!UNS.includes(m.u))UNS.push(m.u);delete m.novo;});
 P.muda.forEach(({m,ch})=>Object.assign(m,ch));
 const porDep={};P.saldo.forEach(x=>{const dep=depMap[x.dep]||x.dep;(porDep[dep]=porDep[dep]||[]).push({m:x.m.id,q:x.q,pu:x.pu||0});});
 Object.entries(porDep).forEach(([dep,itens])=>{M.seq.mov++;M.mov.push({id:'MOV-'+String(M.seq.mov).padStart(5,'0'),n:M.seq.mov,tipo:'entrada',data:o.data||hoje(),reg:hoje(),doc:(o.base?'Inventário inicial: ':'Importação: ')+arquivo,forn:o.base?'Inventário inicial (base oficial do estoque)':'Ajuste de inventário (planilha)',fid:'',cc:'',dep,dep2:'',resp:'',rec:'',obs:o.base?'Saldo da base oficial do estoque':'Saldo informado na planilha importada',itens,chave:'',nf:null});});
 if(o.base)M.base={fonte:arquivo,em:hoje(),linhas:linhas.length};save();return P;}
const BASE=window.ARMANT_ESTOQUE_BASE||null;
const baseLinhas=()=>BASE?lerTabela([BASE.cab].concat(BASE.linhas),BASE.fonte):[];
function basePanel(){if(!BASE)return '';return '<div class="mt-base">'+(M.base?'<span class="ob-pill-real">banco de dados do estoque</span> <b>'+esc(M.base.fonte)+'</b> · '+M.base.linhas+' linhas · carregado em '+br(M.base.em):'<span class="ob-pill-fict">base oficial disponível</span> <b>'+esc(BASE.fonte)+'</b> · '+BASE.linhas.length+' linhas. Este navegador ainda usa outros dados de estoque.<button class="button outline fn-sm" id="mt-baseprev">Carregar a base oficial</button>')+'</div>';}
function ioPanel(){const I=F.imp,P=I&&I.plano;
 return panel('Exportar e importar','Base do almoxarifado em Excel (.xlsx, com as abas Materiais, Estoque, Movimentações e Estoques) ou CSV (abre no Excel). Para importar, use as colunas da aba Materiais; Saldo, Custo médio e Estoque são opcionais.',
 '<div class="mt-io">'+basePanel()+'<div class="ob-actions"><button class="button primary" data-mt-exp="xlsx">'+ic('download')+'Exportar Excel (.xlsx)</button><button class="button outline" data-mt-exp="csv" data-q="materiais">CSV · Materiais</button><button class="button outline" data-mt-exp="csv" data-q="estoque">CSV · Estoque</button><button class="button outline" data-mt-exp="csv" data-q="movs">CSV · Movimentações</button></div>'+
 '<label class="mt-drop mt-impdrop"><input type="file" id="mt-impfile" accept=".xlsx,.xls,.csv,text/csv" hidden>'+ic('download')+'<span><strong>Importar planilha (.xlsx ou .csv)</strong><small>Cadastra os materiais novos, atualiza unidade, categoria e mínimo dos que já existem (pelo código ou pela descrição) e, se houver a coluna Saldo, lança a diferença como entrada de ajuste de inventário. Nada é gravado antes de você conferir.</small></span></label>'+
 (P?'<div class="mt-impprev"><p><b>'+esc(I.arquivo)+'</b> · '+I.linhas.length+' linha(s) lida(s)</p><ul><li>'+P.novos.length+' material(is) novo(s)'+(P.novos.length?': '+P.novos.slice(0,6).map(m=>esc(m.d)).join(', ')+(P.novos.length>6?'…':''):'')+'</li><li>'+P.muda.length+' material(is) com cadastro atualizado</li><li>'+P.saldo.length+' saldo(s) a lançar como entrada de ajuste'+(P.saldo.length?' · '+BRL(P.saldo.reduce((a,x)=>a+x.q*(x.pu||0),0)):'')+'</li>'+(P.deps.length?'<li>'+P.deps.length+' estoque(s) novo(s): '+P.deps.map(d=>esc(d.nome)).join(', ')+'</li>':'')+'</ul>'+(P.avisos.length?'<p class="ob-alert warn">'+P.avisos.slice(0,8).map(esc).join('<br>')+(P.avisos.length>8?'<br>… e mais '+(P.avisos.length-8):'')+'</p>':'')+
 (M.mat.some(m=>m.ex)?'<label class="ob-check"><input type="checkbox" id="mt-tiraex" '+(I.tirarEx?'checked':'')+'> Tirar os '+M.mat.filter(m=>m.ex).length+' materiais de exemplo (os que não têm movimento)</label>':'')+'<div class="ob-actions"><button class="button primary" id="mt-impok" '+(P.novos.length+P.muda.length+P.saldo.length?'':'disabled')+'>Importar</button><button class="text-button" id="mt-impx">Cancelar</button></div></div>':'')+'</div>');}

/* ---------- página ---------- */
const TB={entrega:()=>movForm(curTipo()),lancamento:()=>movForm('entrada'),estoque:T_estoque,movs:T_movs,catalogo:T_catalogo};
function page(){
 return '<div class="view-intro ob-intro"><div><span class="ob-pill-real">almoxarifado · salvo neste navegador</span><h2>Almoxarifado: materiais e estoque.</h2><p>Lance o que chega, registre as saídas para as obras pelo centro de custo e acompanhe o saldo de cada estoque. Cada saída gera um romaneio e entra no custo da obra.</p></div>'+ic('truck')+'</div>'+
 '<div class="ob-tabs" role="tablist">'+TABS.map(([k,l])=>'<a role="tab" href="#materiais/'+k+'" aria-selected="'+(F.tab===k)+'" class="'+(F.tab===k?'active':'')+'">'+l+'</a>').join('')+'</div><div id="mt-tab" class="mt-tab">'+TB[F.tab]()+'</div>';}
const curTipo=()=>F.tab==='lancamento'?'entrada':F.tab==='entrega'?(['devolucao','transf'].includes(F.lastTipo)?F.lastTipo:'entrega'):null;
const refresh=()=>{const el=document.getElementById('mt-tab');if(!el)return;const y=window.scrollY;el.innerHTML=TB[F.tab]();window.scrollTo(0,y);};
const refreshSide=()=>{const t=curTipo(),s=document.getElementById('mt-side');if(t&&s)s.innerHTML=movSide(t);};
const refreshLines=()=>{const t=curTipo(),l=document.getElementById('mt-lines');if(t&&l)l.innerHTML=linhas(t);refreshSide();};

/* ---------- roteador ---------- */
const chrome={};
function setChrome(on){const notice=document.querySelector('.demo-notice p'),pill=document.querySelector('.demo-pill'),act=document.querySelector('.heading-actions');
 if(on){if(!('notice' in chrome)){chrome.notice=notice?notice.innerHTML:'';chrome.pill=pill?pill.innerHTML:'';}
  if(notice)notice.innerHTML='<strong>Materiais.</strong> Entradas, saídas e estoques ficam salvos neste navegador até existir um banco compartilhado. Catálogo inicial é exemplo: ajuste ao da Armant.';
  if(pill)pill.innerHTML='<span></span> Materiais';if(act)act.style.visibility='hidden';}
 else if('notice' in chrome){if(notice)notice.innerHTML=chrome.notice;if(pill)pill.innerHTML=chrome.pill;if(act)act.style.visibility='';}}
function quick(){const st=ledger(),baixo=M.mat.filter(m=>st[m.id].q<m.min).length,val=M.mat.reduce((a,m)=>a+Math.max(0,st[m.id].q)*st[m.id].cm,0);
 return panel('Materiais e estoque','Almoxarifado: '+BRL(val)+' em estoque · '+baixo+' material(is) abaixo do mínimo · '+M.mov.length+' movimentação(ões)','<div class="cad-hub mt-quick">'+[['entrega','Saídas','Saída do estoque para a obra (centro de custo), com romaneio; devolução e transferência'],['lancamento','Lançamento de materiais','Entrada do que chegou do fornecedor: NF, quantidade e preço'],['estoque','Estoque','Saldo, custo médio, mínimo e materiais por obra']].map(([k,t,s])=>'<a class="cad-card" href="#materiais/'+k+'"><strong>'+t+'</strong><span>'+s+'</span><em>Abrir '+ic('arrow')+'</em></a>').join('')+'</div>');}
function ccPanel(cc){const L=M.mov.filter(v=>v.cc===cc&&v.tipo!=='entrada');if(!L.length)return panel('Materiais desta obra','Saídas e devoluções ligadas a '+cc,'<p class="ob-p">Nenhuma saída de material para esta obra ainda.</p>','<a class="button outline" href="#materiais/entrega" data-mt-precc="'+cc+'">Registrar saída</a>');
 const tot={};L.forEach(v=>v.itens.forEach(it=>{const x=tot[it.m]||(tot[it.m]={q:0,v:0});const sg=v.tipo==='entrega'?1:-1;x.q+=sg*it.q;x.v+=sg*it.q*(it.pu||0);}));const vt=Object.values(tot).reduce((a,x)=>a+x.v,0);
 return panel('Materiais desta obra',L.length+' movimento(s) · '+BRL(vt)+' pelo custo médio','<div class="table-wrap"><table class="ob-t"><thead><tr><th>Código</th><th>Material</th><th class="ob-n">Quantidade líquida</th><th class="ob-n">Valor</th></tr></thead><tbody>'+Object.entries(tot).map(([id,x])=>{const m=matById(id)||{};return '<tr><td class="ob-code">'+id+'</td><td class="ob-d">'+esc(m.d||'')+'</td><td class="ob-n">'+qf(x.q)+' <small>'+(m.u||'')+'</small></td><td class="ob-n">'+BRL(x.v)+'</td></tr>';}).join('')+'</tbody></table></div>','<a class="button outline" href="#materiais/entrega" data-mt-precc="'+cc+'">Registrar saída</a>');}
const prevRender=render;
render=function(){const h=location.hash.slice(1),[v,a,b]=h.split('/');
 if(v==='materiais'){if(a&&TABS.some(t=>t[0]===a))F.tab=a;setChrome(true);
  const n=document.getElementById('navigation');prevNav(n);document.getElementById('breadcrumb').textContent='Almoxarifado';document.getElementById('page-title').innerHTML='Almoxarifado<span>.</span>';document.getElementById('page-subtitle').textContent='Entradas, saídas para as obras e saldo de cada estoque.';
  const c=document.getElementById('view');c.innerHTML=page();c.className='fade-in';return;}
 setChrome(false);prevRender();const c=document.getElementById('view');
 if(v==='operations'){const dem=c.querySelector('#cad-btn-dem');const anchor=dem?dem.closest('section'):c.querySelector(':scope > .view-intro');if(anchor)anchor.insertAdjacentHTML('afterend',quick());}
 if(v==='cc'&&a&&!b){const hub=c.querySelector('.cad-hub');const sec=hub&&hub.closest('section');if(sec)sec.insertAdjacentHTML('afterend',ccPanel(a));}};
function prevNav(n){/* reaproveita o menu montado pelo painel: marca Operação & CSC */if(!n)return;const cnt=13+((CAD.state&&CAD.state.dem)||[]).length;
 const act=NAV.some(x=>x[0]==='materiais')?'materiais':'operations';n.innerHTML=NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(id===act?'active':'')+'" '+(id===act?'aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">'+cnt+'</span>':'')+'</a>').join('');}

/* ---------- eventos (prefixo mt-) ---------- */
const onMat=()=>location.hash.startsWith('#materiais');
document.addEventListener('click',e=>{const t=e.target.closest('button,a[data-mt-precc]');if(!t)return;
 if(t.dataset.mtPrecc){draft('entrega').cc=t.dataset.mtPrecc;F.lastTipo='entrega';return;}
 if(!onMat())return;
 if(t.dataset.mtTipo){F.lastTipo=t.dataset.mtTipo;refresh();return;}
 if(t.dataset.mtCat!=null){F.cat=t.dataset.mtCat;refresh();return;}
 if(t.dataset.mtDep!=null){F.dep=t.dataset.mtDep;refresh();return;}
 if(t.dataset.mtExp){exportar(t.dataset.mtExp,t.dataset.q);return;}
 if(t.dataset.mtDdel){const id=t.dataset.mtDdel;if(M.mov.some(x=>depOf(x)===id||x.dep2===id)){say('Este estoque tem movimentos e não pode ser excluído.');return;}if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';return;}M.dep=M.dep.filter(x=>x.id!==id);if(F.dep===id)F.dep='';save();refresh();say('Estoque excluído.');return;}
 if(t.dataset.mtFt!=null){F.ftipo=t.dataset.mtFt;refresh();return;}
 if(t.dataset.mtRm!=null){const d=draft(curTipo());d.itens.splice(+t.dataset.mtRm,1);if(!d.itens.length)d.itens.push({m:'',q:'',pu:''});refreshLines();return;}
 if(t.dataset.mtPed){const p=M.ped.find(x=>x.id===t.dataset.mtPed);if(!p)return;F.lastTipo='entrega';F.draft.entrega={...blank('entrega'),cc:p.cc,rec:p.quem,obs:'Pedido '+p.id+(p.obs?' · '+p.obs:''),ped:p.id,itens:p.itens.map(it=>({m:it.m,q:String(it.q).replace('.',','),pu:''}))};refresh();say('Pedido '+p.id+' carregado na saída. Confira o estoque e registre.');window.scrollTo(0,0);return;}
 if(t.dataset.mtPedx){const p=M.ped.find(x=>x.id===t.dataset.mtPedx);if(!p)return;if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';return;}p.st='recusado';save();refresh();say('Pedido '+p.id+' recusado.');return;}
 if(t.dataset.mtCopy){const v=M.mov.find(x=>x.id===t.dataset.mtCopy);if(v)clip(movTSV([v]),(v.tipo==='entrega'?'Romaneio ':'Movimento ')+(v.doc||v.id)+' copiado.');return;}
 if(t.dataset.mtDel){const id=t.dataset.mtDel;if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';setTimeout(()=>{t.dataset.confirm='';t.textContent='Excluir';},4000);return;}
  let neg=null;[null,...M.dep.map(x=>x.id)].some(dp=>{const st=ledger(id,dp);neg=M.mat.find(m=>st[m.id].q<-1e-9);return !!neg;});if(neg){say('Não dá para excluir: '+neg.id+' ficaria com estoque negativo. Exclua antes as saídas que usaram esse material.');return;}
  M.mov=M.mov.filter(v=>v.id!==id);save();refresh();say('Movimentação excluída. Estoque recalculado.');return;}
 if(t.dataset.mtMdel){const id=t.dataset.mtMdel;if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Confirmar';setTimeout(()=>{t.dataset.confirm='';t.textContent='Excluir';},4000);return;}M.mat=M.mat.filter(m=>m.id!==id);save();refresh();say('Material excluído do cadastro.');return;}
 switch(t.id){
 case 'mt-add':draft(curTipo()).itens.push({m:'',q:'',pu:''});refreshLines();break;
 case 'mt-clear':F.draft[t.dataset.tipo]=blank(t.dataset.tipo);refresh();say('Formulário limpo.');break;
 case 'mt-save':{const tipo=t.dataset.tipo,ck=movCheck(tipo);if(ck.e.length)return;const d=draft(tipo);let novos=0;
  if(tipo==='entrada'){if(d.chave&&M.mov.some(v=>v.chave===d.chave)){say('Esta nota já foi lançada.');return;}
   d.itens.forEach(it=>{if(it.m==='__new'&&it.nf&&num(it.q)>0){const ex=M.mat.find(x=>norm(x.d)===norm(it.nf.d));if(ex)it.m=ex.id;else{const id='MAT-'+String(M.mat.reduce((a,m)=>Math.max(a,+m.id.slice(4)),0)+1).padStart(3,'0');M.mat.push({id,d:it.nf.d,u:guessUn(it.nf.u),cat:guessCat(it.nf.d),min:0,ncm:it.nf.ncm||''});it.m=id;novos++;}}
    if(it.nf&&d.nf&&d.nf.cnpj&&matById(it.m))M.map[d.nf.cnpj+'|'+it.nf.c]=it.m;});}
  const st=ledger(null,d.dep||DEP0);
  const itens=d.itens.filter(it=>it.m&&num(it.q)>0).map(it=>({m:it.m,q:num(it.q),pu:tipo==='entrada'?num(it.pu):st[it.m].cm}));
  M.seq.mov++;let doc=d.doc;if(tipo==='entrega'){M.seq.rom++;doc=doc||'ROM-'+String(M.seq.rom).padStart(4,'0');}
  const mv={id:'MOV-'+String(M.seq.mov).padStart(5,'0'),n:M.seq.mov,tipo,data:d.data,reg:hoje(),doc,forn:tipo==='entrada'?d.forn:'',fid:tipo==='entrada'?fornId(d.forn):'',cc:tipo==='transf'?'':d.cc,dep:d.dep||DEP0,dep2:tipo==='transf'?d.dep2:'',resp:d.resp,rec:d.rec,obs:d.obs,itens,chave:tipo==='entrada'?(d.chave||''):'',nf:tipo==='entrada'&&d.nf?d.nf:null};
  if(tipo==='entrega'&&d.ped){const pd=M.ped.find(x=>x.id===d.ped);if(pd){pd.st='atendido';pd.mov=mv.id;}mv.ped=d.ped;}
  M.mov.push(mv);save();F.draft[tipo]=blank(tipo);refresh();
  say(tipo==='entrada'?'Entrada registrada: '+itens.length+' material(is), '+BRL(movValor(mv))+(novos?'. '+novos+' material(is) novo(s) cadastrado(s) a partir da nota':'')+'.':tipo==='entrega'?'Saída registrada para '+mv.cc+': romaneio '+doc+', '+BRL(movValor(mv))+'.':tipo==='transf'?'Transferência registrada: '+depNome(mv.dep)+' → '+depNome(mv.dep2)+'.':'Devolução registrada de '+mv.cc+'.');break;}
 case 'mt-dsave':{const n=document.getElementById('mt-dn').value.trim(),l=document.getElementById('mt-dl').value.trim();if(!n){say('Informe o nome do estoque.');return;}if(M.dep.some(x=>norm(x.nome)===norm(n))){say('Já existe um estoque com esse nome.');return;}
  const id='DEP-'+String(M.dep.reduce((a,x)=>Math.max(a,+x.id.slice(4)||0),0)+1).padStart(2,'0');M.dep.push({id,nome:n,local:l});save();refresh();say('Estoque criado: '+n+' ('+id+').');break;}
 case 'mt-bulkprev':{F.bulkTxt=document.getElementById('mt-bulk').value;F.bulk=bulkParse(F.bulkTxt);refresh();if(!F.bulk.length)say('Digite ou cole pelo menos uma linha.');break;}
 case 'mt-bulkx':F.bulk=null;refresh();break;
 case 'mt-bulkok':{const L=bulkParse(F.bulkTxt).filter(x=>!x.erro);L.forEach(x=>{const id='MAT-'+String(M.mat.reduce((a,m)=>Math.max(a,+m.id.slice(4)),0)+1).padStart(3,'0');M.mat.push({id,d:x.d,u:x.u,cat:x.cat,min:x.min});});save();F.bulk=null;F.bulkTxt='';refresh();say(L.length+' material(is) cadastrado(s).');break;}
 case 'mt-impok':aplicarImport();break;
 case 'mt-baseprev':{const L=baseLinhas();F.imp={arquivo:BASE.fonte,linhas:L,plano:planejar(L),tirarEx:true,base:true};refresh();say('Base oficial lida: confira e clique em Importar.');break;}
 case 'mt-impx':F.imp=null;refresh();break;
 case 'mt-nfclear':F.draft.entrada=blank('entrada');refresh();say('Importação desfeita.');break;
 case 'mt-tsv':clip(movTSV(movFilt()),'Movimentações copiadas. Cole no Excel.');break;
 case 'mt-nsave':{const d=document.getElementById('mt-nd').value.trim();if(!d){say('Informe a descrição do material.');return;}if(M.mat.some(m=>norm(m.d)===norm(d))){say('Já existe um material com essa descrição.');return;}
  const id='MAT-'+String(M.mat.reduce((a,m)=>Math.max(a,+m.id.slice(4)),0)+1).padStart(3,'0'),mn=num(document.getElementById('mt-nm').value);
  M.mat.push({id,d,u:document.getElementById('mt-nu').value,cat:document.getElementById('mt-nc').value,min:mn>0?mn:0});save();refresh();say('Material cadastrado: '+id+'.');break;}
 }});
function clip(txt,ok){(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say(ok)).catch(()=>say('Não foi possível copiar neste navegador.'));}
document.addEventListener('input',e=>{const t=e.target;if(!onMat())return;
 if(t.id==='mt-q'){F.q=t.value;const pos=t.selectionStart;refresh();const q=document.getElementById('mt-q');if(q){q.focus();q.setSelectionRange(pos,pos);}return;}
 const tipo=curTipo();if(!tipo)return;
 if(t.dataset.mtH){draft(tipo)[t.dataset.mtH]=t.value;refreshSide();return;}
 if(t.dataset.mtL!=null&&t.tagName==='INPUT'){const d=draft(tipo),i=+t.dataset.mtL;d.itens[i][t.dataset.k]=t.value;
  const it=d.itens[i],m=matById(it.m),st=ledger(),q=num(it.q),pu=tipo==='entrada'?num(it.pu):(m?st[m.id].cm:0),bad=it.q!==''&&(!(q>0)||(tipo==='entrega'&&m&&q>st[m.id].q+1e-9));
  t.closest('tr').className=bad?'ob-err':(m&&q>0?'ob-has':'');const c=document.querySelector('[data-mt-v="'+i+'"]');if(c)c.textContent=q>0&&pu>=0&&!bad?BRL(q*pu):'—';refreshSide();}});
document.addEventListener('change',e=>{const t=e.target;if(!onMat())return;
 if(t.id==='mt-nffile'){importFile(t.files[0]);t.value='';return;}
 if(t.id==='mt-tiraex'&&F.imp){F.imp.tirarEx=t.checked;return;}
 if(t.id==='mt-impfile'){const f=t.files[0];t.value='';if(!f)return;lerArquivo(f).then(I=>{I.tirarEx=I.linhas.length>=50;F.imp=I;refresh();say('Planilha lida: confira e clique em Importar.');}).catch(err=>say(err.message||'Não foi possível ler a planilha.'));return;}
 if(t.id==='mt-fcc'){F.fcc=t.value;refresh();return;}
 if(t.dataset.mtMin){const m=matById(t.dataset.mtMin),v=num(t.value);if(m&&v>=0){m.min=v;save();say('Mínimo de '+m.id+': '+qf(v)+' '+m.u+'.');}return;}
 const tipo=curTipo();if(!tipo)return;
 if(t.dataset.mtH&&t.tagName==='SELECT'){draft(tipo)[t.dataset.mtH]=t.value;refreshSide();return;}
 if(t.dataset.mtL!=null&&t.tagName==='SELECT'){draft(tipo).itens[+t.dataset.mtL].m=t.value;refreshLines();}});

/* arrastar a nota para a área de importação */
document.addEventListener('dragover',e=>{const z=e.target.closest&&e.target.closest('#mt-drop');if(!z)return;e.preventDefault();z.classList.add('over');});
document.addEventListener('dragleave',e=>{const z=e.target.closest&&e.target.closest('#mt-drop');if(z)z.classList.remove('over');});
document.addEventListener('drop',e=>{const z=e.target.closest&&e.target.closest('#mt-drop');if(!z)return;e.preventDefault();z.classList.remove('over');importFile(e.dataTransfer.files[0]);});
function addPedido(o){M.seq.ped=(M.seq.ped||0)+1;const p={id:'PED-'+String(M.seq.ped).padStart(4,'0'),data:hoje(),st:'triagem',...o};M.ped.push(p);save();return p;}
function confirmarRecebimento(movId,nome,obs){const v=M.mov.find(x=>x.id===movId);if(!v)return false;v.conf={nome,data:hoje(),obs:obs||''};save();return true;}
/* semBase: modo de teste/demonstração que mantém o catálogo de exemplo */
if(BASE&&!M.base&&!M.semBase&&!M.mov.length&&M.mat.every(m=>m.ex)){try{aplicarLinhas(baseLinhas(),BASE.fonte,true,{data:BASE.data,base:true});}catch(e){}}
window.ArmantMateriais={version:'2.1',base:()=>M.base||null,state:M,ledger,estoques:()=>M.dep,tabelas,parseCSV,parseXML,addPedido,confirmarRecebimento,materiais:()=>M.mat,save};
render();
})();
