-- Armant 360 · 016 · banco de notas fiscais (emissão e controle)
-- Dono: esta migração. Não altera fin_notas (de 002); ela fica como registro antigo de NFS-e.
-- Liga cada nota à obra (demandas.cc), ao cliente (clientes.id) e às saídas de material (mat_movimentos.id).
-- Por LGPD: o destinatário só pode ser pessoa jurídica (CNPJ). CPF não é guardado aqui.
-- Só o superadmin acessa (mesma regra do Banco de dados).

create table if not exists public.nf_notas (
  id text primary key,
  tipo text not null check (tipo in ('nfe_transporte','nfe_produto','nfse')),
  modelo text check (modelo in ('55','57','nfse')),
  serie text,
  numero int,
  status text not null default 'rascunho' check (status in ('rascunho','emitida','cancelada','rejeitada')),
  chave_acesso text unique check (chave_acesso is null or length(chave_acesso) = 44),
  protocolo text,
  emissao date not null default current_date,
  emitente_cnpj text not null check (length(regexp_replace(emitente_cnpj, '\D', '', 'g')) = 14),
  destinatario_cliente_id text references public.clientes(id),
  destinatario_nome text not null,
  destinatario_cnpj text check (destinatario_cnpj is null or length(regexp_replace(destinatario_cnpj, '\D', '', 'g')) = 14),
  cc text references public.demandas(cc),
  cfop text,
  natureza_operacao text,
  origem_deposito text,
  destino_texto text,
  transportador text,
  placa text,
  valor_total numeric(14,2) not null default 0 check (valor_total >= 0),
  mov_ids text[] not null default '{}',
  xml text,
  observacao text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  unique (modelo, serie, numero));

create table if not exists public.nf_itens (
  nota_id text not null references public.nf_notas(id) on delete cascade,
  item int not null,
  codigo text,
  descricao text not null,
  ncm text,
  un text,
  quantidade numeric(14,3) not null check (quantidade > 0),
  valor_unit numeric(14,4) not null default 0 check (valor_unit >= 0),
  valor_total numeric(14,2) generated always as (round(quantidade * valor_unit, 2)) stored,
  mov_id text references public.mat_movimentos(id),
  primary key (nota_id, item));

create table if not exists public.nf_eventos (
  id bigserial primary key,
  nota_id text not null references public.nf_notas(id) on delete cascade,
  quando timestamptz default now(),
  de text,
  para text,
  obs text);

create index if not exists nf_notas_cc on public.nf_notas(cc);
create index if not exists nf_notas_status on public.nf_notas(status);
create index if not exists nf_itens_mov on public.nf_itens(mov_id);

-- toda troca de situação fica registrada: o histórico é gravado depois que a nota existe (AFTER)
create or replace function public.nf_toca_data() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

create or replace function public.nf_registra_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.nf_eventos(nota_id, de, para, obs) values (new.id, null, new.status, 'criada');
  elsif new.status is distinct from old.status then
    insert into public.nf_eventos(nota_id, de, para) values (new.id, old.status, new.status);
  end if;
  return null;
end $$;

drop trigger if exists nf_notas_data_tr on public.nf_notas;
create trigger nf_notas_data_tr before update on public.nf_notas
  for each row execute function public.nf_toca_data();

drop trigger if exists nf_notas_status_tr on public.nf_notas;
create trigger nf_notas_status_tr after insert or update on public.nf_notas
  for each row execute function public.nf_registra_status();

-- resumo por obra: quanto já foi emitido e quanto está em rascunho
create or replace view public.v_nf_resumo with (security_invoker = true) as
  select cc, status, count(*) as notas, coalesce(sum(valor_total), 0) as valor
  from public.nf_notas group by cc, status;

alter table public.nf_notas enable row level security;
alter table public.nf_itens enable row level security;
alter table public.nf_eventos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nf_notas','nf_itens','nf_eventos'] loop
    execute format('drop policy if exists superadmin_tudo on public.%I', t);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t);
  end loop;
end $$;
