-- Armant 360 · 006 · fase 1: o protótipo atual grava cada módulo inteiro em estado_modulo
-- Gravação com controle de versão: se outra pessoa salvou antes, devolve o conflito e o site junta as mudanças.

create or replace function public.salvar_estado(p_chave text, p_dados jsonb, p_versao int) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare atual public.estado_modulo;
begin
  if not public.ativo() then raise exception 'Sem acesso.'; end if;
  if p_chave = 'a360acesso' and not public.pode('acesso') then raise exception 'Só a gestão de acessos altera usuários.'; end if;
  select * into atual from public.estado_modulo where chave = p_chave for update;
  if not found then
    insert into public.estado_modulo(chave, dados, versao, atualizado_por) values (p_chave, p_dados, 1, public.eu_id());
    return jsonb_build_object('ok', true, 'versao', 1);
  end if;
  if p_versao is distinct from atual.versao then
    return jsonb_build_object('ok', false, 'conflito', true, 'versao', atual.versao, 'dados', atual.dados, 'por', atual.atualizado_por);
  end if;
  update public.estado_modulo set dados = p_dados, versao = atual.versao + 1, atualizado_por = public.eu_id() where chave = p_chave;
  return jsonb_build_object('ok', true, 'versao', atual.versao + 1);
end $$;
grant execute on function public.salvar_estado(text, jsonb, int) to authenticated;

-- usuários cadastrados no app (Usuários e acessos) viram perfis no banco: o Google login liga pelo e-mail
create or replace function public.sincronizar_perfis(p_usuarios jsonb) returns int
language plpgsql security definer set search_path = public as
$$
declare u jsonb; n int := 0; nv int;
begin
  if not public.pode('acesso') then raise exception 'Sem permissão.'; end if;
  for u in select * from jsonb_array_elements(p_usuarios) loop
    nv := least(coalesce((u->>'nivel')::int, 1), case when public.is_super() then 6 else 5 end);
    insert into public.perfis(id, nome, email, nivel, setor, funcao, obras, ativo)
    values (u->>'id', u->>'nome', lower(u->>'email'), nv, coalesce(u->>'setor','Campo'), coalesce(u->>'funcao',''),
            coalesce(array(select jsonb_array_elements_text(coalesce(u->'obras','[]'::jsonb))), '{}'), coalesce((u->>'ativo')::boolean, true))
    on conflict (id) do update set nome = excluded.nome, email = excluded.email, nivel = excluded.nivel,
      setor = excluded.setor, funcao = excluded.funcao, obras = excluded.obras, ativo = excluded.ativo
      where public.is_super() or public.perfis.nivel < 6;   -- o superadmin só é alterado por outro superadmin
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.sincronizar_perfis(jsonb) to authenticated;
grant execute on function public.eu_perfil() to authenticated;
