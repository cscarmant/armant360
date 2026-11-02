// Armant 360 · função "admin": poderes do superadmin sobre os logins (só nível 6 consegue chamar)
// Ações (POST JSON { acao, ... }):
//   listar                          → logins do Google + perfis lado a lado
//   criar      { perfil }           → cria ou atualiza um perfil (qualquer nível, inclusive 6)
//   bloquear   { email }            → desativa o perfil e bloqueia o login (some de todos os aparelhos ao expirar o token)
//   liberar    { email }            → desfaz o bloqueio
//   excluir    { email, perfil? }   → apaga o login; com perfil:true apaga também o perfil
// Para ver o sistema como outra pessoa, o superadmin usa "Ver como" no Console do app (não precisa da senha dela).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("SITE_URL") ?? "";
const cors = {
  "Access-Control-Allow-Origin": SITE || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

  // quem está chamando? precisa ser superadmin
  const quem = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: souSuper, error: e1 } = await quem.rpc("is_super");
  if (e1 || souSuper !== true) return resp({ erro: "Só o superadmin usa esta função." }, 403);
  const { data: eu } = await quem.rpc("eu_perfil");

  const adm = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const corpo = await req.json().catch(() => ({}));
  const acao = String(corpo.acao ?? "");
  const email = String(corpo.email ?? "").trim().toLowerCase();

  const registrar = (registro: string, depois: unknown) =>
    adm.from("auditoria").insert({ usuario: eu?.id, usuario_nome: eu?.nome, tabela: "(logins)", operacao: "SQL", registro, depois });
  const loginPorEmail = async (m: string) => {
    for (let page = 1; page < 50; page++) {
      const { data, error } = await adm.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const u = data.users.find((x) => (x.email ?? "").toLowerCase() === m);
      if (u) return u;
      if (data.users.length < 200) return null;
    }
    return null;
  };

  try {
    if (acao === "listar") {
      const { data: logins, error } = await adm.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const { data: perfis } = await adm.from("perfis").select("id,nome,email,nivel,setor,funcao,obras,ativo,auth_id");
      return resp({
        perfis,
        logins: logins.users.map((u) => ({
          id: u.id, email: u.email, criado: u.created_at, ultimo_acesso: u.last_sign_in_at,
          bloqueado: !!u.banned_until && new Date(u.banned_until) > new Date(),
        })),
      });
    }

    if (acao === "criar") {
      const p = corpo.perfil ?? {};
      if (!p.email || !p.nome) return resp({ erro: "Informe nome e e-mail." }, 400);
      const linha = { ...p, email: String(p.email).toLowerCase() };
      const { data, error } = await adm.from("perfis").upsert(linha, { onConflict: "email" }).select().single();
      if (error) throw error;
      await registrar("perfil " + linha.email, linha);
      return resp({ ok: true, perfil: data });
    }

    if (!email) return resp({ erro: "Informe o e-mail." }, 400);
    if (eu?.email === email && ["bloquear", "excluir"].includes(acao)) return resp({ erro: "Você não pode bloquear ou excluir a si mesmo." }, 400);

    if (acao === "bloquear" || acao === "liberar") {
      const bloquear = acao === "bloquear";
      await adm.from("perfis").update({ ativo: !bloquear }).eq("email", email);
      const u = await loginPorEmail(email);
      if (u) {
        const { error } = await adm.auth.admin.updateUserById(u.id, { ban_duration: bloquear ? "876000h" : "none" });
        if (error) throw error;
      }
      await registrar(acao + " " + email, { email });
      return resp({ ok: true });
    }

    if (acao === "excluir") {
      const u = await loginPorEmail(email);
      if (u) {
        const { error } = await adm.auth.admin.deleteUser(u.id);
        if (error) throw error;
      }
      if (corpo.perfil === true) await adm.from("perfis").delete().eq("email", email);
      await registrar("excluir " + email, { email, perfil: corpo.perfil === true });
      return resp({ ok: true });
    }

    return resp({ erro: "Ação desconhecida: " + acao }, 400);
  } catch (e) {
    return resp({ erro: String((e as Error).message ?? e) }, 500);
  }
});
