-- Teste local das regras de acesso (rodar depois dos stubs e das migrações). Cada linha "ok" deve dar true.
\set ON_ERROR_STOP 1
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000006','valentim.arr@gmail.com'),('00000000-0000-0000-0000-000000000001','campo.teste@gmail.com'),('00000000-0000-0000-0000-000000000002','financeiro.teste@gmail.com');
-- o superadmin vem da semente (099) e é ligado no primeiro login; os outros entram sem perfil e viram pedido
select (select auth_id from public.perfis where id='USR-001')='00000000-0000-0000-0000-000000000006' as ok_superadmin_ligado_no_login;
select count(*)=2 as ok_pedidos_criados from public.solicitacoes_acesso where status='pendente';
-- o administrador cria os perfis depois: o login que já existe é ligado e o pedido sai da fila
insert into public.perfis(id,nome,email,nivel,setor,obras) values ('USR-002','Carlos','campo.teste@gmail.com',1,'Campo','{CC-1}'),('USR-003','Fin','financeiro.teste@gmail.com',2,'Financeiro','{}');
select count(*)=2 as ok_perfis_ligados_ao_login from public.perfis where id in ('USR-002','USR-003') and auth_id is not null;
select count(*)=0 as ok_pedidos_aprovados from public.solicitacoes_acesso where status='pendente';
insert into public.clientes(id,razao) values ('CLI-001','TJ-RS');
insert into public.demandas(cc,cliente_id,nome) values ('CC-1','CLI-001','Obra 1'),('CC-2','CLI-001','Obra 2');
insert into public.campo_tarefas(id,data,cc,titulo,responsavel) values ('T1','2026-10-28','CC-1','Tarefa obra 1','Carlos'),('T2','2026-10-28','CC-2','Tarefa obra 2','Carlos');
insert into public.fin_titulos(id,tipo,descricao,valor,vencimento) values ('TIT-1','pag','Compra',100,'2026-11-01');
insert into public.chat_conversas(id,tipo) values ('obra:CC-1','obra'),('obra:CC-2','obra');
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub',uid,'email',(select email from auth.users where id=uid::uuid))::text, false) $$;
grant select on auth.users to authenticated;

set role authenticated;
-- CAMPO
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select public.eu_id()='USR-002' as ok_campo_identificado;
select public.vincular_login()->>'id'='USR-002' as ok_vincular_login_devolve_perfil;
select (select count(*) from public.campo_tarefas)=1 as ok_campo_ve_so_obra_designada;
select (select count(*) from public.fin_titulos)=0 as ok_campo_nao_ve_financeiro;
insert into public.chat_mensagens(conversa_id,de,texto) values ('obra:CC-1','USR-002','Bom dia');
select (select count(*) from public.chat_mensagens)=1 as ok_campo_escreve_no_grupo_da_obra;
do $$ begin insert into public.chat_mensagens(conversa_id,de,texto) values ('obra:CC-2','USR-002','x'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_campo_bloqueado_em_outra_obra'; end $$;
do $$ begin insert into public.atribuicoes(id,de,para,titulo) values ('A0','USR-002','USR-003','x'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_campo_nao_atribui_para_nivel_acima'; end $$;
insert into public.notificacoes(para,de,titulo) values ('USR-003','USR-002','Aviso para o financeiro');
select (select count(*) from public.notificacoes)=0 as ok_campo_nao_le_aviso_dos_outros;
select (public.salvar_estado('a360campo','{"x":1}'::jsonb,null)->>'ok')::boolean as ok_estado_salvo_v1;
select (public.salvar_estado('a360campo','{"x":2}'::jsonb,0)->>'conflito')::boolean as ok_conflito_detectado;
select (public.salvar_estado('a360campo','{"x":2}'::jsonb,1)->>'versao')='2' as ok_estado_salvo_v2;
do $$ begin perform public.salvar_estado('a360acesso','{}'::jsonb,null); raise exception 'falhou'; exception when raise_exception then raise notice 'ok_campo_nao_altera_usuarios'; end $$;
do $$ begin perform public.super_sql('select 1'); raise exception 'falhou'; exception when raise_exception then if sqlerrm like 'Só o superadmin%' then raise notice 'ok_campo_sem_super_sql'; else raise; end if; end $$;
-- FINANCEIRO
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select (select count(*) from public.fin_titulos)=1 as ok_fin_ve_titulos;
select (select count(*) from public.notificacoes)=1 as ok_fin_recebe_aviso;
select (select count(*) from public.campo_tarefas)=0 as ok_fin_nao_ve_campo;
update public.fin_titulos set valor=150 where id='TIT-1';
-- SUPERADMIN
select pg_temp.como('00000000-0000-0000-0000-000000000006');
select public.is_super() as ok_super;
select (select count(*) from public.campo_tarefas)=2 and (select count(*) from public.fin_titulos)=1 and (select count(*) from public.notificacoes)=1 as ok_super_ve_tudo;
select (select count(*) from public.auditoria where tabela='fin_titulos' and operacao='UPDATE' and usuario_nome='Fin')=1 as ok_registro_quem_alterou;
select public.desfazer((select id from public.auditoria where tabela='fin_titulos' and operacao='UPDATE' order by id desc limit 1)) is not null as ok_desfazer;
select (select valor from public.fin_titulos where id='TIT-1')=100 as ok_valor_voltou;
select (public.super_sql('select count(*) as n from public.perfis')->'linhas'->0->>'n')='3' as ok_super_sql_consulta;
select (public.super_sql('update public.perfis set funcao=''teste'' where id=''USR-003''')->>'afetadas')='1' as ok_super_sql_altera;
delete from public.campo_tarefas where id='T2';
select public.desfazer((select id from public.auditoria where tabela='campo_tarefas' and operacao='DELETE' order by id desc limit 1)) is not null as ok_desfazer_exclusao;
select (select count(*) from public.campo_tarefas)=2 as ok_tarefa_voltou;
select public.sincronizar_perfis('[{"id":"USR-009","nome":"Novo","email":"novo@gmail.com","nivel":2,"setor":"Obras","obras":["CC-2"]}]'::jsonb)=1 as ok_sincronizou_perfil;
select (select count(*) from public.v_ultima_atividade)>0 as ok_painel_tempos;
reset role;
-- cadastro por e-mail ainda não confirmado não toma o perfil de ninguém
insert into public.perfis(id,nome,email,nivel,setor) values ('USR-010','Alvo','alvo@gmail.com',5,'Diretoria');
insert into auth.users(id,email,email_confirmed_at) values ('00000000-0000-0000-0000-000000000010','alvo@gmail.com',null);
select (select auth_id from public.perfis where id='USR-010') is null as ok_email_nao_confirmado_nao_liga;
update auth.users set email_confirmed_at=now() where id='00000000-0000-0000-0000-000000000010';
select (select auth_id from public.perfis where id='USR-010')='00000000-0000-0000-0000-000000000010' as ok_liga_quando_confirma;
-- documentos do RH na fase 1: o dono e o RH veem; os outros não
set role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000001');
insert into storage.objects(bucket_id,name) values ('anexos','fase1/DOC-00001'),('anexos','fase1/FOTO-1');
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select (select count(*) from storage.objects where name='fase1/DOC-00001')=0 as ok_documento_rh_de_outro_nao_aparece;
select (select count(*) from storage.objects where name='fase1/FOTO-1')=1 as ok_foto_fase1_aparece_para_ativos;
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select (select count(*) from storage.objects where name='fase1/DOC-00001')=1 as ok_dono_ve_o_proprio_documento;
reset role;
-- gestor (nível 5) não rebaixa nem desativa o superadmin pela lista do app
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000005','gestor@gmail.com');
insert into public.perfis(id,nome,email,nivel,setor) values ('USR-005','Gestor','gestor@gmail.com',5,'Diretoria');
set role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000005');
select public.sincronizar_perfis('[{"id":"USR-001","nome":"X","email":"valentim.arr@gmail.com","nivel":1,"setor":"Campo","ativo":false},{"id":"USR-011","nome":"Novo","email":"novo11@gmail.com","nivel":6}]'::jsonb);
reset role;
select (select nivel=6 and ativo from public.perfis where id='USR-001') as ok_gestor_nao_mexe_no_superadmin;
select (select nivel from public.perfis where id='USR-011')=5 as ok_gestor_nao_cria_superadmin;
-- novo login com e-mail já cadastrado liga ao perfil
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000009','novo@gmail.com');
select (select auth_id from public.perfis where id='USR-009')='00000000-0000-0000-0000-000000000009' as ok_login_google_ligou_perfil;
