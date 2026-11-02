/* Armant 360 · Certificado digital A1 (extensão do Financeiro → Notas fiscais)
   Carregar depois de financeiro.js:  <script src="certificado.js" defer></script>
   - Lê o arquivo .pfx/.p12 com a senha NO NAVEGADOR e mostra titular, CNPJ, emissor e validade.
   - A senha nunca é guardada. O arquivo só é guardado se a pessoa pedir: no protótipo, neste aparelho
     (IndexedDB próprio, fora da sincronização); no site com servidor, no cofre "certificados" (só superadmin e gestão do Financeiro).
   - Avisa antes de expirar (60, 30, 15, 7, 3 e 1 dia, no dia e toda semana depois de vencido): aviso no app e e-mail
     para o superadmin e a gestão do Financeiro. No servidor, a mesma checagem roda todo dia sozinha (pg_cron). */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const ic=n=>typeof icon==='function'?icon(n):'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>typeof toast==='function'?toast(m):null;
const hoje=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const br=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'—';
const dig=s=>String(s||'').replace(/\D/g,'');
const cnpjFmt=v=>{const d=dig(v);return d.length===14?d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):v;};
const AC=()=>window.ArmantAcesso||null,NU=()=>window.ArmantNucleo||null,FIN=()=>window.ArmantFinanceiro||null;
const me=()=>AC()?AC().user():null;
const LIMITES=[60,30,15,7,3,1,0];

/* ---------- estado: só dados públicos do certificado (sem senha, sem chave) ---------- */
const S={atual:null,hist:[],avisos:{}};
try{const s=JSON.parse(localStorage.getItem('a360cert')||'null');if(s){S.atual=s.atual||null;S.hist=Array.isArray(s.hist)?s.hist:[];S.avisos=s.avisos||{};}}catch(e){}
const save=()=>{try{localStorage.setItem('a360cert',JSON.stringify(S));}catch(e){}};
const dias=c=>c?Math.floor((new Date(c.ate+'T12:00')-new Date(hoje()+'T12:00'))/864e5):null;
const pode=()=>{const A=AC(),u=me();if(!A||!u)return true;return u.nivel>=6||(A.can('finance')&&u.nivel>=4);};
const situacao=c=>{const d=dias(c);return d==null?['','—']:d<0?['ce-venc','vencido há '+(-d)+' dia(s)']:d===0?['ce-venc','vence hoje']:d<=15?['ce-urg','vence em '+d+' dia(s)']:d<=60?['ce-at','vence em '+d+' dias']:['ce-ok','válido por mais '+d+' dias'];};

/* ---------- arquivo: IndexedDB próprio (não sincroniza) ou cofre do servidor ---------- */
function idb(){return new Promise((ok,ko)=>{const r=indexedDB.open('a360cert',1);r.onupgradeneeded=()=>r.result.createObjectStore('arq',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});}
async function guardarArquivo(id,blob,nome){const P=window.ArmantPonte;
 if(P&&P.sb){const up=await P.sb.storage.from('certificados').upload(id+'/'+nome.replace(/[^\w.-]+/g,'_'),blob,{upsert:true,contentType:'application/x-pkcs12'});if(up.error)throw up.error;return 'servidor';}
 const db=await idb();await new Promise((ok,ko)=>{const tx=db.transaction('arq','readwrite');tx.objectStore('arq').put({id,blob,nome});tx.oncomplete=ok;tx.onerror=()=>ko(tx.error);});return 'aparelho';}
async function lerArquivo(c){const P=window.ArmantPonte;
 if(c.onde==='servidor'&&P&&P.sb){const dl=await P.sb.storage.from('certificados').download(c.id+'/'+c.arquivo.replace(/[^\w.-]+/g,'_'));if(dl.error)throw dl.error;return dl.data;}
 const db=await idb();return new Promise((ok,ko)=>{const tx=db.transaction('arq','readonly'),r=tx.objectStore('arq').get(c.id);r.onsuccess=()=>ok(r.result?r.result.blob:null);r.onerror=()=>ko(r.error);});}

/* ---------- leitura do .pfx (node-forge, só no navegador) ---------- */
function carregarForge(){return window.forge?Promise.resolve(window.forge):new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/forge/1.3.1/forge.min.js';s.onload=()=>ok(window.forge);s.onerror=()=>ko(new Error('Não foi possível carregar o leitor de certificados.'));document.head.appendChild(s);});}
async function lerPfx(file,senha){const forge=await carregarForge(),buf=new Uint8Array(await file.arrayBuffer());let bin='';for(let i=0;i<buf.length;i+=8192)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));
 let p12;try{p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bin),senha);}catch(e){throw new Error(/password|MAC|Invalid/i.test(e.message)?'Senha incorreta para este certificado.':'Este arquivo não é um certificado A1 (.pfx ou .p12).');}
 const certs=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).map(b=>b.cert).filter(Boolean);
 const chaves=(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]).concat(p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[]);
 if(!certs.length)throw new Error('Nenhum certificado dentro do arquivo.');
 if(!chaves.length)throw new Error('O arquivo não tem a chave privada: não é um certificado A1 completo.');
 // o certificado da empresa é o que não é autoridade certificadora
 const c=certs.find(x=>{const e=x.getExtension('basicConstraints');return !e||!e.cA;})||certs[0];
 const at=(o,n)=>{const f=o.getField(n);return f?String(f.value):'';};
 const cn=at(c.subject,'CN'),san=c.getExtension('subjectAltName');let cnpj='';
 if(san&&san.altNames)san.altNames.forEach(a=>{if(a.type===0&&a.value)try{const raw=forge.asn1.toDer(a.value).getBytes();const m=raw.match(/\d{14}/);if(raw.indexOf('2.16.76.1.3.3')>=0||/\x06\x05\x60\x4c\x01\x03\x03/.test(raw))if(m)cnpj=m[0];}catch(e){}});
 if(!cnpj){const m=cn.match(/(\d{14})/);if(m)cnpj=m[1];}
 const der=forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(),md=forge.md.sha256.create();md.update(der);
 const iso=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
 return {titular:cn.replace(/:\d{11,14}$/,''),cn,cnpj,emissor:at(c.issuer,'CN')||at(c.issuer,'O'),serie:c.serialNumber,impressao:md.digest().toHex().toUpperCase().match(/.{2}/g).join(':'),de:iso(c.validity.notBefore),ate:iso(c.validity.notAfter),tipo:'A1'};}

/* ---------- avisos de vencimento ---------- */
const destinatarios=()=>{const A=AC();return A?A.users().filter(u=>u.nivel>=6||(u.setor==='Financeiro'&&u.nivel>=4)).map(u=>u.id):[];};
function checarAvisos(){const c=S.atual,N=NU();if(!c||!N)return;const d=dias(c);
 const chave=d<0?'v'+Math.floor(-d/7):String(LIMITES.filter(t=>d<=t).pop());if(d>LIMITES[0]||S.avisos[c.id+':'+chave])return;
 LIMITES.filter(t=>d<=t).forEach(t=>{S.avisos[c.id+':'+t]=hoje();});S.avisos[c.id+':'+chave]=hoje();save();
 const txt=(d<0?'O certificado digital A1 da '+c.titular+' VENCEU em '+br(c.ate)+'. Sem ele não dá para assinar notas fiscais.':d===0?'O certificado digital A1 da '+c.titular+' vence HOJE ('+br(c.ate)+').':'O certificado digital A1 da '+c.titular+' vence em '+d+' dia(s), em '+br(c.ate)+'.')+' Providencie a renovação com a certificadora ('+c.emissor+') e depois inclua o novo em Financeiro → Notas fiscais.';
 N.notify(destinatarios(),{tipo:'tarefa',email:true,self:true,titulo:d<0?'Certificado A1 vencido':d===0?'Certificado A1 vence hoje':'Certificado A1 vence em '+d+' dia(s)',texto:txt,link:'#finance/notas'});}

/* ---------- tela ---------- */
const V={erro:'',lendo:false,guardar:true};
function painel(){const c=S.atual,[cl,tx]=situacao(c),ed=pode();
 const form=ed?'<form id="ce-form" class="ce-form" novalidate><label class="ob-field"><span>Arquivo do certificado A1 (.pfx ou .p12)</span><input type="file" name="arq" accept=".pfx,.p12,application/x-pkcs12" required></label><label class="ob-field"><span>Senha do certificado</span><input type="password" name="senha" autocomplete="off" required></label>'+
  '<label class="ob-check cad-wide"><input type="checkbox" name="guardar"'+(V.guardar?' checked':'')+'> Guardar o arquivo no sistema '+(window.ArmantPonte?'(cofre do servidor: só superadmin e gestão do Financeiro abrem)':'(só neste aparelho)')+'</label>'+
  '<p class="area-note cad-wide">A senha é usada só agora, para ler o certificado, e não fica guardada. '+(window.ArmantPonte?'':'No protótipo o arquivo não vai para nenhum outro aparelho.')+'</p><p class="cad-err cad-wide" id="ce-err" role="alert">'+esc(V.erro)+'</p><div class="ob-actions cad-wide"><button class="button primary" type="submit"'+(V.lendo?' disabled':'')+'>'+ic('shield')+(V.lendo?'Lendo…':c?'Incluir o certificado renovado':'Incluir certificado A1')+'</button></div></form>':'<p class="ob-p">Só o superadmin e a gestão do Financeiro incluem o certificado.</p>';
 const ficha=c?'<div class="ce-card '+cl+'"><div class="ce-top"><div><span class="ce-k">Certificado digital '+esc(c.tipo||'A1')+'</span><strong>'+esc(c.titular)+'</strong><small>CNPJ '+esc(cnpjFmt(c.cnpj)||'não identificado')+' · emitido por '+esc(c.emissor)+'</small></div><span class="ce-st">'+tx+'</span></div>'+
  '<dl class="ce-dl"><dt>Válido de</dt><dd>'+br(c.de)+'</dd><dt>Válido até</dt><dd><b>'+br(c.ate)+'</b></dd><dt>Nº de série</dt><dd class="ob-code">'+esc(c.serie)+'</dd><dt>Impressão digital (SHA-256)</dt><dd class="ob-code ce-fp">'+esc(c.impressao)+'</dd><dt>Incluído</dt><dd>'+br(c.em)+' por '+esc(c.por||'—')+'</dd><dt>Arquivo</dt><dd>'+(c.onde?'guardado '+(c.onde==='servidor'?'no cofre do servidor':'neste aparelho'):'não guardado (fica com a empresa)')+'</dd></dl>'+
  (c.aviso?'<p class="ce-warn">'+esc(c.aviso)+'</p>':'')+(ed?'<div class="ob-actions">'+(c.onde?'<button class="button outline fn-sm" data-ce-baixar>'+ic('download')+'Baixar arquivo .pfx</button>':'')+'<button class="text-button" data-ce-rem>Remover certificado</button></div>':'')+'</div>'
  :'<p class="ob-p">Nenhum certificado incluído. Inclua o A1 da Armant para o sistema avisar antes de ele expirar.</p>';
 return '<section class="panel ob-panel ce-panel" id="ce-panel"><div class="panel-header"><div><h2>Certificado digital A1</h2><p>Assina as notas fiscais. O sistema avisa 60, 30, 15, 7, 3 e 1 dia antes de vencer (no app e por e-mail).</p></div></div><div class="ce-grid">'+ficha+form+'</div>'+
  (S.hist.length?'<details class="ce-hist"><summary>Certificados anteriores ('+S.hist.length+')</summary><ul>'+S.hist.slice().reverse().map(h=>'<li>'+esc(h.titular)+' · válido até '+br(h.ate)+' · substituído em '+br(h.sub)+'</li>').join('')+'</ul></details>':'')+'</section>';}
function faixa(){const c=S.atual,d=dias(c);if(!c||d>30)return '';const [cl,tx]=situacao(c);return '<div class="ce-faixa '+cl+'" role="alert">'+ic('shield')+'<span><b>Certificado A1 '+tx+'</b> ('+br(c.ate)+'). Renove com a certificadora e inclua o novo em Notas fiscais.</span><a class="button outline fn-sm" href="#finance/notas">Ver</a></div>';}

/* ---------- integra no Financeiro ---------- */
const prevRender=render;
render=function(){prevRender.apply(this,arguments);const [v,a]=location.hash.slice(1).split('/'),c=document.getElementById('view');
 if(v==='finance'&&c){if(a==='notas'&&!c.querySelector('#ce-panel')){const k=c.querySelector('.kpi-grid');(k||c.firstElementChild||c).insertAdjacentHTML(k?'afterend':'afterbegin',painel());}
  if(!c.querySelector('.ce-faixa')){const f=faixa();if(f)c.insertAdjacentHTML('afterbegin',f);}}
 if(me())checarAvisos();};
const repintar=()=>{const p=document.getElementById('ce-panel');if(p)p.outerHTML=painel();const f=document.querySelector('.ce-faixa');if(f)f.outerHTML=faixa()||'';};
document.addEventListener('submit',async e=>{const f=e.target;if(f.id!=='ce-form')return;e.preventDefault();if(!pode())return;
 const file=f.elements.arq.files[0],senha=f.elements.senha.value;V.guardar=f.elements.guardar.checked;V.erro='';
 if(!file){V.erro='Escolha o arquivo .pfx ou .p12.';repintar();return;}if(!senha){V.erro='Digite a senha do certificado.';repintar();return;}
 V.lendo=true;repintar();
 try{const info=await lerPfx(file,senha);const id='CERT-'+Date.now().toString(36);
  if(info.ate<hoje())throw new Error('Este certificado já venceu em '+br(info.ate)+'. Inclua o certificado renovado.');
  const emit=dig(((FIN()&&FIN().state&&FIN().state.cfg)||{}).cnpj);
  const c={id,...info,arquivo:file.name,em:hoje(),por:(me()||{}).nome||'',onde:'',aviso:emit&&info.cnpj&&emit!==info.cnpj?'Atenção: o CNPJ do certificado ('+cnpjFmt(info.cnpj)+') é diferente do CNPJ do emitente cadastrado ('+cnpjFmt(emit)+').':''};
  if(V.guardar)c.onde=await guardarArquivo(id,file,file.name);
  if(S.atual)S.hist.push({...S.atual,sub:hoje()});S.atual=c;save();
  const N=NU();if(N&&N.log)N.log('Financeiro','criou','Certificado A1 incluído: '+c.titular+' · válido até '+br(c.ate));
  V.lendo=false;repintar();say('Certificado lido: '+c.titular+', válido até '+br(c.ate)+'.');checarAvisos();}
 catch(err){V.lendo=false;V.erro=err.message||'Não foi possível ler o certificado.';repintar();}
 finally{f.elements&&f.elements.senha&&(f.elements.senha.value='');}});
document.addEventListener('click',async e=>{const t=e.target.closest('[data-ce-baixar],[data-ce-rem]');if(!t||!pode())return;
 if(t.dataset.ceRem!==undefined){if(t.dataset.ok!=='1'){t.dataset.ok='1';t.textContent='Confirmar remoção';return;}S.hist.push({...S.atual,sub:hoje()});S.atual=null;save();repintar();say('Certificado removido do sistema.');return;}
 try{const b=await lerArquivo(S.atual);if(!b)throw new Error();const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=S.atual.arquivo||'certificado.pfx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
  const N=NU();if(N&&N.log)N.log('Financeiro','alterou','Arquivo do certificado A1 baixado');}catch(err){say('Arquivo não encontrado '+(S.atual&&S.atual.onde==='aparelho'?'neste aparelho (foi guardado em outro).':'.'));}});

window.ArmantCertificado={version:'1.0',state:S,dias:()=>dias(S.atual),checarAvisos,lerPfx};
})();
