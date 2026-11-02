// Armant 360 · função "contaazul": conexão com a API oficial da Conta Azul (OAuth 2.0, código de autorização)
// Documentação: https://developers.contaazul.com (autorização em login.contaazul.com, token em api-v2.contaazul.com/oauth/token,
// API em https://api-v2.contaazul.com). Publicar com --no-verify-jwt (a volta da Conta Azul chega sem login do site);
// as ações abaixo conferem o login da pessoa por conta própria.
//   POST { acao: "conectar", voltar }  → devolve { url } da tela de autorização da Conta Azul (gestão do Financeiro)
//   GET  ?code=...&state=...           → volta da Conta Azul: troca o código pelos tokens e redireciona ao site (#finance/extrato?ca=ok)
//   POST { acao: "sincronizar", de, ate } → contas financeiras com saldo atual + contas a receber e a pagar no período
//   POST { acao: "desconectar" }       → apaga os tokens
// Segredos: CONTAAZUL_CLIENT_ID, CONTAAZUL_CLIENT_SECRET (do app criado no portal de desenvolvedores da Conta Azul).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("SITE_URL") ?? "";
const CID = Deno.env.get("CONTAAZUL_CLIENT_ID") ?? "";
const CSEC = Deno.env.get("CONTAAZUL_CLIENT_SECRET") ?? "";
const AUTH = "https://login.contaazul.com/#/oauth/authorize";
const TOKEN = Deno.env.get("CONTAAZUL_TOKEN_URL") ?? "https://api-v2.contaazul.com/oauth/token";
const API = Deno.env.get("CONTAAZUL_API") ?? "https://api-v2.contaazul.com"; // trocável só para testes (servidor de testes da Conta Azul)
const RETORNO = URL_SB.replace(/\/$/, "") + "/functions/v1/contaazul";
const cors = { "Access-Control-Allow-Origin": SITE || "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const resp = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
const adm = () => createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const basic = () => "Basic " + btoa(CID + ":" + CSEC);

async function tokens(corpo: Record<string, string>) {
  const r = await fetch(TOKEN, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Conta Azul recusou o token: " + (j.error_description || j.error || r.status));
  return j as { access_token: string; refresh_token: string; expires_in: number };
}
async function acesso(db: ReturnType<typeof adm>) {
  const { data: c } = await db.from("ca_conexao").select("*").eq("id", 1).maybeSingle();
  if (!c?.refresh_token) throw new Error("Conta Azul não conectada. Clique em Conectar à Conta Azul.");
  if (c.access_token && c.expira_em && new Date(c.expira_em).getTime() - Date.now() > 60_000) return c.access_token as string;
  const t = await tokens({ grant_type: "refresh_token", refresh_token: c.refresh_token }); // o refresh_token muda a cada renovação: guardar o novo
  await db.from("ca_conexao").update({ access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expira_em: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString() }).eq("id", 1);
  return t.access_token;
}
async function get(tok: string, caminho: string, q: Record<string, string | number> = {}) {
  const u = new URL(API + caminho); Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(u, { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (tentativa + 1))); continue; }
    if (!r.ok) throw new Error(`Conta Azul ${caminho}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  }
  throw new Error("Conta Azul: muitas chamadas seguidas (429). Tente de novo em instantes.");
}
async function paginas(tok: string, caminho: string, q: Record<string, string>) {
  const itens: any[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const j = await get(tok, caminho, { ...q, pagina, tamanho_pagina: 500 });
    itens.push(...(j.itens || []));
    if (!j.itens || j.itens.length < 500) break;
  }
  return itens;
}
const evento = (tipo: "rec" | "pag") => (e: any) => ({
  id: e.id, tipo, descricao: e.descricao, vencimento: e.data_vencimento, competencia: e.data_competencia, total: +e.total, pago: +(e.pago ?? 0), nao_pago: +(e.nao_pago ?? 0),
  status: e.status_traduzido || e.status, parte: (tipo === "rec" ? e.cliente : e.fornecedor)?.nome || "", categoria: e.categorias?.[0]?.nome || "", centro_custo: e.centros_custo?.[0]?.nome || "",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adm();
  if (!CID || !CSEC) return resp({ erro: "Conta Azul não configurada no servidor (CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET)." }, 503);

  // volta da tela de autorização da Conta Azul
  if (req.method === "GET") {
    const u = new URL(req.url), code = u.searchParams.get("code"), state = u.searchParams.get("state");
    const { data: c } = await db.from("ca_conexao").select("estado,voltar").eq("id", 1).maybeSingle();
    const voltar = c?.voltar || SITE;
    if (!code || !state || !c?.estado || state !== c.estado) return Response.redirect(voltar + (voltar.includes("?") ? "&" : "?") + "ca=erro", 302);
    try {
      const t = await tokens({ grant_type: "authorization_code", code, redirect_uri: RETORNO });
      await db.from("ca_conexao").update({ estado: null, access_token: t.access_token, refresh_token: t.refresh_token, expira_em: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(), conectado_em: new Date().toISOString() }).eq("id", 1);
      await db.from("auditoria").insert({ usuario_nome: "Conta Azul", tabela: "(contaazul)", operacao: "SQL", registro: "Conta Azul conectada" });
      return Response.redirect(voltar.replace(/#.*$/, "") + "?ca=ok#finance/extrato", 302);
    } catch (_e) { return Response.redirect(voltar + (voltar.includes("?") ? "&" : "?") + "ca=erro", 302); }
  }

  // ações do site: só a gestão do Financeiro (e o superadmin)
  const quem = createClient(URL_SB, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: pode } = await quem.rpc("gere_financeiro");
  const { data: eu } = await quem.rpc("eu_perfil");
  if (pode !== true || !eu) return resp({ erro: "Só a gestão do Financeiro conecta e sincroniza a Conta Azul." }, 403);
  const corpo = await req.json().catch(() => ({}));
  try {
    if (corpo.acao === "conectar") {
      const estado = crypto.randomUUID();
      const voltar = String(corpo.voltar || SITE);
      if (SITE && !voltar.startsWith(SITE)) return resp({ erro: "Endereço de volta inválido." }, 400);
      await db.from("ca_conexao").upsert({ id: 1, estado, voltar, conectado_por: eu.id });
      const q = new URLSearchParams({ response_type: "code", client_id: CID, redirect_uri: RETORNO, state: estado, scope: "openid profile aws.cognito.signin.user.admin" });
      return resp({ url: AUTH + "?" + q.toString().replace(/\+/g, "%20") });
    }
    if (corpo.acao === "desconectar") {
      await db.from("ca_conexao").delete().eq("id", 1);
      await db.from("auditoria").insert({ usuario: eu.id, usuario_nome: eu.nome, tabela: "(contaazul)", operacao: "SQL", registro: "Conta Azul desconectada" });
      return resp({ ok: true });
    }
    if (corpo.acao === "sincronizar") {
      const tok = await acesso(db);
      const de = String(corpo.de || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)), ate = String(corpo.ate || new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10));
      const contasCA = await paginas(tok, "/v1/conta-financeira", {});
      const contas = [];
      for (const c of contasCA.filter((x: any) => x.ativo !== false)) {
        let saldo = null; try { saldo = (await get(tok, `/v1/conta-financeira/${c.id}/saldo-atual`)).saldo_atual; } catch (_e) { /* conta sem saldo (ex.: cartão) */ }
        contas.push({ id: c.id, nome: c.nome, banco: c.banco, agencia: c.agencia, numero: c.numero, tipo: c.tipo, saldo });
      }
      const filtro = { data_vencimento_de: de, data_vencimento_ate: ate };
      const receber = (await paginas(tok, "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar", filtro)).map(evento("rec"));
      const pagar = (await paginas(tok, "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar", filtro)).map(evento("pag"));
      await db.from("ca_conexao").update({ ultima_sinc: new Date().toISOString() }).eq("id", 1);
      await db.from("auditoria").insert({ usuario: eu.id, usuario_nome: eu.nome, tabela: "(contaazul)", operacao: "SQL", registro: `Sincronização: ${contas.length} conta(s), ${receber.length} a receber, ${pagar.length} a pagar (${de} a ${ate})` });
      return resp({ contas, receber, pagar });
    }
    return resp({ erro: "Ação desconhecida." }, 400);
  } catch (e) { return resp({ erro: String((e as Error).message ?? e) }, 502); }
});
