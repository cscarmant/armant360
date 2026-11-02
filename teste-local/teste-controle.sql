-- Teste local da migração 008 (rodar depois de teste-permissoes.sql, no mesmo banco). Cada "ok" deve dar true.
\set ON_ERROR_STOP 1
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000020','ro.obra@gmail.com');
insert into public.perfis(id,nome,email,nivel,setor) values ('USR-020','Rita RO','ro.obra@gmail.com',2,'Comercial');
update public.demandas set ro_id='USR-020' where cc='CC-1';
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub',uid,'email',(select email from auth.users where id=uid::uuid))::text, false) $$;
set role authenticated;
-- R.O. decide as atividades da obra dele (sem ser da gestão)
select pg_temp.como('00000000-0000-0000-0000-000000000020');
select public.eh_ro('CC-1') and not public.eh_ro('CC-2') as ok_ro_identificado;
insert into public.obra_atividades(id,cc,titulo,responsavel,prazo,classificacao) values ('ATV-1','CC-1','Instalar evaporadoras','USR-002','2026-11-15','urgente'),('ATV-2','CC-1','Pedir liberação de acesso','USR-002','2026-10-01','andamento');
select count(*)=2 as ok_ro_cria_atividades from public.obra_atividades;
do $$ begin insert into public.obra_atividades(id,cc,titulo,prazo) values ('ATV-X','CC-2','x','2026-12-01'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_ro_bloqueado_em_obra_de_outro'; end $$;
do $$ begin insert into public.obra_atividades(id,cc,titulo,prazo,classificacao) values ('ATV-R','CC-1','x','2026-12-01','restricao'); raise exception 'falhou'; exception when check_violation then raise notice 'ok_restricao_exige_descricao'; end $$;
insert into public.campo_tarefas(id,data,cc,titulo,responsavel,atividade_id,programada_por) values ('TAR-RO','2026-10-29','CC-1','Instalar evaporadoras','Carlos','ATV-1','R.O. Rita');
select count(*)=1 as ok_ro_manda_para_o_campo from public.campo_tarefas where atividade_id='ATV-1';
-- atividades da demanda: só o superadmin altera
do $$ begin insert into public.demanda_itens(cc,id,atividade,qtd,valor) values ('CC-1','IT-001','x',1,10); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_ro_nao_altera_itens_da_demanda'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000000006');
insert into public.demanda_itens(cc,id,codigo,atividade,qtd,un,valor,grupo) values ('CC-1','IT-001','1.2.1.3.48','Condicionador split teto 36.000 btu/h',1,'UN',17084.14,'LPU - máquinas'),('CC-1','IT-002','1.2.4.2.18','Tubo de cobre 5/8"',25,'m',4424,'LPU - peças');
select (select total from public.v_demanda_totais where cc='CC-1')=21508.14 as ok_superadmin_cadastra_itens;
update public.demanda_itens set qtd=30 where cc='CC-1' and id='IT-002';
select pg_temp.como('00000000-0000-0000-0000-000000000020');
select (select count(*) from public.demanda_itens)=2 as ok_ro_le_itens_da_obra;
update public.demanda_itens set qtd=99 where id='IT-002';
select (select qtd from public.demanda_itens where id='IT-002')=30 as ok_ro_nao_consegue_mudar_item;
-- responsável: vê as suas e muda a classificação, mas não o prazo
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select (select count(*) from public.obra_atividades)=2 as ok_responsavel_ve_as_suas;
update public.obra_atividades set classificacao='concluido', concluida_em='2026-10-28' where id='ATV-1';
select (select classificacao from public.obra_atividades where id='ATV-1')='concluido' as ok_responsavel_conclui;
do $$ begin update public.obra_atividades set prazo='2027-01-01' where id='ATV-2'; raise exception 'falhou'; exception when raise_exception then if sqlerrm like 'Só o R.O.%' then raise notice 'ok_responsavel_nao_muda_prazo'; else raise; end if; end $$;
select (select classificacao_efetiva from public.v_obra_atividades where id='ATV-2')='atrasado' as ok_atrasado_calculado;
-- diário atrasado
insert into public.campo_diarios(id,cc,data,por,atraso_dias,motivo,servicos) values ('DIA-1','CC-1','2026-10-26','Carlos',2,'Sem sinal','Passagem de tubulação');
select (select count(*) from public.campo_diarios)=1 as ok_campo_envia_diario_atrasado;
do $$ begin insert into public.campo_diarios(id,cc,data,por,servicos) values ('DIA-2','CC-1',(now() at time zone 'America/Sao_Paulo')::date,'Carlos','x'); raise exception 'falhou'; exception when check_violation then raise notice 'ok_diario_de_hoje_nao_e_atrasado'; end $$;
do $$ begin insert into public.campo_diarios(id,cc,data,por,servicos) values ('DIA-3','CC-2','2026-10-26','Carlos','x'); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_diario_so_da_obra_designada'; end $$;
-- quem não é da obra não vê
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select (select count(*) from public.obra_atividades)=0 as ok_financeiro_nao_ve_controle_de_obras;
select (select count(*) from public.demanda_itens)=2 as ok_financeiro_le_valores_da_demanda;
reset role;
select count(*)>=5 as ok_tudo_no_registro from public.auditoria where tabela in ('obra_atividades','demanda_itens','campo_diarios');
