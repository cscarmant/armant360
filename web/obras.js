/* Armant 360 · Módulo de Obras (extensão do painel)
   Carregar depois de app.js:  <script src="obras-data.js" defer></script><script src="obras.js" defer></script>
   Não altera o código original: acrescenta a aba "Obra · TJ-RS" ao menu e trata as rotas #obra e #obra/<aba>. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
/* a mesma tela serve à obra real (#obra/<aba>) e a cada obra fictícia de demonstração (#obra/OB-001/<aba>) */
const DEMO_ID=/^OB-\d+$/;
const chrome={};
function criarObra(DATA,CFG){
if(!DATA) return;
const O=DATA.obra, ITEMS=DATA.items, FIC=!!CFG.id;
const BASE=FIC?'#obra/'+CFG.id+'/':'#obra/';
const partes=()=>location.hash.slice(1).split('/');
const minha=()=>{const p=partes();return p[0]==='obra'&&(FIC?p[1]===CFG.id:!DEMO_ID.test(p[1]||''));};
const abaDa=()=>{const p=partes();return FIC?p[2]:p[1];};
/* períodos: KM medições feitas, NM no contrato */
const NM=O.plano.length, KM=O.medidoSerie.length, pad2=n=>String(n).padStart(2,'0'), MK='MED '+pad2(KM+1);
const CLG=O.climaGrupo||'3.10.', CLN=O.climaNome||'3.10 Instalações de climatização';
const TX=FIC?{med:'cliente',tj:O.sigla,pl:'planilha de controle',plp:'planilha de controle da obra',per:'período '+pad2(KM+1),fluxo:'Fluxo do cliente (exemplo fictício)',
  aviso:'<strong>Obra fictícia.</strong> Dados inventados para demonstração: nenhum número é de obra real. O que você lança fica salvo neste navegador.',pill:'Obra fictícia · demonstração',cap:'Obra fictícia · dados de demonstração'}
 :{med:'TJ',tj:'TJ-RS',pl:'planilha CRON',plp:'planilha CRON (ago–dez/26)',per:'período 04',fluxo:'Fluxo do TJ-RS (a confirmar)',
  aviso:'<strong>Obra real.</strong> Números da planilha CRON (período 04). Premissas de pagamento e retenções a confirmar. O que você lança fica salvo neste navegador.',pill:'Obra real · planilha CRON',cap:'Obra real · '+O.fonte};
const CHAVE=FIC?'a360demo-'+CFG.id:'a360';
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>typeof escapeText==='function'?escapeText(s):String(s);
const say=m=>typeof toast==='function'?toast(m):null;

/* ---------- formatação ---------- */
const nf=(v,dg=2)=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dg,maximumFractionDigits:dg});
const BRL=v=>'R$ '+nf(v);
const BRk=v=>Math.abs(v)>=1e6?'R$ '+nf(v/1e6,2)+' mi':'R$ '+nf(v/1e3,1)+' mil';
const P=(v,dg=1)=>nf(v*100,dg)+'%';
const addD=(iso,n)=>{const x=new Date(iso+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const br=iso=>iso?iso.split('-').reverse().join('/'):'—';
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const mesl=iso=>{const [y,m]=iso.split('-');return MES[+m-1]+'/'+y.slice(2);};
const planAcum=O.plano.reduce((a,v,i)=>(a.push((a[i-1]||0)+v),a),[]);

/* ---------- estado (salvo neste navegador) ---------- */
const DEF={per:'Mensal',dia:25,aprov:10,pag:30,inss:11,iss:0,gar:0,proxFech:'2026-11-25'};
const S={tab:'andamento',med:{},medQ:{},perfil:{...DEF},q:'',grp:'',so:false,lanc:[],adit:[],prazo:{},pzOnly:'',draft:{},pIni:'2026-10-26',pFim:'2026-11-01',pObs:'',avOnly:false};
try{const s=JSON.parse(localStorage.getItem(CHAVE)||'null');if(s){S.med=s.med||{};S.medQ=s.medQ||{};S.perfil={...DEF,...(s.perfil||{})};S.lanc=Array.isArray(s.lanc)?s.lanc:[];S.adit=Array.isArray(s.adit)?s.adit:[];S.prazo=s.prazo||{};S.draft=(s.lanc&&s.draft)||{};}}catch(e){}
const save=()=>{try{localStorage.setItem(CHAVE,JSON.stringify({med:S.med,medQ:S.medQ,perfil:S.perfil,lanc:S.lanc,adit:S.adit,prazo:S.prazo,draft:S.draft}));}catch(e){}};

/* ---------- cálculos ---------- */
const baseQ=it=>it.ex*it.q;
const lancQ=(c,upto)=>S.lanc.reduce((a,l,i)=>a+(upto==null||i<=upto?(+l.itens[c]||0):0),0);
const doneQ=(it,upto)=>baseQ(it)+lancQ(it.c,upto);
const EX=it=>Math.min(1,doneQ(it)/it.q);
const PU=it=>it.t/it.q;
const split=(it,q)=>{const sal=Math.max(0,it.q-doneQ(it)),dentro=Math.min(q,sal);return {dentro,exc:Math.max(0,q-dentro)};};
const aditQ=c=>S.adit.reduce((a,x)=>a+(x.c===c?x.q:0),0);
const ADST=['Pendente','Em orçamento','Enviado ao cliente','Aprovado','Recusado'];
/* prazos por serviço: linha de base da planilha (PLANEJAMENTO + PLANO do cliente), editável */
const PZB=DATA.prazos||{};
const PZ=it=>{const b=PZB[it.c]||[O.inicio,addD(O.inicio,O.prazo-1),'cli'],o=S.prazo[it.c]||{};return {ini:o.ini||b[0],fim:o.fim||b[1],src:(o.ini||o.fim)?'editado':b[2],bi:b[0],bf:b[1]};};
const dd=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const HOJE=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
/* datas reais pelos lançamentos: 1º lançamento com quantidade = início; quando chega a 100% = término */
function real(it){let ini=it.ex>0?'base':null,fim=it.ex>=1?'base':null,acc=baseQ(it);S.lanc.forEach(l=>{const q=+l.itens[it.c]||0;if(q>0){if(!ini)ini=l.ini;acc+=q;if(!fim&&acc>=it.q-1e-9)fim=l.fim;}});return {ini,fim};}
function pzSt(it,ref,extraQ){const z=PZ(it),e=Math.min(1,(doneQ(it)+(extraQ||0))/it.q),dur=Math.max(1,dd(z.ini,z.fim)+1),esp=ref<z.ini?0:ref>=z.fim?1:(dd(z.ini,ref)+1)/dur,r=real(it);
 let k,l;if(e>=1-1e-9){k=r.fim&&r.fim!=='base'&&r.fim>z.fim?'late':'done';l=k==='late'?'Concluído com atraso':'Concluído';}
 else if(ref>z.fim){k='bad';l='Atrasado '+dd(z.fim,ref)+' d';}
 else if(ref<z.ini){k=e>0?'ok':'wait';l=e>0?'Adiantado':'A iniciar';}
 else if(e<esp-0.15){k='risk';l='Em risco';}else{k='ok';l='No prazo';}
 return {z,e,esp,k,l,dur,r};}
const pzBadge=st=>'<span class="status ob-pz-'+st.k+'">'+st.l+'</span>';
const qf=v=>nf(v,Math.abs(v-Math.round(v))<1e-6?0:2);
const sumEx=f=>ITEMS.filter(f).reduce((a,it)=>a+it.t*EX(it),0);
const EXT=()=>sumEx(()=>true), GX=g=>sumEx(it=>it.c.split('.')[0]===g), CX=()=>sumEx(it=>it.c.startsWith(CLG));
const CT=()=>ITEMS.filter(it=>it.c.startsWith(CLG)).reduce((a,it)=>a+it.t,0);
const EX0=()=>ITEMS.reduce((a,it)=>a+it.t*it.ex,0);
function termino(ex){const s=((ex??EXT())/O.valor)/(planAcum[KM]/O.valor),dur=Math.round(O.prazo/s);return {s,dur,fimP:addD(O.inicio,O.prazo),fimE:addD(O.inicio,dur),atraso:dur-O.prazo};}
function medicao(){let bruto=0,mo=0,mat=0,n=0,err=0;ITEMS.forEach(it=>{const p=+(S.med[it.c]||0);if(!p)return;if(p<0||p>100){err++;return;}const f=p/100;bruto+=it.t*f;mo+=it.mo*f;mat+=it.mat*f;n++;});
 const pf=S.perfil,ret=mo*pf.inss/100+bruto*pf.iss/100+bruto*pf.gar/100,fech=pf.proxFech,aprov=addD(fech,+pf.aprov),rec=addD(aprov,+pf.pag);return {bruto,mo,mat,n,err,ret,liq:bruto-ret,fech,aprov,rec};}
function previsao(){const m=medicao(),pf=S.perfil,out=[];const lista=[[KM+1,m.bruto>0?m.bruto:O.proxima,m.bruto>0?'Lançada na medição':'Próxima medição (planilha)']];
 for(let k=KM+2;k<=NM;k++)lista.push([k,O.plano[k-1],'Cronograma contratual V.0']);
 lista.forEach(([k,v,orig],i)=>{let f=pf.proxFech;if(i){const d=new Date(pf.proxFech+'T12:00:00');d.setMonth(d.getMonth()+i);d.setDate(+pf.dia);f=d.toISOString().slice(0,10);}
  const ret=v*0.315*pf.inss/100+v*pf.iss/100+v*pf.gar/100;out.push({k,v,orig,fech:f,rec:addD(f,+pf.aprov+ +pf.pag),liq:v-ret});});return out;}

/* ---------- peças no estilo do painel ---------- */
function card(label,value,sub,foot,last,progress,opt={}){return '<article class="kpi-card '+(opt.featured?'featured':'')+'"><div class="kpi-top"><div class="kpi-label">'+ic(opt.icon||'chart')+esc(label)+'</div></div><div class="kpi-number">'+value+'</div><p class="kpi-subtitle">'+sub+'</p><div class="kpi-footer"><span class="trend '+(opt.warn?'warning':'')+'">'+ic(opt.warn?'clock':'up')+foot+'</span><span>'+(last||'')+'</span></div><div class="mini-progress"><span style="width:'+Math.max(0,Math.min(100,progress||0))+'%"></span></div></article>';}
const panel=(title,sub,body,right)=>'<section class="panel ob-panel"><div class="panel-header"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+(right||'')+'</div>'+body+'</section>';
const adv=v=>'<div class="advance"><span class="advance-track"><span style="width:'+Math.min(100,v*100)+'%"></span></span>'+P(v)+'</div>';
const CYC=[['Orçamento aprovado','linha de base','done'],['Planejamento','serviços × semanas','done'],['Execução','avanço por serviço','now'],['Medição → Pagamento','repete a cada período','now loop'],['Documentação','as built, termos, ART',''],['Entrega','recebimento e garantia','']];
const cycle=()=>'<div class="ob-cycle ob-cycle6">'+CYC.map((c,i)=>'<div class="ob-step '+c[2]+'"><span class="no">'+String(i+1).padStart(2,'0')+'</span><b>'+c[0]+'</b><span>'+c[1]+'</span></div>').join('')+'</div><p class="ob-loop">'+ic('refresh')+'Medição e pagamento se repetem a cada período (mensal neste contrato) ou a cada marco de execução, até a entrega.</p>';
function curvaS(){const W=620,H=230,L=56,R=16,T=16,B=32,X=i=>L+i*(W-L-R)/NM,Y=v=>T+(1-v/O.valor)*(H-T-B);const ex=EXT();
 const grid=[0,.25,.5,.75,1].map(f=>'<line class="grid-line" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(f*O.valor)+'" y2="'+Y(f*O.valor)+'"/><text x="'+(L-8)+'" y="'+(Y(f*O.valor)+3)+'" text-anchor="end">'+(f?nf(f*O.valor/1e6,1)+' mi':'0')+'</text>').join('');
 const xl=Array.from({length:NM+1},(_,i)=>(i%2===0||NM<10)?'<text x="'+X(i)+'" y="'+(H-10)+'" text-anchor="middle">'+(i?'MED '+String(i).padStart(2,'0'):'início')+'</text>':'').join('');
 const plan='M'+[0,...planAcum].map((v,i)=>X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' L');
 const med='M'+[0,...O.medidoSerie].map((v,i)=>X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' L');
 return '<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Curva S planejado, medido e executado">'+grid+xl+'<path class="plan-line" d="'+plan+'"/><path class="actual-line" d="'+med+'"/>'+O.medidoSerie.map((v,i)=>'<circle cx="'+X(i+1)+'" cy="'+Y(v)+'" r="3" fill="#023c48"/>').join('')+
 '<circle cx="'+X(KM+1)+'" cy="'+Y(planAcum[KM])+'" r="4" fill="white" stroke="#9bb3b8" stroke-width="2"/><text x="'+(X(KM+1)+8)+'" y="'+(Y(planAcum[KM])-6)+'">planejado '+P(planAcum[KM]/O.valor)+'</text><circle cx="'+X(KM+1)+'" cy="'+Y(ex)+'" r="5.5" fill="#317455"/><text x="'+(X(KM+1)+9)+'" y="'+(Y(ex)+4)+'" style="fill:#317455;font-weight:600">executado '+P(ex/O.valor)+'</text></svg></div><div class="legend"><span><i class="dashed"></i>Planejado (V.0)</span><span><i></i>Medido pelo '+TX.med+'</span><span><i style="background:#317455"></i>Executado</span></div>';}

/* ---------- abas ---------- */
const TABS=[['andamento','Andamento'],['planejamento','Planejamento'],['avanco','Lançar andamento'],['relatorio','Relatório de andamento'],['medicao','Medição e faturamento'],['aditivos','Aditivos'],['caixa','Caixa previsto'],['prazo','Prazo'],['processo','Processo'],['presenca','Diário e presença'],['perfil','Perfil do cliente']];
const T={};
T.andamento=()=>{const ex=EXT();return '<div class="kpi-grid">'+card('Executado',P(ex/O.valor),BRL(ex),'avanço físico','com BDI',ex/O.valor*100,{featured:1,icon:'building'})+card('Planejado até '+MK+'',P(planAcum[KM]/O.valor),BRL(planAcum[KM]),'cronograma V.0','linha de base',planAcum[KM]/O.valor*100,{icon:'calendar'})+card('Medido pelo '+TX.med+'',P(O.medido/O.valor),BRL(O.medido),'MED 01 a '+pad2(KM),'contrato',O.medido/O.valor*100,{icon:'receipt'})+card('Executado a medir',BRk(ex-O.medido),'serviço feito, ainda não medido','próxima: '+BRk(O.proxima),'',100,{icon:'wallet',warn:1})+'</div>'+
 '<div class="chart-grid">'+panel('Curva S','Planejado (V.0), medido e executado · com BDI',curvaS())+panel('Avanço por grupo','Executado ÷ valor do grupo','<div class="ob-groups">'+O.grupos.map(g=>{const v=GX(g[0]);return '<div><div class="ob-row"><span><b>'+g[0]+'.</b> '+g[1]+'</span><b>'+P(v/g[2])+'</b></div><div class="health-track"><span style="width:'+v/g[2]*100+'%"></span></div><small>'+BRL(v)+' de '+BRL(g[2])+'</small></div>';}).join('')+'<div class="ob-sep"><div class="ob-row"><span>'+CLN+'</span><b>'+P(CX()/CT())+'</b></div><div class="health-track"><span style="width:'+CX()/CT()*100+'%"></span></div><small>dentro de Obra civil</small></div></div>')+'</div>';};

const groupName=g=>(O.grupos.find(x=>x[0]===g)||[g,''])[1];
const mkSel=(attr,c,val)=>'<select class="ob-mk" '+attr+'="'+c+'" aria-label="Marco do item '+c+'"><option value="">Marco…</option><option value="70" '+(+val===70?'selected':'')+'>Chegou · 70%</option><option value="90" '+(+val===90?'selected':'')+'>Instalado · 90%</option><option value="100" '+(+val===100?'selected':'')+'>Startup · 100%</option></select>';
const tools=extra=>'<div class="toolbar ob-tools"><label class="search-field">'+ic('search')+'<input id="ob-q" type="search" placeholder="Buscar item ou código..." aria-label="Buscar item" value="'+esc(S.q)+'"></label><div class="filter-chips"><button class="filter-chip '+(!S.grp?'active':'')+'" data-ob-grp="">Todos</button>'+O.grupos.map(g=>'<button class="filter-chip '+(S.grp===g[0]?'active':'')+'" data-ob-grp="'+g[0]+'">'+g[0]+'. '+g[1]+'</button>').join('')+'</div>'+(extra||'')+'</div>';
const filt=extraF=>ITEMS.filter(it=>(!S.grp||it.c.split('.')[0]===S.grp)&&(!S.q||(it.c+' '+it.d).toLowerCase().includes(S.q.toLowerCase()))&&extraF(it));
const shortD=d=>esc(d.length>120?d.slice(0,118)+'…':d);

T.planejamento=()=>{const ref=S.pRef||HOJE(),all=ITEMS.map(it=>[it,pzSt(it,ref)]),cnt=k=>all.filter(x=>x[1].k===k).length,ed=Object.keys(S.prazo).length;
 const t0=O.inicio,t1=ITEMS.reduce((a,it)=>{const f=PZ(it).fim;return f>a?f:a;},addD(O.inicio,O.prazo-1)),span=Math.max(1,dd(t0,t1)),pos=d=>Math.max(0,Math.min(100,dd(t0,d)/span*100));
 let last='',rows='';all.filter(([it,st])=>filt(()=>true).includes(it)&&(!S.pzOnly||(S.pzOnly==='bad'?(st.k==='bad'||st.k==='risk'||st.k==='late'):st.k===S.pzOnly))).forEach(([it,st])=>{const g=it.c.split('.')[0];if(g!==last){last=g;rows+='<tr class="ob-gh"><td colspan="8">'+g+'. '+groupName(g)+'</td></tr>';}
  const z=st.z,l=pos(z.ini),w=Math.max(1.2,pos(z.fim)-l);
  rows+='<tr><td class="ob-code">'+it.c+'</td><td class="ob-d">'+shortD(it.d)+'<small>'+BRL(it.t)+(z.src==='editado'?' · <b class="ob-ed">editado</b> (base '+br(z.bi)+' a '+br(z.bf)+')':'')+'</small></td>'+
  '<td class="ob-nw"><input type="date" class="ob-date" data-ob-pzi="'+it.c+'" value="'+z.ini+'" aria-label="Início previsto '+it.c+'"></td><td class="ob-nw"><input type="date" class="ob-date" data-ob-pzf="'+it.c+'" value="'+z.fim+'" aria-label="Término previsto '+it.c+'"></td><td class="ob-n">'+st.dur+' d</td>'+
  '<td class="ob-n">'+P(st.e,0)+'<small>esperado '+P(st.esp,0)+'</small></td><td class="ob-nw">'+pzBadge(st)+(st.r.ini&&st.r.ini!=='base'?'<small>início real '+br(st.r.ini)+(st.r.fim&&st.r.fim!=='base'?' · fim '+br(st.r.fim):'')+'</small>':'')+'</td>'+
  '<td class="ob-gantt"><div class="ob-gbar"><span class="pl" style="left:'+l+'%;width:'+w+'%"></span><span class="ex ob-pz-'+st.k+'" style="left:'+l+'%;width:'+(w*st.e)+'%"></span><i style="left:'+pos(ref)+'%"></i></div></td></tr>';});
 const chips=[['','Todos'],['bad','Atrasados e em risco'],['wait','A iniciar'],['ok','No prazo'],['done','Concluídos']];
 const extra='<label class="period-control ob-ctl">'+ic('calendar')+'<span class="ob-lbl">situação em</span><input type="date" id="ob-pref" value="'+ref+'" aria-label="Data de referência"></label>';
 return '<div class="kpi-grid">'+card('Serviços no prazo',String(cnt('ok')),'de '+ITEMS.length+' serviços','situação em '+br(ref),'',cnt('ok')/ITEMS.length*100,{featured:1,icon:'calendar'})+card('Atrasados',String(cnt('bad')+cnt('late')),'término previsto já passou'+(cnt('late')?' · '+cnt('late')+' concluído(s) com atraso':''),'agir primeiro','',0,{icon:'clock',warn:cnt('bad')>0})+card('Em risco',String(cnt('risk')),'executado abaixo do esperado','mais de 15 p.p. abaixo','',0,{icon:'shield',warn:cnt('risk')>0})+card('A iniciar · concluídos',cnt('wait')+' · '+cnt('done'),ed?ed+' prazo(s) editado(s)':'prazos da planilha','linha de base','',0,{icon:'check'})+'</div>'+
 panel('Prazos por serviço','Início e término previstos de cada serviço. Linha de base: aba PLANEJAMENTO da '+TX.plp+' completada pelo cronograma do cliente (PLANO V.1, por subgrupo). Ajuste as datas aqui; o original fica guardado.',tools(extra)+'<div class="filter-chips ob-pzchips">'+chips.map(([k,l])=>'<button class="filter-chip '+(S.pzOnly===k?'active':'')+'" data-ob-pzo="'+k+'">'+l+'</button>').join('')+'</div><div class="table-wrap ob-tw"><table class="ob-t"><thead><tr><th>Item</th><th>Descrição</th><th>Início previsto</th><th>Término previsto</th><th class="ob-n">Duração</th><th class="ob-n">Executado</th><th>Situação</th><th class="ob-gantt">'+mesl(t0)+' → '+mesl(t1)+'</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">Nenhum serviço com esse filtro.</td></tr>')+'</tbody></table></div>'+
 '<div class="ob-actions"><button class="button outline" id="ob-pzcopy">'+ic('download')+'Copiar para Excel</button>'+(ed?'<button class="button outline" id="ob-pzreset">Voltar aos prazos da planilha</button>':'')+'</div><p class="area-note">A situação compara o executado com o esperado na data: a iniciar, no prazo, em risco (mais de 15 p.p. abaixo do esperado), atrasado (término passou sem concluir) e concluído. Início e término reais vêm dos lançamentos de andamento.</p>');};
function pzTSV(){const ref=S.pRef||HOJE(),L=['Item\tDescrição\tInício previsto\tTérmino previsto\tDuração (dias)\tExecutado %\tEsperado %\tSituação\tInício real\tTérmino real\tOrigem do prazo'];ITEMS.forEach(it=>{const st=pzSt(it,ref);L.push([it.c,it.d,br(st.z.ini),br(st.z.fim),st.dur,nf(st.e*100,1),nf(st.esp*100,1),st.l,st.r.ini==='base'?'antes da data-base':br(st.r.ini),st.r.fim==='base'?'antes da data-base':br(st.r.fim),st.z.src==='editado'?'editado':st.z.src==='int'?'planejamento interno':st.z.src==='mix'?'interno + cliente':'cronograma do cliente'].join('\t'));});return L.join('\n');}
T.avanco=()=>{let last='',rows='';
 filt(it=>!S.avOnly||(EX(it)>0&&EX(it)<1)||S.draft[it.c]!=null).forEach(it=>{const g=it.c.split('.')[0];if(g!==last){last=g;const gt=(O.grupos.find(x=>x[0]===g)||[0,0,1])[2];rows+='<tr class="ob-gh"><td colspan="7">'+g+'. '+groupName(g)+' · '+P(GX(g)/gt)+' concluído</td></tr>';}
  const done=doneQ(it),saldo=Math.max(0,it.q-done),d=S.draft[it.c],bad=d!=null&&(isNaN(+d)||+d<0),sp=d!=null&&!bad?split(it,+d):{dentro:0,exc:0},ja=aditQ(it.c);
  const nv=done+sp.dentro;
  rows+='<tr class="'+(d==null?'':bad?'ob-err':sp.exc>1e-9?'ob-adt':'ob-has')+'"><td class="ob-code">'+it.c+'</td><td class="ob-d">'+shortD(it.d)+'<small>'+BRL(it.t)+'</small></td><td class="ob-n">'+qf(it.q)+' <small>'+(it.u||'')+'</small></td><td class="ob-n">'+qf(done)+' <small>'+P(done/it.q,0)+'</small></td>'+
   '<td class="ob-nw"><input class="ob-pct" inputmode="decimal" data-ob-q="'+it.c+'" value="'+(d==null?'':String(d).replace('.',','))+'" placeholder="0" aria-label="Quantidade entregue no período, item '+it.c+'"> '+(it.u||'')+'<small>saldo '+qf(saldo)+(ja?' · aditivo '+qf(ja):'')+'</small></td>'+
   '<td class="ob-n" data-ob-res="'+it.c+'">'+resCell(it,d,bad,nv,sp)+'</td><td class="ob-nw ob-pzc" data-ob-pzc="'+it.c+'">'+pzCell(it,sp.dentro)+'</td></tr>';});
 const extra='<label class="period-control ob-ctl">'+ic('calendar')+'<span class="ob-lbl">de</span><input type="date" id="ob-pini" value="'+S.pIni+'" aria-label="Início do período"></label><label class="period-control ob-ctl"><span class="ob-lbl">até</span><input type="date" id="ob-pfim" value="'+S.pFim+'" aria-label="Fim do período"></label><label class="ob-check"><input type="checkbox" id="ob-avonly" '+(S.avOnly?'checked':'')+'> Só em andamento</label>';
 return '<div class="ob-split"><div class="ob-main">'+panel('Lançar andamento','Informe a quantidade entregue de cada item no período. Exemplo: se o item prevê 12 equipamentos e 3 foram entregues nesta semana, digite 3. O sistema soma aos lançamentos anteriores.',tools(extra)+'<div class="table-wrap ob-tw"><table class="ob-t"><thead><tr><th>Item</th><th>Descrição</th><th class="ob-n">Planejado</th><th class="ob-n">Entregue até agora</th><th>Entregue no período</th><th class="ob-n">Fica</th><th>Prazo do serviço</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Nenhum item com esse filtro.</td></tr>')+'</tbody></table></div><p class="area-note">Ponto de partida: o executado da '+TX.pl+' no '+TX.per+'. Prazo do serviço: término previsto e situação no fim do período (pode ajustar a data aqui ou na aba Planejamento). Quantidade acima do planejado fica em amarelo: o que passar do saldo vai para a aba Aditivos, com data, quantidade e valor.</p>')+'</div><aside class="ob-side" id="ob-side">'+avSide()+'</aside></div>';};
function pzCell(it,q){const st=pzSt(it,S.pFim||HOJE(),q);return '<input type="date" class="ob-date" data-ob-pzf="'+it.c+'" value="'+st.z.fim+'" aria-label="Término previsto do item '+it.c+'"><small>'+pzBadge(st)+' esperado '+P(st.esp,0)+' em '+br(S.pFim).slice(0,5)+'</small>';}
function resCell(it,d,bad,nv,sp){if(d==null||bad)return '—';return qf(nv)+' <small>'+P(nv/it.q,0)+'</small>'+(sp.exc>1e-9?'<small class="ob-adtnote">+'+qf(sp.exc)+' '+(it.u||'')+' para aditivo</small>':'');}
function avPrev(){let dv=0,n=0,bad=0,na=0,va=0;ITEMS.forEach(it=>{const d=S.draft[it.c];if(d==null)return;const q=+d;if(isNaN(q)||q<0){bad++;return;}const sp=split(it,q);if(sp.dentro>0){dv+=PU(it)*sp.dentro;n++;}if(sp.exc>1e-9){na++;va+=PU(it)*sp.exc;}});return {dv,n,bad,na,va};}
function avSide(){const p=avPrev(),now=EXT(),aft=now+p.dv,t=termino(aft),okP=S.pIni&&S.pFim&&S.pIni<=S.pFim;
 return '<article class="kpi-card featured"><div class="kpi-top"><div class="kpi-label">'+ic('building')+'Andamento da obra</div></div><div class="kpi-number">'+P(aft/O.valor)+'</div><p class="kpi-subtitle">'+(p.n?'antes '+P(now/O.valor)+' · +'+nf(p.dv/O.valor*100,2)+' p.p. neste período':'nenhuma quantidade lançada ainda')+'</p><div class="mini-progress"><span style="width:'+aft/O.valor*100+'%"></span></div></article>'+
 '<section class="panel ob-panel"><dl class="ob-dl"><dt>Período</dt><dd>'+br(S.pIni)+' a '+br(S.pFim)+'</dd><dt>Itens com entrega</dt><dd>'+p.n+'</dd><dt>Valor avançado no período</dt><dd>'+BRL(p.dv)+'</dd><dt>Executado acumulado</dt><dd>'+BRL(aft)+'</dd>'+(p.na?'<dt>Acima do planejado → aditivos</dt><dd class="ob-adtv">'+p.na+' item(ns) · '+BRL(p.va)+'</dd>':'')+'<dt>Término previsto</dt><dd>'+br(t.fimE)+'</dd></dl>'+
 '<label class="ob-field" style="margin-top:12px"><span>Observação do período (opcional)</span><input id="ob-pobs" value="'+esc(S.pObs)+'" placeholder="ex.: chuva na quarta, entrega da Trane"></label>'+
 (p.bad?'<p class="ob-alert bad">'+p.bad+' item(ns) com quantidade inválida.</p>':'')+(p.na?'<p class="ob-alert warn">'+p.na+' item(ns) acima do planejado. Ao registrar, o excedente vai para a aba Aditivos (valor pelo preço unitário do contrato, com BDI).</p>':'')+(!okP?'<p class="ob-alert bad">Confira as datas do período.</p>':'')+
 '<div class="ob-actions"><button class="button primary" id="ob-avsave" '+((p.n||p.na)&&!p.bad&&okP?'':'disabled')+'>'+ic('check')+'Registrar lançamento</button><button class="button outline" id="ob-avclear">Descartar</button></div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Últimos lançamentos</h2><p>'+S.lanc.length+' registrado(s)</p></div><a class="text-button" href="'+BASE+'relatorio">Relatório '+ic('arrow')+'</a></div><dl class="ob-dl">'+S.lanc.slice(-5).reverse().map(l=>'<dt>'+br(l.ini)+' a '+br(l.fim)+' · '+Object.keys(l.itens).length+' item(ns)</dt><dd>+'+BRk(l.dv)+'</dd>').join('')+'<dt>Base · '+TX.pl+' ('+TX.per+')</dt><dd>'+P(EX0()/O.valor)+'</dd></dl><p class="area-note">Salvo neste navegador. Para a equipe toda, o próximo passo é o armazenamento compartilhado.</p></section>';}
function lancRows(){let acc=EX0();return S.lanc.map((l,i)=>{acc+=l.dv;return {i,l,acc};});}
function relCurve(){const pts=[{d:null,v:EX0()},...lancRows().map(r=>({d:r.l.fim,v:r.acc}))];const W=1040,H=250,L=56,R=30,T=18,B=34,n=Math.max(1,pts.length-1),X=i=>L+i*(W-L-R)/n,max=Math.max(...pts.map(p=>p.v))*1.15||1,Y=v=>T+(1-v/max)*(H-T-B);
 const grid=[0,.25,.5,.75,1].map(f=>'<line class="grid-line" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(f*max)+'" y2="'+Y(f*max)+'"/><text x="'+(L-8)+'" y="'+(Y(f*max)+3)+'" text-anchor="end">'+nf(f*max/O.valor*100,0)+'%</text>').join('');
 const path='M'+pts.map((p,i)=>X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' L');
 return '<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Avanço acumulado por lançamento">'+grid+'<path class="actual-line" d="'+path+'"/>'+pts.map((p,i)=>'<circle cx="'+X(i)+'" cy="'+Y(p.v)+'" r="'+(i===pts.length-1?4.5:3)+'" fill="'+(i===pts.length-1?'#023c48':'white')+'" stroke="#023c48" stroke-width="1.5"><title>'+(p.d?br(p.d):'Base')+': '+P(p.v/O.valor)+'</title></circle><text x="'+X(i)+'" y="'+(H-12)+'" text-anchor="middle">'+(p.d?br(p.d).slice(0,5):'base')+'</text>').join('')+'</svg></div>';}
T.relatorio=()=>{const rs=lancRows(),tot=rs.reduce((a,r)=>a+r.l.dv,0),first=S.lanc[0],lastL=S.lanc[S.lanc.length-1];
 const days=first?Math.max(1,(Date.parse(lastL.fim)-Date.parse(first.ini))/864e5+1):0,wk=days?tot/(days/7):0;
 const codes=[...new Set(S.lanc.flatMap(l=>Object.keys(l.itens)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const mat=codes.map(c=>{const it=ITEMS.find(i=>i.c===c);return '<tr><td class="ob-code">'+c+'</td><td class="ob-d">'+shortD(it.d)+'</td><td class="ob-n">'+qf(it.q)+' '+(it.u||'')+'</td><td class="ob-n">'+qf(baseQ(it))+'</td>'+S.lanc.map(l=>'<td class="ob-n">'+(l.itens[c]?qf(+l.itens[c]):'')+'</td>').join('')+'<td class="ob-n"><strong>'+qf(doneQ(it))+'</strong> <small>'+P(EX(it),0)+'</small></td></tr>';}).join('');
 return '<div class="kpi-grid">'+card('Lançamentos registrados',String(S.lanc.length),first?br(first.ini)+' a '+br(lastL.fim):'nenhum ainda','tempo × lançamento','',100,{featured:1,icon:'clipboard'})+card('Avançado nos lançamentos',BRk(tot),'+'+nf(tot/O.valor*100,2)+' p.p. desde a base','valor com BDI','',tot/O.valor*100,{icon:'up'})+card('Ritmo médio',days?BRk(wk)+'/semana':'—',days?nf(wk/O.valor*100,2)+' p.p. por semana':'registre o primeiro lançamento','pelo período coberto','',0,{icon:'clock'})+card('Executado acumulado',P(EXT()/O.valor),BRL(EXT()),'inclui a base da planilha','',EXT()/O.valor*100,{icon:'building'})+'</div>'+
 panel('Avanço acumulado por lançamento','Cada ponto é o fim de um período lançado · % da obra',curvaReady(rs)?relCurve():'<p class="ob-p">Registre lançamentos em "Lançar andamento" para ver a evolução no tempo.</p>','<button class="button outline" id="ob-relcopy">'+ic('clipboard')+'Copiar relatório</button>')+
 panel('Lançamentos por período','Tempo × lançamento: o que foi entregue em cada período','<div class="table-wrap"><table><thead><tr><th>Período</th><th>Registrado em</th><th>Itens</th><th>Valor avançado</th><th>No período</th><th>Acumulado</th><th>Observação</th><th></th></tr></thead><tbody><tr><td colspan="5"><strong>Base</strong> · '+TX.pl+', '+TX.per+'</td><td><strong>'+P(EX0()/O.valor)+'</strong></td><td colspan="2"></td></tr>'+rs.map(r=>'<tr><td><strong>'+br(r.l.ini)+' a '+br(r.l.fim)+'</strong></td><td>'+br(r.l.reg)+'</td><td>'+Object.keys(r.l.itens).length+'</td><td>'+BRL(r.l.dv)+'</td><td>+'+nf(r.l.dv/O.valor*100,2)+' p.p.</td><td><strong>'+P(r.acc/O.valor)+'</strong></td><td><small>'+esc(r.l.obs||'')+'</small></td><td><button class="text-button" data-ob-del="'+r.i+'">Excluir</button></td></tr>').join('')+'</tbody></table></div>')+
 panel('Quantidades por item e período','Itens que tiveram entrega registrada · quantidades na unidade do item',codes.length?'<div class="table-wrap ob-tw"><table class="ob-t"><thead><tr><th>Item</th><th>Descrição</th><th class="ob-n">Planejado</th><th class="ob-n">Base</th>'+S.lanc.map(l=>'<th class="ob-n">'+br(l.ini).slice(0,5)+'–'+br(l.fim).slice(0,5)+'</th>').join('')+'<th class="ob-n">Acumulado</th></tr></thead><tbody>'+mat+'</tbody></table></div>':'<p class="ob-p">Nenhuma entrega registrada ainda.</p>');};
const curvaReady=rs=>rs.length>0;
function relTSV(){const rs=lancRows(),L=['RELATÓRIO DE ANDAMENTO · '+O.nome,'Base: '+TX.pl+', '+TX.per+'\t'+nf(EX0()/O.valor*100,2)+'%','','Período\tRegistrado em\tItens\tValor avançado (R$)\tNo período (p.p.)\tAcumulado (%)\tObservação'];
 rs.forEach(r=>L.push(br(r.l.ini)+' a '+br(r.l.fim)+'\t'+br(r.l.reg)+'\t'+Object.keys(r.l.itens).length+'\t'+nf(r.l.dv)+'\t'+nf(r.l.dv/O.valor*100,2)+'\t'+nf(r.acc/O.valor*100,2)+'\t'+(r.l.obs||'')));
 const codes=[...new Set(S.lanc.flatMap(l=>Object.keys(l.itens)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 L.push('','Item\tDescrição\tUnidade\tPlanejado\tBase\t'+S.lanc.map(l=>br(l.ini)+'–'+br(l.fim)).join('\t')+'\tAcumulado');
 codes.forEach(c=>{const it=ITEMS.find(i=>i.c===c);L.push(c+'\t'+it.d+'\t'+(it.u||'')+'\t'+qf(it.q)+'\t'+qf(baseQ(it))+'\t'+S.lanc.map(l=>l.itens[c]?qf(+l.itens[c]):'').join('\t')+'\t'+qf(doneQ(it)));});
 return L.join('\n');}

T.medicao=()=>{let last='',rows='';
 filt(it=>!S.so||+(S.med[it.c]||0)>0).forEach(it=>{const g=it.c.split('.')[0];if(g!==last){last=g;rows+='<tr class="ob-gh"><td colspan="7">'+g+'. '+groupName(g)+'</td></tr>';}
  const p=S.med[it.c]??'';const bad=p!==''&&(+p<0||+p>100+1e-9),qm=medQtd(it);
  rows+='<tr class="'+(bad?'ob-err':(+p>0?'ob-has':''))+'"><td class="ob-code">'+it.c+'</td><td class="ob-d">'+shortD(it.d)+'</td><td class="ob-n">'+qf(it.q)+' '+esc(it.u||'')+'<small>'+BRL(it.t)+'</small></td><td class="ob-n">'+qf(doneQ(it))+' '+esc(it.u||'')+'<small>'+P(EX(it),0)+'</small></td><td>'+(it.m?mkSel('data-ob-mk',it.c,p):'<span class="status">Periódica</span>')+'</td><td class="ob-nw">'+(it.m?'<span class="ob-mq-fix">'+(qm!==''?qf(qm):'—')+'</span>':'<input class="ob-pct ob-mq" inputmode="decimal" data-ob-mq="'+it.c+'" value="'+(qm!==''?String(qm).replace('.',','):'')+'" placeholder="0" aria-label="Quantidade desta medição em '+esc(it.u||'unidades')+', item '+it.c+'">')+' '+esc(it.u||'')+'</td><td class="ob-n" data-ob-v="'+it.c+'">'+medCel(it)+'</td></tr>';});
 if(!S.so&&!S.grp&&!S.q){rows+='<tr class="ob-gh"><td colspan="7">ADIT. Aditivo de climatização · em negociação <span class="status risk">não mede até ser formalizado</span></td></tr>';O.aditivo.itens.forEach(a=>rows+='<tr><td class="ob-code">ADIT</td><td class="ob-d">'+a[0]+'</td><td class="ob-n">'+a[1]+' '+a[2]+'<small>sem preço</small></td><td class="ob-n">—</td><td><span class="status risk">Aditivo</span></td><td class="ob-nw"><input class="ob-pct" disabled placeholder="—" aria-label="Item de aditivo bloqueado"> '+a[2]+'</td><td class="ob-n">—</td></tr>');}
 const extra='<label class="ob-check"><input type="checkbox" id="ob-so" '+(S.so?'checked':'')+'> Só itens lançados</label><button class="button outline" id="ob-clr">Limpar medição</button>';
 return '<div class="ob-split"><div class="ob-main">'+panel('Lançar medição','Digite a quantidade de cada item que entra nesta medição, na unidade do contrato (UN, M, KG…). Ela é comparada com o contratado e o executado, e o faturamento ao lado responde na hora.',tools(extra)+'<div class="table-wrap ob-tw"><table class="ob-t"><thead><tr><th>Item</th><th>Descrição</th><th class="ob-n">Contratado<small>qtd. · total com BDI</small></th><th class="ob-n">Executado<small>qtd. · %</small></th><th>Tipo</th><th>Esta medição<small>quantidade</small></th><th class="ob-n">Valor<small>comparação</small></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Nenhum item com esse filtro.</td></tr>')+'</tbody></table></div><p class="area-note">"Executado" vem dos lançamentos de andamento. Equipamentos medem por marco: chegou 70%, instalado 90%, startup 100% (acumulado). A quantidade não pode passar do contratado; acima do executado, a linha avisa.</p>')+'</div><aside class="ob-side" id="ob-fat">'+fatCard()+'</aside></div>';};
/* quantidade medida do item (guardada como digitada; os marcos viram quantidade equivalente) */
function medQtd(it){const p=S.med[it.c];if(p==null||p==='')return '';const q=S.medQ[it.c];return q!=null?q:Math.round(it.q*p/100*1e4)/1e4;}
function medCel(it){const p=+(S.med[it.c]||0);if(!p)return '—';if(p<0||p>100+1e-9)return '<span class="ob-mq-bad">acima do contratado ('+qf(it.q)+' '+esc(it.u||'')+')</span>';
 const q=it.q*p/100,ex=doneQ(it);return BRL(it.t*p/100)+'<small>'+P(p/100,1)+' do item'+(q>ex+1e-9?' · <b class="ob-mq-warn">'+qf(q-ex)+' acima do executado</b>':' · saldo '+qf(ex-q)+' executado')+'</small>';}
function fatCard(){const m=medicao(),pf=S.perfil,novo=O.medido+m.bruto,ex=EXT(),al=[];
 if(m.err)al.push(['bad',m.err+' item(ns) com quantidade acima do contratado ou negativa.']);
 if(novo>ex+0.01)al.push(['warn','O medido acumulado ('+BRk(novo)+') passa do executado ('+BRk(ex)+').']);
 if(novo>planAcum[KM]+0.01)al.push(['warn','Acima do cronograma contratual até '+MK+' ('+BRk(planAcum[KM])+'). Confirme o empenho do cliente.']);
 if(m.bruto>0&&!al.length)al.push(['ok','Dentro do executado e do cronograma contratual.']);
 return '<article class="kpi-card featured"><div class="kpi-top"><div class="kpi-label">'+ic('receipt')+'Resposta de faturamento · '+MK+'</div></div><div class="kpi-number">'+BRL(m.bruto)+'</div><p class="kpi-subtitle">'+m.n+' item(ns) lançados · bruto com BDI</p></article>'+
 '<section class="panel ob-panel"><dl class="ob-dl"><dt>Mão de obra</dt><dd>'+BRL(m.mo)+'</dd><dt>Material</dt><dd>'+BRL(m.mat)+'</dd><dt>INSS '+pf.inss+'% sobre M.O.</dt><dd>− '+BRL(m.mo*pf.inss/100)+'</dd><dt>ISS '+pf.iss+'%</dt><dd>− '+BRL(m.bruto*pf.iss/100)+'</dd><dt>Garantia '+pf.gar+'%</dt><dd>− '+BRL(m.bruto*pf.gar/100)+'</dd></dl><div class="ob-big"><span>Líquido a receber</span><strong>'+BRL(m.liq)+'</strong></div></section>'+
 '<section class="panel ob-panel"><dl class="ob-dl"><dt>Fechamento</dt><dd>'+br(m.fech)+'</dd><dt>Aprovação do fiscal (+'+pf.aprov+' dias)</dt><dd>'+br(m.aprov)+'</dd><dt>Recebimento previsto (+'+pf.pag+' dias)</dt><dd>'+br(m.rec)+'</dd><dt>Medido acumulado depois desta</dt><dd>'+P(novo/O.valor)+'</dd></dl>'+al.map(a=>'<p class="ob-alert '+a[0]+'">'+a[1]+'</p>').join('')+'<div class="ob-actions"><button class="button primary" id="ob-copy">'+ic('clipboard')+'Copiar boletim</button><a class="button outline" href="'+BASE+'perfil">Regras do cliente</a></div><p class="area-note">Prazos e retenções são premissas do perfil '+TX.tj+', a confirmar.</p></section>';}

function adTable(){const L=S.adit.slice().sort((a,b)=>b.reg.localeCompare(a.reg)||b.fim.localeCompare(a.fim)),tot=L.reduce((a,x)=>a+x.v,0);
 if(!L.length)return '<p class="ob-p">Nenhuma quantidade acima do planejado foi lançada. Quando o Lançar andamento receber mais do que o saldo de um item, o excedente aparece aqui.</p>';
 return '<div class="table-wrap"><table class="ob-t"><thead><tr><th>Registro</th><th>Período</th><th>Item</th><th>Descrição</th><th class="ob-n">Qtd. acima</th><th class="ob-n">Preço unit.</th><th class="ob-n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>'+
 L.map(x=>'<tr'+(x.st==='Aprovado'?' class="ob-has"':x.st==='Recusado'?' class="ob-mutedrow"':'')+'><td class="ob-nw">'+br(x.reg)+'</td><td class="ob-nw">'+br(x.ini)+'<small>até '+br(x.fim)+'</small></td><td class="ob-code">'+x.c+'</td><td class="ob-d">'+shortD(x.d)+(x.obs?'<small>'+esc(x.obs)+'</small>':'')+'</td><td class="ob-n">'+qf(x.q)+' <small>'+esc(x.u)+'</small></td><td class="ob-n">'+BRL(x.pu)+'</td><td class="ob-n"><strong>'+BRL(x.v)+'</strong></td>'+
  '<td><select class="ob-mk" data-ob-ast="'+x.id+'" aria-label="Situação do excedente '+x.c+'">'+ADST.map(o=>'<option'+(o===x.st?' selected':'')+'>'+o+'</option>').join('')+'</select></td><td><button class="text-button" data-ob-adel="'+x.id+'">Excluir</button></td></tr>').join('')+
 '<tr class="ob-gh"><td colspan="6">Total · '+L.length+' registro(s) · '+P(tot/O.valor,2)+' do contrato</td><td class="ob-n">'+BRL(tot)+'</td><td colspan="2"></td></tr></tbody></table></div>';}
function adTSV(){const L=['Registro\tPeríodo início\tPeríodo fim\tItem\tDescrição\tQtd. acima\tUn.\tPreço unit.\tValor\tSituação\tObservação'];S.adit.forEach(x=>L.push([br(x.reg),br(x.ini),br(x.fim),x.c,x.d,nf(x.q,2),x.u,nf(x.pu),nf(x.v),x.st,x.obs||''].join('\t')));return L.join('\n');}
T.aditivos=()=>{const lim=O.valor*.5,g=O.aditivo.compras.reduce((a,c)=>a+c[3],0),ap=S.adit.filter(x=>x.st==='Aprovado'),pend=S.adit.filter(x=>x.st!=='Aprovado'&&x.st!=='Recusado'),vap=ap.reduce((a,x)=>a+x.v,0),vpe=pend.reduce((a,x)=>a+x.v,0),vt=S.adit.reduce((a,x)=>a+(x.st==='Recusado'?0:x.v),0);
 return '<div class="kpi-grid">'+card('Valor original do contrato',BRk(O.valor),'linha de base · com BDI','contrato 075/2026DEC','',100,{featured:1,icon:'receipt'})+card('Aditivos aprovados',BRL(vap),ap.length?ap.length+' excedente(s) aprovado(s)':'nenhum formalizado','—','',0,{icon:'check'})+card('Em negociação',(1+pend.length)+' registro(s)','climatização sem preço'+(pend.length?' + '+BRk(vpe)+' acima do planejado':''),'bloqueados na medição até aprovar','',50,{icon:'clock',warn:1})+card('Limite legal de acréscimo',BRk(lim),'50% em reforma de edifício (Lei 14.133, art. 125)',(vt?'usado '+P(vt/lim)+' com os excedentes · ':'')+'confirmar com o jurídico','',vt/lim*100,{icon:'shield'})+'</div>'+
 panel('Quantidades acima do planejado','Registradas pelo Lançar andamento: data do registro, período, quantidade e valor pelo preço unitário do contrato (com BDI). O preço final do aditivo pode mudar na negociação.',adTable()+'<div class="ob-actions"><button class="button outline" id="ob-adcopy" '+(S.adit.length?'':'disabled')+'>'+ic('download')+'Copiar para Excel</button><a class="button outline" href="'+BASE+'avanco">Lançar andamento</a></div>','<span class="count-pill">'+BRL(vt)+'</span>')+
 '<div class="bottom-grid">'+panel('Aditivo de climatização','Itens previstos na planilha, sem código de contrato e sem preço. Só entram na medição depois de aprovados.','<div class="table-wrap"><table><thead><tr><th>Item</th><th>Qtd.</th><th>Situação</th></tr></thead><tbody>'+O.aditivo.itens.map(a=>'<tr><td>'+a[0]+'</td><td>'+a[1]+' '+a[2]+'</td><td><span class="status risk">sem preço</span></td></tr>').join('')+'</tbody></table></div>','<span class="count-pill">em negociação</span>')+
 panel('Custos já ligados a aditivo','Compras classificadas como ADITIVO. Sem aditivo aprovado, são custo sem receita.','<div class="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Item</th><th>Valor</th></tr></thead><tbody>'+O.aditivo.compras.map(c=>'<tr><td><strong>'+c[0]+'</strong><br><small>'+c[2]+' · '+c[4]+'</small></td><td>'+c[1]+'</td><td>'+BRL(c[3])+'</td></tr>').join('')+'</tbody></table></div>','<span class="count-pill">'+BRL(g)+'</span>')+'</div>'+
 panel('Como o aditivo muda a obra','Cada aditivo fica registrado com data, valor, prazo e documento; o original é preservado.','<div class="ob-cycle ob-cycle6">'+[['Demanda nova','fiscal ou equipe'],['Orçamento do aditivo','itens, qtd., preço com BDI'],['Aprovação interna','Diretoria'],['Aprovação do cliente','termo aditivo'],['Nova linha de base','valor e prazo atualizados'],['Medição','itens liberados']].map((s,i)=>'<div class="ob-step '+(i<1?'done':i<2?'now':'')+'"><span class="no">0'+(i+1)+'</span><b>'+s[0]+'</b><span>'+s[1]+'</span></div>').join('')+'</div>');};

T.caixa=()=>{const pv=previsao(),max=Math.max(...pv.map(p=>p.v)),tot=pv.reduce((a,p)=>a+p.liq,0),pf=S.perfil;
 return '<div class="kpi-grid">'+card('Próxima medição',BRk(pv[0].v),pv[0].orig,'fechamento '+br(pv[0].fech),'',100,{featured:1,icon:'receipt'})+card('Recebimento previsto',br(pv[0].rec),'fechamento + '+pf.aprov+' + '+pf.pag+' dias','premissa do perfil','',100,{icon:'calendar',warn:1})+card('Entradas líquidas previstas',BRk(tot),''+MK+' a MED '+pad2(NM)+' · após retenções','cronograma V.0','',100,{icon:'wallet'})+card('Prazo até o caixa',(+pf.aprov+ +pf.pag)+' dias','do fechamento ao recebimento','premissa','',100,{icon:'clock'})+'</div>'+
 panel('Medições e recebimentos previstos','Cada medição vira dinheiro pelas regras do perfil do cliente.','<div class="table-wrap"><table><thead><tr><th>Medição</th><th>Origem do valor</th><th>Fechamento</th><th>Recebimento</th><th>Bruto</th><th>Líquido</th><th>Entrada</th></tr></thead><tbody>'+pv.map(p=>'<tr><td><strong>MED '+String(p.k).padStart(2,'0')+'</strong></td><td><small>'+p.orig+'</small></td><td>'+br(p.fech)+'</td><td><strong>'+br(p.rec)+'</strong> <small>'+mesl(p.rec)+'</small></td><td>'+BRL(p.v)+'</td><td>'+BRL(p.liq)+'</td><td style="min-width:120px"><div class="health-track"><span style="width:'+p.v/max*100+'%"></span></div></td></tr>').join('')+'</tbody></table></div><p class="area-note">MED '+pad2(KM+2)+' em diante seguem o cronograma contratual V.0. Retenções: INSS '+pf.inss+'% sobre a mão de obra estimada (31,5%), ISS '+pf.iss+'%, garantia '+pf.gar+'%.</p>','<a class="text-button" href="'+BASE+'perfil">Ajustar regras '+ic('arrow')+'</a>');};

T.prazo=()=>{const t=termino(),ex=EXT();return '<div class="kpi-grid">'+card('Término contratual',br(t.fimP),O.prazo+' dias desde '+br(O.inicio),'linha de base','',100,{icon:'calendar'})+card('Término previsto',br(t.fimE),'estimativa · '+t.dur+' dias','se o ritmo continuar','',100,{featured:1,icon:'clock'})+card('Desvio estimado','+'+t.atraso+' dias','frente ao contrato','recalcula a cada lançamento','',Math.min(100,t.atraso),{icon:'clock',warn:t.atraso>0})+card('Índice de ritmo',nf(t.s,2),'executado ÷ planejado','1,00 = no ritmo','',t.s*100,{icon:'chart'})+'</div>'+
 panel('Como a previsão é calculada','','<p class="ob-p">Ritmo = executado '+P(ex/O.valor)+' ÷ planejado '+P(planAcum[KM]/O.valor)+' até a '+MK+' = <strong>'+nf(t.s,2)+'</strong>. Se o ritmo continuar, a obra leva '+O.prazo+' ÷ '+nf(t.s,2)+' ≈ <strong>'+t.dur+' dias</strong> e termina em <strong>'+br(t.fimE)+'</strong>.</p><p class="ob-alert warn">Estimativa simples. Com menos de 20% executado ainda é instável e recalcula a cada lançamento. No sistema, a previsão será por serviço e por grupo, usando as durações planejadas.</p><div class="ob-groups">'+O.grupos.map(g=>{const v=GX(g[0])/g[2];return '<div class="ob-row"><span>'+g[0]+'. '+g[1]+'</span><span class="status '+(v<.2?'risk':'')+'">'+P(v)+' executado</span></div>';}).join('')+'</div>');};

T.processo=()=>{const E=[['Licitação e orçamento',8],['Planejamento inicial',6],['Revisão e ajustes preliminares',3],['Cronograma',8],['Ordem de início',10],['Mobilização',4],['Acompanhamento de obra',6],['Medições',9],['Entrega da obra',8],['Pós-entrega',2]];
 return panelR('Processo da obra · Matriz RACI','63 tarefas em 10 etapas, geradas para cada obra com responsável, aprovador e prazo.',bpmBtn(),'<div class="priority-list">'+E.map((e,i)=>{const now=i===6||i===7,fut=i>7;return '<div class="priority-item ob-etp"><span class="priority-index">'+String(i+1).padStart(2,'0')+'</span><div class="priority-copy"><strong>'+e[0]+'</strong><p>'+e[1]+' tarefas</p></div><span class="status '+(now?'':fut?'ob-mute':'risk')+'">'+(now?'em andamento':fut?'a iniciar':'sem registro de conclusão')+'</span></div>';}).join('')+'</div><p class="area-note">A situação de cada tarefa ainda não é registrada. A matriz tem 5 tarefas sem aprovador e 2 com dois aprovadores.</p>','<a class="text-button" href="https://claude.ai/artifact/Wi2fwVXbfjTn3KNjDdFjXH" target="_blank" rel="noopener">Abrir o BPM '+ic('arrow')+'</a>');};

T.presenca=()=>{const pr=O.presenca;return '<div class="kpi-grid">'+card('Acesso liberado',String(pr.total),pr.armant+' Armant · '+pr.terceiros+' terceiros','lista de acesso','',100,{featured:1,icon:'users'})+card('Ativos',String(pr.ativos),(pr.total-pr.ativos)+' inativos','lista de acesso','',pr.ativos/pr.total*100,{icon:'check'})+card('Registro diário','sem dado','ainda não existe','a implantar','',0,{icon:'clipboard',warn:1})+card('Horas paradas','sem dado','campo da planilha em #REF!','a implantar','',0,{icon:'clock',warn:1})+'</div>'+
 '<div class="bottom-grid">'+panel('Equipe cadastrada por função','Lista de acesso da obra · sem nomes nem documentos','<div class="table-wrap"><table><thead><tr><th>Função</th><th>Pessoas</th></tr></thead><tbody>'+pr.funcoes.map(f=>'<tr><td>'+f[0]+'</td><td>'+f[1]+'</td></tr>').join('')+'</tbody></table></div>')+
 panel('Como ficará o diário','Um registro por dia, preenchido pelo R.O. no celular.','<dl class="ob-dl"><dt>Data e clima</dt><dd>manhã e tarde</dd><dt>Presentes</dt><dd>empresa, função, entrada e saída</dd><dt>Serviços do dia</dt><dd>itens da EAP e avanço</dd><dt>Ocorrências</dt><dd>horas paradas e motivo</dd><dt>Fotos</dt><dd>evidência por serviço</dd></dl><p class="area-note">CPF e placas ficam com acesso restrito.</p>')+'</div>';};

T.perfil=()=>{const pf=S.perfil,f=(k,l,h)=>'<label class="ob-field"><span>'+l+'</span><input id="ob-pf-'+k+'" data-ob-pf="'+k+'" type="'+(k==='proxFech'?'date':'number')+'" value="'+pf[k]+'" '+(k==='proxFech'?'':'min="0" step="1"')+'><small>'+h+'</small></label>';
 return panel('Perfil do cliente · '+TX.tj+'','Regras de aprovação, pagamento e documentos. Cada cliente terá o seu perfil; a previsão de caixa usa estas regras.','<div class="ob-form"><label class="ob-field"><span>Tipo de medição</span><select disabled><option>Mensal + marcos nos equipamentos</option></select><small>do contrato</small></label>'+f('proxFech','Fechamento da próxima medição','premissa · confirmar')+f('dia','Dia de fechamento nos meses seguintes','premissa · confirmar')+f('aprov','Dias para aprovação do fiscal','premissa · confirmar')+f('pag','Dias para pagamento após a nota','premissa · confirmar')+f('inss','Retenção INSS sobre mão de obra (%)','premissa · confirmar')+f('iss','Retenção ISS sobre o bruto (%)','confirmar')+f('gar','Garantia ou caução retida (%)','confirmar')+'</div>','<button class="button outline" id="ob-pfreset">'+ic('refresh')+'Restaurar premissas</button>')+
 '<div class="bottom-grid">'+panel('Aprovação da medição',TX.fluxo,'<ol class="modal-steps"><li>Prévia validada com a fiscalização</li><li>Boletim enviado com documentos</li><li>Aprovação do fiscal técnico</li><li>Nota fiscal emitida</li><li>Pagamento</li></ol>')+panel('Documentos exigidos por medição','A definir com o time','<p class="ob-p">Exemplos comuns: boletim assinado, diário de obra, fotos, relação de empregados, guias de INSS e FGTS, ART.</p>')+'</div>';};

/* ---------- página da obra ---------- */
const panelR=(t,sub,right,body)=>panel(t,sub,body,right);
const BPM_PDF='docs/Fluxo_Obras_Armant_BPM_RACI.pdf';
const bpmBtn=()=>'<a class="button outline ob-bpm" href="#fluxo">'+ic('layers')+'Fluxo de obras (BPM)</a>';
function page(sub){if(sub&&T[sub])S.tab=sub;return '<div class="ob-toprow"><a class="text-button ob-back" href="#projects">← Voltar às obras</a>'+bpmBtn()+'</div><header class="ob-intro ob-head"><div class="ob-head-main"><div class="ob-head-tags">'+(FIC?'<span class="ob-pill-fict">obra fictícia · demonstração</span>':'<span class="ob-pill-real">obra real</span>')+'</div><h2>'+O.nome+'</h2><p class="ob-head-cli">'+O.cliente+(FIC?' · '+O.cidade+' · '+O.ro:'')+'</p>'+
 '<dl class="ob-head-dl"><div><dt>Contrato</dt><dd>'+O.contrato+'</dd></div><div><dt>Valor com BDI</dt><dd>'+BRL(O.valor)+'</dd></div><div><dt>Prazo</dt><dd>'+O.prazo+' dias</dd></div><div><dt>Início</dt><dd>'+br(O.inicio)+'</dd></div><div><dt>Data-base</dt><dd>'+O.dataBase+'</dd></div></dl>'+
 '<p class="ob-head-src">Fonte: '+O.fonte+'</p></div></header>'+
 '<section class="panel ob-panel">'+cycle()+'</section><div class="ob-tabs" role="tablist">'+TABS.map(([k,l])=>'<a role="tab" href="'+BASE+k+'" aria-selected="'+(S.tab===k)+'" class="'+(S.tab===k?'active':'')+'">'+l+'</a>').join('')+'</div><div id="ob-tab">'+T[S.tab]()+'</div>';}
const refreshTab=()=>{const el=document.getElementById('ob-tab');if(el)el.innerHTML=T[S.tab]();};

/* ---------- integração com o roteador do painel ---------- */
/* sem botão próprio no menu: a obra abre pela tela Obras & contratos */
function setChrome(on){const notice=document.querySelector('.demo-notice p'),pill=document.querySelector('.demo-pill'),act=document.querySelector('.heading-actions'),cap=document.getElementById('data-caption');
 if(on){if(!('notice' in chrome)){chrome.notice=notice?notice.innerHTML:'';chrome.pill=pill?pill.innerHTML:'';}
  if(notice)notice.innerHTML=TX.aviso;
  if(pill)pill.innerHTML='<span></span> '+TX.pill;if(act)act.style.visibility='hidden';if(cap)cap.textContent=TX.cap;}
 else if('notice' in chrome){if(notice)notice.innerHTML=chrome.notice;if(pill)pill.innerHTML=chrome.pill;if(act)act.style.visibility='';}}
const baseRender=render;
function navHTML(cur){return NAV.map(([id,label,i])=>'<a href="#'+id+'" class="nav-item '+(cur===id?'active':'')+'" '+(cur===id?'aria-current="page"':'')+' title="'+label+'" aria-label="'+label+'">'+ic(i)+'<span>'+label+'</span>'+(id==='projects'?'<span class="nav-count">13</span>':'')+'</a>').join('');}
function realRow(cols){const ex=EXT(),t=termino();return '<tr class="ob-real-row"><td><a class="project-link" href="#obra"><span class="project-symbol">'+ic('building')+'</span><span><strong>Foro Alto Petrópolis · TJ-RS</strong><small>Porto Alegre · RS · <b class="ob-tag-real">obra real</b></small></span></a></td><td>'+adv(ex/O.valor)+'</td><td><span class="status risk">Estimativa: +'+t.atraso+' dias</span></td>'+(cols>3?'<td>sem dado</td><td>'+BRk(O.valor)+'</td>':'')+'</tr>';}
function quickLink(){const ex=EXT(),t=termino();return '<a href="#obra" class="tl-quick-link ob-quick"><div>'+ic('building')+'<div><strong>Obra real em acompanhamento · TJ-RS</strong><p>'+P(ex/O.valor)+' executado · '+P(O.medido/O.valor)+' medido · '+BRk(ex-O.medido)+' a medir · término previsto '+br(t.fimE)+'</p></div></div><span class="text-button">Abrir a obra '+ic('arrow')+'</span></a>';}
render=function(){const h=location.hash.slice(1),v=h.split('/')[0],sub=abaDa();
 if(minha()){setChrome(true);document.getElementById('navigation').innerHTML=navHTML('projects');document.getElementById('breadcrumb').textContent='Obras & contratos · '+TX.tj;
  document.getElementById('page-title').innerHTML='Obra em detalhe<span>.</span>';document.getElementById('page-subtitle').textContent=FIC?'Andamento, medição, faturamento, aditivos, caixa e prazo · obra fictícia, só para demonstração.':'Andamento, medição, faturamento, aditivos, caixa e prazo de uma obra real.';
  const c=document.getElementById('view');c.innerHTML=page(sub);c.className='fade-in';return;}
 if(FIC)return baseRender();
 setChrome(false);baseRender();document.getElementById('navigation').innerHTML=navHTML(NAV.some(n=>n[0]===h)?h:'overview');
 const c=document.getElementById('view');
 if(v==='overview'||v===''){const kg=c.querySelector('.kpi-grid');if(kg)kg.insertAdjacentHTML('afterend',quickLink());}
 if(v==='overview'||v===''||v==='projects'){c.querySelectorAll('.table-panel table').forEach(tb=>{const body=tb.querySelector('tbody');if(body&&!body.querySelector('.ob-real-row'))body.insertAdjacentHTML('afterbegin',realRow(tb.querySelectorAll('thead th').length));});
  if(window.ArmantObrasDemo)c.querySelectorAll('[data-project] small').forEach(sm=>{if(!sm.querySelector('.ob-tag-fict'))sm.insertAdjacentHTML('beforeend',' · <b class="ob-tag-fict">obra fictícia</b>');});}};

/* grava o lançamento em rascunho (usado pela tela e pelo app de campo) */
function avCommit(p){const itens={},reg=HOJE(),lid='L'+Date.now();let na=0;
   Object.entries(S.draft).forEach(([c,d])=>{const it=ITEMS.find(i=>i.c===c);if(!it||!(+d>0))return;const sp=split(it,+d);if(sp.dentro>0)itens[c]=sp.dentro;if(sp.exc>1e-9){na++;S.adit.push({id:'A'+Date.now()+'-'+na,lid:p.n?lid:null,reg,ini:S.pIni,fim:S.pFim,c,d:it.d,u:it.u||'',q:sp.exc,pu:PU(it),v:PU(it)*sp.exc,st:'Pendente',obs:S.pObs});}});
   if(p.n){S.lanc.push({id:lid,ini:S.pIni,fim:S.pFim,reg,itens,dv:p.dv,obs:S.pObs,na});S.lanc.sort((x,y)=>x.fim.localeCompare(y.fim));}S.draft={};S.pObs='';return na;}
function lancarCampo(itens,data,obs){const bk={d:S.draft,i:S.pIni,f:S.pFim,o:S.pObs};S.draft={...itens};S.pIni=S.pFim=data;S.pObs=obs||'';const p=avPrev();let r=null;
 if(!p.bad&&(p.n||p.na)){const na=avCommit(p);r={n:p.n,dv:p.dv,na,ex:EXT()/O.valor};}S.draft=bk.d;S.pIni=bk.i;S.pFim=bk.f;S.pObs=bk.o;save();return r;}
/* ---------- eventos (todos com prefixo ob-) ---------- */
document.addEventListener('click',e=>{const t=e.target.closest('button,[data-ob-grp],[data-ob-del],[data-ob-adel],[data-ob-pzo]');if(!t||!minha())return;
 if(t.dataset.obGrp!=null){S.grp=t.dataset.obGrp;refreshTab();return;}
 if(t.dataset.obDel!=null){const i=+t.dataset.obDel,l=S.lanc[i];if(l&&t.dataset.confirm==='1'){S.lanc.splice(i,1);const k=S.adit.length;if(l.id)S.adit=S.adit.filter(a=>a.lid!==l.id);save();refreshTab();say('Lançamento excluído'+(k>S.adit.length?' com '+(k-S.adit.length)+' excedente(s) ligado(s) em Aditivos.':'.'));}else if(l){t.dataset.confirm='1';t.textContent='Confirmar exclusão';setTimeout(()=>{t.dataset.confirm='';t.textContent='Excluir';},4000);}return;}
 if(t.dataset.obPzo!=null){S.pzOnly=t.dataset.obPzo;refreshTab();return;}
 if(t.dataset.obAdel!=null){const id=t.dataset.obAdel;if(t.dataset.confirm==='1'){S.adit=S.adit.filter(x=>x.id!==id);save();refreshTab();say('Registro de aditivo excluído.');}else{t.dataset.confirm='1';t.textContent='Confirmar exclusão';setTimeout(()=>{t.dataset.confirm='';t.textContent='Excluir';},4000);}return;}
 switch(t.id){
 case 'ob-pzcopy':{const txt=pzTSV();(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say('Prazos copiados. Cole no Excel.')).catch(()=>say('Não foi possível copiar neste navegador.'));break;}
 case 'ob-pzreset':S.prazo={};save();refreshTab();say('Prazos voltaram aos da planilha.');break;
 case 'ob-adcopy':{const txt=adTSV();(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say('Aditivos copiados. Cole no Excel.')).catch(()=>say('Não foi possível copiar neste navegador.'));break;}
 case 'ob-clr':S.med={};S.medQ={};save();refreshTab();say('Medição limpa.');break;
 case 'ob-pfreset':S.perfil={...DEF};save();refreshTab();say('Premissas restauradas.');break;
 case 'ob-avsave':{const p=avPrev();if(!(p.n||p.na)||p.bad||!(S.pIni<=S.pFim))return;const na=avCommit(p);
   const d=new Date(S.pFim+'T12:00:00');d.setDate(d.getDate()+1);S.pIni=d.toISOString().slice(0,10);d.setDate(d.getDate()+6);S.pFim=d.toISOString().slice(0,10);save();refreshTab();say((p.n?'Lançamento registrado: obra em '+P(EXT()/O.valor)+'. ':'')+(na?na+' item(ns) acima do planejado enviado(s) para Aditivos. ':'')+'Próximo período sugerido: '+br(S.pIni)+' a '+br(S.pFim)+'.');break;}
 case 'ob-avclear':S.draft={};save();refreshTab();say('Quantidades descartadas.');break;
 case 'ob-relcopy':{const txt=relTSV();(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say('Relatório copiado. Cole no Excel.')).catch(()=>say('Não foi possível copiar neste navegador.'));break;}
 case 'ob-copy':{const m=medicao(),L=['Item\tDescrição\tQuantidade\tUnidade\tContratado\tExecutado\t%\tValor'];ITEMS.forEach(it=>{const p=+(S.med[it.c]||0);if(p>0)L.push(it.c+'\t'+it.d+'\t'+nf(medQtd(it),2)+'\t'+(it.u||'')+'\t'+nf(it.q,2)+'\t'+nf(doneQ(it),2)+'\t'+nf(p,2)+'\t'+nf(it.t*p/100));});L.push('','Bruto\t\t\t'+nf(m.bruto),'Retenções\t\t\t'+nf(m.ret),'Líquido\t\t\t'+nf(m.liq),'Recebimento previsto\t\t\t'+br(m.rec));
  const txt=L.join('\n');(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>say('Boletim copiado. Cole no Excel.')).catch(()=>say('Não foi possível copiar neste navegador.'));break;}
 }});
document.addEventListener('input',e=>{const t=e.target;if(!minha())return;
 if(t.dataset.obMq){const c=t.dataset.obMq,it=ITEMS.find(i=>i.c===c),v=t.value.replace(/\./g,'').replace(',','.').trim(),q=+v,bad=v!==''&&(isNaN(q)||q<0||q>it.q+1e-9);
  if(v===''||q===0){delete S.med[c];delete S.medQ[c];}else if(!isNaN(q)){S.medQ[c]=q;S.med[c]=q/it.q*100;}save();
  const cell=document.querySelector('[data-ob-v="'+CSS.escape(c)+'"]');if(cell)cell.innerHTML=isNaN(q)&&v!==''?'<span class="ob-mq-bad">número inválido</span>':medCel(it);t.closest('tr').className=bad?'ob-err':(q>0?'ob-has':'');const f=document.getElementById('ob-fat');if(f)f.innerHTML=fatCard();}
 if(t.dataset.obP){const c=t.dataset.obP,v=t.value.replace(',','.').trim();if(v===''||+v===0)delete S.med[c];else S.med[c]=+v;save();const it=ITEMS.find(i=>i.c===c),cell=document.querySelector('[data-ob-v="'+CSS.escape(c)+'"]'),bad=v!==''&&(isNaN(+v)||+v<0||+v>100);
  if(cell)cell.textContent=(+v>0&&!bad)?BRL(it.t*+v/100):'—';t.closest('tr').className=bad?'ob-err':(+v>0?'ob-has':'');const f=document.getElementById('ob-fat');if(f)f.innerHTML=fatCard();}
 if(t.dataset.obQ){const c=t.dataset.obQ,it=ITEMS.find(i=>i.c===c);const v=t.value.replace(/\./g,'').replace(',','.').trim();if(v==='')delete S.draft[c];else S.draft[c]=+v;save();
  const d=S.draft[c],done=doneQ(it),bad=d!=null&&(isNaN(d)||d<0),sp=d!=null&&!bad?split(it,d):{dentro:0,exc:0},cell=document.querySelector('[data-ob-res="'+CSS.escape(c)+'"]');t.closest('tr').className=d==null?'':bad?'ob-err':sp.exc>1e-9?'ob-adt':'ob-has';
  if(cell)cell.innerHTML=resCell(it,d,bad,done+sp.dentro,sp);const pc=document.querySelector('[data-ob-pzc="'+CSS.escape(c)+'"]');if(pc)pc.innerHTML=pzCell(it,sp.dentro);const s=document.getElementById('ob-side');if(s)s.innerHTML=avSide();}
 if(t.id==='ob-pobs'){S.pObs=t.value;}
 if(t.id==='ob-q'){S.q=t.value;const pos=t.selectionStart;refreshTab();const q=document.getElementById('ob-q');if(q){q.focus();q.setSelectionRange(pos,pos);}}
 if(t.dataset.obPf){S.perfil[t.dataset.obPf]=t.type==='number'?(+t.value||0):t.value;save();}});
document.addEventListener('change',e=>{const t=e.target;if(!minha())return;
 if(t.dataset.obPzi||t.dataset.obPzf){const c=t.dataset.obPzi||t.dataset.obPzf,it=ITEMS.find(i=>i.c===c),z=PZ(it),o=S.prazo[c]||{},v=t.value;if(!v){t.value=t.dataset.obPzi?z.ini:z.fim;return;}
  const ini=t.dataset.obPzi?v:z.ini,fim=t.dataset.obPzf?v:z.fim;if(fim<ini){say('O término não pode ser antes do início.');t.value=t.dataset.obPzi?z.ini:z.fim;return;}
  if(t.dataset.obPzi)o.ini=v;else o.fim=v;if(o.ini===z.bi)delete o.ini;if(o.fim===z.bf)delete o.fim;if(o.ini||o.fim)S.prazo[c]=o;else delete S.prazo[c];save();
  if(S.tab==='avanco'){const cell=document.querySelector('[data-ob-pzc="'+CSS.escape(c)+'"]'),d=S.draft[c],sp=d!=null&&!isNaN(d)&&d>=0?split(it,d):{dentro:0};if(cell)cell.innerHTML=pzCell(it,sp.dentro);}else refreshTab();say('Prazo de '+c+': '+br(ini)+' a '+br(fim)+'.');return;}
 if(t.id==='ob-pref'){S.pRef=t.value;refreshTab();return;}
 if(t.dataset.obAst){const x=S.adit.find(a=>a.id===t.dataset.obAst);if(x){x.st=t.value;save();refreshTab();say('Situação: '+t.value+'.');}return;}
 if(t.dataset.obMk){const c=t.dataset.obMk;delete S.medQ[c];if(t.value)S.med[c]=+t.value;else delete S.med[c];save();refreshTab();}
 if(t.id==='ob-pini'||t.id==='ob-pfim'){if(t.id==='ob-pini')S.pIni=t.value;else S.pFim=t.value;const s=document.getElementById('ob-side');if(s)s.innerHTML=avSide();document.querySelectorAll('[data-ob-pzc]').forEach(el=>{const it=ITEMS.find(i=>i.c===el.dataset.obPzc),d=S.draft[it.c],sp=d!=null&&!isNaN(d)&&d>=0?split(it,d):{dentro:0};el.innerHTML=pzCell(it,sp.dentro);});}
 if(t.id==='ob-avonly'){S.avOnly=t.checked;refreshTab();}
 if(t.id==='ob-so'){S.so=t.checked;refreshTab();}});

const api={version:'1.8',id:CFG.id||null,state:S,obra:O,items:ITEMS,previsao,medicao,EXT,doneQ,lancarCampo,prazo:PZ};
if(FIC)(window.ArmantObrasDemo=window.ArmantObrasDemo||{})[CFG.id]=api;else window.ArmantObras=api;
}
criarObra(window.ARMANT_OBRA_DATA,{});
(window.ARMANT_OBRAS_DEMO||[]).forEach(d=>criarObra(d.data,{id:d.id}));
/* obras fictícias da lista abrem a tela completa, marcada como fictícia */
document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('[data-project]');if(!el||!(window.ArmantObrasDemo||{})[el.dataset.project])return;e.preventDefault();e.stopPropagation();location.hash='#obra/'+el.dataset.project;},true);
render();
})();
