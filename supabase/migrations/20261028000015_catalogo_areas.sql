-- Armant 360 · 015 · catálogo de referência por área (Civil, Elétrica, Mecânica · HVAC)
-- Dono: esta migração. Não redefine nenhuma tabela das migrações 002 a 014.
-- Fornecedores em uso pela Armant continuam na chave a360cad (fase 1); esta tabela é a referência de mercado.
-- Só o superadmin escreve (mesma regra do Banco de dados). Leitura também só do superadmin nesta fase.

create table if not exists public.catalogo_fornecedores (
  id text primary key,
  area text not null check (area in ('civil','eletrica','mecanica')),
  nome text not null,
  cidade text, uf text,
  tipo text check (tipo in ('fabricante','distribuidor','locadora','serviço')),
  vende text, fonte text,
  status text not null default 'confirmar' check (status in ('confirmar','validado','descartado')),
  criado_em timestamptz default now(), atualizado_em timestamptz default now());

create table if not exists public.catalogo_materiais (
  id text primary key,
  area text not null check (area in ('civil','eletrica','mecanica')),
  categoria text not null,
  itens text[] not null default '{}',
  criado_em timestamptz default now());

create table if not exists public.catalogo_equipamentos (
  id text primary key,
  area text not null check (area in ('civil','eletrica','mecanica')),
  nome text not null,
  tipo text, obs text,
  criado_em timestamptz default now());

create table if not exists public.catalogo_servicos (
  id text primary key,
  area text not null check (area in ('civil','eletrica','mecanica')),
  nome text not null,
  unidade text,
  criado_em timestamptz default now());

do $$
declare t text;
begin
  foreach t in array array['catalogo_fornecedores','catalogo_materiais','catalogo_equipamentos','catalogo_servicos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists superadmin_tudo on public.%I', t);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t);
  end loop;
end $$;
