-- Armant 360 · 002 · tabelas dos módulos (fase 2: dados normalizados)
-- Os códigos (CC-2026-001, CLI-001, TIT-00001...) são os mesmos do protótipo, para importar sem conversão.

-- ---------- comercial e cadastros ----------
create table if not exists public.clientes (
  id text primary key, razao text not null, sigla text, cnpj text, tipo text, esfera text, segmento text,
  cidade text, uf text, contato text, cargo text, email text, fone text,
  medicao text, periodicidade text, dia_fechamento int, dias_aprovacao int, dias_pagamento int,
  ret_inss numeric(6,2) default 0, ret_iss numeric(6,2) default 0, ret_garantia numeric(6,2) default 0,
  docs text[] default '{}', obs text, criado_em timestamptz default now(), atualizado_em timestamptz default now());
create unique index if not exists clientes_cnpj on public.clientes(cnpj) where cnpj is not null and cnpj <> '';

create table if not exists public.demandas (
  cc text primary key, cliente_id text references public.clientes(id), nome text not null, cidade text, uf text, endereco text,
  orcamento text, aprov_doc text, aprov_num text, aprov_data date, valor numeric(14,2), prazo_dias int, inicio date,
  medicao text, ro text, csc text, etapa int default 1, obs text, negociacao_id text,
  criado_em timestamptz default now(), atualizado_em timestamptz default now());

create table if not exists public.negociacoes (
  id text primary key, cliente_id text references public.clientes(id), titulo text not null, valor numeric(14,2), etapa text not null,
  origem text, responsavel text, prox_acao text, prox_data date, motivo_perda text, cc text references public.demandas(cc),
  obs text, historico jsonb default '[]', criado_em timestamptz default now(), atualizado_em timestamptz default now());

create table if not exists public.fornecedores (
  id text primary key, razao text not null, fantasia text, cnpj text, tipos text[] default '{}', especialidade text, marcas text,
  cidade text, uf text, contato text, email text, fone text, cond_pagamento text, faturamento_direto text, situacao text default 'Em homologação',
  docs text[] default '{}', obs text, criado_em timestamptz default now(), atualizado_em timestamptz default now());

-- ---------- obras: EAP, prazos, andamento, aditivos, medição ----------
create table if not exists public.obra_itens (
  cc text references public.demandas(cc) on delete cascade, codigo text, descricao text, un text, qtd numeric(14,4), total numeric(14,2),
  mo numeric(14,2), mat numeric(14,2), exec_base numeric(8,6) default 0, marco boolean default false,
  prazo_ini date, prazo_fim date, base_ini date, base_fim date, origem_prazo text,
  atualizado_em timestamptz default now(), primary key (cc, codigo));

create table if not exists public.obra_premissas (
  cc text primary key references public.demandas(cc) on delete cascade, periodicidade text, dia int, dias_aprov int, dias_pag int,
  inss numeric(6,2), iss numeric(6,2), garantia numeric(6,2), prox_fechamento date, dados jsonb default '{}', atualizado_em timestamptz default now());

create table if not exists public.obra_lancamentos (
  id text primary key, cc text references public.demandas(cc) on delete cascade, ini date, fim date, registrado date,
  obs text, valor_avancado numeric(14,2), excedentes int default 0, origem text default 'painel', criado_por text,
  criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.obra_lancamento_itens (
  lancamento_id text references public.obra_lancamentos(id) on delete cascade, codigo text, qtd numeric(14,4), primary key (lancamento_id, codigo));

create table if not exists public.obra_aditivos (
  id text primary key, cc text references public.demandas(cc) on delete cascade, lancamento_id text, codigo text, descricao text, un text,
  qtd numeric(14,4), preco_unit numeric(14,4), valor numeric(14,2), situacao text default 'Pendente', obs text,
  registrado date, periodo_ini date, periodo_fim date, atualizado_em timestamptz default now());

create table if not exists public.obra_medicoes (
  id uuid primary key default gen_random_uuid(), cc text references public.demandas(cc) on delete cascade, numero int, fechamento date,
  situacao text default 'rascunho', bruto numeric(14,2), retencoes numeric(14,2), liquido numeric(14,2), itens jsonb default '{}',
  atualizado_em timestamptz default now(), unique (cc, numero));

-- ---------- almoxarifado e listas ----------
create table if not exists public.materiais (
  id text primary key, descricao text not null, un text, categoria text, estoque_min numeric(14,4) default 0, ncm text, exemplo boolean default false,
  atualizado_em timestamptz default now());
create table if not exists public.mat_movimentos (
  id text primary key, tipo text not null check (tipo in ('entrada','entrega','devolucao')), data date not null, registrado date,
  documento text, fornecedor text, fornecedor_id text, cc text, responsavel text, recebido_por text, obs text,
  chave_nfe text, nf jsonb, pedido_id text, conferido jsonb, atualizado_em timestamptz default now());
create unique index if not exists mat_mov_chave on public.mat_movimentos(chave_nfe) where chave_nfe is not null and chave_nfe <> '';
create table if not exists public.mat_movimento_itens (
  movimento_id text references public.mat_movimentos(id) on delete cascade, linha int, material_id text references public.materiais(id),
  qtd numeric(14,4) not null, preco_unit numeric(14,6) default 0, primary key (movimento_id, linha));
create table if not exists public.mat_depara (
  cnpj text, cod_fornecedor text, material_id text references public.materiais(id), primary key (cnpj, cod_fornecedor));
create table if not exists public.mat_pedidos (
  id text primary key, cc text, quem text, data date, para date, obs text, status text default 'aberto', movimento_id text, itens jsonb default '[]',
  atualizado_em timestamptz default now());
create table if not exists public.listas_materiais (
  id text primary key, cc text, titulo text not null, tipo text, para date, status text default 'Rascunho', itens jsonb default '[]',
  historico jsonb default '[]', pedido_id text, criado date, por text, atualizado_em timestamptz default now());

-- estoque calculado (entradas + devoluções − entregas)
create or replace view public.v_estoque with (security_invoker = true) as
select m.id, m.descricao, m.un, m.categoria, m.estoque_min,
       coalesce(sum(case when v.tipo in ('entrada','devolucao') then i.qtd when v.tipo = 'entrega' then -i.qtd end),0) as saldo
  from public.materiais m
  left join public.mat_movimento_itens i on i.material_id = m.id
  left join public.mat_movimentos v on v.id = i.movimento_id
 group by m.id;

-- ---------- financeiro ----------
create table if not exists public.fin_contas (id text primary key, nome text not null, saldo numeric(14,2) default 0, data date, atualizado_em timestamptz default now());
create table if not exists public.fin_titulos (
  id text primary key, tipo text not null check (tipo in ('rec','pag')), descricao text not null, parte text, fornecedor_id text, cliente_id text,
  cc text, categoria text, valor numeric(14,2) not null, bruto numeric(14,2), emissao date, vencimento date not null,
  status text not null default 'aberto' check (status in ('aberto','previsto','pago','recebido','cancelado')),
  documento text, origem text, referencia text, obs text, nota text, baixa_data date, baixa_valor numeric(14,2), baixa_conta text,
  criado_em timestamptz default now(), atualizado_em timestamptz default now());
create index if not exists fin_titulos_venc on public.fin_titulos(vencimento);
create table if not exists public.fin_recorrentes (
  id text primary key, tipo text default 'pag', descricao text, valor numeric(14,2), dia int, categoria text, parte text, cc text, inicio date, ativo boolean default true,
  atualizado_em timestamptz default now());
create table if not exists public.fin_notas (
  id text primary key, tipo text check (tipo in ('nfse','nfe')), numero int, serie text, emissao date, tomador text, tomador_doc text, cc text,
  valor numeric(14,2), descricao text, titulo_id text, dados jsonb default '{}', xml text, criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.fin_config (id int primary key default 1 check (id = 1), dados jsonb not null default '{}', atualizado_em timestamptz default now());

-- ---------- frota ----------
create table if not exists public.frota_veiculos (
  id text primary key, placa text unique not null, modelo text, tipo text, ano text, combustivel text, km_inicial numeric(12,1) default 0,
  responsavel text, renavam text, ativo boolean default true, atualizado_em timestamptz default now());
create table if not exists public.frota_uso (
  id text primary key, veiculo_id text references public.frota_veiculos(id), data date, motorista text, cc text,
  km_saida numeric(12,1), km_chegada numeric(12,1), trajeto text, obs text, atualizado_em timestamptz default now());
create table if not exists public.frota_abastecimentos (
  id text primary key, veiculo_id text references public.frota_veiculos(id), data date, km numeric(12,1), litros numeric(10,3), valor numeric(12,2),
  posto text, motorista text, cc text, pago boolean default true, foto_path text, atualizado_em timestamptz default now());
create table if not exists public.frota_manutencoes (
  id text primary key, veiculo_id text references public.frota_veiculos(id), data date, tipo text, descricao text, oficina text, km numeric(12,1),
  valor numeric(12,2), prox_km numeric(12,1), prox_data date, atualizado_em timestamptz default now());
create table if not exists public.frota_documentos (
  id text primary key, veiculo_id text references public.frota_veiculos(id), tipo text, vencimento date, valor numeric(12,2), obs text, pago boolean default false,
  atualizado_em timestamptz default now());

-- ---------- app de campo ----------
create table if not exists public.campo_tarefas (
  id text primary key, data date not null, hora text, cc text, titulo text not null, descricao text, responsavel text, equipe text[] default '{}',
  item_codigo text, meta numeric(14,4), prioridade text default 'Normal', exige_foto boolean default true,
  status text default 'pendente' check (status in ('pendente','feito','parcial','naofeito')), resultado jsonb, fotos text[] default '{}',
  programada_por text, criado date, atualizado_em timestamptz default now());
create index if not exists campo_tarefas_dia on public.campo_tarefas(data, cc);
create table if not exists public.campo_presencas (
  id text primary key, nome text, perfil_id text, funcao text, empresa text, cc text, data date, entrada text, saida text, atualizado_em timestamptz default now());
create table if not exists public.campo_ocorrencias (
  id text primary key, cc text, data date, hora text, tipo text, texto text, quem text, foto_path text, atualizado_em timestamptz default now());
create table if not exists public.campo_fim_servico (
  id text primary key, cc text, data date, hora text, nome text, resumo text, feitas int, parciais int, pendentes int, atualizado_em timestamptz default now());
create table if not exists public.campo_combustivel (
  id text primary key, cc text, data date, hora text, tipo text, texto text, foto_path text, atualizado_em timestamptz default now());

-- ---------- comunicação ----------
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(), para text not null references public.perfis(id) on delete cascade, de text, de_nome text,
  tipo text default 'aviso', titulo text not null, texto text, link text, popup boolean default true, lida boolean default false, criado_em timestamptz default now());
create index if not exists notificacoes_para on public.notificacoes(para, lida);
create table if not exists public.atribuicoes (
  id text primary key, de text references public.perfis(id), para text references public.perfis(id), titulo text not null, descricao text,
  prazo date, prioridade text default 'Normal', cc text, link text, status text default 'nova' check (status in ('nova','andamento','concluida','recusada')),
  historico jsonb default '[]', criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.chat_conversas (
  id text primary key, tipo text not null check (tipo in ('geral','obra','dm')), nome text, criado_em timestamptz default now());
insert into public.chat_conversas(id, tipo, nome) values ('geral','geral','Geral · Armant') on conflict do nothing;
create table if not exists public.chat_mensagens (
  id text primary key default ('MS-' || replace(gen_random_uuid()::text,'-','')), conversa_id text not null references public.chat_conversas(id) on delete cascade,
  de text references public.perfis(id), texto text not null check (length(texto) <= 4000), sistema boolean default false, criado_em timestamptz default now());
create index if not exists chat_mensagens_conv on public.chat_mensagens(conversa_id, criado_em);
create table if not exists public.chat_leituras (
  perfil_id text references public.perfis(id) on delete cascade, conversa_id text references public.chat_conversas(id) on delete cascade,
  lido_ate timestamptz, primary key (perfil_id, conversa_id));
create table if not exists public.chat_destaques (
  id text primary key default ('DS-' || replace(gen_random_uuid()::text,'-','')), mensagem_id text references public.chat_mensagens(id) on delete cascade,
  conversa_id text, por text references public.perfis(id), para text references public.perfis(id), nota text,
  status text default 'aberto' check (status in ('aberto','resolvido')), criado_em timestamptz default now(), resolvido_em timestamptz);
create table if not exists public.reunioes (
  id text primary key, titulo text not null, data date, hora text, cc text, pauta text, link text check (link ~ '^https://meet\.google\.com/'),
  por text references public.perfis(id), participantes text[] default '{}', criado_em timestamptz default now());

-- ---------- RH ----------
create table if not exists public.rh_viagens (
  id text primary key, solicitante text references public.perfis(id), destino text not null, ida date, volta date, motivo text, cc text,
  transporte text, adiantamento numeric(12,2) default 0, hospedagem boolean default false, obs text,
  status text default 'solicitada' check (status in ('solicitada','aprovada','reservada','reprovada','concluida','cancelada')),
  historico jsonb default '[]', criado_em timestamptz default now(), atualizado_em timestamptz default now());
create table if not exists public.rh_documentos (
  id text primary key, perfil_id text references public.perfis(id) on delete cascade, tipo text not null, validade date, obs text,
  arquivo_nome text, tamanho int, mime text, storage_path text, enviado_por text, criado_em timestamptz default now());

-- ---------- fase 1: estado de cada módulo (o protótipo atual lê e grava aqui) ----------
create table if not exists public.estado_modulo (
  chave text primary key check (chave ~ '^a360'), dados jsonb not null default '{}', versao int not null default 1,
  atualizado_por text, atualizado_em timestamptz not null default now());
