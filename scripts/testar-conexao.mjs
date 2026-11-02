// Armant 360 · confere se o DATABASE_URL do .env conecta no banco
import fs from 'node:fs';
import pg from 'pg';
for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL no .env'); process.exit(1); }
const db = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1|host=\//.test(url) ? false : { rejectUnauthorized: false } });
try {
  await db.connect();
  const r = await db.query(`select current_database() as banco, version() as versao, (select count(*) from pg_tables where schemaname = 'public') as tabelas`);
  console.log(`Conectado: ${r.rows[0].banco} · ${r.rows[0].versao.split(' ').slice(0, 2).join(' ')} · ${r.rows[0].tabelas} tabelas do Armant 360`);
} catch (e) {
  console.error('Não conectou:', e.message);
  console.error('Confira a senha no DATABASE_URL do .env e se copiou o "Session pooler".');
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
