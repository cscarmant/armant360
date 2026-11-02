/* Armant 360 · Obras fictícias de demonstração (carregar depois de data.js e antes de obras.js)
   Monta, para cada obra fictícia da lista (OB-001 a OB-012), uma obra completa no mesmo formato da obra real:
   planilha de serviços, prazos, cronograma, medições, aditivos e equipe. Tudo é inventado e sempre igual
   (sorteio fixo pelo código da obra). Nenhum número vem da obra real. */
(function(){
'use strict';
if(typeof PROJECTS==='undefined'||!Array.isArray(PROJECTS)) return;

/* sorteio fixo pelo código da obra */
function rng(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
 return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return (h>>>0)/4294967296;};}
const r2=v=>Math.round(v*100)/100;
const addD=(iso,n)=>{const x=new Date(iso+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const addM=(iso,n)=>{const x=new Date(iso+'T12:00:00');x.setMonth(x.getMonth()+n);return x.toISOString().slice(0,10);};
const brd=iso=>iso.split('-').reverse().join('/');

/* tipo de obra pelo nome */
function tipo(n){n=n.toLowerCase();
 if(/hospital|clínica|clinica|laborat/.test(n))return 'saude';
 if(/indústria|industria|logística|logistica/.test(n))return 'industria';
 if(/hotel|residencial/.test(n))return 'hotel';
 if(/comercial leste|shopping/.test(n))return 'varejo';
 return 'escritorio';}
const AREAS={saude:['Centro cirúrgico','UTI','Internação','Apoio e áreas técnicas'],escritorio:['Térreo e hall','Pavimentos tipo','Auditório e salas de reunião','Sala de TI'],
 industria:['Galpão de produção','Expedição','Escritórios administrativos','Refeitório'],hotel:['Apartamentos','Lobby e restaurante','Cozinha industrial','Áreas comuns'],
 varejo:['Mall e circulação','Lojas âncora','Praça de alimentação','Docas e serviços']};
const CLIENTE={saude:'Associação Hospitalar',escritorio:'Incorporadora',industria:'Indústria e Comércio',hotel:'Empreendimentos Hoteleiros',varejo:'Administradora de Centros Comerciais'};

/* serviços: [subgrupo, descrição, unidade, preço unitário (null = verba), peso no subgrupo, fração de mão de obra, por área?] */
const BASE={
 '1.2':[['MOBILIZAÇÃO E DESMOBILIZAÇÃO DO CANTEIRO DE OBRAS','UN',null,3,.55],['PLACA DE OBRA EM CHAPA GALVANIZADA 2,00 X 1,00 M','UN',980,.3,.15],['LOCAÇÃO DE CONTÊINER ESCRITÓRIO/ALMOXARIFADO','MÊS',1450,2.4,0],['LOCAÇÃO DE ANDAIME TUBULAR, INCLUSIVE MONTAGEM','M²·MÊS',19.5,1.6,.35],['LOCAÇÃO DE PLATAFORMA ELEVATÓRIA (PTA) ATÉ 12 M','DIA',690,1.6,0],['LIMPEZA PERMANENTE DA OBRA E DESCARTE DE RESÍDUOS','MÊS',2100,1.2,.9]],
 '2.2':[['DUTO EM CHAPA GALVANIZADA #24/#22, INCLUSIVE SUPORTAÇÃO','KG',43.8,5,.45,1],['ISOLAMENTO TÉRMICO DE DUTO EM MANTA DE LÃ DE VIDRO 25 MM COM ALUMÍNIO','M²',61,2,.5,1],['DIFUSOR DE INSUFLAMENTO 4 VIAS 600 X 600 MM COM REGISTRO','UN',440,1.4,.2,1],['GRELHA DE RETORNO 600 X 300 MM COM REGISTRO','UN',265,.8,.2,1],['DUTO FLEXÍVEL ISOLADO Ø 200 MM','M',39,.6,.35,1]],
 '2.3':[['TUBULAÇÃO DE COBRE FRIGORÍGENA COM ISOLAMENTO ELASTOMÉRICO 19 MM','M',168,4,.4,1],['DRENO EM PVC 25 MM COM CAIXA SIFONADA','M',36,.8,.55,1],['CARGA COMPLEMENTAR DE FLUIDO R-410A','KG',128,.6,.3],['SUPORTE E FIXAÇÃO DE TUBULAÇÃO EM PERFILADO','M',22,.6,.5,1]],
 '2.4':[['VENTILADOR CENTRÍFUGO DE EXAUSTÃO COM CAIXA ACÚSTICA','UN',7900,2,.15],['VENTILADOR IN-LINE PARA EXAUSTÃO DE SANITÁRIOS','UN',1240,1,.2,1],['VENEZIANA DE TOMADA DE AR EXTERNO COM TELA','UN',650,.5,.2]],
 '3.1':[['QUADRO DE FORÇA DO AR-CONDICIONADO (QFAC) COM DISJUNTORES E DPS','UN',14800,2,.25],['ALIMENTADOR EM CABO FLEXÍVEL 16 MM² 0,6/1 KV','M',96,2,.3,1],['ELETROCALHA PERFURADA 200 X 100 MM COM TAMPA','M',89,1.4,.4,1],['PONTO DE FORÇA PARA EVAPORADORA','UN',320,1,.6,1]],
 '3.2':[['CONTROLADOR CENTRAL DO SISTEMA COM TELA SENSÍVEL AO TOQUE','UN',9900,1.5,.1],['CONTROLE REMOTO COM FIO PARA EVAPORADORA','UN',430,1.2,.15,1],['SENSOR DE TEMPERATURA E UMIDADE AMBIENTE','UN',690,.8,.2,1],['CABO DE COMUNICAÇÃO BLINDADO 2 X 0,75 MM²','M',9.4,.5,.4,1]],
 '4.1':[['TESTE DE ESTANQUEIDADE COM NITROGÊNIO E VÁCUO DA REDE FRIGORÍGENA','UN',null,1,1],['TESTE, AJUSTE E BALANCEAMENTO (TAB) DO SISTEMA DE AR','UN',null,2.2,1],['PARTIDA ASSISTIDA PELO FABRICANTE','UN',null,1,.8]],
 '4.2':[['PROJETO AS BUILT (PLANTAS E DIAGRAMAS)','UN',null,1.2,1],['PMOC INICIAL E ART DE EXECUÇÃO','UN',null,.8,1],['MANUAL DE OPERAÇÃO E MANUTENÇÃO','UN',null,.5,1]],
 '4.3':[['TREINAMENTO DA EQUIPE DE MANUTENÇÃO DO CLIENTE','UN',null,.6,1],['LIMPEZA FINAL E ENTREGA DAS ÁREAS','UN',null,.5,1]]};
const EQUIP={
 saude:[['UNIDADE DE TRATAMENTO DE AR (UTA) 10 TR COM FILTRAGEM F7 + HEPA H13','UN',112000,4,.08],['CONDENSADORA VRF 24 HP','UN',86000,3,.06],['EVAPORADORA VRF CASSETE 4 VIAS 18.000 BTU/H','UN',6900,2.5,.1,1],['CAIXA TERMINAL HEPA H13 COM DIFUSOR','UN',5200,1.6,.12,1]],
 escritorio:[['CONDENSADORA VRF 32 HP','UN',118000,4,.06],['EVAPORADORA VRF CASSETE 4 VIAS 24.000 BTU/H','UN',7400,2.6,.1,1],['EVAPORADORA VRF DUTADA 36.000 BTU/H','UN',9800,1.6,.1,1],['SPLIT HI-WALL INVERTER 24.000 BTU/H PARA SALA DE TI','UN',6100,.6,.12]],
 industria:[['ROOFTOP 20 TR COM ECONOMIZADOR','UN',138000,4,.06],['EXAUSTOR AXIAL Ø 1000 MM PARA GALPÃO','UN',8700,1.6,.12,1],['CORTINA DE AR 1,80 M PARA DOCA','UN',4300,.8,.15],['SPLIT PISO-TETO 60.000 BTU/H','UN',14900,1.4,.1,1]],
 hotel:[['CONDENSADORA VRF 28 HP','UN',98000,3.4,.06],['EVAPORADORA VRF HI-WALL 12.000 BTU/H','UN',4300,2.6,.12,1],['BOMBA DE CALOR PARA ÁGUA QUENTE 60 KW','UN',61000,1.4,.08],['COIFA E CAIXA DE EXAUSTÃO PARA COZINHA','UN',27000,1,.25]],
 varejo:[['ROOFTOP 25 TR','UN',152000,4,.06],['CONDENSADORA VRF 20 HP','UN',72000,2,.06],['EVAPORADORA VRF CASSETE 4 VIAS 36.000 BTU/H','UN',9400,1.8,.1,1],['CORTINA DE AR 1,50 M PARA ACESSO','UN',3900,.6,.15]]};
const EXTRA={saude:{'2.4':[['VENTILADOR DE PRESSURIZAÇÃO DE QUARTO DE ISOLAMENTO','UN',9400,1.4,.15,1]],'3.2':[['MONITOR DE PRESSÃO DIFERENCIAL DE SALA','UN',2500,1,.15,1]],'4.1':[['CERTIFICAÇÃO DE SALAS (CONTAGEM DE PARTÍCULAS E TROCAS DE AR)','UN',null,1.4,1]]},
 escritorio:{'2.2':[['DAMPER CORTA-FOGO 600 X 400 MM','UN',1950,.6,.15]]},industria:{'2.4':[['EXAUSTOR EÓLICO Ø 600 MM','UN',780,.8,.3]]},
 hotel:{'2.2':[['DUTO EM AÇO INOX PARA EXAUSTÃO DE COZINHA','KG',96,1,.4]]},varejo:{'2.2':[['DAMPER CORTA-FOGO 800 X 500 MM','UN',2300,.6,.15]]}};
const SUB=[['1.1','Administração'],['1.2','Canteiro'],['2.1','Equipamentos'],['2.2','Distribuição de ar'],['2.3','Tubulação e dreno'],['2.4','Ventilação e exaustão'],['3.1','Força'],['3.2','Automação'],['4.1','Testes e partida'],['4.2','Documentação'],['4.3','Entrega']];
/* parte do contrato e janela de execução (fração do prazo) de cada subgrupo */
const PESO={'1.1':.075,'1.2':.035,'2.1':.42,'2.2':.15,'2.3':.09,'2.4':.035,'3.1':.085,'3.2':.04,'4.1':.035,'4.2':.02,'4.3':.015};
const JAN={'1.1':[0,1],'1.2':[0,.12],'2.1':[.18,.62],'2.2':[.1,.72],'2.3':[.15,.7],'2.4':[.3,.8],'3.1':[.28,.82],'3.2':[.55,.93],'4.1':[.78,.97],'4.2':[.82,1],'4.3':[.92,1]};
const GRUPOS=[['1','Administração e canteiro'],['2','Climatização e ventilação'],['3','Elétrica e automação'],['4','Testes, documentação e entrega']];
const FORN=['Distribuidora Polar','Termotécnica Andes','Elétrica Meridiano','Dutos Vale Verde','Isolamentos Serra','Refrigeração Austral','Ferragens Cruzeiro'];
const FUNC=[['Gerenciamento da obra',2,.06],['Instalador de ar-condicionado',3,.3],['Montador de dutos',2,.2],['Eletricista',1,.14],['Técnico em refrigeração',1,.1],['Ajudante',2,.2]];

/* andamento planejado de um subgrupo num momento x (0 a 1 do prazo), curva suave dentro da janela */
const prog=(s,x)=>{const [a,b]=JAN[s];if(x<=a)return 0;if(x>=b)return 1;const u=(x-a)/(b-a);return u*u*(3-2*u);};

function monta(p){const R=rng(p.id),tp=tipo(p.name),V=p.contract,areas=AREAS[tp].slice(0,2+Math.floor(R()*2));
 const NM=Math.max(6,Math.min(12,Math.round(5+V/160000+R()*2))),prazo=NM*30;
 /* serviços */
 const lista={};SUB.forEach(([s])=>{lista[s]=(s==='2.1'?EQUIP[tp]:(BASE[s]||[])).concat((EXTRA[tp]||{})[s]||[]);});
 const items=[];
 SUB.forEach(([s])=>{if(s==='1.1')return;const L=lista[s],tw=L.reduce((a,x)=>a+x[3],0),verba=V*PESO[s];let n=0;
  L.forEach(([d,u,pu,w,mo,porArea])=>{const alvo=verba*w/tw,locais=porArea?areas:[null];
   locais.forEach((loc,li)=>{const fat=porArea?(li===0?.42:.58/(locais.length-1))*(0.85+R()*.3):1,val=alvo*fat;
    const inteiro=u==='UN'||u==='DIA'||u==='MÊS',dv=inteiro?1:10;let q,un;if(pu==null){q=1;un=r2(val);}else{un=r2(pu*(0.93+R()*.14));if(val<un)un=r2(val);q=Math.max(1,Math.floor(val/un*dv)/dv);}
    const t=r2(q*un),mot=r2(t*mo);n++;items.push({c:s+'.'+String(n).padStart(2,'0'),d:d+(loc?' · '+loc.toUpperCase():''),u,q,t,mo:mot,mat:r2(t-mot),ex:0,m:s==='2.1'&&pu>20000?1:0,s});});});});
 const resto=r2(V-items.reduce((a,i)=>a+i.t,0));
 items.unshift({c:'1.1.01',d:'EQUIPE DE ADMINISTRAÇÃO DA OBRA (ENGENHEIRO, ENCARREGADO E TÉCNICO DE SEGURANÇA)',u:'UN',q:1,t:resto,mo:resto,mat:0,ex:0,m:0,s:'1.1'});
 const valor=r2(items.reduce((a,i)=>a+i.t,0));
 /* quanto está feito: acha o momento x do cronograma que dá o avanço da obra */
 const alvo=p.advance/100,feito=x=>items.reduce((a,i)=>a+i.t*prog(i.s,x),0)/valor;
 let lo=0,hi=1;for(let k=0;k<40;k++){const m=(lo+hi)/2;if(feito(m)<alvo)lo=m;else hi=m;}const xe=(lo+hi)/2;
 /* período atual: quem está em risco ficou atrás do planejado */
 const atr=p.status==='risk'?Math.max(.05,(p.delay||5)/prazo*4):0;
 const K=Math.max(1,Math.min(NM-1,Math.round((xe+atr)*NM)-1));
 items.forEach(i=>{let e=prog(i.s,xe);if(e>0&&e<1)e=Math.max(.02,Math.min(.98,e*(0.82+R()*.36)));i.ex=Math.round(e*1e4)/1e4;});
 /* ajusta para bater o avanço informado */
 for(let k=0;k<4;k++){const ex0=items.reduce((a,i)=>a+i.t*i.ex,0)/valor,f=alvo/ex0;items.forEach(i=>{if(i.ex>0&&i.ex<1)i.ex=Math.round(Math.min(1,i.ex*f)*1e4)/1e4;});}
 /* datas: a medição do período atual fecha em 25/11/2026 */
 const inicio=addD(addM('2026-11-25',-(K+1)),1);
 const prazos={};items.forEach(i=>{const [a,b]=JAN[i.s];prazos[i.c]=[addD(inicio,Math.round(a*prazo)),addD(inicio,Math.max(Math.round(a*prazo),Math.round(b*prazo)-1)),'int'];});
 const plano=[];for(let m=1;m<=NM;m++)plano.push(r2(items.reduce((a,i)=>a+i.t*(prog(i.s,m/NM)-prog(i.s,(m-1)/NM)),0)));
 const exV=items.reduce((a,i)=>a+i.t*i.ex,0),medido=r2(exV*(0.74+R()*.14));
 const pa=plano.reduce((a,v,i)=>(a.push((a[i-1]||0)+v),a),[]),base=pa[K-1]||1;
 const medidoSerie=pa.slice(0,K).map(v=>r2(v/base*medido));medidoSerie[K-1]=medido;
 const proxima=r2((exV-medido)*(0.8+R()*.15));
 /* aditivo e compras */
 const eqp=EQUIP[tp];const ad=[[eqp[2][0].split(' ').slice(0,3).join(' ')+' (aditivo)',2+Math.floor(R()*5),'UN'],['Ponto de força adicional (aditivo)',3+Math.floor(R()*8),'UN'],['Serviço de instalação complementar (aditivo)',1,'UN']];
 const oc=n=>'OC '+String(7000+Math.floor(R()*900)+n);
 const compras=[[FORN[Math.floor(R()*3)],ad[0][0].replace(' (aditivo)',''),oc(1),r2(eqp[2][2]*ad[0][1]*(0.9+R()*.1)),'Pendente'],[FORN[3+Math.floor(R()*4)],'Cabos e disjuntores para pontos adicionais',oc(2),r2(180*ad[1][1]*(0.9+R()*.2)),R()<.5?'Aprovado':'Pendente']];
 /* equipe na obra */
 const total=Math.max(6,Math.round(5+V/90000+R()*3)),ter=Math.round(total*(0.2+R()*.15));
 const funcoes=FUNC.map(([fn,min,pe])=>[fn,Math.max(min>1?1:min,Math.round(total*pe))]).filter(x=>x[1]>0);
 const sig=p.name.split(' ').map(w=>w[0]).join('').toUpperCase();
 const obra={nome:'Climatização e ventilação · '+p.name,cliente:p.name+' '+CLIENTE[tp]+' (fictício)',sigla:p.name,contrato:'DEMO-'+p.id.slice(3)+'/2026',valor,prazo,inicio,
  dataBase:brd(addM(inicio,-3).slice(0,8)+'01'),medido,proxima,medidoSerie,plano,grupos:GRUPOS.map(([g,n])=>[g,n,r2(items.filter(i=>i.c.split('.')[0]===g).reduce((a,i)=>a+i.t,0))]),
  aditivo:{itens:ad,compras},presenca:{total,armant:total-ter,terceiros:ter,ativos:Math.max(1,total-1-Math.floor(R()*3)),funcoes},
  fonte:'Dados fictícios de demonstração (não é obra real)',climaGrupo:'2.',climaNome:'2 Climatização e ventilação',cidade:p.city,ro:p.owner,bloqueio:p.block,ficticia:true,sig};
 items.forEach(i=>delete i.s);
 return {id:p.id,data:{obra,items,prazos}};}

window.ARMANT_OBRAS_DEMO=PROJECTS.map(monta);
})();
