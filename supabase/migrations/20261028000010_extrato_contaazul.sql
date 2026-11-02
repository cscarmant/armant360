-- Armant 360 · 010 · extrato bancário, conciliação e conexão com a Conta Azul

create or replace function public.gere_financeiro() returns boolean language sql stable security definer set search_path = public as
$$ select public.is_super() or (public.pode('finance') and public.eu_nivel() >= 4) $$;
grant execute on function public.gere_financeiro() to authenticated;

-- arquivos de extrato importados e seus lançamentos (fase 2; na fase 1 ficam no módulo a360extrato)
create table if not exists public.fin_extrato_lotes (
  id text primary key, conta_id text, arquivo text, formato text, saldo_final numeric(14,2), saldo_data date,
  qtd int, importado_por text, criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.fin_extrato_movimentos (
  id text primary key, lote_id text references public.fin_extrato_lotes(id) on delete cascade, conta_id text,
  data date not null, valor numeric(14,2) not null, descricao text, documento text, fitid text, chave text not null,
  titulo_id text references public.fin_titulos(id) on delete set null, conciliado_em date, conciliado_por text, ignorado text,
  atualizado_em timestamptz default now(), unique (chave));
create index if not exists fin_extrato_mov_conta on public.fin_extrato_movimentos(conta_id, data);

-- conexão com a Conta Azul: tokens OAuth só para o servidor (nenhuma regra = ninguém lê pelo site, nem o superadmin pelo app)
create table if not exists public.ca_conexao (
  id int primary key default 1 check (id = 1), estado text, voltar text, access_token text, refresh_token text, expira_em timestamptz,
  conectado_por text, conectado_em timestamptz, ultima_sinc timestamptz, atualizado_em timestamptz default now());

do $$
declare t text;
begin
  foreach t in array array['fin_extrato_lotes','fin_extrato_movimentos','ca_conexao'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['fin_extrato_lotes','fin_extrato_movimentos'] loop
    execute format('drop policy if exists superadmin_tudo on public.%I', t);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t);
    execute format('drop policy if exists financeiro_ler on public.%I', t);
    execute format('create policy financeiro_ler on public.%I for select to authenticated using (public.pode(''finance''))', t);
    execute format('drop policy if exists financeiro_gerir on public.%I', t);
    execute format('create policy financeiro_gerir on public.%I for all to authenticated using (public.pode(''finance'')) with check (public.pode(''finance''))', t);
    execute format('drop trigger if exists auditoria_t on public.%I', t);
    execute format('create trigger auditoria_t after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
    execute format('drop trigger if exists atualizado_t on public.%I', t);
    execute format('create trigger atualizado_t before update on public.%I for each row execute function public.tocar_atualizado()', t);
  end loop;
end $$;
grant select, insert, update, delete on public.fin_extrato_lotes, public.fin_extrato_movimentos to authenticated;
revoke all on public.fin_extrato_lotes, public.fin_extrato_movimentos, public.ca_conexao from anon;
revoke all on public.ca_conexao from authenticated;
