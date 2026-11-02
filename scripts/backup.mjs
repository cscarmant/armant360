// Armant 360 · cópia de segurança do banco inteiro (todas as tabelas + lista e conteúdo dos arquivos)
// Uso:
//   node scripts/backup.mjs                              → grava backups/armant360-AAAA-MM-DD-HHMM.json (+ pasta de arquivos)
//   node scripts/backup.mjs --sem-arquivos               → só as tabelas
//   node scripts/backup.mjs --restaurar backups/x.json   → volta o banco exatamente para aquela cópia (pede confirmação)
// Lê DATABASE_URL (e, para os arquivos, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY) do .env. Não precisa de Docker.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import pg from 'pg';

for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : (process.argv[i + 1] ?? true); };
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL) { console.error('Falta DATABASE_URL no .env'); process.exit(1); }
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: /localhost|127\.0\.0\.1|host=\//.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
await db.connect();

// tabelas na ordem das dependências (quem é referenciado vem antes)
async function tabelasEmOrdem() {
  const { rows } = await db.query(`
    select c.relname::text as t, coalesce(array_agg(distinct r.relname::text) filter (where r.relname is not null and r.relname <> c.relname), array[]::text[]) as dep
      from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      left join pg_constraint k on k.conrelid = c.oid and k.contype = 'f'
      left join pg_class r on r.oid = k.confrelid
     where c.relkind = 'r' group by c.relname`);
  const feitas = [], resto = new Map(rows.map((r) => [r.t, r.dep]));
  while (resto.size) {
    const prontas = [...resto].filter(([, d]) => d.every((x) => feitas.includes(x) || !resto.has(x))).map(([t]) => t);
    if (!prontas.length) { feitas.push(...resto.keys()); break; }
    prontas.sort().forEach((t) => { feitas.push(t); resto.delete(t); });
  }
  return feitas;
}

try {
  const restaurar = arg('--restaurar');
  if (restaurar) {
    const copia = JSON.parse(fs.readFileSync(restaurar, 'utf8'));
    if (copia.app !== 'Armant 360 · banco') throw new Error('Este arquivo não é uma cópia do banco do Armant 360.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ok = await rl.question(`Isto APAGA o banco atual e volta para a cópia de ${copia.gerado}. Digite RESTAURAR para continuar: `);
    rl.close();
    if (ok.trim() !== 'RESTAURAR') { console.log('Cancelado.'); process.exit(0); }
    const ordem = (await tabelasEmOrdem()).filter((t) => copia.tabelas[t]);
    await db.query('begin');
    await db.query(`set local session_replication_role = replica`); // sem gatilhos nem checagem de chaves durante a volta
    for (const t of [...ordem].reverse()) await db.query(`delete from public.${db.escapeIdentifier(t)}`);
    for (const t of ordem) {
      const linhas = copia.tabelas[t];
      for (let i = 0; i < linhas.length; i += 500)
        await db.query(`insert into public.${db.escapeIdentifier(t)} select * from jsonb_populate_recordset(null::public.${db.escapeIdentifier(t)}, $1)`, [JSON.stringify(linhas.slice(i, i + 500))]);
    }
    // contadores (bigserial) continuam depois do maior id restaurado
    const { rows: seqs } = await db.query(`select table_name t, column_name c, pg_get_serial_sequence('public.'||quote_ident(table_name), column_name) s
      from information_schema.columns where table_schema='public' and column_default like 'nextval%'`);
    for (const q of seqs) if (q.s) await db.query(`select setval($1, coalesce((select max(${db.escapeIdentifier(q.c)}) from public.${db.escapeIdentifier(q.t)}), 0) + 1, false)`, [q.s]);
    await db.query(`insert into public.auditoria(usuario_nome, tabela, operacao, registro) values ('restauração', '(backup)', 'SQL', $1)`, ['Banco restaurado da cópia de ' + copia.gerado]);
    await db.query('commit');
    console.log(`Banco restaurado (${ordem.length} tabelas). Os arquivos da cópia ficam na pasta ao lado do .json; reenvie pelo painel do Supabase se precisar.`);
  } else {
    const agora = new Date(), carimbo = agora.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    fs.mkdirSync('backups', { recursive: true });
    const tabelas = {};
    for (const t of await tabelasEmOrdem()) tabelas[t] = (await db.query(`select * from public.${db.escapeIdentifier(t)}`)).rows;
    const arquivos = (await db.query(`select bucket_id, name, metadata->>'mimetype' as mime from storage.objects order by bucket_id, name`).catch(() => ({ rows: [] }))).rows;
    const saida = path.join('backups', `armant360-${carimbo}.json`);
    fs.writeFileSync(saida, JSON.stringify({ app: 'Armant 360 · banco', gerado: agora.toISOString(), tabelas, arquivos }));
    let baixados = 0;
    if (!arg('--sem-arquivos') && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      for (const a of arquivos) {
        const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${a.bucket_id}/${a.name.split('/').map(encodeURIComponent).join('/')}`,
          { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } });
        if (!r.ok) continue;
        const destino = path.join('backups', `armant360-${carimbo}-arquivos`, a.bucket_id, ...a.name.split('/'));
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
        baixados++;
      }
    }
    const linhas = Object.values(tabelas).reduce((s, x) => s + x.length, 0);
    console.log(`Cópia salva: ${saida} (${Object.keys(tabelas).length} tabelas, ${linhas} linhas, ${baixados}/${arquivos.length} arquivos).`);
  }
} catch (e) {
  await db.query('rollback').catch(() => {});
  console.error('Erro:', e.message); process.exitCode = 1;
} finally { await db.end(); }
