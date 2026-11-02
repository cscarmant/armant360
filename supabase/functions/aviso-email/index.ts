// Armant 360 · função "aviso-email": quando alguém pede acesso, manda um e-mail para o administrador
// Quem chama é o próprio banco (gatilho criado por scripts/ligar-aviso-email.mjs), com o segredo no cabeçalho.
// O e-mail sai pelo Resend (resend.com, plano grátis: 3.000 e-mails/mês) e vai SÓ para ADMIN_EMAIL.
const SEGREDO = Deno.env.get("AVISO_SEGREDO") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const PARA = Deno.env.get("ADMIN_EMAIL") ?? "";
const DE = Deno.env.get("EMAIL_REMETENTE") ?? "Armant 360 <onboarding@resend.dev>";
const SITE = Deno.env.get("SITE_URL") ?? "";

const esc = (s: unknown) => String(s ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
  if (!SEGREDO || req.headers.get("x-aviso-segredo") !== SEGREDO) return new Response("Sem permissão.", { status: 401 });
  if (!RESEND || !PARA) return new Response("Falta RESEND_API_KEY ou ADMIN_EMAIL.", { status: 500 });

  const corpo = await req.json().catch(() => ({}));
  const r = corpo.record ?? corpo; // formato do gatilho: { type, table, record }
  // aviso diário do certificado A1 (pg_cron)
  if (corpo.tipo === "certificado" && corpo.texto) {
    const envio = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: DE, to: [PARA], subject: "Armant 360: " + String(corpo.texto).split(". ")[0], html: `<h2>Certificado digital A1</h2><p>${esc(corpo.texto)}</p>${SITE ? `<p><a href="${esc(SITE)}#finance/notas">Abrir Financeiro → Notas fiscais</a></p>` : ""}` }) });
    return new Response(await envio.text(), { status: envio.ok ? 200 : 502 });
  }
  if (!r?.email) return new Response("Sem dados.", { status: 400 });

  const html = `<h2>Novo pedido de acesso ao Armant 360</h2>
<p><b>Nome:</b> ${esc(r.nome)}<br><b>Gmail:</b> ${esc(r.email)}<br><b>Setor:</b> ${esc(r.setor)}<br>
<b>Função:</b> ${esc(r.funcao)}<br><b>Obra:</b> ${esc(r.obra)}<br><b>Telefone:</b> ${esc(r.fone)}</p>
<p>Aprovar em: Armant 360 → Usuários e acessos → Solicitações de acesso.${SITE ? `<br><a href="${esc(SITE)}#acesso">Abrir o Armant 360</a>` : ""}</p>`;

  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: DE, to: [PARA], subject: `Armant 360: pedido de acesso de ${r.nome ?? r.email}`, html }),
  });
  return new Response(await envio.text(), { status: envio.ok ? 200 : 502 });
});
