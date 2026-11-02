// Teste da ponte (fase 1) com um Supabase simulado: dois navegadores = duas pessoas, servidor em memória aqui no Node
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WEB = process.argv[2], BK = require(process.argv[3]);
const srvState = { estado: {}, perfis: {}, sol: [], storage: {}, aud: [] };
for (const [k, v] of Object.entries(BK.dados)) if (k !== 'a360tour') srvState.estado[k] = { dados: JSON.parse(v), versao: 1, por: 'USR-001' };
if (process.argv[5]) { const t = fs.readFileSync(process.argv[5], 'utf8'); srvState.estado.a360eap = { dados: JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, '')), versao: 1, por: 'importação' }; }
for (const u of JSON.parse(BK.dados.a360acesso).users) srvState.perfis[u.email] = { id: u.id, nome: u.nome, email: u.email, nivel: u.nivel, setor: u.setor, funcao: u.funcao || '', obras: u.obras || [], ativo: true };
const pages = [];
const broadcast = async (table, eventType, row) => { for (const p of pages) { try { await p.evaluate(([t, e, r]) => (window.__rt || []).forEach(c => c.table === t && (!c.event || c.event === '*' || c.event === e) && c.fn({ eventType: e, new: r, old: {} })), [table, eventType, row]); } catch (e) {} } };
async function srv(email, op, a, b) {
  const p = srvState.perfis[email];
  if (op === 'rpc') {
    if (a === 'vincular_login') { if (!p) { if (!srvState.sol.some(s => s.email === email)) { const s = { id: 'abcdef12-' + Date.now(), nome: email.split('@')[0], email, status: 'pendente', criado_em: new Date().toISOString() }; srvState.sol.push(s); setTimeout(() => broadcast('solicitacoes_acesso', 'INSERT', s), 50); } return { data: null }; } return { data: p }; }
    if (a === 'pode') return { data: !!p && (p.nivel >= 5 || b.mod !== 'acesso') };
    if (a === 'salvar_estado') {
      if (!p) return { error: { message: 'Sem acesso.' } };
      if (b.p_chave === 'a360acesso' && p.nivel < 5) return { error: { message: 'Só a gestão de acessos altera usuários.' } };
      const at = srvState.estado[b.p_chave];
      if (!at) { srvState.estado[b.p_chave] = { dados: b.p_dados, versao: 1, por: p.id }; broadcast('estado_modulo', 'INSERT', { chave: b.p_chave, versao: 1 }); return { data: { ok: true, versao: 1 } }; }
      if (b.p_versao !== at.versao) return { data: { ok: false, conflito: true, versao: at.versao, dados: at.dados } };
      at.dados = b.p_dados; at.versao++; at.por = p.id; srvState.aud.push({ id: srvState.aud.length + 1, em: new Date().toISOString(), usuario_nome: p.nome, operacao: 'UPDATE', tabela: 'estado_modulo', registro: b.p_chave });
      const v = at.versao; setTimeout(() => broadcast('estado_modulo', 'UPDATE', { chave: b.p_chave, versao: v }), 30); return { data: { ok: true, versao: v } };
    }
    if (a === 'sincronizar_perfis') { for (const u of b.p_usuarios) srvState.perfis[u.email] = { ...(srvState.perfis[u.email] || {}), ...u }; return { data: b.p_usuarios.length }; }
    if (a === 'super_sql') return p && p.nivel >= 6 ? { data: { linhas: Object.entries(srvState.estado).map(([chave, x]) => ({ chave, versao: x.versao })) } } : { error: { message: 'Só o superadmin' } };
    return { error: { message: 'rpc ' + a } };
  }
  if (op === 'from') {
    const { table, ops } = a;
    if (table === 'estado_modulo' && ops.select) return { data: Object.entries(srvState.estado).map(([chave, x]) => ({ chave, dados: x.dados, versao: x.versao, atualizado_por: x.por })) };
    if (table === 'solicitacoes_acesso') return { data: p && p.nivel >= 5 ? srvState.sol.filter(s => s.status === 'pendente') : [] };
    if (table === 'auditoria') return { data: srvState.aud.slice().reverse() };
    return { data: [] };
  }
  if (op === 'upload') { srvState.storage[a] = b; return { data: { path: a } }; }
  if (op === 'download') return srvState.storage[a] ? { data: srvState.storage[a] } : { error: { message: 'not found' } };
  if (op === 'admin') return { data: { perfis: Object.values(srvState.perfis), logins: Object.keys(srvState.perfis).map(e => ({ id: e, email: e, ultimo_acesso: '2026-10-28T10:00', bloqueado: false })) } };
  return { error: { message: 'op ' + op } };
}
const MOCK = `window.supabase={createClient:function(){var em=function(){var t=localStorage.getItem('sb-mock-auth-token');return t?JSON.parse(t).user.email:null;};
 var call=function(op,a,b){return window.__srv(em(),op,a,b);};
 function qb(table){var ops={};var q={select:function(c){ops.select=c||'*';return q;},eq:function(k,v){(ops.eq=ops.eq||[]).push([k,v]);return q;},order:function(){return q;},limit:function(){return q;},delete:function(){ops.del=1;return q;},then:function(ok,ko){return call('from',{table:table,ops:ops}).then(ok,ko);}};return q;}
 return {auth:{getSession:async function(){var e=em();return {data:{session:e?{user:{email:e}}:null}};},signInWithOAuth:async function(){window.__oauth=1;},signOut:async function(){localStorage.removeItem('sb-mock-auth-token');},setSession:async function(){},onAuthStateChange:function(){}},
  rpc:function(n,a){return call('rpc',n,a);},from:qb,
  storage:{from:function(bk){return {upload:async function(p,blob){var t=await blob.text();return call('upload',bk+'/'+p,{t:t,type:blob.type});},download:async function(p){var r=await call('download',bk+'/'+p);if(r.data)r.data=new Blob([r.data.t],{type:r.data.type});return r;},remove:async function(){return {};}};}},
  functions:{invoke:async function(n,o){return call('admin',o.body);}},
  channel:function(){var c={on:function(kind,f,fn){(window.__rt=window.__rt||[]).push({table:f.table,event:f.event,fn:fn});return c;},subscribe:function(){return c;}};return c;}};}};`;
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  if (u === '/config.js') { res.end("window.A360_CONFIG={url:'https://mock.supabase.co',anonKey:'x'};"); return; }
  const f = path.join(WEB, u); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(0);
const BASE = 'http://localhost:' + server.address().port + '/';
const ok = (n, c) => console.log((c ? 'ok   ' : 'FALHA') + ' ' + n);
// a página recarrega sozinha quando chega mudança de outra pessoa: repete a leitura se cair no meio
async function E(p, fn, arg) { for (let i = 0; ; i++) { try { await p.waitForLoadState('load'); return await p.evaluate(fn, arg); } catch (e) { if (i > 8 || !/context was destroyed|navigation/i.test(e.message)) throw e; await p.waitForTimeout(500); } } }
(async () => {
  const br = await chromium.launch(), errs = [];
  async function pessoa(email) {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route('**/supabase.min.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
    await ctx.exposeFunction('__srv', srv);
    if (email) await ctx.addInitScript(e => { if (!sessionStorage.getItem('__ini')) { sessionStorage.setItem('__ini', 1); localStorage.setItem('sb-mock-auth-token', JSON.stringify({ user: { email: e } })); } }, email);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(email + ': ' + e.message)); pages.push(p);
    await p.goto(BASE); await p.waitForTimeout(2500);
    if (await p.locator('[data-tr=skip]').count()) await p.click('[data-tr=skip]').catch(() => {});
    return p;
  }
  const ls = (p, k) => E(p, k => JSON.parse(localStorage.getItem(k) || 'null'), k);
  const A = await pessoa('valentim.arr@gmail.com');
  ok('A entrou como Valentim (sessão do perfil USR-001)', (await E(A, () => (window.ArmantAcesso.user() || {}).id)) === 'USR-001');
  ok('A sem tela de login da ponte', !(await A.locator('#a360-pt').count()));
  ok('A recebeu os dados do servidor', (await ls(A, 'a360cad')).cli.length === srvState.estado.a360cad.dados.cli.length);
  const B = await pessoa('financeiro.teste@gmail.com');
  ok('B entrou como USR-002', (await E(B, () => (window.ArmantAcesso.user() || {}).id)) === 'USR-002');
  // A muda um módulo: B recebe em tempo real
  const n0 = srvState.estado.a360cad.dados.cli.length;
  await E(A, () => { const c = JSON.parse(localStorage.getItem('a360cad')); c.cli.push({ id: 'CLI-A1', razao: 'Cliente do A' }); localStorage.setItem('a360cad', JSON.stringify(c)); });
  await A.waitForTimeout(2500);
  ok('servidor recebeu a mudança do A (versão 2)', srvState.estado.a360cad.versao === 2 && srvState.estado.a360cad.dados.cli.length === n0 + 1);
  await B.waitForTimeout(1500);
  ok('B recebeu a mudança do A sem recarregar à mão', (await ls(B, 'a360cad')).cli.some(c => c.id === 'CLI-A1'));
  // conflito: os dois mudam ao mesmo tempo
  await Promise.all([A, B].map((p, i) => E(p, i => { const c = JSON.parse(localStorage.getItem('a360cad')); c.cli.push({ id: 'CLI-X' + i, razao: 'Simultâneo ' + i }); localStorage.setItem('a360cad', JSON.stringify(c)); }, i)));
  await A.waitForTimeout(4000);
  const ids = srvState.estado.a360cad.dados.cli.map(c => c.id);
  ok('conflito juntado: servidor tem as duas mudanças', ids.includes('CLI-X0') && ids.includes('CLI-X1') && ids.includes('CLI-A1'));
  ok('A e B terminaram iguais ao servidor', JSON.stringify((await ls(A, 'a360cad')).cli.map(c => c.id).sort()) === JSON.stringify(ids.slice().sort()) && JSON.stringify((await ls(B, 'a360cad')).cli.map(c => c.id).sort()) === JSON.stringify(ids.slice().sort()));
  // quem não pode mexer em acessos não sobe a360acesso
  ok('servidor sem senhas no a360acesso', !JSON.stringify(srvState.estado.a360acesso.dados).includes('"hash"') || srvState.estado.a360acesso.versao === 1);
  // pessoa sem perfil
  const C = await pessoa('novo.pedido@gmail.com');
  ok('C (sem perfil) vê "Acesso pendente"', (await C.locator('#a360-pt').innerText()).includes('Acesso pendente'));
  await A.waitForTimeout(2500);
  ok('pedido do C chegou à lista do app do administrador', ((await ls(A, 'a360acesso')).reqs || []).some(r => r.email === 'novo.pedido@gmail.com'));
  ok('pedido subiu para o servidor (todos os gestores veem)', (srvState.estado.a360acesso.dados.reqs || []).some(r => r.email === 'novo.pedido@gmail.com'));
  ok('a360acesso no servidor sem hash de senha', !JSON.stringify(srvState.estado.a360acesso.dados).includes('"hash"'));
  // arquivos: A guarda, B abre
  await E(A, () => ArmantNucleo.files.put({ id: 'DOC-T1', blob: new Blob(['conteudo do documento'], { type: 'text/plain' }), mime: 'text/plain', nome: 't.txt' }));
  await A.waitForTimeout(500);
  ok('arquivo subiu ao Storage', !!srvState.storage['anexos/fase1/DOC-T1']);
  ok('B abre o arquivo do A', (await E(B, async () => { const f = await ArmantNucleo.files.get('DOC-T1'); return f && await f.blob.text(); })) === 'conteudo do documento');
  { let n = 0; const f = () => n++; A.on('load', f); B.on('load', f); await A.waitForTimeout(10000); A.off('load', f); B.off('load', f);
    ok('sem recarga em cadeia com duas pessoas paradas (10 s)', n === 0); }
  // console do superadmin com o painel do servidor
  await A.goto(BASE + '#auditoria'); await A.waitForTimeout(3000); await A.waitForSelector('[data-au-view=console]'); await A.click('[data-au-view=console]'); await A.waitForSelector('.a360-srv', { timeout: 10000 }).catch(() => {});
  ok('painel do servidor aparece no console', (await A.locator('.a360-srv').count()) === 3);
  await A.click('[data-srv=listar]'); await A.waitForTimeout(500);
  ok('logins do servidor listados', (await A.locator('.a360-srv [data-srv=excluir]').count()) >= 6);
  await A.fill('#a360-sql', 'select chave, versao from estado_modulo'); await A.click('[data-srv=sql]'); await A.waitForTimeout(500);
  ok('SQL do superadmin executa', (await A.locator('.a360-srv pre').innerText()).includes('a360cad'));
  await A.screenshot({ path: process.argv[4] + '/ponte-console.png' });
  // B (nível 2) não vê o painel do servidor
  await B.goto(BASE + '#auditoria'); await B.waitForTimeout(800);
  ok('B não vê painel do servidor', !(await B.locator('.a360-srv').count()));
  // sair
  await E(B, () => window.ArmantPonte.sair()); await B.waitForTimeout(300);
  ok('B saiu e voltou para "Entrar com Google"', (await B.locator('#a360-pt').innerText()).includes('Entrar com Google'));
  if (process.argv[5]) {
    await A.goto(BASE + '#projects'); await A.waitForTimeout(1200);
    ok('EAP veio do banco (sem obras-data.js no site)', (await E(A, () => !!(window.ARMANT_OBRA_DATA && window.ARMANT_OBRA_DATA.items.length > 200))) && !(await E(A, () => !!document.querySelector('script[src="obras-data.js"]'))));
    ok('painel de obras mostra a obra do TJ-RS', (await A.locator('#view').innerText()).includes('Alto Petrópolis'));
  }
  await A.goto(BASE + '#projects'); await A.waitForTimeout(1500); console.log('dbg projects', (await A.locator('#view').innerText()).slice(0,150).replace(/\n/g,' | '));
  console.log('erros de página:', errs.length ? errs : 'nenhum');
  await br.close(); server.close();
})();
