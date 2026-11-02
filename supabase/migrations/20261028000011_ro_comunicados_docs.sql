-- Armant 360 · 011 · Menu do R.O. (triagem dos pedidos de material → almoxarifado e compras),
-- gestão de comunicados (grupos no app, comunicados com "ciente") e documentos técnicos das tarefas
-- (laudo técnico e solicitação de acesso). Na fase 1 tudo isso vive nos módulos a360mat, a360com e a360docs
-- (estado_modulo); estas tabelas são a casa da fase 2 e já valem para consultas e relatórios.

-- ---------- pedidos de material: triagem do R.O. e compras ----------
alter table public.mat_pedidos alter column status set default 'triagem';
alter table public.mat_pedidos add column if not exists prioridade text default 'normal' check (prioridade in ('normal','urgente'));
alter table public.mat_pedidos add column if not exists nota_ro text;
alter table public.mat_pedidos add column if not exists motivo text;
alter table public.mat_pedidos add column if not exists origem_id text references public.mat_pedidos(id) on delete set null;
alter table public.mat_pedidos add column if not exists itens_pedidos jsonb;
alter table public.mat_pedidos add column if not exists triado_em timestamptz;
alter table public.mat_pedidos add column if not exists triado_por text;
alter table public.mat_pedidos add column if not exists compra jsonb;
alter table public.mat_pedidos add column if not exists historico jsonb default '[]';
alter table public.mat_pedidos drop constraint if exists mat_pedidos_status_ck;
alter table public.mat_pedidos add constraint mat_pedidos_status_ck check (status in ('triagem','aberto','compras','comprado','atendido','recusado'));

-- regras antigas (003) deixavam qualquer pessoa com App de campo gravar pedidos de qualquer obra: agora
--   o campo só CRIA pedidos (em triagem) das obras em que está designado e lê os dessas obras;
--   almoxarifado e a gestão de Operação & CSC leem e atualizam todos.
drop policy if exists modulo_ler on public.mat_pedidos;
drop policy if exists modulo_gravar on public.mat_pedidos;
drop policy if exists ped_ler on public.mat_pedidos;
create policy ped_ler on public.mat_pedidos for select to authenticated
  using (public.pode_algum(array['almox','operations']) or (public.pode('campo') and public.ve_obra(cc)));
drop policy if exists ped_campo_criar on public.mat_pedidos;
create policy ped_campo_criar on public.mat_pedidos for insert to authenticated
  with check (public.pode('campo') and public.ve_obra(cc) and status = 'triagem');
drop policy if exists ped_gestao on public.mat_pedidos;
create policy ped_gestao on public.mat_pedidos for all to authenticated
  using (public.pode_algum(array['almox','operations'])) with check (public.pode_algum(array['almox','operations']));
-- o R.O. da obra lê e tria os pedidos das obras dele; compras (Suprimentos) lê e atualiza os que foram para compra
drop policy if exists ped_ro on public.mat_pedidos;
create policy ped_ro on public.mat_pedidos for all to authenticated using (public.eh_ro(cc)) with check (public.eh_ro(cc));
drop policy if exists ped_compras on public.mat_pedidos;
create policy ped_compras on public.mat_pedidos for select to authenticated using (public.pode('compras') and status in ('compras','comprado','aberto','atendido'));
drop policy if exists ped_compras_upd on public.mat_pedidos;
create policy ped_compras_upd on public.mat_pedidos for update to authenticated
  using (public.pode('compras') and status in ('compras','comprado'))
  with check (public.pode('compras') and status in ('compras','comprado','aberto','triagem'));
create or replace view public.v_pedidos_material with (security_invoker = true) as
select p.id, p.cc, p.quem, p.data, p.para, p.status, p.prioridade, p.nota_ro, p.motivo, p.origem_id, p.compra->>'fornecedor' as fornecedor,
       p.compra->>'oc' as ordem_compra, (p.compra->>'previsao')::date as previsao, jsonb_array_length(coalesce(p.itens,'[]')) as qtd_itens,
       (p.status = 'comprado' and (p.compra->>'previsao')::date < (now() at time zone 'America/Sao_Paulo')::date) as compra_atrasada
  from public.mat_pedidos p;
grant select on public.v_pedidos_material to authenticated;

-- ---------- comunicados ----------
create table if not exists public.com_grupos (
  id text primary key, nome text not null, descricao text,
  regra jsonb not null default '{}',            -- {todos, setores[], obras[], nivel}
  pessoas text[] not null default '{}',          -- ids de perfis escolhidos à mão
  chat boolean not null default true, ativo boolean not null default true,
  criado_por text references public.perfis(id) on delete set null, criado_em timestamptz default now(), atualizado_em timestamptz default now());
create unique index if not exists com_grupos_nome on public.com_grupos (lower(nome)) where ativo;
create table if not exists public.comunicados (
  id text primary key, titulo text not null check (length(titulo) <= 120), texto text not null check (length(texto) <= 4000),
  prioridade text not null default 'normal' check (prioridade in ('normal','importante','urgente')),
  pede_ciente boolean not null default true, grupos text[] not null default '{}', de text references public.perfis(id) on delete set null,
  criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.comunicado_destinos (
  comunicado_id text references public.comunicados(id) on delete cascade, perfil_id text references public.perfis(id) on delete cascade,
  lido_em timestamptz, ciente_em timestamptz, primary key (comunicado_id, perfil_id));
alter table public.chat_conversas drop constraint if exists chat_conversas_tipo_check;
alter table public.chat_conversas add constraint chat_conversas_tipo_check check (tipo in ('geral','obra','dm','grupo'));

-- membros de um grupo (pela regra e pelas pessoas escolhidas)
create or replace function public.membros_grupo(p_grupo text) returns setof text language sql stable security definer set search_path = public as
$$ select p.id from public.perfis p, public.com_grupos g
    where g.id = p_grupo and g.ativo and p.ativo
      and (p.id = any(g.pessoas) or coalesce((g.regra->>'todos')::boolean,false)
           or p.setor in (select jsonb_array_elements_text(coalesce(g.regra->'setores','[]')))
           or exists (select 1 from jsonb_array_elements_text(coalesce(g.regra->'obras','[]')) o where o = any(p.obras))
           or (coalesce((g.regra->>'nivel')::int,0) > 0 and p.nivel >= (g.regra->>'nivel')::int)) $$;
create or replace function public.gere_comunicados() returns boolean language sql stable security definer set search_path = public as
$$ select public.is_super() or public.eu_nivel() >= 4 or exists (select 1 from public.perfis where id = public.eu_id() and setor in ('RH','Diretoria')) $$;

-- ---------- documentos técnicos das tarefas ----------
alter table public.obra_atividades add column if not exists tipo text check (tipo in ('laudo','acesso'));
create table if not exists public.obra_documentos_tecnicos (
  atividade_id text primary key references public.obra_atividades(id) on delete cascade,
  cc text not null, tipo text not null check (tipo in ('laudo','acesso')),
  revisao int not null default 0, emissoes jsonb not null default '[]',
  dados jsonb not null default '{}',   -- campos do laudo ou da solicitação. NUNCA RG/CPF (LGPD): a checagem abaixo recusa CPF formatado (000.000.000-00)
                                       -- e campos cpf/rg; números soltos (telefone, número de série, patrimônio) passam
  fotos text[] not null default '{}',  -- caminhos no cofre "anexos"
  atualizado_por text, criado_em timestamptz default now(), atualizado_em timestamptz default now(),
  check (dados::text !~ '\d{3}\.\d{3}\.\d{3}-\d{2}' and not (dados ?| array['cpf','rg'])));

-- ---------- RLS, auditoria e carimbo de atualização ----------
do $$
declare t text;
begin
  foreach t in array array['com_grupos','comunicados','comunicado_destinos','obra_documentos_tecnicos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists superadmin_tudo on public.%I', t);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t);
    execute format('drop trigger if exists auditoria_t on public.%I', t);
    execute format('create trigger auditoria_t after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
    if t <> 'comunicado_destinos' then
      execute format('drop trigger if exists atualizado_t on public.%I', t);
      execute format('create trigger atualizado_t before update on public.%I for each row execute function public.tocar_atualizado()', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

drop policy if exists grp_ler on public.com_grupos;
create policy grp_ler on public.com_grupos for select to authenticated using (public.gere_comunicados() or public.eu_id() in (select public.membros_grupo(id)));
drop policy if exists grp_gerir on public.com_grupos;
create policy grp_gerir on public.com_grupos for all to authenticated using (public.gere_comunicados()) with check (public.gere_comunicados());
drop policy if exists com_ler on public.comunicados;
create policy com_ler on public.comunicados for select to authenticated
  using (public.gere_comunicados() or exists (select 1 from public.comunicado_destinos d where d.comunicado_id = id and d.perfil_id = public.eu_id()));
drop policy if exists com_enviar on public.comunicados;
create policy com_enviar on public.comunicados for insert to authenticated with check (public.gere_comunicados() and de = public.eu_id());
drop policy if exists dest_ler on public.comunicado_destinos;
create policy dest_ler on public.comunicado_destinos for select to authenticated using (perfil_id = public.eu_id() or public.gere_comunicados());
drop policy if exists dest_gerir on public.comunicado_destinos;
create policy dest_gerir on public.comunicado_destinos for insert to authenticated with check (public.gere_comunicados());
-- cada pessoa só marca o próprio "lido" e "ciente"
drop policy if exists dest_ciente on public.comunicado_destinos;
create policy dest_ciente on public.comunicado_destinos for update to authenticated using (perfil_id = public.eu_id()) with check (perfil_id = public.eu_id());

drop policy if exists doc_tec on public.obra_documentos_tecnicos;
create policy doc_tec on public.obra_documentos_tecnicos for all to authenticated
  using ((public.pode_algum(array['operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc)
         or exists (select 1 from public.obra_atividades a where a.id = atividade_id and a.responsavel = public.eu_id()))
  with check ((public.pode_algum(array['operations','projects']) and public.ve_obra(cc)) or public.eh_ro(cc)
         or exists (select 1 from public.obra_atividades a where a.id = atividade_id and a.responsavel = public.eu_id()));

-- ---------- permissões dos novos módulos ----------
insert into public.permissoes(modulo, nome, nivel_min, setores) values
  ('ro','Menu do R.O.',4,'{Obras,"Operação & CSC"}'),
  ('compras','Compras',4,'{Suprimentos,"Operação & CSC"}'),
  ('comunicados','Comunicados',1,'{}')
on conflict (modulo) do nothing;
