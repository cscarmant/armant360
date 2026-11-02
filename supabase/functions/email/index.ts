// Armant 360 · função "email": avisa a pessoa por e-mail (tarefa nova, tarefa atribuída, conta criada, R.O. da obra)
// Quem chama é o site (ponte-supabase.js), com o login da pessoa. Regras:
//  - só quem está ativo envia;
//  - o destinatário precisa ser um perfil cadastrado (pelo id ou pelo e-mail); e-mail de fora só para quem gere acessos (conta criada);
//  - no máximo 60 e-mails por pessoa por hora; tudo fica no registro (auditoria).
// Envio: pelo Google Apps Script (APPS_SCRIPT_URL, sai do Gmail que publicou o script, ~100/dia) ou pelo Resend (RESEND_API_KEY;
// para mandar a qualquer pessoa o Resend exige domínio verificado, ex.: armant.com.br).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("SITE_URL") ?? "";
const APPS = Deno.env.get("APPS_SCRIPT_URL") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const DE = Deno.env.get("EMAIL_REMETENTE") ?? "Armant 360 <onboarding@resend.dev>";
const TIPOS = ["tarefa", "aviso", "conta", "campo"];
const cors = { "Access-Control-Allow-Origin": SITE || "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resp = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);
  if (!APPS && !RESEND) return resp({ erro: "Envio de e-mail não configurado (APPS_SCRIPT_URL ou RESEND_API_KEY)." }, 503);

  const quem = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: eu } = await quem.rpc("eu_perfil");
  if (!eu || !eu.ativo || eu.nivel < 1) return resp({ erro: "Sem acesso." }, 403);
  const { data: gereAcesso } = await quem.rpc("pode", { mod: "acesso" });

  const m = await req.json().catch(() => ({}));
  const tipo = TIPOS.includes(m.tipo) ? m.tipo : "aviso";
  const adm = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // destinatário: perfil cadastrado (id ou e-mail); e-mail de fora só para conta criada, por quem gere acessos
  let para = "", nome = String(m.nome ?? "");
  const porId = m.paraId ? await adm.from("perfis").select("email,nome,ativo").eq("id", m.paraId).maybeSingle() : { data: null };
  const porEmail = !porId.data && m.para ? await adm.from("perfis").select("email,nome,ativo").eq("email", String(m.para).toLowerCase()).maybeSingle() : { data: null };
  const p = porId.data || porEmail.data;
  if (p) { para = p.email; nome = p.nome; }
  else if (tipo === "conta" && gereAcesso === true && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(m.para ?? ""))) para = String(m.para).toLowerCase();
  if (!para) return resp({ erro: "Destinatário não cadastrado." }, 400);

  // limite por remetente
  const desde = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await adm.from("auditoria").select("id", { count: "exact", head: true }).eq("tabela", "(email)").eq("usuario", eu.id).gte("em", desde);
  if ((count ?? 0) >= 60) return resp({ erro: "Limite de e-mails por hora atingido." }, 429);

  const assunto = String(m.assunto ?? "Armant 360").slice(0, 160);
  const texto = String(m.texto ?? "").slice(0, 2000);
  const link = String(m.link ?? "").startsWith(SITE || "http") ? String(m.link) : SITE;
  let ok = false, detalhe = "";
  if (APPS) {
    const r = await fetch(APPS, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ tipo, para, nome, assunto, texto, link }) });
    ok = r.ok; detalhe = "apps-script " + r.status;
  } else {
    const html = `<p>Olá, ${esc(nome.split(" ")[0] || "")}!</p><p>${esc(texto).replace(/\n/g, "<br>")}</p>${link ? `<p><a href="${esc(link)}">Abrir no Armant 360</a></p>` : ""}<p style="color:#60767b;font-size:12px">Enviado por ${esc(eu.nome)} pelo Armant 360.</p>`;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: DE, to: [para], subject: assunto, html }) });
    ok = r.ok; detalhe = "resend " + r.status + (r.ok ? "" : " " + (await r.text()).slice(0, 200));
  }
  await adm.from("auditoria").insert({ usuario: eu.id, usuario_nome: eu.nome, tabela: "(email)", operacao: "SQL", registro: `${tipo} → ${para}: ${assunto}`.slice(0, 400), depois: { ok, detalhe } });
  return ok ? resp({ ok: true }) : resp({ erro: "Falha no envio: " + detalhe }, 502);
});
