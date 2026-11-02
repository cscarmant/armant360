-- Armant 360 · 007 · liga o login do Google ao perfil e libera os anexos da fase 1

-- Quem pediu acesso entrou com o Google antes de ter perfil. Quando o administrador cria o perfil
-- (pelo app ou pelo painel), o próximo acesso dessa pessoa liga o login ao perfil pelo e-mail.
create or replace function public.vincular_login() returns jsonb language plpgsql security definer set search_path = public as
$$
declare mail text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null or mail is null then return null; end if;
  update public.perfis set auth_id = auth.uid() where email = mail and auth_id is null
     and not exists (select 1 from public.perfis where auth_id = auth.uid());
  if not exists (select 1 from public.perfis where auth_id = auth.uid()) then
    insert into public.solicitacoes_acesso(nome, email, status)
    values (coalesce(auth.jwt()->'user_metadata'->>'full_name', split_part(mail,'@',1)), mail, 'pendente')
    on conflict do nothing;
  end if;
  return public.eu_perfil();
end $$;
revoke all on function public.vincular_login() from public, anon;
grant execute on function public.vincular_login() to authenticated;

-- quando um perfil é criado ou o e-mail muda, procura um login do Google que já exista com aquele e-mail
create or replace function public.ligar_perfil_existente() returns trigger language plpgsql security definer set search_path = public, auth as
$$
begin
  if new.auth_id is null then
    select u.id into new.auth_id from auth.users u
     where lower(u.email) = new.email and u.email_confirmed_at is not null and not exists (select 1 from public.perfis p where p.auth_id = u.id and p.id <> new.id);
  end if;
  if new.auth_id is not null then
    update public.solicitacoes_acesso set status = 'aprovado', decidido_em = now(), decidido_por = coalesce(public.eu_id(), 'sistema')
     where email = new.email and status = 'pendente';
  end if;
  return new;
end $$;
drop trigger if exists ligar_perfil_t on public.perfis;
create trigger ligar_perfil_t before insert or update of email on public.perfis for each row execute function public.ligar_perfil_existente();

-- fase 1: arquivos do protótipo ficam em anexos/fase1/<id>.
-- Fotos e anexos: qualquer pessoa ativa. Documentos do RH (DOC-…): só quem enviou e o RH (dados pessoais, LGPD).
create or replace function public.ve_arquivo_fase1(nome text, dono text) returns boolean language sql stable security definer set search_path = public as
$$ select public.ativo() and (nome not like 'fase1/DOC-%' or dono = auth.uid()::text or public.pode('rh')) $$;
drop policy if exists a360_fase1 on storage.objects;
create policy a360_fase1 on storage.objects for all to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = 'fase1' and public.ve_arquivo_fase1(name, coalesce(owner_id, owner::text)))
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = 'fase1' and public.ativo());

-- pedidos de acesso chegam ao app em tempo real (o sino do administrador)
do $$ begin
  alter publication supabase_realtime add table public.solicitacoes_acesso;
exception when duplicate_object then null; end $$;
