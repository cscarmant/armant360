-- Armant 360 · 001 · base: usuários (perfis), permissões e funções de acesso
-- Roda no Supabase (PostgreSQL 15+). Superadmin = nível 6: passa por todas as regras.

create extension if not exists pgcrypto;

-- ---------- perfis (um por pessoa; liga ao login do Google pelo e-mail) ----------
create table if not exists public.perfis (
  id          text primary key default ('USR-' || lpad((floor(random()*900000)+100000)::text, 6, '0')),
  auth_id     uuid unique references auth.users(id) on delete set null,
  nome        text not null,
  email       text not null unique check (email = lower(email)),
  nivel       int  not null default 1 check (nivel between 0 and 6),
  setor       text not null default 'Campo',
  funcao      text default '',
  obras       text[] not null default '{}',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.perfis is 'Pessoas do sistema. nivel: 6 Superadmin, 5 Diretoria, 4 Gerência, 3 Coordenação, 2 Administrativo e técnico, 1 Campo, 0 sem acesso.';

-- ---------- permissões por módulo: libera por nível mínimo OU setor ----------
create table if not exists public.permissoes (
  modulo     text primary key,
  nome       text not null,
  nivel_min  int  not null default 5,
  setores    text[] not null default '{}'
);
insert into public.permissoes(modulo, nome, nivel_min, setores) values
 ('overview','Visão geral',3,'{}'),
 ('projects','Obras & contratos',3,'{Obras,"Operação & CSC"}'),
 ('timeline','Cronograma & caixa',3,'{Obras,Financeiro}'),
 ('finance','Financeiro',4,'{Financeiro}'),
 ('commercial','Comercial',4,'{Comercial}'),
 ('operations','Operação & CSC',3,'{"Operação & CSC",Suprimentos,Obras}'),
 ('almox','Almoxarifado',3,'{Almoxarifado,Suprimentos,"Operação & CSC"}'),
 ('frota','Frota',3,'{Frota,"Operação & CSC"}'),
 ('rh','RH',5,'{RH}'),
 ('meurh','Meu RH',1,'{}'),
 ('pmoc','PMOC',3,'{"Manutenção (PMOC)","Operação & CSC"}'),
 ('catalog','Indicadores',3,'{}'),
 ('campo','App de campo',1,'{}'),
 ('atribuidas','Tarefas atribuídas',1,'{}'),
 ('chat','Chat',1,'{}'),
 ('reunioes','Reuniões',2,'{}'),
 ('acesso','Usuários e acessos',5,'{}'),
 ('auditoria','Painel do superadmin',6,'{}')
on conflict (modulo) do nothing;

-- ---------- pedidos de acesso ----------
create table if not exists public.solicitacoes_acesso (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null check (email = lower(email)),
  setor       text, funcao text, obra text, fone text,
  status      text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  decidido_por text, decidido_em timestamptz,
  criado_em   timestamptz not null default now()
);
create unique index if not exists solicitacoes_pendente_unica on public.solicitacoes_acesso(email) where status = 'pendente';

-- ---------- funções de acesso (usadas em todas as regras) ----------
create or replace function public.eu_id() returns text language sql stable security definer set search_path = public as
$$ select id from public.perfis where auth_id = auth.uid() and ativo limit 1 $$;
create or replace function public.eu_nivel() returns int language sql stable security definer set search_path = public as
$$ select coalesce((select nivel from public.perfis where auth_id = auth.uid() and ativo limit 1), 0) $$;
create or replace function public.eu_setor() returns text language sql stable security definer set search_path = public as
$$ select setor from public.perfis where auth_id = auth.uid() and ativo limit 1 $$;
create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as
$$ select public.eu_nivel() >= 6 $$;
create or replace function public.ativo() returns boolean language sql stable security definer set search_path = public as
$$ select public.eu_nivel() >= 1 $$;
create or replace function public.pode(mod text) returns boolean language sql stable security definer set search_path = public as
$$ select public.is_super() or exists (
     select 1 from public.permissoes p
     where p.modulo = mod and public.eu_nivel() >= 1
       and (public.eu_nivel() >= p.nivel_min or public.eu_setor() = any(p.setores))) $$;
create or replace function public.ve_obra(cc text) returns boolean language sql stable security definer set search_path = public as
$$ select public.is_super() or public.eu_nivel() >= 4 or exists (
     select 1 from public.perfis where auth_id = auth.uid() and ativo and cc = any(obras)) $$;
create or replace function public.nivel_de(pid text) returns int language sql stable security definer set search_path = public as
$$ select coalesce((select nivel from public.perfis where id = pid), 0) $$;

-- ---------- primeiro login com Google: liga ao perfil pelo e-mail ou cria pedido ----------
create or replace function public.ao_criar_login() returns trigger language plpgsql security definer set search_path = public as
$$
begin
  -- só e-mail confirmado (o Google já entrega confirmado): ninguém "toma" um perfil cadastrando o e-mail de outra pessoa
  if new.email_confirmed_at is null then return new; end if;
  begin
    update public.perfis set auth_id = new.id, atualizado_em = now()
     where email = lower(new.email) and auth_id is null;
    if not found and not exists (select 1 from public.perfis where email = lower(new.email)) then
      insert into public.solicitacoes_acesso(nome, email, status)
      values (coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), lower(new.email), 'pendente')
      on conflict do nothing;
    end if;
  exception when others then
    -- um erro aqui (ex.: aviso por e-mail fora do ar) nunca pode impedir o login; o vincular_login() tenta de novo ao entrar
    raise warning 'ao_criar_login: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists ao_criar_login on auth.users;
create trigger ao_criar_login after insert or update of email_confirmed_at on auth.users for each row execute function public.ao_criar_login();

-- quem sou eu (o site chama depois do login)
create or replace function public.eu_perfil() returns jsonb language sql stable security definer set search_path = public as
$$ select to_jsonb(p) - 'auth_id' from public.perfis p where p.auth_id = auth.uid() $$;
