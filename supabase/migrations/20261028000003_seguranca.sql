-- Armant 360 · 003 · segurança: Row Level Security em todas as tabelas
-- Regra geral: o módulo libera por nível mínimo OU setor (tabela permissoes); obras só para quem está designado.
-- Superadmin (nível 6): uma regra "superadmin_tudo" em TODAS as tabelas libera ler, criar, alterar e excluir qualquer coisa.

create or replace function public.pode_algum(mods text[]) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from unnest(mods) m where public.pode(m)) $$;

-- 1) liga RLS e cria a regra do superadmin em todas as tabelas públicas
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('drop policy if exists superadmin_tudo on public.%I', t.tablename);
    execute format('create policy superadmin_tudo on public.%I for all to authenticated using (public.is_super()) with check (public.is_super())', t.tablename);
  end loop;
end $$;

-- 2) regras por módulo: (tabela, módulo que lê e grava, coluna da obra ou null, módulos extras que também gravam)
do $$
declare r record;
begin
  for r in select * from (values
    ('clientes','commercial',null,'{operations,finance}'),
    ('negociacoes','commercial',null,'{}'),
    ('demandas','operations',null,'{commercial,projects,finance}'),
    ('fornecedores','operations',null,'{almox,finance}'),
    ('obra_itens','projects','cc','{operations}'),
    ('obra_premissas','projects','cc','{finance}'),
    ('obra_lancamentos','projects','cc','{campo,operations}'),
    ('obra_lancamento_itens','projects',null,'{campo,operations}'),
    ('obra_aditivos','projects','cc','{campo,finance}'),
    ('obra_medicoes','projects','cc','{finance}'),
    ('materiais','almox',null,'{operations}'),
    ('mat_movimentos','almox',null,'{finance}'),
    ('mat_movimento_itens','almox',null,'{finance}'),
    ('mat_depara','almox',null,'{}'),
    ('mat_pedidos','almox',null,'{campo,operations}'),
    ('listas_materiais','operations',null,'{almox}'),
    ('fin_contas','finance',null,'{}'),
    ('fin_titulos','finance',null,'{frota,almox,rh}'),
    ('fin_recorrentes','finance',null,'{}'),
    ('fin_notas','finance',null,'{}'),
    ('fin_config','finance',null,'{}'),
    ('frota_veiculos','frota',null,'{campo}'),
    ('frota_uso','frota',null,'{campo}'),
    ('frota_abastecimentos','frota',null,'{campo}'),
    ('frota_manutencoes','frota',null,'{}'),
    ('frota_documentos','frota',null,'{}'),
    ('campo_tarefas','operations','cc','{campo}'),
    ('campo_presencas','campo','cc','{operations,rh}'),
    ('campo_ocorrencias','campo','cc','{operations,projects}'),
    ('campo_fim_servico','campo','cc','{operations,projects}'),
    ('campo_combustivel','campo','cc','{operations,frota}')
  ) as v(tabela, modulo, col, extras) loop
    execute format('drop policy if exists modulo_ler on public.%I', r.tabela);
    execute format('drop policy if exists modulo_gravar on public.%I', r.tabela);
    execute format('create policy modulo_ler on public.%I for select to authenticated using ((public.pode(%L) or public.pode_algum(%L::text[])) %s)',
      r.tabela, r.modulo, r.extras, case when r.col is null then '' else format('and public.ve_obra(%I)', r.col) end);
    execute format('create policy modulo_gravar on public.%I for all to authenticated using ((public.pode(%L) or public.pode_algum(%L::text[])) %s) with check ((public.pode(%L) or public.pode_algum(%L::text[])) %s)',
      r.tabela, r.modulo, r.extras, case when r.col is null then '' else format('and public.ve_obra(%I)', r.col) end,
      r.modulo, r.extras, case when r.col is null then '' else format('and public.ve_obra(%I)', r.col) end);
  end loop;
end $$;

-- 3) regras especiais
-- perfis: todos os ativos leem (nomes no chat e nas tarefas); quem tem "acesso" altera
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (public.ativo() or auth_id = auth.uid());
drop policy if exists perfis_gravar on public.perfis;
create policy perfis_gravar on public.perfis for all to authenticated using (public.pode('acesso') and nivel < 6) with check (public.pode('acesso') and nivel < 6);

drop policy if exists permissoes_ler on public.permissoes;
create policy permissoes_ler on public.permissoes for select to authenticated using (true);
drop policy if exists permissoes_gravar on public.permissoes;
create policy permissoes_gravar on public.permissoes for update to authenticated using (public.pode('acesso')) with check (public.pode('acesso') and modulo <> 'auditoria');

-- pedidos de acesso: quem entrou com Google sem perfil pode pedir com o próprio e-mail; a gestão de acesso vê e decide
drop policy if exists sol_pedir on public.solicitacoes_acesso;
create policy sol_pedir on public.solicitacoes_acesso for insert to authenticated with check (email = lower(auth.jwt()->>'email') and status = 'pendente');
drop policy if exists sol_gerir on public.solicitacoes_acesso;
create policy sol_gerir on public.solicitacoes_acesso for all to authenticated using (public.pode('acesso')) with check (public.pode('acesso'));
drop policy if exists sol_ver_o_meu on public.solicitacoes_acesso;
create policy sol_ver_o_meu on public.solicitacoes_acesso for select to authenticated using (email = lower(auth.jwt()->>'email'));

-- notificações: cada um vê e marca as suas; qualquer ativo pode avisar outro
drop policy if exists notif_minhas on public.notificacoes;
create policy notif_minhas on public.notificacoes for select to authenticated using (para = public.eu_id());
drop policy if exists notif_marcar on public.notificacoes;
create policy notif_marcar on public.notificacoes for update to authenticated using (para = public.eu_id()) with check (para = public.eu_id());
drop policy if exists notif_apagar on public.notificacoes;
create policy notif_apagar on public.notificacoes for delete to authenticated using (para = public.eu_id());
drop policy if exists notif_enviar on public.notificacoes;
create policy notif_enviar on public.notificacoes for insert to authenticated with check (public.ativo() and (de is null or de = public.eu_id()));

-- tarefas atribuídas: hierarquia (só para quem está abaixo; diretoria para qualquer um)
drop policy if exists atr_ver on public.atribuicoes;
create policy atr_ver on public.atribuicoes for select to authenticated using (de = public.eu_id() or para = public.eu_id() or (public.eu_nivel() >= 3 and public.nivel_de(para) < public.eu_nivel()));
drop policy if exists atr_criar on public.atribuicoes;
create policy atr_criar on public.atribuicoes for insert to authenticated with check (de = public.eu_id() and para <> de and (public.eu_nivel() >= 5 or public.nivel_de(para) < public.eu_nivel()));
drop policy if exists atr_mudar on public.atribuicoes;
create policy atr_mudar on public.atribuicoes for update to authenticated using (de = public.eu_id() or para = public.eu_id()) with check (de = public.eu_id() or para = public.eu_id());

-- chat: Geral para todos; grupo da obra para os designados; conversa direta só para os dois
create or replace function public.ve_conversa(cid text) returns boolean language sql stable security definer set search_path = public as
$$ select public.ativo() and (
     cid = 'geral'
  or (cid like 'obra:%' and public.ve_obra(substr(cid, 6)))
  or (cid like 'dm:%' and public.eu_id() = any(string_to_array(substr(cid, 4), '|')))) $$;
drop policy if exists conv_ver on public.chat_conversas;
create policy conv_ver on public.chat_conversas for select to authenticated using (public.ve_conversa(id));
drop policy if exists conv_criar on public.chat_conversas;
create policy conv_criar on public.chat_conversas for insert to authenticated with check (public.ve_conversa(id));
drop policy if exists msg_ver on public.chat_mensagens;
create policy msg_ver on public.chat_mensagens for select to authenticated using (public.ve_conversa(conversa_id));
drop policy if exists msg_enviar on public.chat_mensagens;
create policy msg_enviar on public.chat_mensagens for insert to authenticated with check (public.ve_conversa(conversa_id) and de = public.eu_id());
drop policy if exists leit_minhas on public.chat_leituras;
create policy leit_minhas on public.chat_leituras for all to authenticated using (perfil_id = public.eu_id()) with check (perfil_id = public.eu_id());
drop policy if exists leit_ver on public.chat_leituras;
create policy leit_ver on public.chat_leituras for select to authenticated using (public.ve_conversa(conversa_id));
drop policy if exists dest_ver on public.chat_destaques;
create policy dest_ver on public.chat_destaques for select to authenticated using (public.ve_conversa(conversa_id));
drop policy if exists dest_criar on public.chat_destaques;
create policy dest_criar on public.chat_destaques for insert to authenticated with check (por = public.eu_id() and public.ve_conversa(conversa_id));
drop policy if exists dest_resolver on public.chat_destaques;
create policy dest_resolver on public.chat_destaques for update to authenticated using (por = public.eu_id() or para = public.eu_id());

-- reuniões: quem marcou e os convidados
drop policy if exists reu_ver on public.reunioes;
create policy reu_ver on public.reunioes for select to authenticated using (por = public.eu_id() or public.eu_id() = any(participantes));
drop policy if exists reu_criar on public.reunioes;
create policy reu_criar on public.reunioes for insert to authenticated with check (por = public.eu_id() and public.pode('reunioes'));

-- RH: cada um vê o seu; o gestor (nível acima) vê a equipe para aprovar; o RH vê tudo
drop policy if exists via_ver on public.rh_viagens;
create policy via_ver on public.rh_viagens for select to authenticated using (solicitante = public.eu_id() or public.pode('rh') or public.nivel_de(solicitante) < public.eu_nivel());
drop policy if exists via_pedir on public.rh_viagens;
create policy via_pedir on public.rh_viagens for insert to authenticated with check (solicitante = public.eu_id() and status in ('solicitada','aprovada'));
drop policy if exists via_decidir on public.rh_viagens;
create policy via_decidir on public.rh_viagens for update to authenticated using (solicitante = public.eu_id() or public.pode('rh') or public.nivel_de(solicitante) < public.eu_nivel());
drop policy if exists doc_ver on public.rh_documentos;
create policy doc_ver on public.rh_documentos for select to authenticated using (perfil_id = public.eu_id() or public.pode('rh'));
drop policy if exists doc_enviar on public.rh_documentos;
create policy doc_enviar on public.rh_documentos for insert to authenticated with check (perfil_id = public.eu_id() or public.pode('rh'));
drop policy if exists doc_apagar on public.rh_documentos;
create policy doc_apagar on public.rh_documentos for delete to authenticated using (perfil_id = public.eu_id() or public.pode('rh'));

-- fase 1 (estado dos módulos): ativos leem e gravam; acessos e registro só quem pode
drop policy if exists estado_ler on public.estado_modulo;
create policy estado_ler on public.estado_modulo for select to authenticated using (public.ativo());
drop policy if exists estado_gravar on public.estado_modulo;
create policy estado_gravar on public.estado_modulo for all to authenticated
  using (public.ativo() and (chave <> 'a360acesso' or public.pode('acesso')))
  with check (public.ativo() and (chave <> 'a360acesso' or public.pode('acesso')));

-- 4) ninguém anônimo acessa nada
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
