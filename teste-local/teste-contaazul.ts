// Teste da função contaazul contra o servidor de testes (mock) oficial da Conta Azul.
// Rodar: CONTAAZUL_API=https://developers.contaazul.com/_mock/docs/financial-apis-openapi deno run -A teste-local/teste-contaazul.ts
// O Supabase é simulado aqui (fetch interceptado); a Conta Azul responde de verdade pelo mock.
const env: Record<string, string> = { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", SITE_URL: "https://armant360.netlify.app", CONTAAZUL_CLIENT_ID: "cid", CONTAAZUL_CLIENT_SECRET: "sec", CONTAAZUL_TOKEN_URL: "https://token.teste/oauth/token" };
for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);
const banco: any = { ca_conexao: null, auditoria: [] };
const chamadas: string[] = [];
const fetchReal = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  if (url.startsWith("https://token.teste")) { chamadas.push("token " + new URLSearchParams(init.body).get("grant_type") + " " + init.headers.Authorization); return new Response(JSON.stringify({ access_token: "AT" + chamadas.length, refresh_token: "RT" + chamadas.length, expires_in: 3600 }), { status: 200 }); }
  if (url.startsWith(env.SUPABASE_URL)) {
    const u = new URL(url), m = (init?.method || "GET").toUpperCase(), body = init?.body ? JSON.parse(init.body) : null;
    if (u.pathname.endsWith("/rpc/gere_financeiro")) return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    if (u.pathname.endsWith("/rpc/eu_perfil")) return new Response(JSON.stringify({ id: "USR-001", nome: "Valentim" }), { status: 200, headers: { "content-type": "application/json" } });
    if (u.pathname.endsWith("/ca_conexao")) {
      if (m === "GET") return new Response(JSON.stringify(banco.ca_conexao ? [banco.ca_conexao] : []), { status: 200, headers: { "content-type": "application/json" } });
      if (m === "DELETE") { banco.ca_conexao = null; return new Response("", { status: 204 }); }
      banco.ca_conexao = { ...(banco.ca_conexao || {}), ...(Array.isArray(body) ? body[0] : body) }; return new Response("", { status: 201 });
    }
    if (u.pathname.endsWith("/auditoria")) { banco.auditoria.push(body); return new Response("", { status: 201 }); }
    return new Response("[]", { status: 200 });
  }
  if (url.includes("_mock")) chamadas.push("api " + new URL(url).pathname.replace(/.*financial-apis-openapi/, ""));
  return fetchReal(input, init);
};
let handler: (r: Request) => Promise<Response>;
(Deno as any).serve = (h: any) => { handler = h; return {} as any; };
await import("../supabase/functions/contaazul/index.ts");
const ok = (n: string, c: boolean) => console.log((c ? "ok   " : "FALHA") + " " + n);
const post = (b: unknown) => handler!(new Request("https://proj.supabase.co/functions/v1/contaazul", { method: "POST", headers: { Authorization: "Bearer usuario", "content-type": "application/json" }, body: JSON.stringify(b) }));
// 1) conectar: URL da tela de autorização oficial
const r1 = await (await post({ acao: "conectar", voltar: "https://armant360.netlify.app/#finance/extrato" })).json();
ok("conectar devolve a tela de login.contaazul.com com client_id, state e scope", /^https:\/\/login\.contaazul\.com\/#\/oauth\/authorize\?response_type=code&client_id=cid&redirect_uri=https%3A%2F%2Fproj\.supabase\.co%2Ffunctions%2Fv1%2Fcontaazul&state=[0-9a-f-]{36}&scope=openid%20profile%20aws\.cognito\.signin\.user\.admin$/.test(r1.url));
const estado = new URL(r1.url.replace("#/", "")).searchParams.get("state")!;
// 2) volta com state errado é recusada; com o certo troca o código
const rx = await handler!(new Request("https://proj.supabase.co/functions/v1/contaazul?code=X&state=errado"));
ok("volta com state errado é recusada", rx.status === 302 && rx.headers.get("location")!.includes("ca=erro"));
const r2 = await handler!(new Request(`https://proj.supabase.co/functions/v1/contaazul?code=COD&state=${estado}`));
ok("volta certa troca o código (Basic client_id:secret) e redireciona ao extrato", r2.status === 302 && r2.headers.get("location") === "https://armant360.netlify.app/?ca=ok#finance/extrato" && chamadas.some((c) => c === "token authorization_code Basic " + btoa("cid:sec")) && banco.ca_conexao.refresh_token);
// 3) token vencido: renova e guarda o novo refresh_token
banco.ca_conexao.expira_em = new Date(Date.now() - 1000).toISOString(); const rtAntes = banco.ca_conexao.refresh_token;
const r3 = await (await post({ acao: "sincronizar", de: "2026-10-01", ate: "2026-10-31" })).json();
ok("renovou o token e guardou o refresh_token novo", chamadas.some((c) => c.startsWith("token refresh_token")) && banco.ca_conexao.refresh_token !== rtAntes);
console.log("   ", JSON.stringify({ contas: r3.contas?.[0], receber: r3.receber?.[0], pagar: r3.pagar?.[0] }).slice(0, 600));
ok("contas financeiras com saldo atual", r3.contas?.length >= 1 && typeof r3.contas[0].saldo === "number");
ok("contas a receber normalizadas (cliente, vencimento, total, pago, não pago)", r3.receber?.[0]?.tipo === "rec" && r3.receber[0].parte && r3.receber[0].vencimento && typeof r3.receber[0].nao_pago === "number");
ok("contas a pagar com fornecedor", r3.pagar?.[0]?.tipo === "pag" && !!r3.pagar[0].parte);
ok("chamou as rotas oficiais", ["/v1/conta-financeira", "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar", "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar"].every((p) => chamadas.some((c) => c.includes(p))));
ok("registrou no registro (auditoria)", banco.auditoria.some((a: any) => /Sincronização/.test(a.registro)));
const r4 = await (await post({ acao: "desconectar" })).json();
ok("desconectar apaga os tokens", r4.ok && banco.ca_conexao === null);
