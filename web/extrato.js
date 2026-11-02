/* Armant 360 · Extrato bancário e conciliação (Financeiro → Extrato e conciliação)
   Carregar depois de financeiro.js:  <script src="extrato.js" defer></script>
   - Importa extratos em OFX/OFC (padrão dos bancos), CSV/TXT, Excel (.xlsx/.xls), PDF (texto) e a exportação da Conta Azul.
   - Não duplica: o mesmo lançamento importado de novo é reconhecido.
   - Concilia com as contas a receber e a pagar: sugere o título pelo valor, pela data e pelo nome; baixa com um clique;
     cria o lançamento do que não estava previsto (tarifa, imposto, transferência) ou marca como ignorado.
   - Conta Azul: no site com servidor, a função "contaazul" conecta pela API oficial (OAuth 2.0) e traz contas financeiras,
     saldos e contas a receber e a pagar. No protótipo, importe a planilha exportada da Conta Azul. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const nf=(v,dg=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const BRL=v=>(v<0?'− ':'')+'R$ '+nf(Math.abs(v));
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const br=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'—';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const FIN=()=>window.ArmantFinanceiro||null,AC=()=>window.ArmantAcesso||null,NU=()=>window.ArmantNucleo||null;
const me=()=>AC()?AC().user():null;
const pode=()=>{const A=AC();return !A||A.can('finance');};
const dd=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);

/* ---------- estado ---------- */
const X={lotes:[],mov:[],seq:{l:0,m:0},ca:{}};
try{const s=JSON.parse(localStorage.getItem('a360extrato')||'null');if(s){X.lotes=Array.isArray(s.lotes)?s.lotes:[];X.mov=Array.isArray(s.mov)?s.mov:[];X.seq={...X.seq,...(s.seq||{})};X.ca=s.ca||{};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360extrato',JSON.stringify(X));return true;}catch(e){say('Memória do navegador cheia: não foi possível salvar o extrato.');return false;}};
const V={conta:'',f:'pend',prev:null,erro:'',q:''};
const contas=()=>FIN()?FIN().state.contas:[];
const cNome=id=>(contas().find(c=>c.id===id)||{}).nome||'—';

/* ---------- números e datas em qualquer formato ---------- */
function valor(v){if(typeof v==='number')return v;let s=String(v==null?'':v).trim();if(!s)return NaN;let neg=/^\(.*\)$/.test(s)||/^-/.test(s)||/-\s*$/.test(s)||/\bD$/i.test(s);
 s=s.replace(/[R$\s()CDcd+-]/g,'');if(!s)return NaN;const lc=s.lastIndexOf(','),lp=s.lastIndexOf('.');
 if(lc>lp)s=s.replace(/\./g,'').replace(',','.');else if(lp>lc&&lc>=0)s=s.replace(/,/g,'');else if(lc<0&&(s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
 const n=+s;return isNaN(n)?NaN:(neg?-n:n);}
function data(v,ano){if(v instanceof Date&&!isNaN(v))return new Date(v-v.getTimezoneOffset()*6e4).toISOString().slice(0,10);
 if(typeof v==='number'&&v>20000&&v<80000)return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10);
 const s=String(v||'').trim();let m=s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);if(m)return m[1]+'-'+m[2]+'-'+m[3];
 m=s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);if(m){let y=m[3]||String(ano||new Date().getFullYear());if(y.length===2)y='20'+y;const d=m[1].padStart(2,'0'),mo=m[2].padStart(2,'0');if(+mo>12||+d>31)return '';return y+'-'+mo+'-'+d;}return '';}
function texto(buf){const u8=new Uint8Array(buf);let t=new TextDecoder('utf-8').decode(u8);if(t.includes('\uFFFD'))t=new TextDecoder('windows-1252').decode(u8);return t.replace(/^\uFEFF/,'');}

/* ---------- OFX / OFC ---------- */
function lerOFX(t){const tag=(b,n)=>{const m=b.match(new RegExp('<'+n+'>\\s*([^<\\r\\n]*)','i'));return m?m[1].trim():'';};
 const partes=t.split(/<STMTTRN>/i).slice(1).map(b=>b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
 const movs=partes.map(b=>{const v=valor(tag(b,'TRNAMT').replace(',','.'));return {data:data(tag(b,'DTPOSTED')),valor:v,desc:[tag(b,'NAME'),tag(b,'MEMO')].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' · ')||tag(b,'TRNTYPE'),doc:tag(b,'CHECKNUM')||tag(b,'REFNUM'),fitid:tag(b,'FITID')};}).filter(m=>m.data&&!isNaN(m.valor));
 const bal=t.match(/<LEDGERBAL>[\s\S]*?<BALAMT>\s*([-\d.,]+)[\s\S]*?<DTASOF>\s*(\d{8})/i);
 return {movs,banco:tag(t,'BANKID')||tag(t,'ORG'),conta:tag(t,'ACCTID'),saldo:bal?{valor:valor(bal[1].replace(',','.')),data:data(bal[2])}:null,formato:'OFX'};}

/* ---------- tabelas (CSV, TXT, Excel, exportação da Conta Azul) ---------- */
function csvLinhas(t){const L=t.split(/\r?\n/).filter(l=>l.trim()),amostra=L.slice(0,15).join('\n'),cont=c=>(amostra.match(new RegExp(c==='|'?'\\|':c==='\t'?'\t':c,'g'))||[]).length;
 const sep=[';','\t',',','|'].sort((a,b)=>cont(b)-cont(a))[0];
 return L.map(l=>{const out=[];let cur='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){if(q&&l[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(ch===sep&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out.map(x=>x.trim());});}
function lerTabela(rows,formato){rows=rows.filter(r=>r&&r.some(c=>c!==null&&c!==''));let h=-1,col={};
 for(let i=0;i<Math.min(rows.length,25)&&h<0;i++){const r=rows[i].map(c=>norm(c));const k={};
  r.forEach((c,j)=>{if(!c||c.length>40)return;if(k.d==null&&/^(data|dt\b|date|data (do )?lan|data mov)/.test(c))k.d=j;else if(k.h==null&&/(hist|descri|lancamento|memo|detalhe|favorecido|nome)/.test(c))k.h=j;else if(k.cr==null&&/(credito|entrada|recebimento)/.test(c)&&!/saldo/.test(c))k.cr=j;else if(k.db==null&&/(debito|saida|pagamento)/.test(c)&&!/saldo/.test(c))k.db=j;else if(k.v==null&&/^(valor|vlr|amount|montante|valor \(r\$\)|valor r\$)/.test(c))k.v=j;else if(k.s==null&&/saldo/.test(c))k.s=j;else if(k.doc==null&&/(^doc|documento|numero|n[ºo°]|cheque)/.test(c))k.doc=j;else if(k.dc==null&&/^(d\/c|c\/d|dc|tipo|natureza|sinal)$/.test(c))k.dc=j;else if(k.cat==null&&/categoria/.test(c))k.cat=j;});
  if(k.d!=null&&(k.v!=null||k.cr!=null||k.db!=null)){h=i;col=k;}}
 if(h<0){// sem cabeçalho: 1ª coluna com data, última coluna com número = valor
  const r=rows.find(r=>data(r[0]));if(!r)throw new Error('Não encontrei as colunas de data e valor.');col={d:0,h:1,v:r.map((c,j)=>[c,j]).filter(([c])=>!isNaN(valor(c))&&!data(c)).map(x=>x[1]).slice(-1)[0]};h=-1;}
 const anoRef=(rows.slice(0,h+1).flat().join(' ').match(/\b(20\d{2})\b/)||[])[1];let saldo=null;
 const movs=[];rows.slice(h+1).forEach(r=>{const dt=data(r[col.d],anoRef);if(!dt)return;const desc=String(r[col.h]==null?'':r[col.h]).replace(/\s+/g,' ').trim();
  let v=col.v!=null?valor(r[col.v]):(valor(r[col.cr])||0)-Math.abs(valor(r[col.db])||0);if(col.v==null&&isNaN(valor(r[col.cr]))&&isNaN(valor(r[col.db])))v=NaN;
  if(col.dc!=null&&!isNaN(v)){const s=norm(r[col.dc]);if(/^d|debito|saida|-/.test(s))v=-Math.abs(v);else if(/^c|credito|entrada/.test(s))v=Math.abs(v);}
  const sl=col.s!=null?valor(r[col.s]):NaN;if(!isNaN(sl))saldo={valor:sl,data:dt};
  if(isNaN(v)||v===0)return;if(/^saldo\b|saldo anterior|saldo do dia|saldo final|s a l d o/i.test(desc))return;
  movs.push({data:dt,valor:Math.round(v*100)/100,desc:desc||'(sem descrição)',doc:col.doc!=null?String(r[col.doc]||''):'',cat:col.cat!=null?String(r[col.cat]||''):''});});
 if(!movs.length)throw new Error('Nenhum lançamento encontrado nas linhas da tabela.');
 return {movs,saldo,formato};}

/* ---------- PDF (extratos em texto; confira depois) ---------- */
let pdfLib=null;
function loadPdf(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);if(pdfLib)return pdfLib;pdfLib=new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=()=>ko(new Error('Não foi possível carregar o leitor de PDF.'));document.head.appendChild(s);});return pdfLib;}
async function lerPDF(buf){const L=await loadPdf(),doc=await L.getDocument({data:buf}).promise,linhas=[];
 for(let p=1;p<=doc.numPages;p++){const tc=await (await doc.getPage(p)).getTextContent(),by={};tc.items.forEach(it=>{const y=Math.round(it.transform[5]/3);(by[y]=by[y]||[]).push(it);});
  Object.keys(by).sort((a,b)=>b-a).forEach(y=>linhas.push(by[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()));}
 const ano=(linhas.join(' ').match(/\b(20\d{2})\b/)||[])[1],movs=[];let saldo=null;
 linhas.forEach(l=>{const m=l.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\s?[\d.]+,\d{2})\s*([DC-])?(?:\s+(-?[\d.]+,\d{2})\s*([DC])?)?\s*$/);if(!m)return;
  const desc=m[2].trim();let v=valor(m[3]);if(m[4]==='D'||m[4]==='-')v=-Math.abs(v);if(m[5]){let s=valor(m[5]);if(m[6]==='D')s=-Math.abs(s);saldo={valor:s,data:data(m[1],ano)};}
  if(/saldo/i.test(desc)){if(!m[5])saldo={valor:v,data:data(m[1],ano)};return;}
  if(!isNaN(v)&&v!==0)movs.push({data:data(m[1],ano),valor:v,desc,doc:''});});
 if(!movs.length)throw new Error('Não consegui ler lançamentos neste PDF (pode ser uma imagem). Peça ao banco o extrato em OFX ou CSV.');
 return {movs,saldo,formato:'PDF (conferir)'};}

function carregarXLSX(){return window.XLSX?Promise.resolve(window.XLSX):new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=()=>ko(new Error('Não foi possível carregar o leitor de planilhas.'));document.head.appendChild(s);});}
async function lerArquivo(file){const ext=(file.name.split('.').pop()||'').toLowerCase(),buf=await file.arrayBuffer();
 if(ext==='ofx'||ext==='ofc'||ext==='qfx')return lerOFX(texto(buf));
 if(ext==='csv'||ext==='txt'){const t=texto(buf);if(/<OFX>|OFXHEADER/i.test(t))return lerOFX(t);if(/^\d{3}\d{4}[0-9]/.test(t)&&t.split(/\r?\n/)[0].length>=240)throw new Error('Arquivo CNAB: para conciliação use o extrato em OFX ou CSV do internet banking.');return lerTabela(csvLinhas(t),ext.toUpperCase());}
 if(ext==='xlsx'||ext==='xls'||ext==='xlsm'){const XL=await carregarXLSX(),wb=XL.read(new Uint8Array(buf),{type:'array',cellDates:true});let melhor=null,erro=null;
  for(const sn of wb.SheetNames){try{const r=lerTabela(XL.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null}),'Excel');if(!melhor||r.movs.length>melhor.movs.length)melhor=r;}catch(e){erro=e;}}
  if(!melhor)throw erro||new Error('Planilha sem lançamentos.');return melhor;}
 if(ext==='pdf')return lerPDF(buf);
 throw new Error('Formato .'+ext+' não reconhecido. Use OFX, CSV, TXT, XLSX, XLS ou PDF.');}

/* ---------- conciliação ---------- */
const chave=(conta,m)=>m.fitid?conta+'|'+m.fitid:conta+'|'+m.data+'|'+m.valor.toFixed(2)+'|'+norm(m.desc).slice(0,40);
const toks=s=>new Set(norm(s).replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>=4&&!['pagamento','recebimento','transferencia','deposito','credito','debito','boleto','conta','pix','ted','doc'].includes(w)));
function candidatos(m){const F=FIN();if(!F)return [];const tipo=m.valor>0?'rec':'pag',v=Math.abs(m.valor),T=toks(m.desc);
 return F.abertos().filter(t=>t.tipo===tipo&&Math.abs((+t.valor)-v)<=Math.max(0.01,v*0.002)).map(t=>{const d=Math.abs(dd(t.venc,m.data)),nome=[...toks(t.parte+' '+t.desc)].some(w=>T.has(w));return {t,d,nome,score:d-(nome?15:0)};})
  .filter(c=>c.d<=15||c.nome).sort((a,b)=>a.score-b.score);}
function sugestao(m){const c=candidatos(m);if(!c.length)return null;const exato=c.length===1||(c[0].score<c[1].score-3);return {...c[0],exato:exato&&(c[0].d<=5||c[0].nome)};}
function conciliar(m,tid){const F=FIN(),t=F.baixarTitulo(tid,{data:m.data,valor:Math.abs(m.valor),conta:m.conta,extrato:m.id});if(!t)return false;m.conc={tit:t.id,em:hoje(),por:(me()||{}).nome||''};return true;}

/* ---------- Conta Azul (servidor) ---------- */
async function ca(acao,dados){const P=window.ArmantPonte;if(!P||!P.sb)throw new Error('A sincronização com a Conta Azul funciona no site com servidor (o protocolo OAuth exige a chave secreta guardada no servidor). Aqui, importe a planilha exportada da Conta Azul.');
 const r=await P.sb.functions.invoke('contaazul',{body:{acao,...(dados||{})}});if(r.error){let m=r.error.message;try{m=(await r.error.context.json()).erro||m;}catch(e){}throw new Error(m);}return r.data;}
async function sincronizarCA(){const F=FIN(),d=await ca('sincronizar',{de:(()=>{const x=new Date();x.setDate(x.getDate()-90);return x.toISOString().slice(0,10);})(),ate:(()=>{const x=new Date();x.setDate(x.getDate()+365);return x.toISOString().slice(0,10);})()});
 let n=0;(d.receber||[]).concat(d.pagar||[]).forEach(e=>{const pago=e.nao_pago<=0.005;F.lancarExterno({ref:'ca:'+e.id,tipo:e.tipo,desc:e.descricao,parte:e.parte||'',valor:+e.total,venc:e.vencimento,emissao:e.competencia||e.vencimento,cat:e.categoria||(e.tipo==='rec'?'Outras receitas':'Outras despesas'),status:pago?(e.tipo==='rec'?'recebido':'pago'):'aberto',...(pago?{liq:{data:e.pagamento||e.vencimento,valor:+e.pago,conta:'ca'}}:{}),orig:'contaazul'});n++;});
 X.ca={conectado:true,ultima:new Date().toISOString().slice(0,16),contas:d.contas||[],n};save();return n;}

/* ---------- tela ---------- */
function resumo(){const L=X.mov.filter(m=>!V.conta||m.conta===V.conta),pend=L.filter(m=>!m.conc&&!m.ign),ent=L.filter(m=>m.valor>0).reduce((a,m)=>a+m.valor,0),sai=L.filter(m=>m.valor<0).reduce((a,m)=>a+m.valor,0);
 const card=(l,v,s,f)=>'<article class="kpi-card'+(f?' featured':'')+'"><div class="kpi-top"><div class="kpi-label">'+l+'</div></div><div class="kpi-number">'+v+'</div><p class="kpi-subtitle">'+s+'</p></article>';
 return '<div class="kpi-grid">'+card('A conciliar',String(pend.length),pend.length?'lançamentos do banco sem título':'tudo conciliado',1)+card('Conciliados',String(L.filter(m=>m.conc).length),'baixados nos títulos')+card('Entradas',BRL(ent),'no período importado')+card('Saídas',BRL(sai),'no período importado')+'</div>';}
function importBox(){const cs=contas();return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Importar extrato</h2><p>OFX/OFC (recomendado), CSV, TXT, Excel (.xlsx/.xls), PDF ou a planilha exportada da Conta Azul</p></div></div>'+
 '<form id="ex-form" class="ex-form" novalidate><label class="ob-field"><span>Conta bancária</span><select name="conta">'+(cs.length?cs.map(c=>'<option value="'+c.id+'">'+esc(c.nome)+'</option>').join(''):'')+'<option value="__nova">+ Nova conta…</option></select></label>'+
 '<label class="ob-field ex-nova" hidden><span>Nome da nova conta</span><input name="nova" placeholder="Ex.: Banrisul 0000-0"></label>'+
 '<label class="ob-field cad-wide"><span>Arquivo(s)</span><input type="file" name="arq" multiple accept=".ofx,.ofc,.qfx,.csv,.txt,.xlsx,.xls,.xlsm,.pdf"></label>'+
 '<p class="cad-err cad-wide" id="ex-err" role="alert">'+esc(V.erro)+'</p><div class="ob-actions cad-wide"><button class="button primary" type="submit">'+ic('download')+'Ler extrato</button></div></form>'+
 (V.prev?'<div class="ex-prev"><p><b>'+V.prev.movs.length+' lançamento(s)</b> lidos de '+esc(V.prev.nome)+' ('+esc(V.prev.formato)+')'+(V.prev.dup?', '+V.prev.dup+' já importado(s) antes':'')+(V.prev.saldo?' · saldo do banco em '+br(V.prev.saldo.data)+': <b>'+BRL(V.prev.saldo.valor)+'</b>':'')+'.</p><div class="table-wrap ex-mini"><table class="ob-t"><tbody>'+V.prev.movs.slice(0,8).map(m=>'<tr><td class="ob-nw">'+br(m.data)+'</td><td class="ob-d">'+esc(m.desc)+'</td><td class="ob-n '+(m.valor<0?'fn-neg':'fn-pos')+'">'+BRL(m.valor)+'</td></tr>').join('')+(V.prev.movs.length>8?'<tr><td colspan="3" class="ob-p">… e mais '+(V.prev.movs.length-8)+'</td></tr>':'')+'</tbody></table></div><div class="ob-actions"><button class="button primary" data-ex-ok>Importar '+(V.prev.movs.length-V.prev.dup)+' lançamento(s)</button><button class="button outline" data-ex-cancel>Cancelar</button></div></div>':'')+'</section>';}
function caBox(){const c=X.ca||{},srv=!!window.ArmantPonte;
 return '<section class="panel ob-panel ex-ca"><div class="panel-header"><div><h2>Conta Azul</h2><p>'+(c.ultima?'Última sincronização: '+c.ultima.replace('T',' ')+' · '+c.n+' título(s)':'Sincronize contas a receber, a pagar e saldos')+'</p></div></div><div class="ex-cab">'+
 (srv?(c.conectado?'<button class="button primary fn-sm" data-ex-ca="sync">'+ic('refresh')+'Sincronizar agora</button> <button class="text-button" data-ex-ca="desconectar">Desconectar</button>':'<button class="button primary fn-sm" data-ex-ca="conectar">Conectar à Conta Azul</button>')
  :'<p class="area-note">A sincronização direta usa a API oficial da Conta Azul e funciona no site com servidor (o roteiro configura). Aqui, exporte o extrato ou as contas a pagar e a receber da Conta Azul em Excel e importe ao lado.</p>')+
 (c.contas&&c.contas.length?'<ul class="ex-cacontas">'+c.contas.map(k=>'<li>'+esc(k.nome)+' · '+esc(k.banco||'')+'<b>'+BRL(k.saldo||0)+'</b></li>').join('')+'</ul>':'')+'</div></section>';}
function linha(m){const s=!m.conc&&!m.ign?sugestao(m):null,F=FIN();
 const st=m.conc?'<span class="status fn-ok">conciliado</span><small>'+esc(m.conc.tit)+'</small>':m.ign?'<span class="status ob-mute">ignorado</span><small>'+esc(m.ign)+'</small>':s?'<span class="status '+(s.exato?'fn-ok-s':'')+'">'+(s.exato?'sugestão exata':'possível')+'</span><small>'+esc(s.t.desc)+' · '+esc(s.t.parte||'')+' · venc. '+br(s.t.venc)+'</small>':'<span class="status risk">sem título</span>';
 const act=!pode()?'':m.conc||m.ign?'<button class="text-button" data-ex-undo="'+m.id+'">Desfazer</button>':
  (s?'<button class="button primary fn-sm" data-ex-conc="'+m.id+'" data-tit="'+s.t.id+'">Conciliar</button> ':'')+'<button class="text-button" data-ex-esc="'+m.id+'">Escolher título</button> <button class="text-button" data-ex-novo="'+m.id+'">Criar lançamento</button> <button class="text-button" data-ex-ign="'+m.id+'">Ignorar</button>';
 return '<tr class="'+(m.conc?'ex-ok':m.ign?'ex-ign':'')+'"><td class="ob-nw">'+br(m.data)+'</td><td class="ob-d">'+esc(m.desc)+'<small>'+esc(cNome(m.conta))+(m.doc?' · doc '+esc(m.doc):'')+'</small></td><td class="ob-n '+(m.valor<0?'fn-neg':'fn-pos')+'">'+BRL(m.valor)+'</td><td class="ex-st">'+st+'</td><td class="ob-nw ex-act">'+act+'</td></tr>'+
  (V.esc===m.id?'<tr class="ex-esc"><td colspan="5">'+escolher(m)+'</td></tr>':'')+(V.novo===m.id?'<tr class="ex-esc"><td colspan="5">'+novoForm(m)+'</td></tr>':'');}
function escolher(m){const F=FIN(),tipo=m.valor>0?'rec':'pag',L=F.abertos().filter(t=>t.tipo===tipo).sort((a,b)=>Math.abs(a.valor-Math.abs(m.valor))-Math.abs(b.valor-Math.abs(m.valor))).slice(0,30);
 return '<div class="ex-pick"><b>Escolha o título '+(tipo==='rec'?'a receber':'a pagar')+' para baixar com '+BRL(Math.abs(m.valor))+' em '+br(m.data)+':</b>'+(L.length?'<ul>'+L.map(t=>'<li><button class="text-button" data-ex-conc="'+m.id+'" data-tit="'+t.id+'">'+esc(t.desc)+' · '+esc(t.parte||'')+' · '+BRL(t.valor)+' · venc. '+br(t.venc)+'</button></li>').join('')+'</ul>':'<p class="ob-p">Nenhum título em aberto. Use "Criar lançamento".</p>')+'<button class="text-button" data-ex-fechar>Fechar</button></div>';}
function novoForm(m){const F=FIN(),cats=m.valor>0?F.CAT_R:F.CAT_P,sug=/tarifa|tar\b|pacote|manut.*conta|cesta/i.test(m.desc)?'Administrativo':/iof|imposto|darf|das\b|gps|fgts|inss|iss/i.test(m.desc)?'Impostos':/combust|posto|ipiranga|shell/i.test(m.desc)?'Veículos e combustível':'';
 return '<form class="ex-nform" data-ex-nf="'+m.id+'"><label class="ob-field"><span>Descrição</span><input name="desc" value="'+esc(m.desc)+'"></label><label class="ob-field"><span>'+(m.valor>0?'Pagador':'Favorecido')+'</span><input name="parte"></label><label class="ob-field"><span>Categoria</span><select name="cat">'+cats.map(c=>'<option'+(c===sug?' selected':'')+'>'+c+'</option>').join('')+'</select></label><label class="ob-field"><span>Obra (opcional)</span><select name="cc"><option value="">—</option>'+((window.ArmantCadastros&&window.ArmantCadastros.demandas)?window.ArmantCadastros.demandas():[]).map(d=>'<option value="'+d.cc+'">'+d.cc+'</option>').join('')+'</select></label><div class="ob-actions"><button class="button primary fn-sm" type="submit">Lançar como '+(m.valor>0?'recebido':'pago')+'</button><button class="text-button" type="button" data-ex-fechar>Cancelar</button></div></form>';}
function saldoBanco(){const cs=contas().filter(c=>!V.conta||c.id===V.conta);return cs.map(c=>{const lotes=X.lotes.filter(l=>l.conta===c.id&&l.saldo).sort((a,b)=>String(a.saldo.data).localeCompare(String(b.saldo.data))),ult=lotes[lotes.length-1];if(!ult)return '';
 const F=FIN(),sis=(+c.saldo||0)+F.state.tit.filter(t=>t.liq&&t.liq.conta===c.id&&t.liq.data>(c.data||'')&&t.liq.data<=ult.saldo.data).reduce((a,t)=>a+(t.tipo==='rec'?1:-1)*(+t.liq.valor),0)+X.mov.filter(m=>m.ign&&m.conta===c.id&&m.data>(c.data||'')&&m.data<=ult.saldo.data).reduce((a,m)=>a+m.valor,0),pend=X.mov.filter(m=>!m.conc&&!m.ign&&m.conta===c.id).length,dif=Math.round((ult.saldo.valor-sis)*100)/100;
 return '<div class="ex-saldo'+(Math.abs(dif)>0.01?' dif':'')+'"><b>'+esc(c.nome)+'</b> · saldo do banco em '+br(ult.saldo.data)+': '+BRL(ult.saldo.valor)+' · no sistema: '+BRL(sis)+(Math.abs(dif)>0.01?' · <b>diferença '+BRL(dif)+'</b>'+(pend?' ('+pend+' lançamento(s) ainda a conciliar)':' (confira o saldo inicial da conta em Contas e emitente)'):' · confere ✓')+'</div>';}).join('');}
function page(){const L=X.mov.filter(m=>(!V.conta||m.conta===V.conta)&&(V.f==='todos'||(V.f==='pend'&&!m.conc&&!m.ign)||(V.f==='conc'&&m.conc)||(V.f==='ign'&&m.ign))&&(!V.q||norm(m.desc+' '+m.doc).includes(norm(V.q)))).sort((a,b)=>b.data.localeCompare(a.data)),exatos=X.mov.filter(m=>!m.conc&&!m.ign).map(m=>[m,sugestao(m)]).filter(([,s])=>s&&s.exato);
 return resumo()+'<div class="ex-top">'+importBox()+caBox()+'</div>'+saldoBanco()+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Lançamentos do banco</h2><p>'+L.length+' na lista · sugestões pelo valor, pela data e pelo nome</p></div>'+(exatos.length&&pode()?'<button class="button primary fn-sm" data-ex-todos>'+ic('check')+'Conciliar '+exatos.length+' sugestão(ões) exata(s)</button>':'')+'</div>'+
 '<div class="toolbar cad-tools"><label class="search-field">'+ic('search')+'<input id="ex-q" type="search" placeholder="Buscar no extrato" value="'+esc(V.q)+'"></label><select id="ex-conta"><option value="">Todas as contas</option>'+contas().map(c=>'<option value="'+c.id+'"'+(V.conta===c.id?' selected':'')+'>'+esc(c.nome)+'</option>').join('')+'</select><div class="filter-chips">'+[['pend','A conciliar'],['conc','Conciliados'],['ign','Ignorados'],['todos','Todos']].map(([k,l])=>'<button class="filter-chip '+(V.f===k?'active':'')+'" data-ex-f="'+k+'">'+l+'</button>').join('')+'</div></div>'+
 '<div class="table-wrap"><table class="ob-t ex-t"><thead><tr><th>Data</th><th>Lançamento</th><th class="ob-n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>'+(L.map(linha).join('')||'<tr><td colspan="5" class="ob-p">'+(X.mov.length?'Nada neste filtro.':'Importe um extrato para começar.')+'</td></tr>')+'</tbody></table></div>'+
 (X.lotes.length?'<details class="ex-lotes"><summary>Arquivos importados ('+X.lotes.length+')</summary><ul>'+X.lotes.slice().reverse().map(l=>'<li>'+br(l.em)+' · '+esc(l.arquivo)+' · '+esc(l.formato)+' · '+esc(cNome(l.conta))+' · '+l.qtd+' lançamento(s)'+(pode()?' <button class="text-button" data-ex-dellote="'+l.id+'">Desfazer importação</button>':'')+'</li>').join('')+'</ul></details>':'')+'</section>';}

/* ---------- eventos (prefixo ex-) ---------- */
const on=()=>location.hash.startsWith('#finance/extrato');
const refresh=()=>{const F=FIN();if(F&&F.refresh)F.refresh();};
const log=t=>{const N=NU();if(N&&N.log)N.log('Financeiro','alterou',t);};
document.addEventListener('change',e=>{if(!on())return;const t=e.target;
 if(t.name==='conta'&&t.form&&t.form.id==='ex-form'){t.form.querySelector('.ex-nova').hidden=t.value!=='__nova';}
 if(t.id==='ex-conta'){V.conta=t.value;refresh();}});
document.addEventListener('input',e=>{if(!on()||e.target.id!=='ex-q')return;V.q=e.target.value;const pos=e.target.selectionStart;refresh();const q=document.getElementById('ex-q');if(q){q.focus();q.setSelectionRange(pos,pos);}});
document.addEventListener('submit',async e=>{const f=e.target;if(!on())return;
 if(f.id==='ex-form'){e.preventDefault();if(!pode())return;V.erro='';let conta=f.elements.conta.value;const files=[...f.elements.arq.files];
  let nova=false;if(conta==='__nova'){const n=f.elements.nova.value.trim();if(!n){V.erro='Dê um nome para a nova conta.';refresh();return;}conta=FIN().addConta(n).id;nova=true;}
  if(!conta){V.erro='Cadastre ou escolha a conta bancária.';refresh();return;}if(!files.length){V.erro='Escolha o arquivo do extrato.';refresh();return;}
  try{const movs=[];let saldo=null,formato=[],nome=files.map(x=>x.name).join(', ');for(const file of files){const r=await lerArquivo(file);movs.push(...r.movs);if(r.saldo&&(!saldo||r.saldo.data>=saldo.data))saldo=r.saldo;formato.push(r.formato);}
   const ja=new Set(X.mov.map(m=>m.chave)),ks=movs.map(m=>chave(conta,m));V.prev={conta,movs:movs.map((m,i)=>({...m,chave:ks[i]})),saldo,formato:[...new Set(formato)].join(', '),nome,nova,dup:ks.filter(k=>ja.has(k)).length};}
  catch(err){V.erro=err.message||'Não foi possível ler o arquivo.';V.prev=null;}refresh();return;}
 if(f.dataset.exNf){e.preventDefault();const m=X.mov.find(x=>x.id===f.dataset.exNf);if(!m)return;const g=n=>f.elements[n].value.trim();
  const t=FIN().criarLiquidado({tipo:m.valor>0?'rec':'pag',desc:g('desc')||m.desc,parte:g('parte'),cat:g('cat'),cc:g('cc'),valor:Math.abs(m.valor),data:m.data,conta:m.conta,extrato:m.id,ref:'ext:'+m.id});
  m.conc={tit:t.id,em:hoje(),por:(me()||{}).nome||'',criado:true};save();V.novo=null;log('Extrato: lançamento '+t.id+' criado ('+BRL(m.valor)+')');refresh();say('Lançamento '+t.id+' criado e conciliado.');}});
document.addEventListener('click',async e=>{if(!on())return;const t=e.target.closest('[data-ex-ok],[data-ex-cancel],[data-ex-conc],[data-ex-esc],[data-ex-novo],[data-ex-ign],[data-ex-undo],[data-ex-fechar],[data-ex-f],[data-ex-todos],[data-ex-dellote],[data-ex-ca]');if(!t)return;const d=t.dataset;
 if(d.exF){V.f=d.exF;refresh();return;}
 if(!pode())return;
 if(d.exCancel!==undefined){V.prev=null;refresh();return;}
 if(d.exOk!==undefined&&V.prev){const ja=new Set(X.mov.map(m=>m.chave)),P=V.prev;X.seq.l++;const lote={id:'EXT-'+String(X.seq.l).padStart(4,'0'),conta:P.conta,arquivo:P.nome,formato:P.formato,em:hoje(),por:(me()||{}).nome||'',saldo:P.saldo,qtd:0};
  P.movs.forEach(m=>{if(ja.has(m.chave))return;ja.add(m.chave);X.seq.m++;X.mov.push({id:'MOV-'+String(X.seq.m).padStart(5,'0'),lote:lote.id,conta:P.conta,data:m.data,valor:m.valor,desc:m.desc,doc:m.doc||'',fitid:m.fitid||'',chave:m.chave,cat:m.cat||''});lote.qtd++;});
  // conta nova (ou ainda sem saldo inicial): o saldo inicial sai do próprio extrato (saldo final − lançamentos)
  const c=contas().find(k=>k.id===P.conta),semMov=c&&!FIN().state.tit.some(t=>t.liq&&t.liq.conta===c.id);
  if(c&&P.saldo&&lote.qtd>0&&(P.nova||(!(+c.saldo)&&semMov))){const daConta=X.mov.filter(m=>m.conta===c.id),ini=daConta.reduce((a,m)=>a<m.data?a:m.data,daConta[0].data),soma=X.mov.filter(m=>m.conta===c.id&&m.data<=P.saldo.data).reduce((a,m)=>a+m.valor,0);
   const d0=new Date(ini+'T12:00');d0.setDate(d0.getDate()-1);c.saldo=Math.round((P.saldo.valor-soma)*100)/100;c.data=d0.toISOString().slice(0,10);FIN().save();lote.saldoInicial=c.saldo;}
  X.lotes.push(lote);V.prev=null;V.f='pend';save();log('Extrato importado: '+lote.arquivo+' ('+lote.qtd+' lançamentos)');refresh();say(lote.qtd+' lançamento(s) importado(s).');return;}
 const m=d.exConc||d.exEsc||d.exNovo||d.exIgn||d.exUndo?X.mov.find(x=>x.id===(d.exConc||d.exEsc||d.exNovo||d.exIgn||d.exUndo)):null;
 if(d.exConc&&m){if(conciliar(m,d.tit)){V.esc=null;save();log('Extrato: '+m.id+' conciliado com '+d.tit);refresh();say('Conciliado: título '+d.tit+' baixado em '+br(m.data)+'.');}else say('Título não está mais em aberto.');return;}
 if(d.exEsc&&m){V.esc=V.esc===m.id?null:m.id;V.novo=null;refresh();return;}
 if(d.exNovo&&m){V.novo=V.novo===m.id?null:m.id;V.esc=null;refresh();return;}
 if(d.exFechar!==undefined){V.esc=null;V.novo=null;refresh();return;}
 if(d.exIgn&&m){m.ign=/transf|aplic|resgate|invest/i.test(m.desc)?'transferência/aplicação':'ignorado por '+((me()||{}).nome||'');save();refresh();return;}
 if(d.exUndo&&m){if(m.conc){FIN().desfazerBaixa(m.conc.tit);delete m.conc;}delete m.ign;save();log('Extrato: conciliação de '+m.id+' desfeita');refresh();return;}
 if(d.exTodos!==undefined){let n=0;X.mov.filter(x=>!x.conc&&!x.ign).forEach(x=>{const s=sugestao(x);if(s&&s.exato&&conciliar(x,s.t.id))n++;});save();log('Extrato: '+n+' conciliações exatas');refresh();say(n+' lançamento(s) conciliado(s).');return;}
 if(d.exDellote){if(t.dataset.ok!=='1'){t.dataset.ok='1';t.textContent='Confirmar (desfaz as conciliações deste arquivo)';return;}X.mov.filter(x=>x.lote===d.exDellote).forEach(x=>{if(x.conc)FIN().desfazerBaixa(x.conc.tit);});X.mov=X.mov.filter(x=>x.lote!==d.exDellote);X.lotes=X.lotes.filter(l=>l.id!==d.exDellote);save();refresh();say('Importação desfeita.');return;}
 if(d.exCa){try{if(d.exCa==='conectar'){const r=await ca('conectar',{voltar:location.origin+location.pathname+'#finance/extrato'});location.href=r.url;return;}
   if(d.exCa==='desconectar'){await ca('desconectar');X.ca={};save();refresh();say('Conta Azul desconectada.');return;}
   t.disabled=true;const n=await sincronizarCA();refresh();say('Conta Azul: '+n+' título(s) sincronizado(s).');}catch(err){t.disabled=false;say(err.message);}}});
/* volta da Conta Azul depois de autorizar */
if(/[?&#]ca=ok/.test(location.href)){X.ca={...(X.ca||{}),conectado:true};save();history.replaceState(null,'',location.pathname+'#finance/extrato');}

window.ArmantExtrato={version:'1.0',state:X,page,lerArquivo,lerOFX,lerTabela,csvLinhas,sugestao};
})();
