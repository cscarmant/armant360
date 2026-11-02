
/* Modelo demonstrativo: recebimentos e pagamentos previstos, sem integração. */
const TIMELINE_MODEL = {
  makeProjects(periodKey) {
    const previous=periodKey==='sep';
    return PROJECTS.map((p,i)=>({...p,advance:previous?Math.max(0,p.advance-12):p.advance,margin:previous?p.margin+.6:p.margin,status:previous&&p.id==='OB-003'?'ok':p.status}));
  },
  origin(periodKey) { return new Date(periodKey==='sep'?'2026-09-30T12:00:00Z':'2026-10-26T12:00:00Z'); },
  add(date,days) { return new Date(date.getTime()+days*86400000); },
  day(date,origin) { return Math.round((date-origin)/86400000); },
  makeMeasurements(periodKey) {
    const origin=this.origin(periodKey);
    const approved=periodKey==='sep'?[75000,60000,50000,60000]:[95000,80000,65000,70000];
    return PROJECTS.flatMap((p,i)=>{
      const first=i<4;
      const approvedDay=first?-4+i:4+(i%4)*5;
      const secondDay=21+(i%5)*3;
      return [
        {id:p.id+'-M1',projectId:p.id,code:'M1',project:p.name,value:first?approved[i]:Math.round(p.contract*.025),measuredDay:approvedDay-2,approvedDay,invoiceDay:approvedDay+5,receiptDay:approvedDay+19,status:first?'Aprovada a faturar':'Aprovação prevista',owner:first?'CSC + Financeiro':'Engenharia + cliente'},
        {id:p.id+'-M2',projectId:p.id,code:'M2',project:p.name,value:Math.round(p.contract*.04),measuredDay:secondDay-3,approvedDay:secondDay,invoiceDay:secondDay+4,receiptDay:secondDay+18,status:'Medição futura estimada',owner:'R.O. + CSC'}
      ].map(m=>({...m,clientId:p.id,client:p.name,service:m.code==='M1'?'Instalação HVAC':'Comissionamento e entrega',measuredDate:this.add(origin,m.measuredDay),approvalDate:this.add(origin,m.approvedDay),invoiceDate:this.add(origin,m.invoiceDay),receiptDate:this.add(origin,m.receiptDay)}));
    });
  },
  makeExpenses(periodKey) {
    const origin=this.origin(periodKey),weights=[1.1,.9,1.4,1,.8,1.1,.9,.8];
    return PROJECTS.flatMap((p,i)=>weights.map((weight,week)=>({id:p.id+'-P'+week,projectId:p.id,project:p.name,week,date:this.add(origin,week*7+3),value:Math.round(p.contract*.014*weight),type:['Materiais e equipamentos','Equipes e terceiros','Logística e apoio'][week%3]})));
  },
  calculate(periodKey,projectId,delays,weeks=8,options={}) {
    const origin=this.origin(periodKey);
    const bounded=value=>Math.max(0,Math.min(120,Math.round(Number(value)||0)));
    const measurements=this.makeMeasurements(periodKey).filter(m=>projectId==='all'||m.projectId===projectId).map(m=>{
      const serviceDelay=m.status==='Aprovada a faturar'?0:bounded(options.serviceDelays?.[m.id]);
      const clientDelay=bounded(options.clientDelays?.[m.clientId]);
      const paymentDelay=bounded(delays[m.id]);
      const delay=serviceDelay+clientDelay+paymentDelay;
      return {...m,baseMeasuredDate:m.measuredDate,baseReceiptDate:m.receiptDate,serviceDelay,clientDelay,paymentDelay,delay,
        measuredDay:m.measuredDay+serviceDelay,measuredDate:this.add(m.measuredDate,serviceDelay),
        approvalDate:this.add(m.approvalDate,serviceDelay),invoiceDate:this.add(m.invoiceDate,serviceDelay),
        effectiveDay:m.receiptDay+delay};
    });

    const expenses=this.makeExpenses(periodKey).filter(e=>projectId==='all'||e.projectId===projectId);
    const opening=projectId==='all'?PERIODS[periodKey].cashStart:0;
    let running=opening;
    const buckets=Array.from({length:weeks},(_,i)=>{
      const receipts=measurements.filter(m=>m.effectiveDay>=i*7&&m.effectiveDay<(i+1)*7);
      const payments=expenses.filter(e=>e.week===i);
      const weekMeasurements=measurements.filter(a=>a.measuredDay>=i*7&&a.measuredDay<(i+1)*7),measured=weekMeasurements.reduce((sum,a)=>sum+a.value,0);
      const income=receipts.reduce((s,m)=>s+m.value,0),out=payments.reduce((s,e)=>s+e.value,0);
      running+=income-out;
      return {index:i,date:this.add(origin,i*7),income,out,measured,weekMeasurements,balance:running,receipts,payments};
    });
    return {origin,opening,measurements,expenses,buckets,income:buckets.reduce((s,w)=>s+w.income,0),out:buckets.reduce((s,w)=>s+w.out,0),closing:running,lowest:Math.min(opening,...buckets.map(w=>w.balance)),outside:measurements.filter(m=>m.effectiveDay>=weeks*7).reduce((s,m)=>s+m.value,0)};
  }
};
window.ArmantTimeline=(()=>{
  const GRAF=(()=>{try{return JSON.parse(localStorage.getItem('a360grafico')||'null')||{};}catch(e){return {};}})();
  const guardaGraf=()=>{try{localStorage.setItem('a360grafico',JSON.stringify({serie:state.serie,tipo:state.tipo}));}catch(e){}};
  const state={serie:Object.assign({income:true,out:true,measured:true,balance:false},GRAF.serie||{}),tipo:['linhas','barras','areas'].includes(GRAF.tipo)?GRAF.tipo:'linhas',project:'all',weeks:8,delay:{},measurement:'OB-001-M1',week:2,onlyRisk:false,showBalance:false,serviceDelays:{},clientDelays:{},planPeriod:null};
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'});
  const date=date=>dateFmt.format(date).replace('.','');
  const fullDate=date=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  const model=()=>{ensurePlan();return TIMELINE_MODEL.calculate(period,state.project,state.delay,state.weeks,{serviceDelays:state.serviceDelays,clientDelays:state.clientDelays});};
  const allModel=()=>{ensurePlan();return TIMELINE_MODEL.calculate(period,'all',state.delay,state.weeks,{serviceDelays:state.serviceDelays,clientDelays:state.clientDelays});};
  const selected=()=>allModel().measurements.find(m=>m.id===state.measurement);
  const dayPct=n=>Math.max(.6,Math.min(99.1,n/(state.weeks*7)*100));
  function stats(){
    const m=model(),portfolio=state.project==='all';
    return '<div class="tl-stat"><span>Entradas previstas no horizonte</span><strong>'+compact(m.income)+'</strong><small>'+m.measurements.length+' medições consideradas'+(m.outside?' · '+compact(m.outside)+' após o horizonte':'')+'</small></div><div class="tl-stat"><span>Pagamentos previstos no horizonte</span><strong>'+compact(m.out)+'</strong><small>Materiais, equipes, terceiros e apoio</small></div><div class="tl-stat '+(m.lowest<0?'negative':'')+'"><span>'+(portfolio?'Menor saldo projetado':'Menor saldo líquido da obra')+'</span><strong>'+compactSigned(m.lowest)+'</strong><small>'+(portfolio?'Caixa inicial: '+compact(m.opening):'Entradas − pagamentos · saldo inicial zero')+'</small></div><div class="tl-stat"><span>Saldo ao fim do horizonte</span><strong>'+compactSigned(m.closing)+'</strong><small>'+state.weeks+' semanas · '+date(m.origin)+' a '+date(TIMELINE_MODEL.add(m.origin,state.weeks*7-1))+'</small></div>';
  }
  /* subitens colapsáveis: cada obra abre os seus subitens (grupos e itens da EAP, atividades do Controle de obras ou fases) */
  const OPEN={};
  const escS=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const brS=iso=>iso?String(iso).split('-').reverse().join('/'):'—';
  function subBar(m,ini,fim,pct,cls,tip){const H=state.weeks*7,o=m.origin,d=iso=>Math.round((new Date(iso+'T12:00:00Z')-o)/86400000);
    if(!ini||!fim)return '<span class="tl-sub-out">sem datas</span>';const a=d(ini),b=d(fim)+1;
    if(b<=0)return '<span class="tl-sub-out" title="'+escS(tip)+'">← terminou em '+brS(fim)+'</span>';if(a>=H)return '<span class="tl-sub-out right" title="'+escS(tip)+'">começa em '+brS(ini)+' →</span>';
    const l=Math.max(0,a)/H*100,r=Math.min(H,b)/H*100;return '<div class="tl-subbar '+(cls||'')+(a<0?' cut-l':'')+(b>H?' cut-r':'')+'" style="left:'+l+'%;width:'+Math.max(.8,r-l)+'%" title="'+escS(tip)+'"><i style="width:'+Math.max(0,Math.min(100,pct||0))+'%"></i></div>';}
  function subRows(m,key,nodes,lvl){return nodes.map(n=>{const k=key+'/'+n.k,has=n.filhos&&n.filhos.length,op=!!OPEN[k];
    return '<div class="tl-row tl-sub lvl'+lvl+'"><div class="tl-plab tl-subl" style="--lvl:'+lvl+'">'+(has?'<button class="tl-tog" data-tl-sub="'+escS(k)+'" aria-expanded="'+op+'" aria-label="'+(op?'Recolher':'Abrir')+' '+escS(n.nome)+'">'+(op?'▾':'▸')+'</button>':'<span class="tl-tog-sp"></span>')+'<span class="tl-subname" title="'+escS(n.nome)+'"><strong>'+escS(n.nome)+'</strong><small>'+escS(n.info||'')+'</small></span></div><div class="tl-lane">'+subBar(m,n.ini,n.fim,n.pct,n.cls,n.nome+' · '+brS(n.ini)+' a '+brS(n.fim)+(n.pct!=null?' · '+Math.round(n.pct)+'% feito':''))+'</div></div>'+(has&&op?subRows(m,k,n.filhos,lvl+1):'');}).join('');}
  const span=L=>{const is=L.map(x=>x.ini).filter(Boolean).sort(),fs=L.map(x=>x.fim).filter(Boolean).sort();return {ini:is[0]||'',fim:fs[fs.length-1]||''};};
  const pond=L=>{const t=L.reduce((a,x)=>a+(x.peso||0),0);return t?L.reduce((a,x)=>a+(x.pct||0)*(x.peso||0),0)/t:null;};
  function atividades(cc){const C=window.ArmantControle;if(!C||!C.atividades)return [];const CLN=Object.fromEntries((C.CLASSES||[]).map(c=>[c[0],c[1]]));
    return C.atividades(cc).map(a=>{const e=C.classificacao(a);return {k:'atv-'+a.id,nome:a.titulo,ini:a.inicio||a.criado,fim:a.prazo,pct:e==='concluido'?100:0,cls:'cls-'+e,info:CLN[e]||e};});}
  function eap(){const O=window.ArmantObras;if(!O||!O.items||!O.prazo)return [];const G=(O.obra&&O.obra.grupos)||[],gn=Object.fromEntries(G.map(g=>[g[0],g[1]]));
    const its=O.items.map(it=>{const z=O.prazo(it),q=+it.q||0,dn=q?Math.min(1,O.doneQ(it)/q):0;return {k:it.c,c:it.c,nome:it.c+' · '+String(it.d||'').slice(0,70),ini:z.ini,fim:z.fim,pct:dn*100,peso:+it.t||0,info:(q?Math.round(dn*100)+'% · ':'')+(z.ini?brS(z.ini)+' a '+brS(z.fim):'')};});
    const grp={};its.forEach(it=>{const [a,b]=it.c.split('.');((grp[a]=grp[a]||{})[a+'.'+b]=grp[a][a+'.'+b]||[]).push(it);});
    return Object.keys(grp).sort((x,y)=>x-y).map(g=>{const subs=Object.keys(grp[g]).sort((x,y)=>+x.split('.')[1]-+y.split('.')[1]).map(sg=>{const L=grp[g][sg],z=span(L),pc=pond(L);return {k:sg,nome:sg+' · '+L.length+' item(ns)',ini:z.ini,fim:z.fim,pct:pc,peso:L.reduce((a,x)=>a+x.peso,0),info:(pc!=null?Math.round(pc)+'% feito · ':'')+brS(z.ini)+' a '+brS(z.fim),filhos:L};});
      const z=span(subs),pc=pond(subs);return {k:'g'+g,nome:g+' · '+(gn[g]||'Grupo '+g),ini:z.ini,fim:z.fim,pct:pc,info:(pc!=null?Math.round(pc)+'% feito · ':'')+subs.length+' subgrupo(s)',filhos:subs};});}
  /* obras reais com o mesmo desenho das demais: faixa da fase atual (status do kanban), medições aprovadas e a próxima */
  const FASE={plan:'Planejamento',mob:'Mobilização',exec:'Execução',ent:'Entrega',fim:'Concluída'};
  function curto(n){const ps=String(n).split(' · ');return ps.find(x=>!/climatiza|reforma|instala|manuten|substitui|amplia/i.test(x))||ps[0];}
  function faixaReal(m,d,ini,fim,O){const H=state.weeks*7,dd=iso=>Math.round((new Date(iso+'T12:00:00Z')-m.origin)/864e5);
    const K=window.ArmantKanbanObras,ko=K&&K.obras?K.obras().find(x=>x.k===d.cc):null,fase=FASE[ko?ko.col:(ini?'exec':'plan')]||'Execução';
    if(!ini)return '<div class="tl-execution tl-plan" style="left:0.6%;width:30%" title="Início a definir"><span>'+fase+' · início a definir</span></div>';
    const a=dd(ini),b=dd(fim||ini)+1,atr=ko&&ko.col!=='fim'&&b<=dd(new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10));
    let h;if(b<=0)h='<div class="tl-execution risk" style="left:0.6%;width:42%" title="Prazo da obra: '+brS(ini)+' a '+brS(fim)+'"><span>'+fase+' · prazo terminou em '+brS(fim)+'</span></div>';
    else if(a>=H)h='<div class="tl-execution tl-plan" style="left:0.6%;width:30%"><span>'+fase+' · começa em '+brS(ini)+' →</span></div>';
    else{const l=dayPct(Math.max(0,a)),r=dayPct(Math.min(H,b));h='<div class="tl-execution'+(atr?' risk':'')+(ko&&ko.col==='plan'?' tl-plan':'')+'" style="left:'+l+'%;width:'+Math.max(1,r-l)+'%" title="'+escS(fase+' · prazo '+brS(ini)+' a '+brS(fim)+(ko&&ko.adv!=null?' · '+Math.round(ko.adv*100)+'% executado':''))+'"><span>'+fase+(ko&&ko.adv!=null?' · '+Math.round(ko.adv*100)+'%':'')+'</span></div>';}
    if(O&&O.obra){const ms=O.obra.medidoSerie||[],k=ms.length;if(k)h+='<span class="tl-approved" title="Medições aprovadas: M1 a M'+k+'">M'+k+' ✓</span>';
      const pf=O.state&&O.state.perfil&&O.state.perfil.proxFech,dx=pf?dd(pf):-1;if(dx>=0&&dx<H)h+='<span class="tl-milestone" style="left:'+dayPct(dx)+'%" title="'+escS('M'+(k+1)+' · fechamento '+brS(pf)+(O.obra.proxima?' · '+money.format(O.obra.proxima):''))+'"><i></i><span>M'+(k+1)+'</span></span>';}
    return h;}
  function obrasReais(m){const CAD=window.ArmantCadastros,O=window.ArmantObras;if(!CAD||!CAD.demandas)return '';
    return CAD.demandas().filter(d=>!d.ficticia).map(d=>{const seed=!!d.seed&&!d.exemplo&&O&&O.obra,ini=d.inicio||(seed&&O.obra.inicio)||'',prazo=+(d.prazo||(seed&&O.obra.prazo)||0),fim=ini&&prazo?new Date(new Date(ini+'T12:00:00Z').getTime()+(prazo-1)*864e5).toISOString().slice(0,10):'';
      const filhos=[...(seed?eap():[])],at=atividades(d.cc);if(at.length)filhos.push({k:'atv',nome:'Atividades do Controle de obras',...span(at),pct:at.filter(a=>a.pct===100).length/at.length*100,info:at.length+' atividade(s)',filhos:at});
      const k='cc:'+d.cc,op=!!OPEN[k];
      return '<div class="tl-row tl-real"><div class="tl-plab">'+(filhos.length?'<button class="tl-tog" data-tl-sub="'+k+'" aria-expanded="'+op+'" aria-label="'+(op?'Recolher':'Abrir')+' subitens de '+escS(d.cc)+'">'+(op?'▾':'▸')+'</button>':'<span class="tl-tog-sp"></span>')+'<a class="tl-project" href="'+(seed?'#obra':'#controle/'+d.cc)+'" title="'+escS(d.nome||d.cc)+'"><span class="tl-project-icon">'+icon('building')+'</span><span><strong>'+escS(curto(d.nome||d.cc))+'</strong><small>'+escS([d.cidade&&(d.cidade+(d.uf?' · '+d.uf:'')),d.cc].filter(Boolean).join(' · '))+'</small></span></a></div><div class="tl-lane"><div class="tl-week-focus" style="left:'+(state.week/state.weeks*100)+'%;width:'+(100/state.weeks)+'%"></div>'+faixaReal(m,d,ini,fim,seed?O:null)+'</div></div>'+(op?subRows(m,k,filhos,1):'');}).join('');}
  function fases(p,start,end){const n=['Mobilização e canteiro','Infraestrutura (dutos e tubulação)','Instalação de equipamentos','Elétrica e automação','Testes, comissionamento e entrega'],w=[.12,.32,.3,.16,.1];let c=start;
    return n.map((nome,i)=>{const len=Math.max(2,Math.round((end-start)*w[i]*1.25)),a=Math.round(c-(i?(end-start)*.06:0));c=a+len;const pr=Math.max(0,Math.min(100,(p.advance-(i*18))*1.6));return {k:'f'+i,nome,dIni:a,dFim:Math.min(end,c),pct:pr,info:'fase ilustrativa · '+Math.round(pr)+'%'};});}
  function compactSigned(value){return value<0?'− '+compact(Math.abs(value)):compact(value);}
  function gantt(){
    const m=model(),ps=TIMELINE_MODEL.makeProjects(period).filter(p=>(state.project==='all'||p.id===state.project)&&(!state.onlyRisk||p.status==='risk'));
    const weekHead=m.buckets.map(w=>'<button class="tl-week '+(state.week===w.index?'selected':'')+'" data-tl-week="'+w.index+'" aria-label="Ver fluxo da semana de '+fullDate(w.date)+'"><strong>'+date(w.date)+'</strong><span>S'+(w.index+1)+'</span></button>').join('');
    const rows=ps.map(p=>{
      const idx=PROJECTS.findIndex(x=>x.id===p.id),start=Math.max(0,2-(idx%3)*7),end=35+(idx%4)*7;
      const measures=m.measurements.filter(a=>a.projectId===p.id);
      const milestones=measures.map(a=>{
        const selectedClass=state.measurement===a.id?'selected':'',delay=a.delay||0,receiptDate=TIMELINE_MODEL.add(m.origin,a.effectiveDay),off=a.effectiveDay>=state.weeks*7;
        return (a.measuredDay>=0?'<button class="tl-milestone '+selectedClass+'" style="left:'+dayPct(a.measuredDay)+'%" data-tl-measure="'+a.id+'" title="'+escapeText(a.code+' · medição '+date(a.measuredDate)+' · '+money.format(a.value))+'" aria-label="'+escapeText(a.project+' '+a.code+', medição em '+date(a.measuredDate)+', '+money.format(a.value))+'"><i></i><span>'+a.code+'</span></button>':'<span class="tl-approved" title="Medição já aprovada antes da data-base">'+a.code+' ✓</span>')+'<button class="tl-receipt '+selectedClass+' '+(delay?'simulated':'')+' '+(off?'outside':'')+'" style="left:'+dayPct(a.effectiveDay)+'%" data-tl-receipt="'+a.id+'" title="'+escapeText(a.code+' · recebimento '+date(receiptDate)+' · '+money.format(a.value)+(delay?' · atraso simulado '+delay+' dias':'')+(off?' · fora do horizonte':''))+'" aria-label="'+escapeText(a.project+' '+a.code+', entrada prevista em '+date(receiptDate)+', '+money.format(a.value)+(off?', após o horizonte':''))+'"><i></i><span>'+(off?'→':a.code)+'</span></button>';
      }).join('');
      const fk='ob:'+p.id,fop=!!OPEN[fk],fs=fases(p,start,end),toIso=n=>TIMELINE_MODEL.add(m.origin,n).toISOString().slice(0,10);
      return '<div class="tl-row"><div class="tl-plab"><button class="tl-tog" data-tl-sub="'+fk+'" aria-expanded="'+fop+'" aria-label="'+(fop?'Recolher':'Abrir')+' subitens de '+escS(p.name)+'">'+(fop?'▾':'▸')+'</button><button class="tl-project" data-tl-project="'+p.id+'" title="Filtrar fluxo desta obra"><span class="tl-project-icon">'+icon('building')+'</span><span><strong>'+p.name+'</strong><small>'+p.city+'</small></span>'+(p.status==='risk'?'<i class="tl-risk" title="Obra com desvio no cenário"></i>':'')+'</button></div><div class="tl-lane"><div class="tl-week-focus" style="left:'+(state.week/state.weeks*100)+'%;width:'+(100/state.weeks)+'%"></div><div class="tl-execution '+(p.status==='risk'?'risk':'')+'" style="left:'+dayPct(start)+'%;width:'+(dayPct(end)-dayPct(start))+'%" title="Faixa ilustrativa de execução remanescente"><span>Execução</span></div>'+milestones+'</div></div>'+(fop?subRows(m,fk,fs.map(f=>({...f,ini:toIso(f.dIni),fim:toIso(f.dFim)})),1):'');
    }).join('');
    const reais=state.project==='all'&&!state.onlyRisk?obrasReais(m):'';
    return '<div class="tl-gantt-scroll"><div class="tl-gantt-inner" style="--weeks:'+state.weeks+'"><div class="tl-gantt-head"><div class="tl-gantt-label">OBRA / CONTRATO <span>'+ps.length+' '+(ps.length===1?'obra':'obras')+' · ▸ abre os subitens</span></div><div class="tl-week-head">'+weekHead+'</div></div>'+reais+rows+(ps.length?'':'<p class="area-note" style="padding:25px">Nenhuma obra neste filtro.</p>')+'</div></div>';
  }
  function chart(){
    const m=model(),b=m.buckets,W=900,H=316,L=111,R=30,T=28,B=47,PW=W-L-R,PH=H-T-B;
    const base=TIMELINE_MODEL.calculate(period,state.project,{},state.weeks).buckets;
    state.showBalance=!!state.serie.balance;
    const SER=[['income','Entradas previstas','#276b68','income'],['out','Gastos previstos','#b88b52','expense'],['measured','Medições previstas','#688da6','measurement'],['balance','Saldo acumulado','#8a9d72','balance']];
    const on=SER.filter(z=>state.serie[z[0]]),ks=(on.length?on:SER.slice(0,3)).map(z=>z[0]);
    const plotted=b.flatMap(w=>ks.map(k=>w[k]));
    const reference=base.flatMap(w=>ks.map(k=>w[k]));
    const maximum=Math.max(...plotted,...reference,50000),minimum=Math.min(0,...plotted);
    const step=Math.max(10000,Math.ceil((maximum-minimum)/4/10000)*10000);
    const min=minimum<0?Math.floor(minimum/step)*step:0,max=Math.ceil(maximum/step)*step;
    // Todas as séries passam pela mesma função e pelo mesmo domínio em reais.
    const y=value=>T+PH-(value-min)/(max-min)*PH;
    const col=PW/b.length,x=i=>L+col*(i+.5);
    const labels=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step);
    const grids=labels.map(value=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(value)+'" y2="'+y(value)+'" stroke="'+(value===0?'#c2cfc3':'#e6ede6')+'" stroke-dasharray="'+(value===0?'0':'3 5')+'"/><text x="'+(L-13)+'" y="'+(y(value)+4)+'" text-anchor="end">'+money.format(value)+'</text>').join('');
    function series(key,label,color,extraClass=''){
      const path=b.map((w,i)=>(i?'L':'M')+x(i)+' '+y(w[key])).join(' ');
      const dots=b.map((w,i)=>'<circle class="tl-flow-point" data-series="'+key+'" data-week="'+i+'" data-value="'+w[key]+'" cx="'+x(i)+'" cy="'+y(w[key])+'" r="'+(i===state.week?5.8:4.2)+'" fill="'+(i===state.week?color:'#fff')+'" stroke="'+color+'" stroke-width="2.6"><title>'+label+' · '+fullDate(w.date)+': '+money.format(w[key])+'</title></circle>').join('');
      return '<g class="tl-flow-series '+extraClass+'" data-series="'+key+'"><path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(key==='balance'?'1.8':'2.8')+'" '+(key==='balance'?'stroke-dasharray="6 5"':'')+' stroke-linejoin="round" stroke-linecap="round"/>'+dots+'</g>';
    }
    /* barras: entradas, gastos e medições lado a lado em cada semana; o saldo segue como linha tracejada */
    function barras(){const bs=on.filter(z=>z[0]!=='balance'),gw=col*.7,bw=bs.length?gw/bs.length:0,y0=y(Math.max(min,0));
      return bs.map(([k,l,c],j)=>'<g class="tl-flow-series" data-series="'+k+'">'+b.map((w,i)=>{const v=w[k],yy=y(v),x0=x(i)-gw/2+j*bw;return '<rect class="tl-flow-bar" x="'+(x0+1)+'" y="'+Math.min(yy,y0)+'" width="'+Math.max(1,bw-2)+'" height="'+Math.max(0,Math.abs(y0-yy))+'" rx="2" fill="'+c+'" fill-opacity="'+(i===state.week?1:.78)+'"><title>'+l+' · '+fullDate(w.date)+': '+money.format(v)+'</title></rect>';}).join('')+'</g>').join('')+(state.serie.balance?series('balance','Saldo acumulado','#8a9d72','tl-balance-series'):'');}
    /* áreas: cada série com preenchimento leve até a linha do zero */
    function areas(){const y0=y(Math.max(min,0));return on.map(([k,l,c])=>{const p=b.map((w,i)=>(i?'L':'M')+x(i)+' '+y(w[k])).join(' ');return '<path d="'+p+' L'+x(b.length-1)+' '+y0+' L'+x(0)+' '+y0+' Z" fill="'+c+'" fill-opacity="'+(k==='balance'?.08:.16)+'" stroke="none"/>';}).join('')+on.map(([k,l,c])=>series(k,l,c,k==='balance'?'tl-balance-series':'')).join('');}
    const lines=!on.length?'<text x="'+(L+PW/2)+'" y="'+(T+PH/2)+'" text-anchor="middle" class="tl-chart-empty">Ligue pelo menos uma série na legenda</text>':state.tipo==='barras'?barras():state.tipo==='areas'?areas():on.map(([k,l,c])=>series(k,l,c,k==='balance'?'tl-balance-series':'')).join('');
    const dates=b.map((w,i)=>'<text x="'+x(i)+'" y="'+(H-15)+'" text-anchor="middle">'+date(w.date).replace(' de ',' ')+'</text>').join('');
    const overlays=b.map((w,i)=>'<button class="tl-chart-hit" style="left:'+((L+i*col)/W*100)+'%;width:'+(col/W*100)+'%" data-tl-week="'+i+'" title="'+fullDate(w.date)+' · entradas '+money.format(w.income)+' · gastos '+money.format(w.out)+' · medições '+money.format(w.measured)+' · saldo '+money.format(w.balance)+'" aria-label="Selecionar semana de '+fullDate(w.date)+'"><span class="sr-only">Semana '+(i+1)+'</span></button>').join('');
    const selectedWeek=b[Math.min(state.week,b.length-1)];
    return '<div class="tl-chart-options"><div class="tl-chart-legend tl-legend-sw" role="group" aria-label="Séries do gráfico (clique para ligar ou desligar)">'+SER.map(([k,l,c,cls])=>'<button type="button" class="tl-sw'+(state.serie[k]?' on':'')+'" data-tl-serie="'+k+'" aria-pressed="'+!!state.serie[k]+'"><i class="'+cls+'" style="--c:'+c+'"></i>'+l+'</button>').join('')+'<button type="button" class="tl-sw-all" data-tl-todas>'+(on.length===SER.length?'Desligar todas':'Mostrar todas')+'</button></div><div class="tl-tipo" role="group" aria-label="Tipo de gráfico">'+[['linhas','Linhas'],['barras','Barras'],['areas','Áreas']].map(([k,l])=>'<button type="button" data-tl-tipo="'+k+'" aria-pressed="'+(state.tipo===k)+'" class="'+(state.tipo===k?'on':'')+'">'+l+'</button>').join('')+'</div></div><p class="tl-scale-note">Valores semanais em reais · um único eixo para todas as curvas</p><div class="tl-chart-wrap"><svg class="tl-cash-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(on.map(z=>z[1]).join(', ')||'Nenhuma série')+' em '+({linhas:'linhas',barras:'barras',areas:'áreas'}[state.tipo])+', na mesma escala em reais, em '+state.weeks+' semanas. Dados fictícios."><title>Entradas, gastos e medições · mesma escala em reais</title><rect x="'+(L+state.week*col)+'" y="'+T+'" width="'+col+'" height="'+PH+'" rx="7" fill="#f0f5ed"/>'+grids+lines+dates+'</svg>'+overlays+'</div><div class="tl-week-summary"><div><small>SEMANA SELECIONADA</small><strong>'+date(selectedWeek.date)+' → '+date(TIMELINE_MODEL.add(selectedWeek.date,6))+'</strong></div><div><small>Entradas previstas</small><strong>'+money.format(selectedWeek.income)+'</strong></div><div><small>Medições previstas</small><strong>'+money.format(selectedWeek.measured)+'</strong></div><div><small>Gastos previstos</small><strong>'+money.format(selectedWeek.out)+'</strong></div><div><small>Saldo acumulado</small><strong class="'+(selectedWeek.balance<0?'negative':'')+'">'+money.format(selectedWeek.balance)+'</strong></div><button class="text-button" data-tl-week-detail="'+state.week+'">Abrir composição '+icon('arrow')+'</button></div>';
  }


  function detail(){
    const m=selected(),origin=TIMELINE_MODEL.origin(period),newDate=TIMELINE_MODEL.add(origin,m.effectiveDay);
    return '<div class="tl-detail-title"><span class="tl-selected-code">'+m.code+'</span><div><h3>'+escapeText(m.client)+'</h3><p>'+escapeText(m.service)+' · '+money.format(m.value)+'</p></div></div><div class="tl-process">'+[['Medição',m.measuredDate],['Aprovação',m.approvalDate],['Faturamento',m.invoiceDate],['Recebimento',newDate]].map(([label,dt],i)=>'<div class="'+(i===3&&m.delay?'shifted':'')+'"><span>'+label+'</span><strong>'+date(dt)+'</strong></div>').join('')+'</div><p class="tl-hypothesis">'+(m.status==='Aprovada a faturar'?'Medição aprovada, aguardando faturamento e cobrança.':'Datas previstas com os ajustes de execução deste serviço.')+' Recebimento previsto após os ajustes do cliente e do serviço.</p>';
  }
  function simCaption(){
    const m=selected(),newDate=TIMELINE_MODEL.add(TIMELINE_MODEL.origin(period),m.effectiveDay);
    return '<strong>'+(m.delay?'+'+m.delay+' dias no total':'Sem atraso configurado')+'</strong><span>'+date(m.baseReceiptDate)+' '+(m.delay?'→ '+date(newDate):'· entrada prevista')+'</span><small class="tl-delay-breakdown">Execução: +'+m.serviceDelay+'d · Cliente: +'+m.clientDelay+'d · Recebimento do serviço: +'+m.paymentDelay+'d</small>';
  }


  function risk(){
    const m=model(),portfolio=state.project==='all';
    const first=m.buckets.find(w=>w.balance<(portfolio?300000:0)),delayed=m.measurements.filter(a=>a.delay>0).length;
    return '<div class="tl-risk-note '+(first?'attention':'')+'">'+icon(first?'clock':'check')+'<p>'+(first?(portfolio?'O cenário fica abaixo da reserva ilustrativa na semana de ':'A obra apresenta saldo líquido negativo na semana de ')+date(first.date)+'. Compare as datas de recebimento com os pagamentos comprometidos.':'O cenário mantém '+(portfolio?'saldo acima da reserva ilustrativa.':'saldo líquido não negativo.') )+(delayed?' <strong>'+delayed+' recebimento'+(delayed>1?'s':'')+' com atraso simulado.</strong>':'')+'</p></div>';
  }

  function ensurePlan(){
    if(state.planPeriod===period)return;
    state.planPeriod=period;
    let plan={};try{plan=JSON.parse(localStorage.getItem('armant-forecast-delays-v1')||'{}')[period]||{};}catch{}
    const clean=values=>Object.fromEntries(Object.entries(values||{}).map(([key,value])=>[key,Math.max(0,Math.min(120,Math.round(Number(value)||0)))]));
    state.delay=clean(plan.payments);state.serviceDelays=clean(plan.services);state.clientDelays=clean(plan.clients);
  }
  function savePlan(){
    try{const plans=JSON.parse(localStorage.getItem('armant-forecast-delays-v1')||'{}');plans[period]={payments:state.delay,services:state.serviceDelays,clients:state.clientDelays};localStorage.setItem('armant-forecast-delays-v1',JSON.stringify(plans));}catch{}
  }
  function delayCounts(){
    const data=model(),services=data.measurements.filter(a=>a.delay>0),clients=new Set(services.map(a=>a.clientId));
    return services.length?clients.size+' cliente'+(clients.size===1?'':'s')+' · '+services.length+' serviço'+(services.length===1?'':'s')+' com ajuste':'Nenhum atraso configurado';
  }
  function clientDelayCaption(projectId){
    const items=allModel().measurements.filter(a=>a.clientId===projectId),active=items.filter(a=>a.delay>0);
    return active.length?active.length+' serviço'+(active.length===1?'':'s')+' · até +'+Math.max(...active.map(a=>a.delay))+' dias':'Sem ajustes';
  }
  function serviceDelayCaption(m){
    return (m.delay?'+'+m.delay+' dias no total':'Prazo-base')+' · entrada em '+date(TIMELINE_MODEL.add(TIMELINE_MODEL.origin(period),m.effectiveDay));
  }
  function simulationControls(){
    const data=allModel(),ps=PROJECTS.filter(p=>state.project==='all'||p.id===state.project);
    const groups=ps.map(p=>{
      const items=data.measurements.filter(a=>a.clientId===p.id);
      return '<details class="tl-client-delay"><summary><span class="tl-delay-chevron">'+icon('chevron')+'</span><span class="tl-client-name">'+escapeText(p.name)+'</span><span class="tl-client-status" id="tl-client-status-'+p.id+'">'+clientDelayCaption(p.id)+'</span></summary><div class="tl-client-body"><label class="tl-client-term"><span>Prazo extra do cliente para receber<small>Aplica-se aos serviços deste cliente.</small></span><span class="tl-days-input"><input type="number" min="0" max="120" step="1" inputmode="numeric" data-tl-client-delay="'+p.id+'" value="'+(state.clientDelays[p.id]||0)+'" aria-label="Atraso de recebimento do cliente '+escapeText(p.name)+' em dias"><small>dias</small></span></label>'+items.map(a=>'<div class="tl-service-delay"><div class="tl-service-heading"><button data-tl-pick="'+a.id+'">'+escapeText(a.service)+' <span>'+a.code+'</span></button><span class="tl-service-amount">'+money.format(a.value)+'</span></div><div class="tl-service-inputs"><label><span>Atraso na execução</span><span class="tl-days-input"><input type="number" min="0" max="120" step="1" inputmode="numeric" data-tl-service-delay="'+a.id+'" value="'+a.serviceDelay+'" '+(a.status==='Aprovada a faturar'?'disabled title="Medição já aprovada: execução confirmada"':'')+' aria-label="Atraso na execução de '+escapeText(a.service)+' de '+escapeText(p.name)+' em dias"><small>dias</small></span></label><label><span>Atraso extra no recebimento</span><span class="tl-days-input"><input type="number" min="0" max="120" step="1" inputmode="numeric" data-tl-payment-delay="'+a.id+'" value="'+a.paymentDelay+'" aria-label="Atraso extra no recebimento de '+escapeText(a.service)+' de '+escapeText(p.name)+' em dias"><small>dias</small></span></label></div><p class="tl-service-forecast" id="tl-service-status-'+a.id+'">'+serviceDelayCaption(a)+'</p></div>').join('')+'</div></details>';
    }).join('');
    return '<div class="tl-forecast-config"><div class="tl-forecast-selected"><span class="eyebrow">ATRASO POR CLIENTE E SERVIÇO</span><span class="tl-simulation-name" id="tl-simulation-name">'+escapeText(selected().client)+' · '+escapeText(selected().service)+' · '+selected().code+'</span><div class="tl-delay-value" id="tl-delay-caption">'+simCaption()+'</div></div><details class="tl-delay-config"><summary>'+icon('layers')+'<span>Configurar atrasos por cliente e serviço<small id="tl-delay-count">'+delayCounts()+'</small></span><span class="tl-delay-chevron">'+icon('chevron')+'</span></summary><div class="tl-delay-content"><p class="tl-delay-explanation">Atraso total = execução do serviço + prazo extra do cliente + recebimento do serviço. Medições já aprovadas mantêm a data de execução.</p>'+groups+'</div></details><p class="tl-local-note">Simulação salva neste navegador, por período. Os pagamentos previstos mantêm suas datas.</p></div>';
  }


  function render(){
    if(state.week>=state.weeks)state.week=state.weeks-1;
    const ps=TIMELINE_MODEL.makeProjects(period),m=model();
    return '<div class="tl-intro"><div><span class="eyebrow">DA EXECUÇÃO AO RECEBIMENTO</span><h2>O tempo da obra. O tempo do dinheiro.</h2><p>Medições e recebimentos no Gantt, comparados aos pagamentos. Selecione uma obra, explore as semanas ou simule um atraso.</p></div>'+icon('chart')+'</div><div class="tl-controls"><label><span>Visão do fluxo</span><select id="tl-project"><option value="all">Todas as obras · caixa consolidado</option>'+ps.map(p=>'<option value="'+p.id+'" '+(state.project===p.id?'selected':'')+'>'+p.name+'</option>').join('')+'</select></label><label><span>Horizonte a partir de '+date(m.origin)+'</span><select id="tl-horizon"><option value="8" '+(state.weeks===8?'selected':'')+'>8 semanas</option><option value="12" '+(state.weeks===12?'selected':'')+'>12 semanas</option></select></label><button class="button outline" data-tl-reset>Restaurar cenário '+icon('refresh')+'</button></div><div class="tl-stats" id="timeline-stats">'+stats()+'</div><section class="panel tl-gantt-panel"><div class="panel-header"><div><h2>Cronograma integrado de obras e medições</h2><p>Clique em uma medição ou entrada para acompanhar seu efeito no caixa.</p></div><button class="filter-chip '+(state.onlyRisk?'active':'')+'" data-tl-risk aria-pressed="'+state.onlyRisk+'">'+(state.onlyRisk?'Mostrar todas':'Só obras com desvio')+'</button></div><div class="tl-gantt-legend"><span><i class="execution"></i>Execução remanescente</span><span><i class="milestone"></i>Medição</span><span><i class="receipt"></i>Recebimento previsto</span><span><i class="simulated"></i>Atraso simulado</span></div><div id="timeline-gantt">'+gantt()+'</div><div class="tl-gantt-foot"><span>Medição aprovada antes da data-base aparece como M1 ✓.</span><span>Arraste a tabela para os lados em telas menores.</span></div></section><div class="tl-linked-grid"><section class="panel tl-flow-panel"><div class="panel-header"><div><h2>Entradas, gastos e medições</h2><p>'+(state.project==='all'?'Caixa consolidado das 12 obras':'Fluxo exclusivo da obra selecionada')+' · clique em uma semana</p></div><span class="count-pill">Previsão · dados fictícios</span></div>'+simulationControls()+'<div id="timeline-chart">'+chart()+'</div></section><section class="panel tl-simulation"><div class="panel-header"><div><h2>Experimente o impacto</h2><p>Recebimento da medição selecionada</p></div>'+icon('sparkles')+'</div><div id="timeline-detail">'+detail()+'</div></section></div><div id="timeline-risk">'+risk()+'</div><p class="area-note">Leitura de caixa: saídas são pagamentos previstos, não despesas por competência. Aprovação, faturamento e recebimento têm datas próprias. Horizonte de 12 semanas mantém apenas os compromissos cadastrados; períodos posteriores sem registros não indicam ausência de operação.</p>';
  }
  function refresh(){
    const targets={'timeline-stats':stats,'timeline-gantt':gantt,'timeline-chart':chart,'timeline-detail':detail,'tl-delay-caption':simCaption,'timeline-risk':risk,'tl-simulation-name':()=>escapeText(selected().client)+' · '+escapeText(selected().service)+' · '+selected().code,'tl-delay-count':delayCounts};
    for(const [id,fn] of Object.entries(targets)){const el=document.getElementById(id);if(el)el.innerHTML=fn();}
    for(const a of allModel().measurements){const item=document.getElementById('tl-service-status-'+a.id);if(item)item.textContent=serviceDelayCaption(a);const client=document.getElementById('tl-client-status-'+a.clientId);if(client)client.textContent=clientDelayCaption(a.clientId);}
  }
  function chooseMeasurement(id,receipt=false,scroll=true){
    state.measurement=id;
    const m=selected();
    state.week=Math.min(state.weeks-1,Math.max(0,Math.floor((receipt?m.effectiveDay:m.measuredDay)/7)));
    refresh();
    if(scroll)document.getElementById('timeline-chart')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  document.addEventListener('click',e=>{
    const sub=e.target.closest('[data-tl-sub]');if(sub){const k=sub.dataset.tlSub;if(OPEN[k])delete OPEN[k];else OPEN[k]=1;if(e.altKey)Object.keys(OPEN).filter(x=>x.startsWith(k+'/')).forEach(x=>delete OPEN[x]);const g=document.getElementById('timeline-gantt'),sc=g&&g.querySelector('.tl-gantt-scroll'),sl=sc?sc.scrollLeft:0;if(g){g.innerHTML=gantt();const n=g.querySelector('.tl-gantt-scroll');if(n)n.scrollLeft=sl;const b=g.querySelector('[data-tl-sub="'+k.replace(/"/g,'\\"')+'"]');if(b)b.focus();}return;}
    const el=e.target.closest('[data-tl-measure],[data-tl-receipt],[data-tl-project],[data-tl-week],[data-tl-week-detail],[data-tl-risk],[data-tl-reset],[data-tl-balance],[data-tl-pick],[data-tl-serie],[data-tl-tipo],[data-tl-todas]');
    if(!el)return;
    if(el.dataset.tlPick)chooseMeasurement(el.dataset.tlPick,true,false);
    else if(el.hasAttribute('data-tl-balance')){state.serie.balance=!state.serie.balance;guardaGraf();refresh();}
    else if(el.dataset.tlSerie){state.serie[el.dataset.tlSerie]=!state.serie[el.dataset.tlSerie];guardaGraf();refresh();}
    else if(el.hasAttribute('data-tl-todas')){const todas=Object.values(state.serie).every(Boolean);Object.keys(state.serie).forEach(k=>state.serie[k]=!todas);guardaGraf();refresh();}
    else if(el.dataset.tlTipo){state.tipo=el.dataset.tlTipo;guardaGraf();refresh();}
    else if(el.dataset.tlMeasure)chooseMeasurement(el.dataset.tlMeasure);
    else if(el.dataset.tlReceipt)chooseMeasurement(el.dataset.tlReceipt,true);
    else if(el.dataset.tlProject){state.project=state.project===el.dataset.tlProject?'all':el.dataset.tlProject;state.measurement=TIMELINE_MODEL.makeMeasurements(period).find(m=>state.project==='all'||m.projectId===state.project).id;document.getElementById('view').innerHTML=render();}
    else if(el.dataset.tlWeek!==undefined){state.week=Number(el.dataset.tlWeek);refresh();}
    else if(el.dataset.tlWeekDetail!==undefined){const w=model().buckets[Number(el.dataset.tlWeekDetail)];showDialog('COMPOSIÇÃO DO FLUXO · DADOS FICTÍCIOS','<h2 id="dialog-title">Semana de '+date(w.date)+'</h2><p class="modal-description">Entradas e pagamentos previstos para '+(state.project==='all'?'a carteira de obras.':'a obra selecionada.')+'</p><div class="detail-kpis"><div><small>Entradas previstas</small><strong>'+compact(w.income)+'</strong></div><div><small>Pagamentos previstos</small><strong>'+compact(w.out)+'</strong></div></div><h3 class="modal-section">Recebimentos de medições</h3>'+(w.receipts.length?'<ul class="modal-steps">'+w.receipts.map(m=>'<li>'+m.project+' · '+m.code+' · '+money.format(m.value)+(m.delay?' · +'+m.delay+' dias simulados':'')+'</li>').join('')+'</ul>':'<p class="modal-description">Nenhum recebimento cadastrado nesta semana.</p>')+'<h3 class="modal-section">Pagamentos previstos</h3>'+(w.payments.length?'<ul class="modal-steps">'+w.payments.map(p=>'<li>'+p.project+' · '+p.type+' · '+money.format(p.value)+'</li>').join('')+'</ul>':'<p class="modal-description">Nenhum pagamento cadastrado nesta semana.</p>')+'<p class="modal-callout">Saldo acumulado após esta semana: '+money.format(w.balance)+'. A composição é demonstrativa e não está conectada ao financeiro.</p>');}
    else if(el.hasAttribute('data-tl-risk')){state.onlyRisk=!state.onlyRisk;document.getElementById('view').innerHTML=render();}
    else if(el.hasAttribute('data-tl-reset')){state.project='all';state.delay={};state.serviceDelays={};state.clientDelays={};savePlan();state.measurement='OB-001-M1';state.onlyRisk=false;state.showBalance=false;state.week=2;state.weeks=8;document.getElementById('view').innerHTML=render();toast('Cenário demonstrativo restaurado.');}
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='tl-project'){state.project=e.target.value;state.measurement=TIMELINE_MODEL.makeMeasurements(period).find(m=>state.project==='all'||m.projectId===state.project).id;document.getElementById('view').innerHTML=render();}
    if(e.target.id==='tl-horizon'){state.weeks=Number(e.target.value);if(state.week>=state.weeks)state.week=state.weeks-1;document.getElementById('view').innerHTML=render();}
  });
  document.addEventListener('input',e=>{const el=e.target;if(!el.matches('[data-tl-client-delay],[data-tl-service-delay],[data-tl-payment-delay]'))return;const value=Math.max(0,Math.min(120,Math.round(Number(el.value)||0)));if(el.dataset.tlClientDelay)state.clientDelays[el.dataset.tlClientDelay]=value;else if(el.dataset.tlServiceDelay){state.serviceDelays[el.dataset.tlServiceDelay]=value;state.measurement=el.dataset.tlServiceDelay;}else{state.delay[el.dataset.tlPaymentDelay]=value;state.measurement=el.dataset.tlPaymentDelay;}savePlan();refresh();});
  function exportRows(){
    const m=model();return [['CRONOGRAMA E CAIXA — DADOS FICTÍCIOS'],['Data-base',fullDate(m.origin),'Horizonte',state.weeks+' semanas'],['Visão',state.project==='all'?'Todas as obras':PROJECTS.find(p=>p.id===state.project).name],['Caixa inicial do cenário',m.opening],[],['Semana','Início','Medições previstas','Entradas previstas','Pagamentos previstos','Saldo acumulado'],...m.buckets.map(w=>[w.index+1,fullDate(w.date),w.measured,w.income,w.out,w.balance]),[],['Cliente fictício','Serviço demonstrativo','Obra','Medição','Valor','Medição ajustada','Aprovação ajustada','Faturamento ajustado','Recebimento original','Atraso execução (dias)','Atraso cliente (dias)','Atraso recebimento serviço (dias)','Atraso total (dias)','Recebimento ajustado'],...m.measurements.map(a=>[a.client,a.service,a.project,a.code,a.value,fullDate(a.measuredDate),fullDate(a.approvalDate),fullDate(a.invoiceDate),fullDate(a.baseReceiptDate),a.serviceDelay,a.clientDelay,a.paymentDelay,a.delay,fullDate(TIMELINE_MODEL.add(m.origin,a.effectiveDay))])];
  }


  return {render,exportRows};
})();



