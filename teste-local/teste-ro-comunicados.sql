-- Teste local da migração 011 (rodar depois de teste-permissoes.sql e teste-controle.sql, no mesmo banco). Cada "ok" deve dar true.
\set ON_ERROR_STOP 1
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000040','compras.teste@gmail.com');
insert into public.perfis(id,nome,email,nivel,setor) values ('USR-040','Sara Compras','compras.teste@gmail.com',4,'Suprimentos');
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub',uid,'email',(select email from auth.users where id=uid::uuid))::text, false) $$;
insert into public.mat_pedidos(id,cc,quem,data,itens) values ('PED-1','CC-1','Carlos','2026-10-28','[{"m":"MAT-001","q":2}]'),('PED-2','CC-2','Carlos','2026-10-28','[{"m":"MAT-002","q":1}]');
select (select status from public.mat_pedidos where id='PED-1')='triagem' as ok_pedido_nasce_em_triagem;
set role authenticated;
-- campo: cria pedido só da obra designada (Carlos está na CC-1) e sempre em triagem
select pg_temp.como('00000000-0000-0000-0000-000000000001');
insert into public.mat_pedidos(id,cc,quem,data,itens) values ('PED-3','CC-1','Carlos','2026-10-28','[]');
select (select count(*) from public.mat_pedidos where id='PED-3')=1 as ok_campo_pede_na_obra_dele;
do $$ begin insert into public.mat_pedidos(id,cc,quem,data) values ('PED-4','CC-2','Carlos','2026-10-28'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_campo_nao_pede_em_outra_obra'; end $$;
update public.mat_pedidos set status='aberto' where id='PED-3';
select (select status from public.mat_pedidos where id='PED-3')='triagem' as ok_campo_nao_pula_a_triagem;
-- R.O. da CC-1 (Rita, da migração 008) tria só as obras dele
select pg_temp.como('00000000-0000-0000-0000-000000000020');
update public.mat_pedidos set status='recusado', motivo='x' where id='PED-2';
select not exists(select 1 from public.mat_pedidos where id='PED-2') as ok_ro_nao_tria_obra_de_outro;
update public.mat_pedidos set status='compras', prioridade='urgente', nota_ro='obra parada', triado_em=now(), triado_por='Rita RO' where id='PED-1';
select (select status from public.mat_pedidos where id='PED-1')='compras' as ok_ro_encaminha_para_compras;
do $$ begin update public.mat_pedidos set status='xpto' where id='PED-1'; raise exception 'falhou'; exception when check_violation then raise notice 'ok_situacao_invalida_recusada'; end $$;
-- compras vê o que foi para compra e registra
select pg_temp.como('00000000-0000-0000-0000-000000000040');
select public.pode('compras') as ok_suprimentos_tem_compras;
update public.mat_pedidos set status='comprado', compra='{"fornecedor":"Dufrio","oc":"06450","previsao":"2026-10-01"}' where id='PED-1';
select (select compra_atrasada from public.v_pedidos_material where id='PED-1') as ok_compra_atrasada_calculada;
-- comunicados: gestão cria grupo e comunicado; cada um só marca o próprio ciente
select pg_temp.como('00000000-0000-0000-0000-000000000006');
insert into public.com_grupos(id,nome,regra) values ('GRP-001','Equipe de campo','{"setores":["Campo"]}');
select 'USR-002'=any(array(select public.membros_grupo('GRP-001'))) and not exists (select 1 from public.membros_grupo('GRP-001') m join public.perfis p on p.id=m where p.setor<>'Campo') as ok_grupo_por_setor;
insert into public.com_grupos(id,nome,regra,pessoas) values ('GRP-002','Campo e compras','{"obras":["CC-1"]}','{USR-040}');
select (select count(*) from public.membros_grupo('GRP-002'))=2 as ok_grupo_por_obra_e_pessoa;
insert into public.comunicados(id,titulo,texto,prioridade,grupos,de) values ('COM-1','EPI obrigatório','Capacete e cinto.','urgente','{GRP-001}','USR-001');
insert into public.comunicado_destinos(comunicado_id,perfil_id) select 'COM-1', public.membros_grupo('GRP-001');
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select (select count(*) from public.comunicados)=1 as ok_destinatario_ve_o_comunicado;
update public.comunicado_destinos set lido_em=now(), ciente_em=now() where comunicado_id='COM-1';
select (select ciente_em is not null from public.comunicado_destinos where perfil_id='USR-002') as ok_marca_o_proprio_ciente;
do $$ begin insert into public.comunicados(id,titulo,texto,de) values ('COM-X','x','y','USR-002'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_campo_nao_envia_comunicado'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select (select count(*) from public.comunicados)=0 as ok_quem_nao_e_do_grupo_nao_ve;
-- documento técnico: nunca guarda CPF
select pg_temp.como('00000000-0000-0000-0000-000000000020');
update public.obra_atividades set tipo='laudo' where id='ATV-2';
insert into public.obra_documentos_tecnicos(atividade_id,cc,tipo,dados) values ('ATV-2','CC-1','laudo','{"local":"Agência","conclusao":"Substituir"}');
select (select count(*) from public.obra_documentos_tecnicos)=1 as ok_ro_salva_o_laudo;
do $$ begin insert into public.obra_documentos_tecnicos(atividade_id,cc,tipo,dados) values ('ATV-1','CC-1','acesso','{"pessoas":[{"nome":"Fulano","cpf":"123.456.789-09"}]}'); raise exception 'falhou'; exception when check_violation then raise notice 'ok_cpf_recusado_no_documento'; end $$;
update public.obra_atividades set tipo='laudo' where id='ATV-1';
insert into public.obra_documentos_tecnicos(atividade_id,cc,tipo,dados) values ('ATV-1','CC-1','laudo','{"eq":[{"serie":"51999998888","pat":"64044212345"}],"empresa":{"fone":"51999998888"}}');
select (select count(*) from public.obra_documentos_tecnicos where atividade_id='ATV-1')=1 as ok_numero_de_serie_e_telefone_passam;
reset role;
select count(*)>=4 as ok_tudo_no_registro from public.auditoria where tabela in ('com_grupos','comunicados','comunicado_destinos','obra_documentos_tecnicos');
