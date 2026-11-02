-- Armant 360 · 008 · Controle de obras, R.O. por obra, atividades da demanda (só o superadmin altera),
-- documentos da demanda, tarefas de campo ligadas às atividades e diário de obra enviado com atraso

-- ---------- R.O. e CSC de cada obra passam a ser pessoas cadastradas ----------
alter table public.demandas add column if not exists ro_id text references public.perfis(id) on delete set null;
alter table public.demandas add column if not exists csc_id text references public.perfis(id) on delete set null;
create or replace function public.eh_ro(p_cc text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.demandas where cc = p_cc and ro_id is not null and ro_id = public.eu_id()) $$;

-- ---------- atividades da demanda aprovada: atividade, quantidade, valor ----------
create table if not exists public.demanda_itens (
  cc text not null references public.demandas(cc) on delete cascade,
  id text not null,
  codigo text, atividade text not null, qtd numeric(14,4) not null check (qtd > 0), un text,
  valor numeric(14,2) not null check (valor > 0), grupo text, origem text,
  criado_em timestamptz default now(), atualizado_em timestamptz default now(),
  primary key (cc, id));
create or replace view public.v_demanda_totais with (security_invoker = true) as
select cc, count(*) as atividades, sum(valor) as total from public.demanda_itens group by cc;

-- ---------- documentos da demanda (e-mail de aprovação, orçamento, laudo, ficha) ----------
create table if not exists public.demanda_documentos (
  id text primary key, cc text not null references public.demandas(cc) on delete cascade,
  nome text not null, mime text, tamanho bigint, caminho text, enviado_por text, criado_em timestamptz default now(), atualizado_em timestamptz default now());

-- ---------- controle de obras ----------
create table if not exists public.obra_atividades (
  id text primary key, cc text not null references public.demandas(cc) on delete cascade,
  item_id text, titulo text not null, qtd numeric(14,4), un text,
  responsavel text references public.perfis(id) on delete set null,
  inicio date, prazo date not null,
  classificacao text not null default 'andamento' check (classificacao in ('urgente','andamento','restricao','concluido')),
  restricao text, obs text, concluida_em date, criado_por text, historico jsonb default '[]',
  criado_em timestamptz default now(), atualizado_em timestamptz default now(),
  check (classificacao <> 'restricao' or coalesce(restricao,'') <> ''),
  check (inicio is null or prazo >= inicio));
create index if not exists obra_atividades_cc on public.obra_atividades(cc, prazo);
-- "Atrasado" não se grava: é calculado (passou do prazo sem concluir)
create or replace view public.v_obra_atividades with (security_invoker = true) as
select a.*, case when a.classificacao = 'concluido' then 'concluido'
                 when a.prazo < (now() at time zone 'America/Sao_Paulo')::date then 'atrasado'
                 else a.classificacao end as classificacao_efetiva
  from public.obra_atividades a;

-- tarefas de campo mandadas pelo R.O. a partir de uma atividade
alter table public.campo_tarefas add column if not exists atividade_id text references public.obra_atividades(id) on delete set null;

-- ---------- diário de obra enviado com atraso (app de campo) ----------
create table if not exists public.campo_diarios (
  id text primary key, cc text not null, data date not null, por text not null,
  enviado_em timestamptz not null default now(), atraso_dias int, motivo text,
  equipe jsonb default '[]', servicos text not null, ocorrencias text, clima text, fotos text[] default '{}',
  atualizado_em timestamptz default now(),
  check (data < (enviado_em at time zone 'America/Sao_Paulo')::date));

-- ---------- permissões ----------
insert into public.permissoes(modulo, nome, nivel_min, setores) values ('controle','Controle de obras',1,'{}') on conflict (modulo) do nothing;
update public.permissoes set nome = 'Dia a Dia' where modulo = 'atribuidas';

do $$
declare t text;
begin
  foreach t in array array['demanda_itens','demanda_documentos','obra_atividades','campo_diarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists superadmin_tudo on public.%I', t);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t);
    execute format('drop trigger if exists auditoria_t on public.%I', t);
    execute format('create trigger auditoria_t after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
    execute format('drop trigger if exists atualizado_t on public.%I', t);
    execute format('create trigger atualizado_t before update on public.%I for each row execute function public.tocar_atualizado()', t);
  end loop;
end $$;

-- atividades da demanda: quem trabalha com a obra lê; SÓ o superadmin cria, altera e exclui (regra superadmin_tudo)
drop policy if exists itens_ler on public.demanda_itens;
create policy itens_ler on public.demanda_itens for select to authenticated
  using (public.pode_algum(array['operations','projects','finance','commercial']) or public.eh_ro(cc));

-- documentos da demanda: Operação & CSC, Obras e o R.O. da obra
drop policy if exists docs_dem on public.demanda_documentos;
create policy docs_dem on public.demanda_documentos for all to authenticated
  using (public.pode_algum(array['operations','projects']) or public.eh_ro(cc))
  with check (public.pode_algum(array['operations','projects']) or public.eh_ro(cc));

-- controle de obras: a gestão (Operação & CSC, Obras) e o R.O. da obra decidem; o responsável vê e muda a classificação das suas
drop policy if exists atv_ler on public.obra_atividades;
create policy atv_ler on public.obra_atividades for select to authenticated
  using ((public.pode_algum(array['operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc) or responsavel = public.eu_id());
drop policy if exists atv_gerir on public.obra_atividades;
create policy atv_gerir on public.obra_atividades for all to authenticated
  using ((public.pode_algum(array['operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc))
  with check ((public.pode_algum(array['operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc));
drop policy if exists atv_responsavel on public.obra_atividades;
create policy atv_responsavel on public.obra_atividades for update to authenticated
  using (responsavel = public.eu_id()) with check (responsavel = public.eu_id());
-- o responsável só muda a classificação, a restrição e a observação (o resto é do R.O.)
create or replace function public.atv_so_classificacao() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if public.is_super() or public.eh_ro(new.cc) or (public.pode_algum(array['operations','projects']) and public.ve_obra(new.cc)) then return new; end if;
  if (new.cc, new.titulo, new.qtd, new.un, new.responsavel, new.inicio, new.prazo, new.item_id)
     is distinct from (old.cc, old.titulo, old.qtd, old.un, old.responsavel, old.inicio, old.prazo, old.item_id) then
    raise exception 'Só o R.O. da obra altera a atividade; você pode mudar a classificação.';
  end if;
  return new;
end $$;
drop trigger if exists atv_so_classificacao_t on public.obra_atividades;
create trigger atv_so_classificacao_t before update on public.obra_atividades for each row execute function public.atv_so_classificacao();

-- o R.O. programa tarefas de campo das obras dele
drop policy if exists campo_ro on public.campo_tarefas;
create policy campo_ro on public.campo_tarefas for all to authenticated using (public.eh_ro(cc)) with check (public.eh_ro(cc));

-- diário atrasado: quem trabalha no campo daquela obra envia; Operação, Obras e o R.O. leem
drop policy if exists diario_ler on public.campo_diarios;
create policy diario_ler on public.campo_diarios for select to authenticated
  using ((public.pode_algum(array['campo','operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc));
drop policy if exists diario_enviar on public.campo_diarios;
create policy diario_enviar on public.campo_diarios for insert to authenticated
  with check (public.pode('campo') and public.ve_obra(cc));

grant select, insert, update, delete on public.demanda_itens, public.demanda_documentos, public.obra_atividades, public.campo_diarios to authenticated;
grant select on public.v_demanda_totais, public.v_obra_atividades to authenticated;
revoke all on public.demanda_itens, public.demanda_documentos, public.obra_atividades, public.campo_diarios from anon;

do $$ begin
  alter publication supabase_realtime add table public.obra_atividades;
exception when duplicate_object then null; end $$;
