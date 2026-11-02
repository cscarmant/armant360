/* Armant 360 · catálogo de referência por área (Civil, Elétrica, Mecânica · HVAC)
   Dono: este arquivo. É a referência de mercado (quem existe, o que vende, o que faz), não o cadastro
   de fornecedores que a Armant usa (esse é `ArmantCadastros.fornecedores()`).
   Para usar um fornecedor do catálogo, a Armant importa uma vez (cria o cadastro próprio com `origem:'catalogo'`
   e o id deste catálogo). Depois disso, o cadastro próprio é a fonte; este catálogo não é alterado pela obra.
   Status: 'confirmar' = achado em pesquisa pública, ainda não validado com a empresa (contato, estoque, preço).
   Nenhum preço está aqui. Nenhum telefone ou e-mail foi inventado: só entra o que a fonte mostra. */
(function () {
  'use strict';
  var AREAS = [
    { id: 'civil', nome: 'Engenharia civil', desc: 'Obra civil: estrutura, alvenaria, acabamento, locação de equipamentos de içamento e acesso.' },
    { id: 'eletrica', nome: 'Elétrica', desc: 'Alimentação, quadros, cabos, proteção e aterramento.' },
    { id: 'mecanica', nome: 'Mecânica · HVAC', desc: 'Climatização: equipamentos, tubulação de cobre, isolamento, dreno, suportes e manutenção.' }
  ];

  /* fornecedores: nome, cidade, tipo (fabricante, distribuidor, locadora, serviço), o que vende, fonte, status */
  var FORNECEDORES = [
    { id: 'FC-CIV-001', area: 'civil', nome: 'Tumelero Materiais de Construção S.A.', cidade: 'Porto Alegre', uf: 'RS', tipo: 'distribuidor', vende: 'Materiais de construção em geral', fonte: 'https://finder.techleap.nl/companies/tumelero_materiais_de_constru_o_s_a_', status: 'confirmar' },
    { id: 'FC-CIV-002', area: 'civil', nome: 'Imperatriz Comércio Atacadista Distribuidora de Material de Construção Ltda', cidade: 'Porto Alegre', uf: 'RS', tipo: 'distribuidor', vende: 'Materiais para construção (atacado)', fonte: 'https://www.solutudo.com.br/empresas/rs/pto-alegre/materiais-para-construcao/imperatriz-comercio-atacadista-distribuidora-de-material-de-construcao-ltda-5094534', status: 'confirmar' },
    { id: 'FC-CIV-003', area: 'civil', nome: 'Lukow Locações de Equipamentos Ltda (Mestre da Obra Locações)', cidade: 'Porto Alegre', uf: 'RS', tipo: 'locadora', vende: 'Aluguel de equipamentos (tipo de equipamento não confirmado)', fonte: 'https://www.solutudo.com.br/empresas/rs/pto-alegre/aluguel-de-equipamentos/lukow-locacoes-de-equipamentos-ltda-25466333', status: 'confirmar' },
    { id: 'FC-CIV-004', area: 'civil', nome: 'W Rental Locadora de Equipamentos Ltda', cidade: 'Porto Alegre', uf: 'RS', tipo: 'locadora', vende: 'Locação de equipamentos de construção (portfólio não confirmado)', fonte: 'https://a-leads.co/company/5759946_fac33bf6', status: 'confirmar' },
    { id: 'FC-ELE-001', area: 'eletrica', nome: 'Distrito Materiais Elétricos Ltda', cidade: 'Porto Alegre', uf: 'RS', tipo: 'distribuidor', vende: 'Comércio atacadista de material elétrico (CNAE principal)', fonte: 'https://cnpja.com/office/08329509000437', status: 'confirmar' },
    { id: 'FC-MEC-001', area: 'mecanica', nome: 'Hidromaq Com. Representações de Peças e Equipamentos', cidade: 'Porto Alegre', uf: 'RS', tipo: 'serviço', vende: 'Peças e manutenção de empilhadeiras e guindastes (não é locadora)', fonte: 'https://www.ohub.com.br/empresa/hidromaq-com-representacoes-de-pecas-e-equipamentos-porto-alegre-rs-47822', status: 'confirmar' }
  ];

  /* materiais por área (categorias, sem preço). Unidade = a usada nas planilhas da Armant */
  var MATERIAIS = [
    { id: 'MC-CIV-01', area: 'civil', categoria: 'Concreto e argamassa', itens: ['Cimento', 'Argamassa de assentamento', 'Argamassa de revestimento', 'Areia', 'Brita'] },
    { id: 'MC-CIV-02', area: 'civil', categoria: 'Aço e estrutura', itens: ['Vergalhão (aço CA-50/CA-60)', 'Tela soldada', 'Perfis metálicos'] },
    { id: 'MC-CIV-03', area: 'civil', categoria: 'Alvenaria e acabamento', itens: ['Bloco de concreto', 'Tijolo', 'Chapisco', 'Impermeabilizante'] },
    { id: 'MC-ELE-01', area: 'eletrica', categoria: 'Cabos', itens: ['Cabo flexível 2,5 mm²', 'Cabo flexível 4 mm²', 'Cabo flexível 6 mm²', 'Cabo de alimentação 10 mm² ou mais', 'Cabo PP de controle'] },
    { id: 'MC-ELE-02', area: 'eletrica', categoria: 'Proteção e quadros', itens: ['Disjuntor termomagnético', 'Disjuntor diferencial (DR)', 'Quadro de distribuição', 'Barramento e borne', 'Dispositivo de proteção contra surto (DPS)'] },
    { id: 'MC-ELE-03', area: 'eletrica', categoria: 'Eletrodutos e conexões', itens: ['Eletroduto PVC', 'Eletroduto metálico', 'Conduletes', 'Caixas de passagem', 'Haste de aterramento'] },
    { id: 'MC-MEC-01', area: 'mecanica', categoria: 'Tubulação frigorígena', itens: ['Tubo de cobre 1/4"', 'Tubo de cobre 3/8"', 'Tubo de cobre 1/2" e maiores', 'Isolamento elastomérico (ex.: 9 mm, célula fechada)', 'Fita de vedação e nitrogênio para teste'] },
    { id: 'MC-MEC-02', area: 'mecanica', categoria: 'Dreno e suportes', itens: ['Tubo de dreno PVC', 'Conexões de dreno', 'Suporte e abraçadeira para tubulação', 'Bandeja e perfilado'] },
    { id: 'MC-MEC-03', area: 'mecanica', categoria: 'Equipamentos e peças', itens: ['Evaporadora split hi-wall', 'Condensadora split', 'Filtro e gás refrigerante', 'Correia e rolamento para ventilador', 'Capacitor e contator'] }
  ];

  /* equipamentos (próprios ou locados) por área */
  var EQUIPAMENTOS = [
    { id: 'EQ-CIV-01', area: 'civil', nome: 'Guindaste / guincho de carga', tipo: 'locação', obs: 'Locadoras em Porto Alegre a confirmar' },
    { id: 'EQ-CIV-02', area: 'civil', nome: 'Andaime tubular / fachadeiro', tipo: 'locação', obs: '' },
    { id: 'EQ-CIV-03', area: 'civil', nome: 'Empilhadeira', tipo: 'locação ou próprio', obs: 'Peças e manutenção: Hidromaq (a confirmar)' },
    { id: 'EQ-ELE-01', area: 'eletrica', nome: 'Multímetro e alicate amperímetro', tipo: 'próprio', obs: '' },
    { id: 'EQ-ELE-02', area: 'eletrica', nome: 'Megômetro (teste de isolação)', tipo: 'próprio', obs: '' },
    { id: 'EQ-MEC-01', area: 'mecanica', nome: 'Bomba de vácuo', tipo: 'próprio', obs: '' },
    { id: 'EQ-MEC-02', area: 'mecanica', nome: 'Manifold e balança de carga para gás', tipo: 'próprio', obs: '' },
    { id: 'EQ-MEC-03', area: 'mecanica', nome: 'Máquina de solda oxiacetilênica / brasagem', tipo: 'próprio', obs: '' }
  ];

  /* serviços típicos por área (lista de partida; o orçamento de cada obra é que define o que é feito) */
  var SERVICOS = [
    { id: 'SV-CIV-01', area: 'civil', nome: 'Alvenaria e revestimento', unidade: 'm²' },
    { id: 'SV-CIV-02', area: 'civil', nome: 'Fundação e base para equipamentos', unidade: 'un' },
    { id: 'SV-ELE-01', area: 'eletrica', nome: 'Alimentação elétrica de equipamento', unidade: 'un' },
    { id: 'SV-ELE-02', area: 'eletrica', nome: 'Quadro de comando e proteção', unidade: 'un' },
    { id: 'SV-MEC-01', area: 'mecanica', nome: 'Instalação de evaporadora e condensadora', unidade: 'un' },
    { id: 'SV-MEC-02', area: 'mecanica', nome: 'Tubulação frigorígena com isolamento', unidade: 'm' },
    { id: 'SV-MEC-03', area: 'mecanica', nome: 'Dreno e teste de estanqueidade', unidade: 'm' },
    { id: 'SV-MEC-04', area: 'mecanica', nome: 'Manutenção preventiva (PMOC)', unidade: 'un' }
  ];

  window.ArmantCatalogoAreas = {
    version: '1.0',
    areas: function () { return AREAS.slice(); },
    fornecedores: function (area) { return FORNECEDORES.filter(function (x) { return !area || x.area === area; }); },
    materiais: function (area) { return MATERIAIS.filter(function (x) { return !area || x.area === area; }); },
    equipamentos: function (area) { return EQUIPAMENTOS.filter(function (x) { return !area || x.area === area; }); },
    servicos: function (area) { return SERVICOS.filter(function (x) { return !area || x.area === area; }); }
  };
})();
