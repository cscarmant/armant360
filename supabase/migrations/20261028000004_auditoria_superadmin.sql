-- Armant 360 · 004 · registro de tudo (auditoria) e poderes do superadmin
-- Cada inclusão, alteração e exclusão em qualquer tabela vira uma linha com antes/depois, quem e quando.

create table if not exists public.auditoria (
  id           bigserial primary key,
  em           timestamptz not null default now(),
  auth_id      uuid default auth.uid(),
  usuario      text,
  usuario_nome text,
  tabela       text not null,
  operacao     text not null check (operacao in ('INSERT','UPDATE','DELETE','SQL','DESFAZER','LOGIN')),
  registro     text,
  antes        jsonb,
  depois       jsonb
);
create index if not exists auditoria_em on public.auditoria(em desc);
create index if not exists auditoria_tabela on public.auditoria(tabela, em desc);
alter table public.auditoria enable row level security;
drop policy if exists superadmin_tudo on public.auditoria;
create policy superadmin_tudo on public.auditoria for all to authenticated using (public.is_super()) with check (public.is_super());

-- chave de cada registro (id, cc, codigo, chave...) para mostrar no painel
create or replace function public.chave_registro(r jsonb) returns text language sql immutable as
$$ select coalesce(r->>'id', r->>'cc' || coalesce(' · ' || (r->>'codigo'), ''), r->>'chave', r->>'modulo', r->>'lancamento_id', r->>'movimento_id', r->>'perfil_id') $$;

create or replace function public.registrar_auditoria() returns trigger language plpgsql security definer set search_path = public as
$$
declare a jsonb; d jsonb; quem text; nome text;
begin
  -- durante a importação do backup o registro fica desligado (a importação grava um resumo no fim)
  if current_setting('armant.importando', true) = 'on' then return coalesce(new, old); end if;
  if tg_op in ('UPDATE','DELETE') then a := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then d := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and a = d then return new; end if;
  select id, p.nome into quem, nome from public.perfis p where auth_id = auth.uid();
  insert into public.auditoria(usuario, usuario_nome, tabela, operacao, registro, antes, depois)
  values (quem, coalesce(nome, case when auth.uid() is null then 'sistema' else 'sem perfil' end), tg_table_name, tg_op, public.chave_registro(coalesce(d, a)), a, d);
  return coalesce(new, old);
end $$;

-- liga o registro e o "atualizado_em" em todas as tabelas (menos a própria auditoria)
create or replace function public.tocar_atualizado() returns trigger language plpgsql as
$$ begin new.atualizado_em := now(); return new; end $$;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'auditoria' loop
    execute format('drop trigger if exists auditoria_t on public.%I', t.tablename);
    execute format('create trigger auditoria_t after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t.tablename);
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='atualizado_em') then
      execute format('drop trigger if exists atualizado_t on public.%I', t.tablename);
      execute format('create trigger atualizado_t before update on public.%I for each row execute function public.tocar_atualizado()', t.tablename);
    end if;
  end loop;
end $$;

-- ---------- poderes do superadmin ----------
-- desfazer qualquer alteração do registro (volta ao "antes"; apaga o que foi criado; recria o que foi excluído)
create or replace function public.desfazer(aud_id bigint) returns text language plpgsql security definer set search_path = public as
$$
declare a public.auditoria; pk text[]; cond text; cols text;
begin
  if not public.is_super() then raise exception 'Só o superadmin pode desfazer.'; end if;
  select * into a from public.auditoria where id = aud_id;
  if not found then raise exception 'Registro % não encontrado.', aud_id; end if;
  if a.operacao not in ('INSERT','UPDATE','DELETE') then raise exception 'Este registro não pode ser desfeito.'; end if;
  select array_agg(att.attname order by k.n) into pk
    from pg_index i cross join unnest(i.indkey) with ordinality as k(attnum, n)
    join pg_attribute att on att.attrelid = i.indrelid and att.attnum = k.attnum
   where i.indrelid = ('public.' || quote_ident(a.tabela))::regclass and i.indisprimary;
  select string_agg(format('%I = (r->>%L)::%s', c, c, format_type(att.atttypid, att.atttypmod)), ' and ') into cond
    from unnest(pk) c join pg_attribute att on att.attrelid = ('public.' || quote_ident(a.tabela))::regclass and att.attname = c;
  if a.operacao = 'INSERT' then
    execute format('delete from public.%I t using (select $1 as r) x where %s', a.tabela, replace(cond, 'r->>', 'x.r->>')) using a.depois;
  elsif a.operacao = 'DELETE' then
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', a.tabela, a.tabela) using a.antes;
  else
    select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns where table_schema='public' and table_name=a.tabela;
    execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where %s',
                   a.tabela, cols, cols, a.tabela, replace(cond, 'r->>', '$1->>')) using a.antes;
  end if;
  insert into public.auditoria(usuario, usuario_nome, tabela, operacao, registro, antes, depois)
  select id, nome, a.tabela, 'DESFAZER', a.registro, a.depois, a.antes from public.perfis where auth_id = auth.uid();
  return 'Desfeito: ' || a.operacao || ' em ' || a.tabela || ' (' || coalesce(a.registro,'') || ')';
end $$;

-- executar qualquer comando SQL pelo painel (somente superadmin; tudo fica no registro)
create or replace function public.super_sql(comando text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare res jsonb; n bigint;
begin
  if not public.is_super() then raise exception 'Só o superadmin pode executar SQL.'; end if;
  insert into public.auditoria(usuario, usuario_nome, tabela, operacao, registro, depois)
  select id, nome, '(sql)', 'SQL', left(comando, 120), jsonb_build_object('comando', comando) from public.perfis where auth_id = auth.uid();
  if comando ~* '^\s*(select|with)\s' then
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', comando) into res;
    return jsonb_build_object('linhas', res);
  end if;
  execute comando;
  get diagnostics n = row_count;
  return jsonb_build_object('afetadas', n);
end $$;
revoke all on function public.super_sql(text) from public, anon;
revoke all on function public.desfazer(bigint) from public, anon;
grant execute on function public.super_sql(text), public.desfazer(bigint) to authenticated;

-- painel geral do superadmin: movimento por dia e último registro de cada tabela
create or replace view public.v_atividade_dia with (security_invoker = true) as
select date_trunc('day', em at time zone 'America/Sao_Paulo')::date as dia, tabela, operacao, count(*) as total
  from public.auditoria group by 1,2,3;
create or replace view public.v_ultima_atividade with (security_invoker = true) as
select distinct on (tabela) tabela, em, usuario_nome, operacao, registro from public.auditoria order by tabela, em desc;

grant select, insert, update, delete on public.auditoria to authenticated;
grant select on public.v_atividade_dia, public.v_ultima_atividade to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.auditoria from anon;
