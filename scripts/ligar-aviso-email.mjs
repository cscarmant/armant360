// Armant 360 · liga o e-mail automático: cada pedido de acesso novo chama a função aviso-email
// Uso: node scripts/ligar-aviso-email.mjs   (lê DATABASE_URL, SUPABASE_URL e AVISO_SEGREDO do .env)
// O segredo fica guardado no cofre do Supabase (vault), não no código do gatilho.
import fs from 'node:fs';
import pg from 'pg';

for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { DATABASE_URL, SUPABASE_URL, AVISO_SEGREDO } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !AVISO_SEGREDO) { console.error('Faltam DATABASE_URL, SUPABASE_URL ou AVISO_SEGREDO no .env'); process.exit(1); }

const db = new pg.Client({ connectionString: DATABASE_URL, ssl: /localhost|127\.0\.0\.1|host=\//.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query('create extension if not exists pg_net');
  // guarda (ou atualiza) os dois segredos no cofre
  for (const [nome, valor] of [['a360_aviso_url', SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/aviso-email'], ['a360_aviso_segredo', AVISO_SEGREDO]]) {
    const r = await db.query(`select id from vault.secrets where name = $1`, [nome]);
    if (r.rowCount) await db.query(`select vault.update_secret($1, $2)`, [r.rows[0].id, valor]);
    else await db.query(`select vault.create_secret($1, $2)`, [valor, nome]);
  }
  await db.query(`
create or replace function public.avisar_pedido_acesso() returns trigger language plpgsql security definer set search_path = public as
$f$
declare u text; s text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'a360_aviso_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'a360_aviso_segredo';
  if u is not null then
    perform net.http_post(url := u, body := jsonb_build_object('type','INSERT','table','solicitacoes_acesso','record', to_jsonb(new)),
                          headers := jsonb_build_object('Content-Type','application/json','x-aviso-segredo', s));
  end if;
  return new;
exception when others then
  raise warning 'avisar_pedido_acesso: %', sqlerrm; -- e-mail falhou: o pedido continua valendo e aparece no app
  return new;
end $f$;
revoke all on function public.avisar_pedido_acesso() from public, anon, authenticated;
drop trigger if exists avisar_pedido_t on public.solicitacoes_acesso;
create trigger avisar_pedido_t after insert on public.solicitacoes_acesso for each row execute function public.avisar_pedido_acesso();`);
  // certificado A1: checagem todo dia às 08:07 (horário de Brasília) — avisa no app e manda e-mail ao superadmin
  await db.query(`
create or replace function public.rodar_aviso_certificado() returns void language plpgsql security definer set search_path = public as
$f$
declare t text; u text; s text;
begin
  t := public.avisar_certificado();
  if t is null then return; end if;
  select decrypted_secret into u from vault.decrypted_secrets where name = 'a360_aviso_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'a360_aviso_segredo';
  if u is not null then
    perform net.http_post(url := u, body := jsonb_build_object('tipo','certificado','texto', t), headers := jsonb_build_object('Content-Type','application/json','x-aviso-segredo', s));
  end if;
exception when others then raise warning 'rodar_aviso_certificado: %', sqlerrm;
end $f$;
revoke all on function public.rodar_aviso_certificado() from public, anon, authenticated;`);
  try {
    await db.query('create extension if not exists pg_cron');
    await db.query(`select cron.unschedule('a360-certificado') where exists (select 1 from cron.job where jobname = 'a360-certificado')`);
    await db.query(`select cron.schedule('a360-certificado', '7 11 * * *', 'select public.rodar_aviso_certificado()')`);
    console.log('Aviso do certificado A1 agendado: todo dia às 08:07 (Brasília).');
  } catch (e) { console.log('Não consegui agendar o aviso do certificado (pg_cron):', e.message, '— ative a extensão pg_cron em Database → Extensions e rode de novo.'); }
  console.log('E-mail automático ligado: pedidos de acesso novos chamam a função aviso-email.');
} finally { await db.end(); }
