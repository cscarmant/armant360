-- Notas fiscais (migração 016): criação, troca de situação, item calculado, CNPJ obrigatório (CPF recusado), quantidade positiva
insert into public.clientes(id,razao) values ('CLI-NF','Cliente NF');
insert into public.demandas(cc,cliente_id,nome) values ('CC-NF','CLI-NF','Obra NF');
insert into public.nf_notas(id,tipo,modelo,serie,numero,emitente_cnpj,destinatario_cliente_id,destinatario_nome,destinatario_cnpj,cc,cfop,natureza_operacao)
  values ('NF-1','nfe_transporte','55','1',1,'12345678000195','CLI-NF','Cliente NF','98765432000110','CC-NF','5949','Transferência para obra');
select exists(select 1 from public.nf_eventos where nota_id='NF-1' and de is null and para='rascunho') as ok_criacao_gera_evento;
update public.nf_notas set status='emitida', chave_acesso='3'||repeat('5',43) where id='NF-1';
select (select count(*) from public.nf_eventos where nota_id='NF-1')=2 as ok_troca_de_status_gera_evento;
insert into public.nf_itens(nota_id,item,descricao,quantidade,valor_unit) values ('NF-1',1,'Tubo de cobre 1/4',10,12.5);
select (select valor_total from public.nf_itens where nota_id='NF-1' and item=1)=125.00 as ok_valor_do_item_calculado;
select (select count(*) from public.v_nf_resumo where cc='CC-NF' and status='emitida')=1 as ok_resumo_por_obra;
do $$ begin insert into public.nf_notas(id,tipo,emitente_cnpj,destinatario_nome,destinatario_cnpj) values ('NF-X','nfe_produto','12345678000195','X','123.456.789-09'); raise exception 'nao_recusou_cpf'; exception when check_violation then null; end $$;
select true as ok_cpf_recusado;
do $$ begin insert into public.nf_itens(nota_id,item,descricao,quantidade) values ('NF-1',2,'Zero',0); raise exception 'nao_recusou_zero'; exception when check_violation then null; end $$;
select true as ok_quantidade_zero_recusada;
do $$ begin insert into public.nf_notas(id,tipo,emitente_cnpj,destinatario_nome,chave_acesso) values ('NF-Y','nfe_produto','12345678000195','Y','123'); raise exception 'nao_recusou_chave'; exception when check_violation then null; end $$;
select true as ok_chave_de_acesso_com_44_digitos;
