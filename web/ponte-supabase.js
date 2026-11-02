/* Armant 360 · ponte com o Supabase (fase 1)
   Carrega ANTES do app. Sem config.js preenchido, não faz nada (o site funciona como protótipo local).
   Com config.js:
   - login só com Google (Supabase Auth); quem não tem perfil vê "acesso pendente" e o administrador é avisado;
   - cada módulo (chaves a360*) é guardado inteiro na tabela estado_modulo, com controle de versão;
     se duas pessoas mexem ao mesmo tempo, as mudanças são juntadas registro a registro (pelo id);
   - mudanças de outras pessoas chegam em tempo real; a página recarrega sozinha quando você não está digitando;
   - fotos e documentos (ArmantNucleo.files) vão para o Storage (anexos/fase1/<id>);
   - o superadmin ganha no Console do painel: logins do servidor (bloquear, liberar, excluir), SQL livre e "desfazer". */
(function () {
  'use strict';
  var CFG = window.A360_CONFIG || {};
  if (!CFG.url || !CFG.anonKey || !window.supabase) return;

  var rawSet = Storage.prototype.setItem, rawGet = Storage.prototype.getItem, rawDel = Storage.prototype.removeItem;
  var FORA = { a360sess: 1, a360tour: 1, a360ponte: 1, a360tema: 1 };
  var sincroniza = function (k) { return typeof k === 'string' && /^a360/.test(k) && !FORA[k]; };
  var lsGet = function (k) { try { return rawGet.call(localStorage, k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { v == null ? rawDel.call(localStorage, k) : rawSet.call(localStorage, k, v); } catch (e) { aviso('Sem espaço no navegador para guardar ' + k + '.'); } };
  var json = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
  var igual = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* meta: de quem é o cache deste aparelho, versão de cada módulo e o que ainda não subiu */
  var META = json(lsGet('a360ponte')) || {};
  META.v = META.v || {}; META.sujo = META.sujo || {};
  var salvaMeta = function () { lsSet('a360ponte', JSON.stringify(META)); };
  var BASE = {}; // última versão do servidor de cada módulo (para juntar mudanças)

  /* dados da obra (EAP) vêm do banco, não de um arquivo público: entram antes do módulo de obras carregar */
  var eap = json(lsGet('a360eap'));
  if (eap && eap.items) window.ARMANT_OBRA_DATA = eap;

  /* link "entrar como" do superadmin chega com o token no #: guarda e limpa antes do app ler o endereço */
  var tokenNoLink = null;
  if (/access_token=/.test(location.hash)) {
    var h = new URLSearchParams(location.hash.slice(1));
    tokenNoLink = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token') };
    history.replaceState(null, '', location.pathname + location.search + '#overview');
  }

  /* consumo de dados: mede o que este aparelho baixa e envia do servidor e manda o resumo a cada 5 minutos
     (Painel do superadmin → Consumo e custos). Conta o tamanho das respostas, não o conteúdo. */
  var USO = {}, fetchOriginal = window.fetch.bind(window);
  function usoDe(a) { return USO[a] || (USO[a] = { req: 0, down: 0, up: 0 }); }
  function areaDe(u) { return /\/storage\/v1\//.test(u) ? 'arquivos' : /\/functions\/v1\//.test(u) ? 'funcoes' : /\/auth\/v1\//.test(u) ? 'login' : 'banco'; }
  function tamCorpo(b) { if (!b) return 0; if (typeof b === 'string') return b.length; if (b.size != null) return b.size; if (b.byteLength != null) return b.byteLength; return 0; }
  function medir(input, init) {
    var url = String(typeof input === 'string' ? input : (input && input.url) || '');
    if (/\/rpc\/registrar_uso/.test(url)) return fetchOriginal(input, init);
    var u = usoDe(areaDe(url)); u.req++; u.up += tamCorpo(init && init.body);
    return fetchOriginal(input, init).then(function (r) {
      var n = +r.headers.get('content-length');
      if (n > 0) u.down += n; else r.clone().arrayBuffer().then(function (b) { u.down += b.byteLength; }).catch(function () {});
      return r;
    });
  }
  function enviarUso() {
    if (!EU || !Object.keys(USO).length) return;
    var p = USO; USO = {};
    var volta = function () { Object.keys(p).forEach(function (a) { var u = usoDe(a); u.req += p[a].req; u.down += p[a].down; u.up += p[a].up; }); };
    sb.rpc('registrar_uso', { p: p }).then(function (r) { if (!r || r.error) volta(); }).catch(volta);
  }
  setInterval(enviarUso, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) enviarUso(); });

  var sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }, global: { fetch: medir } });
  var EU = null; // perfil no banco

  /* abre o app direto do cache se este aparelho já tem login (a confirmação vem logo depois) */
  var temToken = Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k); });
  if (temToken && META.uid) {
    var s0 = json(sessionStorage.getItem('a360sess')) || {};
    if (s0.uid !== META.uid) sessionStorage.setItem('a360sess', JSON.stringify({ uid: META.uid, em: Date.now(), g: 1 }));
  } else {
    try { sessionStorage.removeItem('a360sess'); rawDel.call(localStorage, 'a360sess'); } catch (e) {}
    document.documentElement.classList.add('a360-espera');
  }

  /* ---------- tela da ponte (login, pendente, carregando) ---------- */
  var css = document.createElement('style');
  css.textContent = 'html.a360-espera body>*:not(#a360-pt){visibility:hidden}' +
    '#a360-pt{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#042f39;font-family:inherit;padding:16px}' +
    '#a360-pt .c{background:#063f4c;color:#fff;border-radius:16px;padding:32px 28px;max-width:400px;width:100%;box-shadow:0 20px 60px #0006;text-align:center}' +
    '#a360-pt h1{font-size:22px;margin:8px 0 10px;color:#fff}#a360-pt p{color:#ffffffcc;line-height:1.5;margin:0 0 16px}' +
    '#a360-pt button{border:0;border-radius:999px;padding:12px 22px;font-weight:600;font-size:15px;cursor:pointer;background:#fff;color:#063f4c;margin:4px}' +
    '#a360-pt button.s{background:transparent;color:#fff;border:1px solid #ffffff66}#a360-pt .m{letter-spacing:3px;font-size:10.5px;color:#ffffffa6;margin-top:4px}' +
    '#a360-pt .c{max-width:440px}#a360-pt .b{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:16px}#a360-pt .b img{width:min(250px,72%);height:auto;filter:brightness(0) invert(1)}' +
    '#a360-pt .b .s{font-weight:600;font-size:14px;letter-spacing:4px;text-transform:uppercase}#a360-pt .b .t{font-size:17px;color:#bfe9ef}' +
    '#a360-pt #a360-g{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;background:#fff;color:#1f1f1f;border:1px solid #dadce0;font:500 15px Roboto,Arial,sans-serif;padding:12px 16px;margin:4px 0}#a360-pt #a360-g svg{width:20px;height:20px}' +
    '.a360-faixa{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147482000;background:#063f4c;color:#fff;border-radius:999px;padding:10px 12px 10px 18px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px #0005;font-size:14px;max-width:calc(100vw - 32px)}' +
    '.a360-faixa button{border:0;border-radius:999px;padding:6px 14px;background:#fff;color:#063f4c;font-weight:600;cursor:pointer}' +
    '.a360-srvs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;margin-top:16px}.a360-srv textarea{width:100%;min-height:120px;box-sizing:border-box}.a360-srv pre{max-height:260px;overflow:auto;font-size:12px;background:#0001;padding:8px;border-radius:8px;white-space:pre-wrap}.a360-srv table{font-size:12px}.a360-srv .ob-actions{flex-wrap:wrap}';
  document.head.appendChild(css);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function tela(html) {
    var run = function () {
      var el = document.getElementById('a360-pt');
      if (!el) { el = document.createElement('div'); el.id = 'a360-pt'; document.body.appendChild(el); }
      el.innerHTML = '<div class="c"><div class="b"><img src="assets/armant-logo.png" alt="Armant" onerror="this.remove()"><span class="s">Inteligência de gestão</span><span class="t">Performance térmica com precisão.</span><span class="m">ARMANT 360</span></div>' + html + '</div>';
    };
    document.body ? run() : document.addEventListener('DOMContentLoaded', run);
  }
  function semTela() { var el = document.getElementById('a360-pt'); if (el) el.remove(); document.documentElement.classList.remove('a360-espera'); }
  function aviso(txt, botao, acao) {
    var run = function () {
      document.querySelectorAll('.a360-faixa').forEach(function (x) { x.remove(); });
      var d = document.createElement('div'); d.className = 'a360-faixa'; d.setAttribute('role', 'status');
      d.innerHTML = '<span>' + esc(txt) + '</span>' + (botao ? '<button type="button">' + esc(botao) + '</button>' : '');
      if (botao) d.querySelector('button').onclick = acao; else setTimeout(function () { d.remove(); }, 5000);
      document.body.appendChild(d);
    };
    document.body ? run() : document.addEventListener('DOMContentLoaded', run);
  }
  function telaLogin(msg) {
    document.documentElement.classList.add('a360-espera');
    tela('<h1>Entrar</h1><p>' + (msg || 'Use a sua conta Gmail cadastrada pela Armant.') + '</p><button type="button" id="a360-g"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg><span>Entrar com Google</span></button>');
    var liga = function () {
      var b = document.getElementById('a360-g'); if (!b) return;
      b.onclick = function () {
        sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
      };
    };
    document.body ? liga() : document.addEventListener('DOMContentLoaded', liga);
  }

  /* ---------- juntar mudanças (base = servidor antes; meu = este aparelho; deles = servidor agora) ---------- */
  var temId = function (a) { return Array.isArray(a) && a.length && a.every(function (x) { return x && typeof x === 'object' && x.id != null; }); };
  function juntar(base, meu, deles) {
    if (igual(meu, deles)) return meu;
    if (base !== undefined && igual(meu, base)) return deles;
    if (base !== undefined && igual(deles, base)) return meu;
    if (Array.isArray(meu) && Array.isArray(deles)) {
      if ((temId(meu) || !meu.length) && (temId(deles) || !deles.length)) {
        var mapa = function (a) { var m = {}; (Array.isArray(a) ? a : []).forEach(function (x) { if (x && x.id != null) m[x.id] = x; }); return m; };
        var B = mapa(base), M = mapa(meu), D = mapa(deles), out = [], visto = {};
        var pega = function (id) {
          if (visto[id]) return; visto[id] = 1;
          var b = B[id], m = M[id], d = D[id];
          if (m && d) out.push(juntar(b, m, d));
          else if (m && !d) { if (!b || !igual(m, b)) out.push(m); }       // eles apagaram: só fica se eu mudei
          else if (d && !m) { if (!b || !igual(d, b)) out.push(d); }       // eu apaguei: só fica se eles mudaram
        };
        deles.forEach(function (x) { pega(x.id); }); meu.forEach(function (x) { pega(x.id); });
        return out;
      }
      var chave = function (x) { return JSON.stringify(x); };
      var tinha = {}; (Array.isArray(base) ? base : []).forEach(function (x) { tinha[chave(x)] = 1; });
      var tenho = {}; meu.forEach(function (x) { tenho[chave(x)] = 1; });
      return meu.concat(deles.filter(function (x) { return !tenho[chave(x)] && !tinha[chave(x)]; }));
    }
    if (meu && deles && typeof meu === 'object' && typeof deles === 'object' && !Array.isArray(meu) && !Array.isArray(deles)) {
      var o = {}, b0 = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
      Object.keys(Object.assign({}, deles, meu)).forEach(function (k) {
        var tm = k in meu, td = k in deles, tb = k in b0;
        if (tm && td) o[k] = juntar(tb ? b0[k] : undefined, meu[k], deles[k]);
        else if (tm) { if (!tb || !igual(meu[k], b0[k])) o[k] = meu[k]; }
        else if (td) { if (!tb || !igual(deles[k], b0[k])) o[k] = deles[k]; }
      });
      return o;
    }
    return meu; // valores simples em conflito: vale o deste aparelho
  }

  /* acessos: senhas do protótipo não sobem (no servidor o login é o Google) */
  function limpar(k, d) {
    if (k !== 'a360acesso' || !d) return d;
    var c = JSON.parse(JSON.stringify(d));
    (c.users || []).forEach(function (u) { delete u.salt; delete u.hash; delete u.trocar; });
    (c.reqs || []).forEach(function (r) { delete r.pw; });
    return c;
  }

  /* ---------- enviar ---------- */
  var timers = {}, enviando = {}, precisaRecarregar = false;
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === localStorage && EU !== false && sincroniza(k)) marcar(k);
  };
  Storage.prototype.removeItem = function (k) {
    rawDel.call(this, k);
    if (this === localStorage && EU && sincroniza(k)) {
      delete META.v[k]; delete META.sujo[k]; salvaMeta();
      sb.from('estado_modulo').delete().eq('chave', k).then(function (r) { if (r.error) aviso('Não foi possível apagar ' + k + ' no servidor: ' + r.error.message); });
    }
  };
  function marcar(k) {
    META.sujo[k] = 1; salvaMeta();
    if (!EU) return; // sobe quando o login confirmar
    clearTimeout(timers[k]); timers[k] = setTimeout(function () { enviar(k); }, 700);
  }
  async function enviar(k, tentativa) {
    tentativa = tentativa || 0;
    if (enviando[k]) { clearTimeout(timers[k]); timers[k] = setTimeout(function () { enviar(k); }, 400); return; }
    enviando[k] = true;
    try {
      var local = json(lsGet(k));
      if (local == null) { delete META.sujo[k]; salvaMeta(); return; }
      var dados = limpar(k, local);
      var r = await sb.rpc('salvar_estado', { p_chave: k, p_dados: dados, p_versao: META.v[k] == null ? null : META.v[k] });
      if (r.error) throw r.error;
      var res = r.data;
      if (res.ok) {
        META.v[k] = res.versao; BASE[k] = dados;
        if (igual(json(lsGet(k)), local)) delete META.sujo[k];
        salvaMeta();
        if (k === 'a360acesso') sincronizarPerfis(dados);
      } else if (res.conflito && tentativa < 4) {
        var junto = juntar(BASE[k], local, res.dados);
        if (k === 'a360acesso') junto = manterSenhas(junto, local);
        lsSet(k, JSON.stringify(junto));
        META.v[k] = res.versao; BASE[k] = res.dados; salvaMeta();
        enviando[k] = false;
        if (!igual(junto, local)) precisaRecarregar = true;
        await enviar(k, tentativa + 1);
        if (precisaRecarregar) recarregar('Suas mudanças foram juntadas com as de outra pessoa.');
        return;
      }
    } catch (e) {
      if (e && e.code) {
        // o servidor recusou (ex.: sem permissão para este módulo): não insiste; volta ao que está no servidor
        delete META.sujo[k]; delete META.v[k]; salvaMeta();
        aviso('O servidor não aceitou a mudança em ' + k.replace('a360', '') + ': ' + (e.message || e.code) + '. Voltando aos dados do servidor.');
        enviando[k] = false;
        try { if (await puxar(false)) recarregar('Dados atualizados com o servidor.'); } catch (er) {}
        return;
      }
      aviso('Sem conexão com o servidor: as mudanças ficam guardadas aqui e sobem quando voltar.');
      clearTimeout(timers[k]); timers[k] = setTimeout(function () { enviar(k); }, 30000);
    } finally { enviando[k] = false; }
  }
  function manterSenhas(junto, local) {
    var por = {}; (local.users || []).forEach(function (u) { por[u.id] = u; });
    (junto.users || []).forEach(function (u) { var l = por[u.id]; if (l && l.hash) { u.salt = l.salt; u.hash = l.hash; } });
    return junto;
  }
  async function sincronizarPerfis(d) {
    var us = (d.users || []).filter(function (u) { return u.email; }).map(function (u) {
      return { id: u.id, nome: u.nome, email: u.email, nivel: u.nivel, setor: u.setor, funcao: u.funcao || '', obras: u.obras || [], ativo: u.ativo !== false };
    });
    var r = await sb.rpc('sincronizar_perfis', { p_usuarios: us });
    if (r.error) console.warn('Armant 360: perfis não sincronizados', r.error.message);
  }
  window.addEventListener('online', function () { Object.keys(META.sujo).forEach(function (k) { enviar(k); }); });
  window.addEventListener('beforeunload', function () { if (EU) Object.keys(META.sujo).forEach(function (k) { enviar(k); }); }); // o que não der tempo sobe na próxima abertura

  /* ---------- recarregar sem atrapalhar quem está digitando ---------- */
  var digitando = function () { var a = document.activeElement; return a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  var temSujo = function () { return Object.keys(META.sujo).length > 0; };
  function recarregar(txt) {
    var ult = +(sessionStorage.getItem('a360recarga') || 0), falta = 15000 - (Date.now() - ult);
    if (falta > 0) { clearTimeout(recarregar.t); recarregar.t = setTimeout(function () { recarregar(txt); }, falta); return; }
    if (temSujo()) { setTimeout(function () { recarregar(txt); }, 1500); return; }
    if (document.hidden) { document.addEventListener('visibilitychange', function f() { if (!document.hidden) { document.removeEventListener('visibilitychange', f); recarregar(txt); } }); return; }
    if (digitando() || document.querySelector('.cs-modal,.fn-drawer,dialog[open]')) {
      aviso(txt || 'Há novidades de outra pessoa.', 'Atualizar', function () { location.reload(); });
      return;
    }
    sessionStorage.setItem('a360recarga', Date.now()); location.reload();
  }

  /* ---------- receber ---------- */
  async function puxar(primeira) {
    var r = await sb.from('estado_modulo').select('chave,dados,versao,atualizado_por');
    if (r.error) throw r.error;
    var mudou = false, noServidor = {};
    r.data.forEach(function (row) {
      var k = row.chave; noServidor[k] = 1;
      if (!sincroniza(k)) return;
      if (META.v[k] === row.versao && lsGet(k) != null) { BASE[k] = row.dados; return; }
      if (META.sujo[k] && lsGet(k) != null) return; // o envio cuida do conflito
      var d = row.dados;
      if (k === 'a360acesso') { var l = json(lsGet(k)); if (l) d = manterSenhas(JSON.parse(JSON.stringify(d)), l); }
      lsSet(k, JSON.stringify(d)); META.v[k] = row.versao; BASE[k] = row.dados; mudou = true;
    });
    // módulo zerado por outra pessoa: some daqui também
    Object.keys(META.v).forEach(function (k) { if (!noServidor[k] && !META.sujo[k]) { rawDel.call(localStorage, k); delete META.v[k]; mudou = true; } });
    salvaMeta();
    return mudou;
  }

  /* pedidos de acesso do servidor entram na lista do app (quem gere acessos vê e aprova ali) */
  async function trazerPedidos() {
    var r = await sb.from('solicitacoes_acesso').select('*').eq('status', 'pendente');
    if (r.error || !r.data.length) return false;
    var ac = json(lsGet('a360acesso')) || {}; ac.reqs = ac.reqs || []; ac.users = ac.users || [];
    var novos = r.data.filter(function (s) {
      return !ac.users.some(function (u) { return u.email === s.email; }) && !ac.reqs.some(function (q) { return q.email === s.email && q.st === 'pendente'; });
    });
    if (!novos.length) return false;
    novos.forEach(function (s) {
      ac.reqs.push({ id: 'REQ-' + s.id.slice(0, 8), nome: s.nome, email: s.email, setor: s.setor || '—', funcao: s.funcao || '', obra: s.obra || '', fone: s.fone || '', em: String(s.criado_em).slice(0, 19), st: 'pendente', srv: s.id });
    });
    Storage.prototype.setItem.call(localStorage, 'a360acesso', JSON.stringify(ac)); // marca para subir
    return true;
  }

  /* o perfil do banco precisa existir também na lista de usuários do app */
  function garantirUsuario(p) {
    var ac = json(lsGet('a360acesso'));
    if (!ac) ac = { users: [], perm: {}, seq: 0, cfg: {}, reqs: [] };
    ac.users = ac.users || [];
    var u = ac.users.find(function (x) { return x.id === p.id; }) || ac.users.find(function (x) { return x.email === p.email; });
    if (u) {
      // o banco manda: nível, setor, obras e situação de quem entrou valem o que está no perfil
      var antes = JSON.stringify(u);
      u.id = p.id; u.nivel = p.nivel; u.setor = p.setor; u.obras = p.obras || []; u.ativo = p.ativo !== false;
      if (JSON.stringify(u) === antes) return false;
    } else ac.users.push({ id: p.id, nome: p.nome, email: p.email, setor: p.setor, nivel: p.nivel, funcao: p.funcao || '', obras: p.obras || [], ativo: true, criado: String(p.criado_em || '').slice(0, 10) });
    lsSet('a360acesso', JSON.stringify(ac));
    return true;
  }

  /* ---------- arquivos no Storage ---------- */
  function ligarArquivos() {
    var N = window.ArmantNucleo; if (!N || !N.files || N.files.__ponte) return;
    var F = N.files, put = F.put, get = F.get, del = F.del, caminho = function (id) { return 'fase1/' + encodeURIComponent(id); };
    F.put = async function (o) {
      var r = await put(o);
      try {
        var blob = o.blob || (o.data ? await (await fetch(o.data)).blob() : null);
        if (blob) {
          var up = await sb.storage.from('anexos').upload(caminho(o.id), blob, { upsert: true, contentType: o.mime || blob.type || 'application/octet-stream' });
          if (up.error) throw up.error;
        }
      } catch (e) { aviso('Arquivo guardado só neste aparelho (falha ao enviar ao servidor).'); }
      return r;
    };
    F.get = async function (id) {
      var r = await get(id); if (r) return r;
      var dl = await sb.storage.from('anexos').download(caminho(id));
      if (dl.error || !dl.data) return r;
      var o = { id: id, blob: dl.data, mime: dl.data.type };
      try { await put(o); } catch (e) {}
      return o;
    };
    F.del = async function (id) { var r = await del(id); sb.storage.from('anexos').remove([caminho(id)]); return r; };
    F.__ponte = true;
  }

  /* ---------- poderes do superadmin no Console (servidor) ---------- */
  var SRV = { logins: null, sql: '', res: '', aud: null };
  async function admin(acao, dados) {
    var r = await sb.functions.invoke('admin', { body: Object.assign({ acao: acao }, dados || {}) });
    if (r.error) { var m = r.error.message; try { m = (await r.error.context.json()).erro || m; } catch (e) {} throw new Error(m); }
    return r.data;
  }
  function painelServidor() {
    if (!EU || EU.nivel < 6) return;
    var lado = document.querySelector('.cs-us'); if (!lado || document.querySelector('.a360-srv')) return;
    var split = lado.closest('.ob-split') || lado.parentNode;
    var lg = SRV.logins;
    var html = '<section class="panel ob-panel a360-srv"><div class="panel-header"><div><h2>Servidor · logins</h2><p>Contas do Google no Supabase</p></div></div>' +
      (lg ? '<div class="table-wrap"><table class="ob-t"><thead><tr><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th></th></tr></thead><tbody>' +
        lg.logins.map(function (l) {
          var p = (lg.perfis || []).find(function (x) { return x.email === (l.email || '').toLowerCase(); });
          return '<tr><td>' + esc(l.email) + (l.bloqueado ? ' <b>(bloqueado)</b>' : '') + '</td><td>' + (p ? esc(p.id + ' · nível ' + p.nivel) : 'sem perfil') + '</td><td>' + esc(String(l.ultimo_acesso || '—').slice(0, 16).replace('T', ' ')) + '</td><td class="ob-nw">' +
            '<button class="text-button" data-srv="' + (l.bloqueado ? 'liberar' : 'bloquear') + '" data-em="' + esc(l.email) + '">' + (l.bloqueado ? 'Liberar' : 'Bloquear') + '</button> ' +
            '<button class="text-button" data-srv="excluir" data-em="' + esc(l.email) + '">Excluir</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="ob-actions"><button class="button outline fn-sm" data-srv="listar">Carregar logins</button></div>') +
      '</section><section class="panel ob-panel a360-srv"><div class="panel-header"><div><h2>Servidor · SQL</h2><p>Qualquer comando no banco (fica no registro)</p></div></div>' +
      '<textarea id="a360-sql" class="cs-json" spellcheck="false" placeholder="select chave, versao from estado_modulo">' + esc(SRV.sql) + '</textarea>' +
      '<div class="ob-actions"><button class="button primary fn-sm" data-srv="sql">Executar</button></div>' + (SRV.res ? '<pre>' + esc(SRV.res) + '</pre>' : '') +
      '</section><section class="panel ob-panel a360-srv"><div class="panel-header"><div><h2>Servidor · registro</h2><p>Últimas alterações no banco, com desfazer</p></div></div>' +
      (SRV.aud ? '<div class="table-wrap"><table class="ob-t"><tbody>' + SRV.aud.map(function (a) {
        return '<tr><td class="ob-nw">' + esc(String(a.em).slice(0, 16).replace('T', ' ')) + '</td><td>' + esc((a.usuario_nome || '') + ' · ' + a.operacao + ' · ' + a.tabela + ' · ' + (a.registro || '')) + '</td><td>' +
          (/^(INSERT|UPDATE|DELETE)$/.test(a.operacao) ? '<button class="text-button" data-srv="desfazer" data-id="' + a.id + '">Desfazer</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="ob-actions"><button class="button outline fn-sm" data-srv="aud">Carregar registro</button></div>') + '</section>';
    split.insertAdjacentHTML('afterend', '<div class="a360-srvs">' + html + '</div>');
  }
  function repintar() { document.querySelectorAll('.a360-srvs').forEach(function (x) { x.remove(); }); painelServidor(); }
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-srv]'); if (!t || !EU || EU.nivel < 6) return;
    var a = t.dataset.srv, em = t.dataset.em;
    try {
      if ((a === 'excluir' || a === 'bloquear' || a === 'desfazer') && t.dataset.ok !== '1') { t.dataset.ok = '1'; t.textContent = 'Confirmar'; return; }
      if (a === 'listar') { SRV.logins = await admin('listar'); }
      else if (a === 'bloquear' || a === 'liberar' || a === 'excluir') { await admin(a, { email: em }); SRV.logins = await admin('listar'); aviso('Feito: ' + a + ' ' + em + '.'); }
      else if (a === 'sql') {
        SRV.sql = document.getElementById('a360-sql').value;
        var q = await sb.rpc('super_sql', { comando: SRV.sql });
        SRV.res = q.error ? 'Erro: ' + q.error.message : JSON.stringify(q.data, null, 2);
      } else if (a === 'aud' || a === 'desfazer') {
        if (a === 'desfazer') { var d = await sb.rpc('desfazer', { aud_id: +t.dataset.id }); aviso(d.error ? 'Erro: ' + d.error.message : d.data); if (!d.error) recarregar('Alteração desfeita.'); }
        var au = await sb.from('auditoria').select('id,em,usuario_nome,operacao,tabela,registro').order('id', { ascending: false }).limit(60);
        SRV.aud = au.data || [];
      }
      repintar();
    } catch (er) { aviso('Erro: ' + er.message); }
  });

  /* ---------- tempo real ---------- */
  function ouvir() {
    sb.channel('a360-estado').on('postgres_changes', { event: '*', schema: 'public', table: 'estado_modulo' }, async function (p) {
      var ut = usoDe('tempo_real'); ut.req++; try { ut.down += JSON.stringify(p).length; } catch (e) {}
      var k = (p.new && p.new.chave) || (p.old && p.old.chave); if (!sincroniza(k)) return;
      if (p.eventType !== 'DELETE' && p.new.versao != null && META.v[k] != null && p.new.versao <= META.v[k]) return; // eco do meu envio
      if (META.sujo[k]) { enviar(k); return; } // meu envio vai encontrar o conflito e juntar
      var mudou = await puxar(false);
      if (mudou) recarregar('Novidades de outra pessoa em ' + k.replace('a360', '') + '.');
    }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes_acesso' }, async function () {
      if (await trazerPedidos()) aviso('Novo pedido de acesso. Veja em Usuários e acessos.', 'Abrir', function () { location.hash = '#acesso'; location.reload(); });
    }).subscribe();
  }

  /* ---------- início ---------- */
  async function iniciar() {
    try {
      if (tokenNoLink && tokenNoLink.access_token) await sb.auth.setSession(tokenNoLink);
      var s = (await sb.auth.getSession()).data.session;
      if (!s) { EU = null; telaLogin(); return; }
      var email = String(s.user.email || '').toLowerCase();
      if (!/^[^@\s]+@(gmail|googlemail)\.com$/.test(email) && !CFG.outrosDominios) { await sb.auth.signOut(); telaLogin('O acesso é só com conta Gmail. Você entrou com ' + esc(email) + '.'); return; }
      var pr = await sb.rpc('vincular_login'); if (pr.error) throw pr.error;
      var p = pr.data;
      if (!p || !p.ativo || p.nivel < 1) {
        EU = false; document.documentElement.classList.add('a360-espera');
        tela('<h1>Acesso pendente</h1><p>Olá! Seu pedido de acesso com <b>' + esc(email) + '</b> foi enviado ao administrador. Assim que ele liberar, é só entrar de novo.</p><button type="button" id="a360-de-novo">Já fui liberado</button><button type="button" class="s" id="a360-sair">Sair</button>');
        document.getElementById('a360-de-novo').onclick = function () { location.reload(); };
        document.getElementById('a360-sair').onclick = function () { sair(); };
        return;
      }
      // outro usuário neste aparelho: limpa o cache do anterior
      if (META.email && META.email !== email) {
        Object.keys(localStorage).filter(function (k) { return sincroniza(k); }).forEach(function (k) { rawDel.call(localStorage, k); });
        META = { v: {}, sujo: {} };
      }
      var primeira = !META.uid || META.uid !== p.id;
      if (primeira) META.sujo = {}; // o que o app gravou antes do primeiro login é só o padrão vazio: vale o servidor
      META.email = email; META.uid = p.id; salvaMeta();
      EU = p;
      // o que ficou sem subir (página recarregada antes de enviar, ou sem internet) sobe primeiro
      for (var k of Object.keys(META.sujo)) await enviar(k);
      var mudou = await puxar(true);
      if (garantirUsuario(p)) mudou = true;
      if ((await sb.rpc('pode', { mod: 'acesso' })).data === true && await trazerPedidos()) mudou = true;
      for (var k2 of Object.keys(META.sujo)) await enviar(k2);
      var s1 = json(sessionStorage.getItem('a360sess')) || {};
      if (s1.uid !== p.id) { sessionStorage.setItem('a360sess', JSON.stringify({ uid: p.id, em: Date.now(), g: 1 })); mudou = true; }
      ouvir();
      if (mudou || primeira) { if (primeira) tela('<h1>Carregando…</h1><p>Trazendo os dados da Armant.</p>'); location.reload(); return; }
      semTela();
    } catch (e) {
      console.error(e);
      if (META.uid && lsGet('a360')) { EU = EU || null; semTela(); aviso('Servidor indisponível: trabalhando com os dados deste aparelho.'); }
      else tela('<h1>Sem conexão</h1><p>Não foi possível falar com o servidor (' + esc(e.message || e) + ').</p><button type="button" onclick="location.reload()">Tentar de novo</button>');
    }
  }
  async function sair() {
    enviarUso();
    try { await sb.auth.signOut(); } catch (e) {}
    try { sessionStorage.removeItem('a360sess'); rawDel.call(localStorage, 'a360sess'); } catch (e) {}
    META.uid = null; salvaMeta(); EU = null; telaLogin('Você saiu.');
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && EU) { EU = null; telaLogin('Sua sessão terminou. Entre de novo.'); } });

  /* e-mail para a pessoa (tarefa nova, atribuição, conta criada): função "email" do servidor */
  function email(msg) { if (!EU) return; sb.functions.invoke('email', { body: msg }).then(function (r) { if (r.error) console.warn('Armant 360: e-mail não enviado', r.error.message); }); }
  window.ArmantPonte = { uso: function () { return JSON.parse(JSON.stringify(USO)); }, enviarUso: enviarUso, sb: sb, sair: sair, admin: admin, email: email, eu: function () { return EU; }, enviarTudo: function () { return Promise.all(Object.keys(META.sujo).map(function (k) { return enviar(k); })); } };
  document.addEventListener('DOMContentLoaded', function () {
    ligarArquivos();
    new MutationObserver(function () { painelServidor(); }).observe(document.body, { childList: true, subtree: true });
  });
  iniciar();
})();
