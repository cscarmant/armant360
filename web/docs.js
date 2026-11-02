/* Armant 360 · Documentos técnicos das tarefas (extensão do painel)
   Carregar depois de controle.js:  <script src="docs.js" defer></script>
   Ao adicionar uma tarefa no Controle de obras, o tipo pode ser:
     · Criar laudo técnico     → editor no modelo ARM (destinatário, local, endereço, contrato, introdução, tabela de
                                 equipamentos, situação, condições observadas, fotos, análise, conclusão, recomendações,
                                 assinaturas) com revisão R00, R01… e impressão/PDF.
     · Solicitação de acesso   → modelo "ficha do cliente" (local, contrato, gestor, dados da contratada, período com
                                 entrada/saída, áreas e serviço, relação de funcionários) ou "lista de acessos" (empresa,
                                 CNPJ, nome, início, saída, horário excepcional, fim de semana, atividade, observações).
   LGPD: RG e CPF NÃO são guardados. São digitados só na hora de imprimir e somem ao fechar a janela.
   Rota: #doc/<ATV-xxxx>. Estado salvo na chave a360docs; fotos no banco de arquivos do navegador. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const CAD=window.ArmantCadastros||{},NU=()=>window.ArmantNucleo||null,AC=()=>window.ArmantAcesso||null,CT=()=>window.ArmantControle||null;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const br=iso=>iso?iso.split('-').reverse().join('/'):'';
const MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const extenso=iso=>{const [y,m,d]=(iso||hoje()).split('-');return +d+' de '+MES[+m-1]+' de '+y;};
const demByCC=cc=>typeof CAD.demandas==='function'?CAD.demandas().find(d=>d.cc===cc):null;
const cliOf=d=>{const L=typeof CAD.clientes==='function'?CAD.clientes():[];return d?L.find(c=>c.id===d.cli)||null:null;};
const me=()=>AC()?AC().user():null;
const users=()=>AC()&&AC().users?AC().users():[];
const TIPOS=[['','Atividade'],['laudo','Criar laudo técnico'],['acesso','Solicitação de acesso']];
const TL=Object.fromEntries(TIPOS);

/* ---------- estado ---------- */
const S={docs:{},cfg:{empresa:{nome:'Armant Soluções em Climatização Ltda',cnpj:'13.591.585/0001-03',end:'',contato:'',fone:'',email:'',rt:''},assin:[{nome:'',cargo:'',reg:''},{nome:'',cargo:'',reg:''}],cidade:'Porto Alegre'}};
try{const s=JSON.parse(localStorage.getItem('a360docs')||'null');if(s){S.docs=s.docs||{};S.cfg={...S.cfg,...(s.cfg||{}),empresa:{...S.cfg.empresa,...((s.cfg||{}).empresa||{})}};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360docs',JSON.stringify(S));return true;}catch(e){say('Não foi possível salvar neste navegador.');return false;}};
const atv=id=>{const C=CT();return C?C.atividades().find(a=>a.id===id):null;};

function novoDoc(a){const d=demByCC(a.cc)||{},c=cliOf(d)||{};
 if(a.tipo==='laudo')return {tipo:'laudo',rev:0,emitidas:[],dest:[c.razao||'',c.setor||'',c.end||[c.cidade,c.uf].filter(Boolean).join('/')].filter(Boolean).join('\n'),aos:c.contato?('Aos cuidados de '+c.contato+(c.cargo?', '+c.cargo:'')):'',
  local:d.nome||'',endereco:[d.end,d.cidade&&d.cidade+(d.uf?'/'+d.uf:'')].filter(Boolean).join(' | '),contrato:d.aprovNum||'',
  intro:'Durante a visita técnica realizada em '+(d.nome||'[local]')+', foi verificado que ',eq:[{eq:'1',tipo:'',fab:'',cap:'',pat:'',tag:''}],situacao:'',cond:'',fotos:[],analise:'',conclusao:'',recom:'',data:hoje(),cidade:S.cfg.cidade,assin:JSON.parse(JSON.stringify(S.cfg.assin))};
 return {tipo:'acesso',modelo:c.razao&&/banrisul/i.test(c.razao)?'ficha':'ficha',local:d.nome||'',contrato:d.aprovNum||'',gestor:c.contato||'',empresa:{...S.cfg.empresa},
  periodo:[{dia:a.inicio||hoje(),ent:'08:00',sai:'18:00',areas:[],serv:a.titulo||''}],areas:['SAA','Peça forte','Retaguarda / cash','Demais áreas (saguão, arquivo, banheiros)'],
  pessoas:users().filter(u=>(u.obras||[]).includes(a.cc)&&['Campo','Engenharia'].includes(u.setor)).map(u=>({nome:u.nome,empresa:S.cfg.empresa.nome,cnpj:S.cfg.empresa.cnpj,ativ:u.funcao||'',ini:a.inicio||hoje(),fim:a.prazo||'',fds:'NÃO',hexc:'',obs:''}))};}
const docDe=a=>{if(!S.docs[a.id]){S.docs[a.id]=novoDoc(a);save();}return S.docs[a.id];};

/* ---------- editor ---------- */
const inp=(k,v,ph,w)=>'<label class="ob-field'+(w?' cad-wide':'')+'"><span>'+ph+'</span><input data-dc="'+k+'" value="'+esc(v)+'"></label>';
const area=(k,v,ph,rows,dica)=>'<label class="ob-field cad-wide"><span>'+ph+'</span><textarea data-dc="'+k+'" rows="'+(rows||4)+'">'+esc(v)+'</textarea>'+(dica?'<small class="cad-hint">'+dica+'</small>':'')+'</label>';
function edLaudo(D){return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Destinatário e identificação</h2></div></div><div class="ob-form">'+
  area('dest',D.dest,'Ao (cliente, setor e endereço, uma linha cada)',3)+inp('aos',D.aos,'Aos cuidados de',1)+inp('local',D.local,'LOCAL',1)+inp('endereco',D.endereco,'ENDEREÇO',1)+inp('contrato',D.contrato,'CONTRATO',1)+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Introdução</h2></div></div><div class="ob-form">'+area('intro',D.intro,'Texto',4)+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Equipamentos</h2><p>Tabela do laudo</p></div><button class="button outline fn-sm" data-dc-eqadd>+ equipamento</button></div><div class="table-wrap"><table class="ob-t dc-eq"><thead><tr><th>EQ.</th><th>Tipo</th><th>Fabricante</th><th>Capacidade</th><th>Patrimônio</th><th>Setor / sala / TAG</th><th></th></tr></thead><tbody>'+
  D.eq.map((e,i)=>'<tr>'+['eq','tipo','fab','cap','pat','tag'].map(k=>'<td><input data-dc-eq="'+i+'|'+k+'" value="'+esc(e[k])+'"></td>').join('')+'<td><button class="text-button" data-dc-eqdel="'+i+'" aria-label="Remover">×</button></td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Situação do equipamento</h2></div></div><div class="ob-form">'+area('situacao',D.situacao,'Situação',4)+area('cond',D.cond,'Condições observadas',5,'Uma por linha: vira a lista com marcadores.')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Fotos</h2><p>'+D.fotos.length+' foto(s) · aparecem numeradas no laudo</p></div><label class="button outline fn-sm dc-up">+ fotos<input type="file" accept="image/*" multiple data-dc-foto hidden></label></div><div class="dc-fotos">'+
  D.fotos.map((f,i)=>'<figure><img data-dc-img="'+f.id+'" alt=""><figcaption><input data-dc-leg="'+i+'" value="'+esc(f.leg)+'" placeholder="Legenda da foto '+(i+1)+'"></figcaption><button class="text-button" data-dc-fdel="'+i+'">Remover</button></figure>').join('')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Análise, conclusão e recomendações</h2></div></div><div class="ob-form">'+area('analise',D.analise,'Análise de viabilidade técnica e econômica',4)+area('conclusao',D.conclusao,'Conclusão',4)+area('recom',D.recom,'Recomendações',5,'Uma por linha.')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Local, data e assinaturas</h2></div></div><div class="ob-form">'+inp('cidade',D.cidade,'Cidade')+'<label class="ob-field"><span>Data</span><input type="date" data-dc="data" value="'+esc(D.data)+'"></label>'+
  D.assin.map((s,i)=>'<div class="ob-field cad-wide dc-as"><span>Assinatura '+(i+1)+'</span><input data-dc-as="'+i+'|nome" value="'+esc(s.nome)+'" placeholder="Nome"><input data-dc-as="'+i+'|cargo" value="'+esc(s.cargo)+'" placeholder="Cargo (ex.: Sócio administrador)"><input data-dc-as="'+i+'|reg" value="'+esc(s.reg)+'" placeholder="Registro (CREA, CAU)"></div>').join('')+
  '<label class="ob-check cad-wide"><input type="checkbox" data-dc-padrao> Guardar estas assinaturas como padrão dos próximos laudos</label></div></section>';}
function edAcesso(D){const E=D.empresa;
 return '<section class="panel ob-panel"><div class="panel-header"><div><h2>Modelo</h2></div></div><div class="filter-chips">'+[['ficha','Ficha de liberação de acesso (cliente)'],['lista','Lista de acessos da obra']].map(([k,l])=>'<button class="filter-chip'+(D.modelo===k?' active':'')+'" data-dc-mod="'+k+'">'+l+'</button>').join('')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Local e contrato</h2></div></div><div class="ob-form">'+inp('local',D.local,'Local',1)+inp('contrato',D.contrato,'Contrato nº')+inp('gestor',D.gestor,'Gestor do cliente')+'</div></section>'+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Dados da contratada</h2><p>Fica guardado para as próximas solicitações</p></div></div><div class="ob-form">'+[['nome','Nome da empresa',1],['cnpj','CNPJ'],['end','Endereço',1],['contato','Contato'],['fone','Telefone'],['email','E-mail'],['rt','Responsável técnico']].map(([k,l,w])=>'<label class="ob-field'+(w?' cad-wide':'')+'"><span>'+l+'</span><input data-dc-emp="'+k+'" value="'+esc(E[k])+'"></label>').join('')+'</div></section>'+
 (D.modelo==='ficha'?'<section class="panel ob-panel"><div class="panel-header"><div><h2>Período e áreas</h2><p>Marque as áreas que serão acessadas</p></div><button class="button outline fn-sm" data-dc-padd>+ dia</button></div><div class="table-wrap"><table class="ob-t dc-eq"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída</th>'+D.areas.map(x=>'<th>'+esc(x)+'</th>').join('')+'<th>Serviço que será executado</th><th></th></tr></thead><tbody>'+
  D.periodo.map((p,i)=>'<tr><td><input type="date" data-dc-p="'+i+'|dia" value="'+esc(p.dia)+'"></td><td><input type="time" data-dc-p="'+i+'|ent" value="'+esc(p.ent)+'"></td><td><input type="time" data-dc-p="'+i+'|sai" value="'+esc(p.sai)+'"></td>'+D.areas.map((x,j)=>'<td class="dc-c"><input type="checkbox" data-dc-pa="'+i+'|'+j+'"'+(p.areas.includes(j)?' checked':'')+' aria-label="'+esc(x)+'"></td>').join('')+'<td><input data-dc-p="'+i+'|serv" value="'+esc(p.serv)+'"></td><td><button class="text-button" data-dc-pdel="'+i+'">×</button></td></tr>').join('')+'</tbody></table></div></section>':'')+
 '<section class="panel ob-panel"><div class="panel-header"><div><h2>Relação de funcionários</h2><p>RG e CPF não ficam guardados: são digitados só na hora de imprimir (LGPD)</p></div><span><select data-dc-pick aria-label="Adicionar pessoa"><option value="">+ pessoa cadastrada</option>'+users().filter(u=>!D.pessoas.some(p=>p.nome===u.nome)).map(u=>'<option value="'+esc(u.id)+'">'+esc(u.nome)+' · '+esc(u.setor||'')+'</option>').join('')+'</select> <button class="button outline fn-sm" data-dc-pesadd>+ outra pessoa</button></span></div><div class="table-wrap"><table class="ob-t dc-eq"><thead><tr><th>Nome</th><th>Empresa</th>'+(D.modelo==='lista'?'<th>CNPJ</th><th>Início</th><th>Saída</th><th>Horário excepcional</th><th>Fins de semana</th>':'')+'<th>Atividade</th>'+(D.modelo==='lista'?'<th>Observações</th>':'')+'<th></th></tr></thead><tbody>'+
  D.pessoas.map((p,i)=>'<tr><td><input data-dc-pe="'+i+'|nome" value="'+esc(p.nome)+'"></td><td><input data-dc-pe="'+i+'|empresa" value="'+esc(p.empresa)+'"></td>'+(D.modelo==='lista'?'<td><input data-dc-pe="'+i+'|cnpj" value="'+esc(p.cnpj)+'"></td><td><input type="date" data-dc-pe="'+i+'|ini" value="'+esc(p.ini)+'"></td><td><input type="date" data-dc-pe="'+i+'|fim" value="'+esc(p.fim)+'"></td><td><input data-dc-pe="'+i+'|hexc" value="'+esc(p.hexc)+'"></td><td><select data-dc-pe="'+i+'|fds"><option>NÃO</option><option'+(p.fds==='SIM'?' selected':'')+'>SIM</option></select></td>':'')+'<td><input data-dc-pe="'+i+'|ativ" value="'+esc(p.ativ)+'"></td>'+(D.modelo==='lista'?'<td><input data-dc-pe="'+i+'|obs" value="'+esc(p.obs)+'"></td>':'')+'<td><button class="text-button" data-dc-pedel="'+i+'">×</button></td></tr>').join('')+'</tbody></table></div>'+(D.pessoas.length?'':'<p class="area-note">Nenhuma pessoa ainda.</p>')+'</section>';}
function pagina(a){const D=docDe(a),d=demByCC(a.cc);
 return '<a class="text-button ob-back" href="#controle/'+a.cc+'">← Controle de obras · '+a.cc+'</a>'+
 '<div class="view-intro ob-intro"><div><span class="ob-pill-real">'+esc(TL[a.tipo]||'documento')+'</span><h2>'+esc(a.titulo)+'</h2><p>'+esc(a.cc)+(d?' · '+esc(d.nome):'')+(D.tipo==='laudo'?' · revisão atual R'+String(D.rev).padStart(2,'0')+(D.emitidas.length?' · última emissão '+br(D.emitidas[D.emitidas.length-1].d):' · ainda não emitido'):'')+'. Tudo é salvo sozinho enquanto você digita.</p></div>'+ic('clipboard')+'</div>'+
 '<div class="dc-bar"><button class="button primary" data-dc-print>'+ic('download')+(D.tipo==='laudo'?'Visualizar e imprimir (PDF)':'Imprimir solicitação')+'</button>'+(D.tipo==='laudo'?'<button class="button outline" data-dc-emitir>Emitir R'+String(D.emitidas.length?D.rev+1:D.rev).padStart(2,'0')+' e concluir a tarefa</button>':'<button class="button outline" data-dc-emitir>Marcar como enviada e concluir a tarefa</button>')+(D.tipo==='acesso'&&D.modelo==='lista'?'<button class="button outline" data-dc-xlsx>Baixar Excel (sem CPF)</button>':'')+'</div>'+
 (D.tipo==='laudo'?edLaudo(D):edAcesso(D));}

/* ---------- impressão ---------- */
const lista=t=>String(t||'').split('\n').map(x=>x.replace(/^\s*[-•●*]\s*/,'').trim()).filter(Boolean);
const par=t=>String(t||'').split(/\n{2,}/).map(x=>'<p>'+esc(x).replace(/\n/g,'<br>')+'</p>').join('');
const logo=()=>{try{return new URL('assets/armant-logo.png',location.href).href;}catch(e){return 'assets/armant-logo.png';}};
const CSSP='@page{size:A4;margin:18mm 16mm}body{font-family:Roboto,Arial,sans-serif;color:#16282c;font-size:11pt;line-height:1.45}h1{text-align:center;font-size:15pt;letter-spacing:.5px;margin:18px 0 8px}h2{font-size:11.5pt;margin:16px 0 6px;text-transform:uppercase;color:#023c48}table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:6px 0}th,td{border:1px solid #9fb1b4;padding:4px 6px;text-align:left;vertical-align:top}th{background:#e9f0f1}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #023c48;padding-bottom:8px;margin-bottom:14px}.top img{height:42px;filter:brightness(0) saturate(100%) invert(15%) sepia(40%) saturate(2000%) hue-rotate(160deg)}.top small{color:#60767b;font-size:8.5pt;text-align:right}.id p{margin:2px 0}.fotos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fotos figure{margin:0;break-inside:avoid}.fotos img{width:100%;max-height:70mm;object-fit:contain;border:1px solid #ccd}.fotos figcaption{font-size:9pt;text-align:center;color:#334}.ass{display:flex;gap:30px;margin-top:40px;break-inside:avoid}.ass div{flex:1;text-align:center;font-size:9.5pt;border-top:1px solid #16282c;padding-top:4px}.data{text-align:center;margin-top:24px}.no-print{background:#fbf1e2;padding:10px;border-radius:8px;margin-bottom:12px;font-size:10pt}.no-print input{padding:4px;width:140px}@media print{.no-print{display:none}}.c{text-align:center}input.v{border:0;border-bottom:1px dotted #999;width:100%;font:inherit;background:transparent}';
async function fotosURL(D){const N=NU(),out=[];for(const f of D.fotos){try{const r=N&&N.files?await N.files.get(f.id):null;if(r&&r.blob)out.push({src:await new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.readAsDataURL(r.blob);}),leg:f.leg});}catch(e){}}return out;}
async function imprimir(a){const D=docDe(a),w=window.open('','_blank');if(!w){say('Libere as janelas (pop-up) para imprimir.');return;}
 const topo='<div class="top"><img src="'+logo()+'" alt="Armant"><small>'+esc(S.cfg.empresa.nome)+(S.cfg.empresa.cnpj?'<br>CNPJ '+esc(S.cfg.empresa.cnpj):'')+'</small></div>';
 let html;
 if(D.tipo==='laudo'){const F=await fotosURL(D),rev='R'+String(D.rev).padStart(2,'0');
  html=topo+'<div class="id"><p>Ao</p>'+lista(D.dest).map(x=>'<p><b>'+esc(x)+'</b></p>').join('')+(D.aos?'<p>'+esc(D.aos)+',</p>':'')+'</div><p>A '+esc(S.cfg.empresa.nome)+', infra-assinada, contratada para a elaboração de trabalho técnico de engenharia, tendo procedido às diligências que se fizeram necessárias, vem apresentar à consideração de V. Senhorias a conclusão a que chegou, por meio do seguinte:</p>'+
   '<h1>LAUDO TÉCNICO</h1><div class="id"><p><b>LOCAL:</b> '+esc(D.local)+'</p><p><b>ENDEREÇO:</b> '+esc(D.endereco)+'</p><p><b>CONTRATO:</b> '+esc(D.contrato)+'</p></div>'+
   '<h2>Introdução</h2>'+par(D.intro)+(D.eq.some(e=>e.tipo||e.fab||e.pat)?'<table><thead><tr><th>EQ.</th><th>TIPO</th><th>FABRICANTE</th><th>CAPACIDADE</th><th>PATRIMÔNIO</th><th>SETOR/SALA/TAG</th></tr></thead><tbody>'+D.eq.filter(e=>e.tipo||e.fab||e.cap||e.pat||e.tag).map(e=>'<tr><td class="c">'+esc(e.eq)+'</td><td>'+esc(e.tipo)+'</td><td>'+esc(e.fab)+'</td><td>'+esc(e.cap)+'</td><td>'+esc(e.pat)+'</td><td>'+esc(e.tag)+'</td></tr>').join('')+'</tbody></table>':'')+
   (D.situacao||D.cond?'<h2>Situação do equipamento</h2>'+par(D.situacao)+(lista(D.cond).length?'<p>Condições observadas:</p><ul>'+lista(D.cond).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''):'')+
   (F.length?'<div class="fotos">'+F.map((f,i)=>'<figure><img src="'+f.src+'" alt=""><figcaption>Foto '+(i+1)+(f.leg?' – '+esc(f.leg):'')+'</figcaption></figure>').join('')+'</div>':'')+
   (D.analise?'<h2>Análise de viabilidade técnica e econômica</h2>'+par(D.analise):'')+(D.conclusao?'<h2>Conclusão</h2>'+par(D.conclusao):'')+(lista(D.recom).length?'<h2>Recomendações</h2><ul>'+lista(D.recom).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
   '<p class="data">'+esc(D.cidade)+', '+extenso(D.data)+'</p><div class="ass">'+D.assin.filter(s=>s.nome).map(s=>'<div><b>'+esc(S.cfg.empresa.nome.toUpperCase())+'</b><br>'+esc(s.nome)+'<br>'+esc(s.cargo)+(s.reg?'<br>'+esc(s.reg):'')+'</div>').join('')+'</div>';
  w.document.title='Laudo técnico '+a.cc+' '+rev;}
 else{const E=D.empresa,ficha=D.modelo==='ficha';
  const aviso='<div class="no-print"><b>LGPD:</b> RG e CPF não ficam guardados no sistema. Preencha nesta janela antes de imprimir; ao fechar, eles somem.</div>';
  html=aviso+topo+(ficha?'<h1>SOLICITAÇÃO DE LIBERAÇÃO DE ACESSO</h1><div class="id"><p><b>Local:</b> '+esc(D.local)+'</p><p><b>Contrato nº:</b> '+esc(D.contrato)+'</p><p><b>Gestor:</b> '+esc(D.gestor)+'</p></div>'+
   '<h2>Dados da contratada</h2><div class="id">'+[['Nome da empresa',E.nome],['Endereço',E.end],['Contato',E.contato],['Telefone',E.fone],['E-mail',E.email],['Responsável técnico',E.rt]].map(([l,v])=>'<p><b>'+l+':</b> '+esc(v)+'</p>').join('')+'</div>'+
   '<h2>Período e áreas acessadas</h2><table><thead><tr><th>Dia/mês</th><th>Entrada</th><th>Saída</th>'+D.areas.map(x=>'<th>'+esc(x)+'</th>').join('')+'<th>Serviço que será executado</th></tr></thead><tbody>'+D.periodo.map(p=>'<tr><td>'+br(p.dia).slice(0,5)+'</td><td>'+esc(p.ent)+'</td><td>'+esc(p.sai)+'</td>'+D.areas.map((x,j)=>'<td class="c">'+(p.areas.includes(j)?'X':'')+'</td>').join('')+'<td>'+esc(p.serv)+'</td></tr>').join('')+'</tbody></table>'+
   '<h2>Relação de funcionários</h2><table><thead><tr><th>Nome</th><th style="width:22%">RG</th><th style="width:22%">CPF</th></tr></thead><tbody>'+D.pessoas.map(p=>'<tr><td>'+esc(p.nome)+'</td><td><input class="v" aria-label="RG"></td><td><input class="v" aria-label="CPF"></td></tr>').join('')+'</tbody></table>'
   :'<h1>CONTROLE DE ACESSO · '+esc(D.local.toUpperCase())+'</h1><p class="c">Data: '+br(hoje())+(D.contrato?' · Contrato '+esc(D.contrato):'')+'</p><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Nome</th><th>CPF</th><th>Início</th><th>Saída</th><th>Horário excepcional</th><th>Fins de semana</th><th>Atividade</th><th>Observações</th></tr></thead><tbody>'+D.pessoas.map(p=>'<tr><td>'+esc(p.empresa)+'</td><td>'+esc(p.cnpj)+'</td><td>'+esc(p.nome)+'</td><td><input class="v" aria-label="CPF"></td><td>'+br(p.ini)+'</td><td>'+br(p.fim)+'</td><td>'+esc(p.hexc)+'</td><td>'+esc(p.fds)+'</td><td>'+esc(p.ativ)+'</td><td>'+esc(p.obs)+'</td></tr>').join('')+'</tbody></table>')+
   '<p class="data">'+esc(S.cfg.cidade)+', '+extenso(hoje())+'</p><div class="ass"><div>'+esc(E.rt||E.contato||E.nome)+'<br>'+esc(E.nome)+'</div></div>';
  w.document.title='Solicitação de acesso '+a.cc;}
 w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+esc(w.document.title||'Documento')+'</title><style>'+CSSP+'</style></head><body>'+html+'<p class="no-print"><button onclick="print()">Imprimir / salvar em PDF</button></p></body></html>');w.document.close();}
async function baixarXlsx(a){const D=docDe(a);try{if(!window.XLSX)await new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=()=>ko(new Error('sem internet'));document.head.appendChild(s);});
 const L=[['CONTROLE DE ACESSO EFETIVO - '+D.local.toUpperCase()],['Data:',br(hoje())],[],['STATUS','EMPRESA','CNPJ','NOME','CPF','INÍCIO','SAÍDA','HORÁRIO EXCEPCIONAL','FINAIS DE SEMANA','ATIVIDADE','OBSERVAÇÕES'],...D.pessoas.map(p=>['ATIVO',p.empresa,p.cnpj,p.nome,'',br(p.ini),br(p.fim),p.hexc,p.fds,p.ativ,p.obs])];
 const ws=XLSX.utils.aoa_to_sheet(L),wb=XLSX.utils.book_new();ws['!cols']=[8,26,20,30,16,11,11,18,14,30,24].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws,'Controle de Acesso');XLSX.writeFile(wb,'Lista-de-acessos_'+a.cc+'.xlsx');say('Excel baixado. A coluna CPF vai em branco: preencha no arquivo, fora do sistema.');}catch(e){say('Não foi possível gerar o Excel: '+e.message);}}

/* ---------- roteador ---------- */
const prevRender=render;
render=function(){const [v,id]=location.hash.slice(1).split('/');
 if(v==='doc'){const a=atv(id),c=document.getElementById('view');
  document.getElementById('breadcrumb').textContent='Operação & CSC · Controle de obras · '+(a?TL[a.tipo]||'Documento':'Documento');document.getElementById('page-title').innerHTML=(a&&a.tipo==='acesso'?'Solicitação de acesso':'Laudo técnico')+'<span>.</span>';document.getElementById('page-subtitle').textContent=a?a.cc:'';
  if(!a||!a.tipo){c.innerHTML='<p class="area-note">Documento não encontrado. Abra pelo Controle de obras.</p>';return;}
  c.innerHTML=pagina(a);c.className='fade-in';carregarFotos(S.docs[a.id]);return;}
 prevRender();
 /* Controle de obras: tipo da tarefa no formulário e atalho para o documento nos cartões */
 if(v==='controle'){const f=document.getElementById('ct-form');if(f&&!f.querySelector('[name=tipo]')){const a=f.dataset.id?atv(f.dataset.id):null,t=f.querySelector('[name=titulo]');const lab=t&&t.closest('label');
   if(lab)lab.insertAdjacentHTML('beforebegin','<label class="ob-field cad-wide"><span>Tipo de tarefa</span><select name="tipo" id="dc-tipo">'+TIPOS.map(([k,l])=>'<option value="'+k+'"'+((a&&a.tipo||'')===k?' selected':'')+'>'+l+'</option>').join('')+'</select><small class="cad-hint">Laudo técnico e solicitação de acesso abrem um documento para preencher e imprimir.</small></label>');}
  document.querySelectorAll('[data-ct-id]').forEach(el=>{const a=atv(el.dataset.ctId);if(a&&a.tipo&&!el.querySelector('.dc-open'))el.insertAdjacentHTML('beforeend','<a class="button outline fn-sm dc-open" href="#doc/'+a.id+'">'+(a.tipo==='laudo'?'📄 Abrir laudo':'🪪 Abrir solicitação')+'</a>');});}};
async function carregarFotos(D){if(!D||!D.fotos||!D.fotos.length)return;const N=NU();for(const f of D.fotos){const img=document.querySelector('[data-dc-img="'+f.id+'"]');if(!img||!N||!N.files)continue;try{const r=await N.files.get(f.id);if(r&&r.blob)img.src=URL.createObjectURL(r.blob);}catch(e){}}}

/* tipo da tarefa: o formulário do Controle salva a atividade; aqui guardamos o tipo nela */
document.addEventListener('change',e=>{if(e.target.id!=='dc-tipo')return;const f=e.target.form,t=f.elements.titulo,cc=f.elements.cc&&f.elements.cc.value,d=demByCC(cc);if(e.target.value&&t&&!t.value)t.value=(e.target.value==='laudo'?'Laudo técnico':'Solicitação de acesso')+(d?' · '+String(d.nome||cc).slice(0,50):'');},true);
document.addEventListener('submit',e=>{const f=e.target;if(f.id!=='ct-form')return;const tp=f.elements.tipo?f.elements.tipo.value:'';const antes=new Set((CT()?CT().atividades():[]).map(a=>a.id)),id=f.dataset.id;
 setTimeout(()=>{const C=CT();if(!C)return;const a=id?atv(id):C.atividades().find(x=>!antes.has(x.id));if(!a)return;if((a.tipo||'')!==tp){if(tp)a.tipo=tp;else delete a.tipo;C.save();
  if(tp)say(TL[tp]+': abra pelo botão no cartão da tarefa.');render();}},0);},true);

/* ---------- edição (salva sozinho) ---------- */
const on=()=>location.hash.startsWith('#doc/');
const cur=()=>{const a=atv(location.hash.split('/')[1]);return a?{a,D:docDe(a)}:null;};
const refresh=()=>{const y=window.scrollY;render();window.scrollTo(0,y);};
let tmr=null;const salvarDepois=()=>{clearTimeout(tmr);tmr=setTimeout(save,300);};
document.addEventListener('input',e=>{if(!on())return;const c=cur();if(!c)return;const t=e.target,d=t.dataset,D=c.D;
 if(d.dc){D[d.dc]=t.value;salvarDepois();return;}
 if(d.dcEq){const [i,k]=d.dcEq.split('|');D.eq[+i][k]=t.value;salvarDepois();return;}
 if(d.dcLeg){D.fotos[+d.dcLeg].leg=t.value;salvarDepois();return;}
 if(d.dcAs){const [i,k]=d.dcAs.split('|');D.assin[+i][k]=t.value;salvarDepois();return;}
 if(d.dcEmp){D.empresa[d.dcEmp]=t.value;S.cfg.empresa[d.dcEmp]=t.value;salvarDepois();return;}
 if(d.dcP){const [i,k]=d.dcP.split('|');D.periodo[+i][k]=t.value;salvarDepois();return;}
 if(d.dcPe){const [i,k]=d.dcPe.split('|');D.pessoas[+i][k]=t.value;salvarDepois();return;}});
document.addEventListener('change',async e=>{if(!on())return;const c=cur();if(!c)return;const t=e.target,d=t.dataset,D=c.D;
 if(d.dcPa){const [i,j]=d.dcPa.split('|').map(Number),p=D.periodo[i];p.areas=t.checked?[...new Set([...p.areas,j])]:p.areas.filter(x=>x!==j);save();return;}
 if(d.dcPe&&t.tagName==='SELECT'){const [i,k]=d.dcPe.split('|');D.pessoas[+i][k]=t.value;save();return;}
 if(d.dcPadrao!==undefined&&t.checked){S.cfg.assin=JSON.parse(JSON.stringify(D.assin));S.cfg.cidade=D.cidade;save();say('Assinaturas guardadas como padrão.');return;}
 if(d.dcPick!==undefined&&t.value){const u=users().find(x=>x.id===t.value);if(u)D.pessoas.push({nome:u.nome,empresa:S.cfg.empresa.nome,cnpj:S.cfg.empresa.cnpj,ativ:u.funcao||'',ini:c.a.inicio||hoje(),fim:c.a.prazo||'',fds:'NÃO',hexc:'',obs:''});save();refresh();return;}
 if(d.dcFoto!==undefined){const N=NU();if(!N||!N.files){say('Banco de arquivos indisponível.');return;}let n=0;for(const f of [...t.files]){if(!/^image\//.test(f.type))continue;if(f.size>8e6){say(f.name+' passa de 8 MB.');continue;}const id='DOCF-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);await N.files.put({id,blob:f,mime:f.type,nome:f.name});D.fotos.push({id,leg:''});n++;}save();refresh();if(n)say(n+' foto(s) incluída(s).');}});
document.addEventListener('click',e=>{if(!on())return;const t=e.target.closest('[data-dc-eqadd],[data-dc-eqdel],[data-dc-fdel],[data-dc-mod],[data-dc-padd],[data-dc-pdel],[data-dc-pesadd],[data-dc-pedel],[data-dc-print],[data-dc-emitir],[data-dc-xlsx]');if(!t)return;const c=cur();if(!c)return;const d=t.dataset,D=c.D;
 if(d.dcEqadd!==undefined){D.eq.push({eq:String(D.eq.length+1),tipo:'',fab:'',cap:'',pat:'',tag:''});}
 else if(d.dcEqdel){D.eq.splice(+d.dcEqdel,1);}
 else if(d.dcFdel){const f=D.fotos.splice(+d.dcFdel,1)[0];const N=NU();if(f&&N&&N.files)N.files.del(f.id).catch(()=>{});}
 else if(d.dcMod){D.modelo=d.dcMod;}
 else if(d.dcPadd!==undefined){const u=D.periodo[D.periodo.length-1]||{};const nx=u.dia?new Date(new Date(u.dia+'T12:00:00Z').getTime()+864e5).toISOString().slice(0,10):hoje();D.periodo.push({dia:nx,ent:u.ent||'08:00',sai:u.sai||'18:00',areas:(u.areas||[]).slice(),serv:u.serv||''});}
 else if(d.dcPdel){D.periodo.splice(+d.dcPdel,1);}
 else if(d.dcPesadd!==undefined){D.pessoas.push({nome:'',empresa:'',cnpj:'',ativ:'',ini:c.a.inicio||hoje(),fim:c.a.prazo||'',fds:'NÃO',hexc:'',obs:''});}
 else if(d.dcPedel){D.pessoas.splice(+d.dcPedel,1);}
 else if(d.dcPrint!==undefined){save();imprimir(c.a);return;}
 else if(d.dcXlsx!==undefined){save();baixarXlsx(c.a);return;}
 else if(d.dcEmitir!==undefined){if(D.tipo==='laudo'){if(!D.conclusao.trim())return say('Escreva a conclusão antes de emitir.');if(D.emitidas.length)D.rev++;D.emitidas.push({rev:D.rev,d:hoje(),por:me()?me().nome:''});}
  else{if(!D.pessoas.some(p=>p.nome))return say('Inclua ao menos uma pessoa.');D.enviada={d:hoje(),por:me()?me().nome:''};}
  save();const C=CT(),a=c.a;if(C&&a.cls!=='concluido'){a.cls='concluido';a.concl=hoje();(a.hist=a.hist||[]).push({d:hoje(),t:(D.tipo==='laudo'?'laudo emitido R'+String(D.rev).padStart(2,'0'):'solicitação de acesso enviada')+(me()?' · '+me().nome:'')});C.save();}
  const N=NU();if(N&&a.por)N.notify(a.por,{tipo:'aviso',titulo:(D.tipo==='laudo'?'Laudo emitido':'Solicitação de acesso pronta')+' · '+a.cc,texto:a.titulo,link:'#doc/'+a.id,pop:false});
  refresh();say(D.tipo==='laudo'?'Laudo R'+String(D.rev).padStart(2,'0')+' emitido. Tarefa concluída.':'Solicitação marcada como enviada. Tarefa concluída.');return;}
 save();refresh();});

window.ArmantDocs={version:'1.0',state:S,TIPOS,doc:id=>{const a=atv(id);return a&&a.tipo?docDe(a):null;},imprimir:id=>{const a=atv(id);if(a)imprimir(a);}};
})();
