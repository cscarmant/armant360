-- Armant 360 · 009 · certificado digital A1: dados do certificado, cofre do arquivo e aviso antes de expirar
-- A senha do certificado NUNCA é guardada. O arquivo .pfx fica no cofre "certificados" (privado),
-- que só o superadmin e a gestão do Financeiro (nível 4 ou mais com acesso ao Financeiro) abrem.

create or replace function public.gere_certificado() returns boolean language sql stable security definer set search_path = public as
$$ select public.is_super() or (public.pode('finance') and public.eu_nivel() >= 4) $$;

create table if not exists public.fin_certificados (
  id text primary key, tipo text not null default 'A1', titular text not null, cnpj text, emissor text,
  numero_serie text, impressao_digital text, valido_de date, valido_ate date not null,
  arquivo_nome text, arquivo_caminho text, ativo boolean not null default true,
  avisos jsonb not null default '{}', incluido_por text, criado_em timestamptz default now(), atualizado_em timestamptz default now());
create unique index if not exists fin_certificados_um_ativo on public.fin_certificados ((true)) where ativo;

alter table public.fin_certificados enable row level security;
drop policy if exists superadmin_tudo on public.fin_certificados;
create policy superadmin_tudo on public.fin_certificados for all to authenticated using (public.is_super()) with check (public.is_super());
drop policy if exists cert_ler on public.fin_certificados;
create policy cert_ler on public.fin_certificados for select to authenticated using (public.pode('finance'));
drop policy if exists cert_gerir on public.fin_certificados;
create policy cert_gerir on public.fin_certificados for all to authenticated using (public.gere_certificado()) with check (public.gere_certificado());
drop trigger if exists auditoria_t on public.fin_certificados;
create trigger auditoria_t after insert or update or delete on public.fin_certificados for each row execute function public.registrar_auditoria();
drop trigger if exists atualizado_t on public.fin_certificados;
create trigger atualizado_t before update on public.fin_certificados for each row execute function public.tocar_atualizado();
grant select, insert, update, delete on public.fin_certificados to authenticated;
revoke all on public.fin_certificados from anon;

-- cofre do arquivo
insert into storage.buckets (id, name, public, file_size_limit) values ('certificados', 'certificados', false, 1048576) on conflict (id) do nothing;
drop policy if exists a360_cert on storage.objects;
create policy a360_cert on storage.objects for all to authenticated
  using (bucket_id = 'certificados' and public.gere_certificado())
  with check (bucket_id = 'certificados' and public.gere_certificado());

-- certificado vigente: na fase 1 vem do módulo a360cert (estado_modulo); na fase 2, da tabela
create or replace view public.v_certificado_vigente with (security_invoker = true) as
select id, titular, cnpj, emissor, valido_ate, (valido_ate - (now() at time zone 'America/Sao_Paulo')::date) as dias_restantes, 'tabela' as origem
  from public.fin_certificados where ativo
union all
select e.dados->'atual'->>'id', e.dados->'atual'->>'titular', e.dados->'atual'->>'cnpj', e.dados->'atual'->>'emissor',
       (e.dados->'atual'->>'ate')::date, ((e.dados->'atual'->>'ate')::date - (now() at time zone 'America/Sao_Paulo')::date), 'fase1'
  from public.estado_modulo e
 where e.chave = 'a360cert' and e.dados->'atual'->>'ate' ~ '^\d{4}-\d{2}-\d{2}$'
   and not exists (select 1 from public.fin_certificados where ativo);
grant select on public.v_certificado_vigente to authenticated;

-- checagem diária (chamada pelo pg_cron, ligado por scripts/ligar-aviso-email.mjs):
-- avisa no app o superadmin e a gestão do Financeiro nos limites 60, 30, 15, 7, 3, 1 e 0 dia, e toda semana depois de vencido.
-- Cada limite avisa uma vez só; devolve o texto do aviso (ou null) para o e-mail.
create or replace function public.avisar_certificado() returns text language plpgsql security definer set search_path = public as
$$
declare c record; lim int; k text; txt text; tit text; ja jsonb;
begin
  select * into c from public.v_certificado_vigente limit 1;
  if not found or c.valido_ate is null then return null; end if;
  if c.dias_restantes > 60 then return null; end if;
  if c.dias_restantes < 0 then k := 'v' || floor(-c.dias_restantes / 7.0)::int;
  else select min(t) into lim from unnest(array[60,30,15,7,3,1,0]) t where c.dias_restantes <= t; k := lim::text; end if;
  if c.origem = 'tabela' then select avisos into ja from public.fin_certificados where id = c.id;
  else select coalesce(dados->'avisos', '{}') into ja from public.estado_modulo where chave = 'a360cert'; end if;
  if ja ? (c.id || ':' || k) then return null; end if;
  tit := case when c.dias_restantes < 0 then 'Certificado A1 vencido' when c.dias_restantes = 0 then 'Certificado A1 vence hoje'
              else 'Certificado A1 vence em ' || c.dias_restantes || ' dia(s)' end;
  txt := 'O certificado digital A1 da ' || c.titular || case when c.dias_restantes < 0 then ' VENCEU em ' else ' vence em ' end
         || to_char(c.valido_ate, 'DD/MM/YYYY') || '. Renove com a certificadora (' || coalesce(c.emissor, '—') || ') e inclua o novo em Financeiro → Notas fiscais.';
  insert into public.notificacoes(para, de_nome, tipo, titulo, texto, link)
  select p.id, 'Sistema', 'tarefa', tit, txt, '#finance/notas' from public.perfis p
   where p.ativo and (p.nivel >= 6 or (p.setor = 'Financeiro' and p.nivel >= 4));
  if c.origem = 'tabela' then update public.fin_certificados set avisos = avisos || jsonb_build_object(c.id || ':' || k, current_date) where id = c.id;
  else update public.estado_modulo set dados = jsonb_set(dados, '{avisos}', coalesce(dados->'avisos', '{}') || jsonb_build_object(c.id || ':' || k, current_date)), versao = versao + 1, atualizado_por = 'sistema' where chave = 'a360cert'; end if;
  return tit || '. ' || txt;
end $$;
revoke all on function public.avisar_certificado() from public, anon, authenticated;
