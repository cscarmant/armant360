-- Armant 360 · 013 · consumo de dados (Painel do superadmin → Consumo e custos)
-- O site mede o que baixa e envia do servidor (banco, arquivos, funções, login) e manda um resumo a cada
-- poucos minutos (registrar_uso). O banco guarda por dia e por pessoa, e o painel junta isso ao tamanho do
-- banco, dos arquivos e aos usuários ativos para prever a conta da hospedagem.

create table if not exists public.uso_diario (
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  perfil_id text not null references public.perfis(id) on delete cascade,
  area text not null check (area in ('banco','arquivos','funcoes','login','tempo_real')),
  requisicoes bigint not null default 0, bytes_baixados bigint not null default 0, bytes_enviados bigint not null default 0,
  primary key (dia, perfil_id, area));
create table if not exists public.uso_snapshot (
  dia date primary key, banco_bytes bigint, arquivos_bytes bigint, arquivos_qtd bigint,
  usuarios_ativos_30d int, perfis_ativos int, emails_30d int, criado_em timestamptz default now());

alter table public.uso_diario enable row level security;
alter table public.uso_snapshot enable row level security;
drop policy if exists superadmin_tudo on public.uso_diario;
create policy superadmin_tudo on public.uso_diario for all to authenticated using (public.is_super()) with check (public.is_super());
drop policy if exists superadmin_tudo on public.uso_snapshot;
create policy superadmin_tudo on public.uso_snapshot for all to authenticated using (public.is_super()) with check (public.is_super());
grant select, insert, update, delete on public.uso_diario, public.uso_snapshot to authenticated;
revoke all on public.uso_diario, public.uso_snapshot from anon;

-- cada pessoa logada soma o próprio uso (não lê nem altera o dos outros); valores absurdos são recusados
create or replace function public.registrar_uso(p jsonb) returns void language plpgsql security definer set search_path = public as
$$
declare eu text := public.eu_id(); k text; v jsonb;
begin
  if eu is null or p is null or jsonb_typeof(p) <> 'object' then return; end if;
  for k, v in select * from jsonb_each(p) loop
    if k not in ('banco','arquivos','funcoes','login','tempo_real') then continue; end if;
    if coalesce((v->>'req')::bigint,0) < 0 or coalesce((v->>'down')::bigint,0) < 0 or coalesce((v->>'up')::bigint,0) < 0
       or coalesce((v->>'req')::bigint,0) > 100000 or coalesce((v->>'down')::bigint,0) > 5e9 or coalesce((v->>'up')::bigint,0) > 5e9 then
      raise exception 'Valores de uso fora do esperado.';
    end if;
    insert into public.uso_diario(perfil_id, area, requisicoes, bytes_baixados, bytes_enviados)
    values (eu, k, coalesce((v->>'req')::bigint,0), coalesce((v->>'down')::bigint,0), coalesce((v->>'up')::bigint,0))
    on conflict (dia, perfil_id, area) do update set requisicoes = uso_diario.requisicoes + excluded.requisicoes,
      bytes_baixados = uso_diario.bytes_baixados + excluded.bytes_baixados, bytes_enviados = uso_diario.bytes_enviados + excluded.bytes_enviados;
  end loop;
end $$;
revoke all on function public.registrar_uso(jsonb) from public, anon;
grant execute on function public.registrar_uso(jsonb) to authenticated;

-- fotografia do dia (tamanho do banco e dos arquivos); o painel chama, e o pg_cron pode chamar também
create or replace function public.foto_consumo() returns void language sql security definer set search_path = public as
$$
  insert into public.uso_snapshot(dia, banco_bytes, arquivos_bytes, arquivos_qtd, usuarios_ativos_30d, perfis_ativos, emails_30d)
  select (now() at time zone 'America/Sao_Paulo')::date, pg_database_size(current_database()),
         (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects), (select count(*) from storage.objects),
         (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
         (select count(*) from public.perfis where ativo),
         (select count(*) from public.auditoria where tabela = '(email)' and em > now() - interval '30 days')
  on conflict (dia) do update set banco_bytes = excluded.banco_bytes, arquivos_bytes = excluded.arquivos_bytes, arquivos_qtd = excluded.arquivos_qtd,
    usuarios_ativos_30d = excluded.usuarios_ativos_30d, perfis_ativos = excluded.perfis_ativos, emails_30d = excluded.emails_30d, criado_em = now();
$$;
revoke all on function public.foto_consumo() from public, anon, authenticated;

-- painel: só o superadmin
create or replace function public.painel_consumo() returns jsonb language plpgsql security definer set search_path = public as
$$
declare r jsonb;
begin
  if not public.is_super() then raise exception 'Só o superadmin vê o consumo.' using errcode = '42501'; end if;
  perform public.foto_consumo();
  select jsonb_build_object(
    'agora', now(),
    'banco_bytes', pg_database_size(current_database()),
    'tabelas', (select coalesce(jsonb_agg(t order by t.bytes desc), '[]') from (
        select c.relname as nome, pg_total_relation_size(c.oid) as bytes, c.reltuples::bigint as linhas
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 15) t),
    'arquivos', (select coalesce(jsonb_agg(a order by a.bytes desc), '[]') from (
        select bucket_id as cofre, count(*) as qtd, coalesce(sum((metadata->>'size')::bigint),0) as bytes from storage.objects group by bucket_id) a),
    'usuarios_ativos_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'perfis_ativos', (select count(*) from public.perfis where ativo),
    'emails_30d', (select count(*) from public.auditoria where tabela = '(email)' and em > now() - interval '30 days'),
    'uso_30d', (select coalesce(jsonb_object_agg(area, jsonb_build_object('req', req, 'down', down, 'up', up)), '{}') from (
        select area, sum(requisicoes) req, sum(bytes_baixados) down, sum(bytes_enviados) up from public.uso_diario
         where dia > (now() at time zone 'America/Sao_Paulo')::date - 30 group by area) u),
    'dias_medidos', (select count(distinct dia) from public.uso_diario where dia > (now() at time zone 'America/Sao_Paulo')::date - 30),
    'por_dia', (select coalesce(jsonb_agg(d order by d.dia), '[]') from (
        select dia, sum(bytes_baixados) down, sum(bytes_enviados) up, sum(requisicoes) req, count(distinct perfil_id) pessoas from public.uso_diario
         where dia > (now() at time zone 'America/Sao_Paulo')::date - 30 group by dia) d),
    'por_pessoa', (select coalesce(jsonb_agg(x order by x.down desc), '[]') from (
        select u.perfil_id, p.nome, p.setor, sum(u.bytes_baixados) down, sum(u.requisicoes) req from public.uso_diario u join public.perfis p on p.id = u.perfil_id
         where u.dia > (now() at time zone 'America/Sao_Paulo')::date - 30 group by u.perfil_id, p.nome, p.setor order by sum(u.bytes_baixados) desc limit 10) x),
    'historico', (select coalesce(jsonb_agg(s order by s.dia), '[]') from (
        select dia, banco_bytes, arquivos_bytes, arquivos_qtd, usuarios_ativos_30d from public.uso_snapshot where dia > (now() at time zone 'America/Sao_Paulo')::date - 180) s)
  ) into r;
  return r;
end $$;
revoke all on function public.painel_consumo() from public, anon;
grant execute on function public.painel_consumo() to authenticated;

-- fotografia diária às 23h50 (Brasília), para o histórico não depender de alguém abrir o painel.
-- Se o pg_cron não estiver ativo, o painel continua tirando a foto do dia quando é aberto.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('a360-consumo') where exists (select 1 from cron.job where jobname = 'a360-consumo');
  perform cron.schedule('a360-consumo', '50 2 * * *', 'select public.foto_consumo()');
exception when others then raise notice 'pg_cron indisponível (%): a foto do consumo será tirada quando o painel for aberto.', sqlerrm;
end $$;
