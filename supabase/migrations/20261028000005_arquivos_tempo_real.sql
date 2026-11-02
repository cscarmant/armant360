-- Armant 360 · 005 · arquivos (fotos, documentos, notas) e tempo real (chat, avisos)

insert into storage.buckets (id, name, public, file_size_limit) values
  ('fotos-campo',   'fotos-campo',   false, 10485760),
  ('documentos-rh', 'documentos-rh', false, 10485760),
  ('notas-fiscais', 'notas-fiscais', false, 10485760),
  ('anexos',        'anexos',        false, 20971520)
on conflict (id) do nothing;

-- superadmin: tudo em todos os arquivos
drop policy if exists a360_super on storage.objects;
create policy a360_super on storage.objects for all to authenticated using (public.is_super()) with check (public.is_super());
-- fotos do campo e anexos: qualquer pessoa ativa envia e vê (pasta = centro de custo: CC-2026-001/arquivo.jpg)
drop policy if exists a360_fotos on storage.objects;
create policy a360_fotos on storage.objects for all to authenticated
  using (bucket_id in ('fotos-campo','anexos') and public.ativo() and public.ve_obra((storage.foldername(name))[1]))
  with check (bucket_id in ('fotos-campo','anexos') and public.ativo() and public.ve_obra((storage.foldername(name))[1]));
-- documentos do RH: pasta = id do perfil (USR-001/aso.pdf); a pessoa vê os seus, o RH vê todos
drop policy if exists a360_docs on storage.objects;
create policy a360_docs on storage.objects for all to authenticated
  using (bucket_id = 'documentos-rh' and ((storage.foldername(name))[1] = public.eu_id() or public.pode('rh')))
  with check (bucket_id = 'documentos-rh' and ((storage.foldername(name))[1] = public.eu_id() or public.pode('rh')));
-- notas fiscais: financeiro e almoxarifado
drop policy if exists a360_notas on storage.objects;
create policy a360_notas on storage.objects for all to authenticated
  using (bucket_id = 'notas-fiscais' and public.pode_algum(array['finance','almox']))
  with check (bucket_id = 'notas-fiscais' and public.pode_algum(array['finance','almox']));

-- tempo real: chat, avisos, tarefas e o estado da fase 1 chegam na hora em todos os aparelhos
do $$
declare t text;
begin
  foreach t in array array['chat_mensagens','chat_destaques','notificacoes','atribuicoes','campo_tarefas','estado_modulo'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
