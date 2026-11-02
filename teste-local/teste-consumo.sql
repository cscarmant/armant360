-- Teste local da migração 013 (rodar depois de teste-permissoes.sql, no mesmo banco). Cada "ok" deve dar true.
\set ON_ERROR_STOP 1
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claims', json_build_object('sub',uid,'email',(select email from auth.users where id=uid::uuid))::text, false) $$;
update auth.users set last_sign_in_at = now() where email in ('campo.teste@gmail.com','valentim.arr@gmail.com');
insert into storage.objects(bucket_id,name,metadata) values ('fotos-campo','CC-1/f1.jpg','{"size":350000}'),('anexos','fase1/d1','{"size":120000}');
set role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select public.registrar_uso('{"banco":{"req":12,"down":800000,"up":20000},"arquivos":{"req":3,"down":1050000,"up":350000}}');
select public.registrar_uso('{"banco":{"req":2,"down":100000,"up":0},"xpto":{"req":1,"down":1,"up":1}}');
do $$ begin perform public.registrar_uso('{"banco":{"req":1,"down":-5,"up":0}}'); raise exception 'falhou'; exception when raise_exception then if sqlerrm like 'Valores%' then raise notice 'ok_valor_negativo_recusado'; else raise; end if; end $$;
select (select count(*) from public.uso_diario)=0 as ok_campo_nao_le_o_uso;
do $$ begin perform public.painel_consumo(); raise exception 'falhou'; exception when insufficient_privilege then raise notice 'ok_so_superadmin_ve_o_painel'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000000006');
select (public.painel_consumo()->'uso_30d'->'banco'->>'down')::bigint = 900000 as ok_uso_somado_por_area;
select (public.painel_consumo()->'uso_30d'->'xpto') is null as ok_area_desconhecida_ignorada;
select (public.painel_consumo()->>'banco_bytes')::bigint > 0 as ok_tamanho_do_banco;
select (select sum((a->>'bytes')::bigint) from jsonb_array_elements(public.painel_consumo()->'arquivos') a) = 470000 as ok_tamanho_dos_arquivos;
select (public.painel_consumo()->>'usuarios_ativos_30d')::int = 2 as ok_usuarios_ativos;
select (public.painel_consumo()->'por_pessoa'->0->>'perfil_id') = 'USR-002' as ok_quem_mais_consome;
reset role;
select count(*)=1 as ok_foto_do_dia_sem_duplicar from public.uso_snapshot;
