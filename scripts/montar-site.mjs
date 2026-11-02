// Armant 360 · monta a pasta "publicar" a partir de "web" para subir ao site
// - grava config.js com o endereço do Supabase e a chave pública (anon) do .env
// - deixa de fora o obras-data.js e o estoque-data.js (dados reais): no site, a EAP e o estoque vêm do banco, só para quem entrou
import fs from 'node:fs';
import path from 'node:path';

for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('Faltam SUPABASE_URL e SUPABASE_ANON_KEY no .env (rode o 01-criar-projeto.ps1).'); process.exit(1); }

const DE = 'web', PARA = 'publicar', FORA = new Set(['obras-data.js', 'estoque-data.js']);
fs.rmSync(PARA, { recursive: true, force: true });
fs.cpSync(DE, PARA, { recursive: true, filter: (f) => !FORA.has(path.basename(f)) });
fs.writeFileSync(path.join(PARA, 'config.js'), `/* gerado por scripts/montar-site.mjs */\nwindow.A360_CONFIG = { url: ${JSON.stringify(SUPABASE_URL)}, anonKey: ${JSON.stringify(SUPABASE_ANON_KEY)} };\n`);
const idx = path.join(PARA, 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/<script src="obras-data\.js"[^>]*><\/script>/, '').replace(/<script src="estoque-data\.js"[^>]*><\/script>/, ''));
// o site só abre por https e não deixa outros sites o colocarem dentro de uma moldura
fs.writeFileSync(path.join(PARA, '_headers'), '/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: geolocation=(self), camera=(self)\n');
const n = fs.readdirSync(PARA, { recursive: true }).length;
console.log(`Pasta "${PARA}" pronta (${n} arquivos, sem obras-data.js nem estoque-data.js, config.js apontando para ${SUPABASE_URL}).`);
