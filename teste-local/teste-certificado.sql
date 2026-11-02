-- Teste local da migração 009 (rodar depois de teste-permissoes.sql e teste-controle.sql). Cada "ok" deve dar true.
\set ON_ERROR_STOP 1
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000030','gerente.fin@gmail.com');
insert into public.perfis(id,nome,email,nivel,setor) values ('USR-030','Gerente Fin','gerente.fin@gmail.com',4,'Financeiro');
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub',uid,'email',(select email from auth.users where id=uid::uuid))::text, false) $$;
-- fase 1: o certificado vem do módulo a360cert
insert into public.estado_modulo(chave,dados,versao) values ('a360cert', jsonb_build_object('atual', jsonb_build_object('id','CERT-1','titular','ARMANT SOLUCOES','cnpj','13591585000103','emissor','AC Teste','ate', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 20,'YYYY-MM-DD')),'avisos','{}'::jsonb), 1);
select (select dias_restantes from public.v_certificado_vigente)=20 as ok_vigente_fase1;
select public.avisar_certificado() like 'Certificado A1 vence em 20 dia%' as ok_aviso_gerado;
select count(*)>=2 as ok_notificou_super_e_financeiro from public.notificacoes where titulo like 'Certificado A1 vence em 20%' and para in ('USR-001','USR-030');
select public.avisar_certificado() is null as ok_nao_repete_no_mesmo_limite;
-- fase 2: tabela e permissões
set role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000030');
insert into public.fin_certificados(id,titular,cnpj,emissor,valido_ate) values ('CERT-2','ARMANT SOLUCOES','13591585000103','AC Teste', (now() AT TIME ZONE 'America/Sao_Paulo')::date + 6);
select (select count(*) from public.fin_certificados)=1 as ok_gestao_financeiro_inclui;
insert into storage.objects(bucket_id,name) values ('certificados','CERT-2/cert.pfx');
select (select count(*) from storage.objects where bucket_id='certificados')=1 as ok_gestao_guarda_no_cofre;
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select (select count(*) from public.fin_certificados)=0 as ok_campo_nao_ve_certificado;
select (select count(*) from storage.objects where bucket_id='certificados')=0 as ok_campo_nao_abre_o_cofre;
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select (select count(*) from public.fin_certificados)=1 as ok_financeiro_nivel2_ve_dados;
select (select count(*) from storage.objects where bucket_id='certificados')=0 as ok_financeiro_nivel2_nao_abre_o_arquivo;
do $$ begin insert into public.fin_certificados(id,titular,valido_ate) values ('CERT-X','x',(now() AT TIME ZONE 'America/Sao_Paulo')::date+100); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_financeiro_nivel2_nao_inclui'; end $$;
reset role;
select (select dias_restantes from public.v_certificado_vigente)=6 as ok_tabela_tem_prioridade_sobre_fase1;
select public.avisar_certificado() like 'Certificado A1 vence em 6 dia%' as ok_aviso_limite_7;
update public.fin_certificados set valido_ate = (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1 where id='CERT-2';
select public.avisar_certificado() like 'Certificado A1 vencido%' as ok_aviso_vencido;
select count(*)>=1 as ok_no_registro from public.auditoria where tabela='fin_certificados';
