// Armant 360 · importa o backup do Painel do superadmin para o banco (Supabase/PostgreSQL)
// Uso:  node scripts/importar-backup.mjs --arquivo C:\caminho\armant360-backup.json [--eap web\obras-data.js] [--so-fase1]
//       node scripts/importar-backup.mjs --so-eap --eap web\obras-data.js   (só a lista de serviços da obra, sem backup)
// Precisa de DATABASE_URL no ambiente (.env). Fotos e documentos sobem para o Storage se houver
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY; sem eles, ficam só na fase 1 (estado_modulo).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]); return a; }, []));
carregarEnv();
if (!args.arquivo && !args['so-eap']) sair('Informe o backup: --arquivo caminho\\armant360-backup.json');
if (!process.env.DATABASE_URL) sair('Falta DATABASE_URL no arquivo .env (Supabase → Project Settings → Database → Connection string → URI).');
const bk = args['so-eap'] ? { app: 'Armant 360', dados: {} } : JSON.parse(fs.readFileSync(args.arquivo, 'utf8'));
if (bk.app !== 'Armant 360' || !bk.dados) sair('Este arquivo não é um backup do Armant 360.');
const J = k => { try { return JSON.parse(bk.dados[k] || 'null') || {}; } catch { return {}; } };
const nz = v => (v === '' || v === undefined || (typeof v === 'number' && isNaN(v))) ? null : v;
const dt = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) ? v.slice(0, 10) : null;
const n = v => (v === '' || v == null || isNaN(+v)) ? null : +v;

const ssl = /localhost|127\.0\.0\.1|host=\/|@\//.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
await db.connect();
const total = {};
async function upsert(tabela, linhas, pk) {
  linhas = linhas.filter(Boolean);
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  for (const r of linhas) {
    const vals = cols.map(c => (r[c] !== null && typeof r[c] === 'object' && !Array.isArray(r[c])) || (Array.isArray(r[c]) && r[c].some(x => x && typeof x === 'object')) ? JSON.stringify(r[c]) : r[c]);
    const upd = cols.filter(c => !pk.includes(c)).map(c => `${q(c)} = excluded.${q(c)}`).join(', ');
    await db.query(`insert into public.${q(tabela)} (${cols.map(q).join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')})
                    on conflict (${pk.map(q).join(',')}) do ${upd ? 'update set ' + upd : 'nothing'}`, vals);
  }
  total[tabela] = (total[tabela] || 0) + linhas.length;
}
const q = c => '"' + c.replace(/"/g, '""') + '"';

try {
  await db.query('begin');
  await db.query("select set_config('armant.importando', 'on', true)");

  // ---------- fase 1: cada módulo inteiro, para o protótipo funcionar compartilhado ----------
  for (const [chave, texto] of Object.entries(bk.dados)) {
    if (!chave.startsWith('a360') || ['a360tour', 'a360sess'].includes(chave)) continue;
    await db.query(`insert into public.estado_modulo(chave, dados, versao, atualizado_por) values ($1, $2::jsonb, 1, 'importação')
                    on conflict (chave) do update set dados = excluded.dados, versao = public.estado_modulo.versao + 1, atualizado_por = 'importação'`, [chave, texto]);
    total.estado_modulo = (total.estado_modulo || 0) + 1;
  }

  // a lista de serviços da obra (EAP, dados reais do contrato) fica no banco, só para quem entrou; o site publicado não leva o obras-data.js
  const EAP1 = lerEAP(args.eap);
  if (EAP1) {
    await db.query(`insert into public.estado_modulo(chave, dados, versao, atualizado_por) values ('a360eap', $1::jsonb, 1, 'importação')
                    on conflict (chave) do update set dados = excluded.dados, versao = public.estado_modulo.versao + 1, atualizado_por = 'importação'`, [JSON.stringify(EAP1)]);
    total.estado_modulo = (total.estado_modulo || 0) + 1;
  }

  if (!args['so-fase1'] && !args['so-eap']) {
    // ---------- usuários: perfis (o login Google liga depois pelo e-mail) ----------
    const AC = J('a360acesso'), mapaU = {};
    for (const u of AC.users || []) {
      const ja = await db.query(`select email from public.perfis where id = $1`, [u.id]);
      if (ja.rowCount && ja.rows[0].email !== String(u.email).toLowerCase())
        throw new Error(`O usuário ${u.id} já existe no banco com outro e-mail (${ja.rows[0].email}; no backup é ${u.email}). Este backup veio de outro navegador: importe num banco novo ou ajuste os usuários com o 09-superadmin.ps1.`);
      const r = await db.query(`insert into public.perfis(id, nome, email, nivel, setor, funcao, obras, ativo) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (email) do update set nome = excluded.nome, nivel = greatest(public.perfis.nivel, excluded.nivel), setor = excluded.setor, funcao = excluded.funcao, obras = excluded.obras, ativo = excluded.ativo
        returning id`, [u.id, u.nome, String(u.email).toLowerCase(), u.nivel, (u.setor === 'Obras' ? 'Engenharia' : u.setor) || 'Campo', u.funcao || '', u.obras || [], u.ativo !== false]);
      mapaU[u.id] = r.rows[0].id; total.perfis = (total.perfis || 0) + 1;
    }
    const U = id => id ? (mapaU[id] || null) : null;
    for (const [mod, p] of Object.entries(AC.perm || {})) await db.query('update public.permissoes set nivel_min = $2, setores = $3 where modulo = $1 and modulo <> $4', [mod, p.n, (p.s || []).map(x => x === 'Obras' ? 'Engenharia' : x), 'auditoria']);
    await upsert('solicitacoes_acesso', (AC.reqs || []).map(r => ({ id: uuidDe(r.id), nome: r.nome, email: String(r.email).toLowerCase(), setor: nz(r.setor), funcao: nz(r.funcao), obra: nz(r.obra), fone: nz(r.fone), status: r.st === 'aprovado' ? 'aprovado' : r.st === 'recusado' ? 'recusado' : 'pendente', criado_em: nz(r.em) })), ['id']);

    // ---------- cadastros e comercial (inclui o TJ-RS, que no protótipo vem do código) ----------
    const CAD = J('a360cad');
    const cli = [{ id: 'CLI-001', razao: 'Tribunal de Justiça do Estado do Rio Grande do Sul', sigla: 'TJ-RS', tipo: 'Público', esfera: 'Estadual', segmento: 'Judiciário', cidade: 'Porto Alegre', uf: 'RS', medicao: 'Periódica', period: 'Mensal', dia: 25, aprov: 10, pag: 30, inss: 11, iss: 0, gar: 0, docs: [] }, ...(CAD.cli || [])];
    await upsert('clientes', cli.map(c => ({ id: c.id, razao: c.razao, sigla: nz(c.sigla), cnpj: nz(c.cnpj), tipo: nz(c.tipo), esfera: nz(c.esfera), segmento: nz(c.segmento), cidade: nz(c.cidade), uf: nz(c.uf), contato: nz(c.contato), cargo: nz(c.cargo), email: nz(c.email), fone: nz(c.fone), medicao: nz(c.medicao), periodicidade: nz(c.period), dia_fechamento: n(c.dia), dias_aprovacao: n(c.aprov), dias_pagamento: n(c.pag), ret_inss: n(c.inss) ?? 0, ret_iss: n(c.iss) ?? 0, ret_garantia: n(c.gar) ?? 0, docs: c.docs || [], obs: nz(c.obs) })), ['id']);
    const EAP = lerEAP(args.eap);
    const dem = [{ cc: 'CC-2026-001', cli: 'CLI-001', nome: EAP?.obra?.nome || 'Reforma da climatização · Foro Regional do Alto Petrópolis', cidade: 'Porto Alegre', uf: 'RS', aprovDoc: 'Contrato assinado', aprovNum: EAP?.obra?.contrato || '075/2026DEC', valor: EAP?.obra?.valor || null, prazo: EAP?.obra?.prazo || 360, inicio: EAP?.obra?.inicio || null, medicao: 'Periódica', etapa: 2 }, ...(CAD.dem || [])];
    await upsert('demandas', dem.map(d => ({ cc: d.cc, cliente_id: nz(d.cli), nome: d.nome, cidade: nz(d.cidade), uf: nz(d.uf), endereco: nz(d.end), orcamento: nz(d.orc), aprov_doc: nz(d.aprovDoc), aprov_num: nz(d.aprovNum), aprov_data: dt(d.aprovData), valor: n(d.valor), prazo_dias: n(d.prazo), inicio: dt(d.inicio), medicao: nz(d.medicao), ro: nz(d.ro), csc: nz(d.csc), ro_id: U((CAD.resp?.[d.cc]?.ro) || d.ro), csc_id: U((CAD.resp?.[d.cc]?.csc) || d.csc), etapa: n(d.etapa) ?? 1, obs: nz(d.obs) })), ['cc']);
    await upsert('fornecedores', (CAD.forn || []).map(f => ({ id: f.id, razao: f.razao, fantasia: nz(f.fant), cnpj: nz(f.cnpj), tipos: f.tipos || [], especialidade: nz(f.espec), marcas: nz(f.marcas), cidade: nz(f.cidade), uf: nz(f.uf), contato: nz(f.contato), email: nz(f.email), fone: nz(f.fone), cond_pagamento: nz(f.pag), faturamento_direto: nz(f.fatdir), situacao: nz(f.sit), docs: f.docs || [], obs: nz(f.obs) })), ['id']);
    await upsert('negociacoes', (CAD.neg || []).map(x => ({ id: x.id, cliente_id: nz(x.cli), titulo: x.titulo, valor: n(x.valor), etapa: x.etapa, origem: nz(x.origem), responsavel: nz(x.resp), prox_acao: nz(x.prox), prox_data: dt(x.proxData), motivo_perda: nz(x.motivo), cc: nz(x.cc), obs: nz(x.obs), historico: x.hist || [] })), ['id']);

    // ---------- obra: EAP, prazos, lançamentos, aditivos, medição, premissas ----------
    const OB = J('a360'), cc0 = 'CC-2026-001';
    if (EAP?.items) await upsert('obra_itens', EAP.items.map(it => { const pz = (EAP.prazos || {})[it.c] || [], ed = (OB.prazo || {})[it.c] || {}; return { cc: cc0, codigo: it.c, descricao: it.d, un: nz(it.u), qtd: n(it.q), total: n(it.t), mo: n(it.mo), mat: n(it.mat), exec_base: n(it.ex) ?? 0, marco: !!it.m, prazo_ini: dt(ed.ini || pz[0]), prazo_fim: dt(ed.fim || pz[1]), base_ini: dt(pz[0]), base_fim: dt(pz[1]), origem_prazo: ed.ini || ed.fim ? 'editado' : nz(pz[2]) }; }), ['cc', 'codigo']);
    else console.log('Aviso: sem --eap web\\obras-data.js, a lista de serviços da obra (EAP) não foi importada.');
    for (const l of OB.lanc || []) {
      const id = l.id || ('L-' + l.fim + '-' + Math.random().toString(36).slice(2, 6));
      await upsert('obra_lancamentos', [{ id, cc: cc0, ini: dt(l.ini), fim: dt(l.fim), registrado: dt(l.reg), obs: nz(l.obs), valor_avancado: n(l.dv), excedentes: n(l.na) ?? 0, origem: l.campo ? 'campo' : 'painel' }], ['id']);
      await upsert('obra_lancamento_itens', Object.entries(l.itens || {}).map(([codigo, qtd]) => ({ lancamento_id: id, codigo, qtd: n(qtd) })), ['lancamento_id', 'codigo']);
    }
    await upsert('obra_aditivos', (OB.adit || []).map(a => ({ id: a.id, cc: cc0, lancamento_id: nz(a.lid), codigo: a.c, descricao: nz(a.d), un: nz(a.u), qtd: n(a.q), preco_unit: n(a.pu), valor: n(a.v), situacao: nz(a.st), obs: nz(a.obs), registrado: dt(a.reg), periodo_ini: dt(a.ini), periodo_fim: dt(a.fim) })), ['id']);
    if (OB.med && Object.keys(OB.med).length) await upsert('obra_medicoes', [{ id: uuidDe('med-' + cc0 + '-rascunho'), cc: cc0, numero: 0, situacao: 'rascunho', itens: OB.med }], ['id']);
    if (OB.perfil) { const p = OB.perfil; await upsert('obra_premissas', [{ cc: cc0, periodicidade: nz(p.per), dia: n(p.dia), dias_aprov: n(p.aprov), dias_pag: n(p.pag), inss: n(p.inss), iss: n(p.iss), garantia: n(p.gar), prox_fechamento: dt(p.proxFech), dados: p }], ['cc']); }

    // ---------- almoxarifado e listas ----------
    const MT = J('a360mat');
    await upsert('materiais', (MT.mat || []).map(m => ({ id: m.id, descricao: m.d, un: nz(m.u), categoria: nz(m.cat), estoque_min: n(m.min) ?? 0, ncm: nz(m.ncm), exemplo: !!m.ex })), ['id']);
    await upsert('mat_movimentos', (MT.mov || []).map(v => ({ id: v.id, tipo: v.tipo, data: dt(v.data), registrado: dt(v.reg), documento: nz(v.doc), fornecedor: nz(v.forn), fornecedor_id: nz(v.fid), cc: nz(v.cc), responsavel: nz(v.resp), recebido_por: nz(v.rec), obs: nz(v.obs), chave_nfe: nz(v.chave), nf: v.nf || null, pedido_id: nz(v.ped), conferido: v.conf || null })), ['id']);
    for (const v of MT.mov || []) await upsert('mat_movimento_itens', (v.itens || []).map((it, i) => ({ movimento_id: v.id, linha: i + 1, material_id: it.m, qtd: n(it.q), preco_unit: n(it.pu) ?? 0 })), ['movimento_id', 'linha']);
    await upsert('mat_depara', Object.entries(MT.map || {}).map(([k, m]) => { const [cnpj, ...cod] = k.split('|'); return { cnpj, cod_fornecedor: cod.join('|'), material_id: m }; }), ['cnpj', 'cod_fornecedor']);
    await upsert('mat_pedidos', (MT.ped || []).map(p => ({ id: p.id, cc: nz(p.cc), quem: nz(p.quem), data: dt(p.data), para: dt(p.para), obs: nz(p.obs), status: ['triagem', 'aberto', 'compras', 'comprado', 'atendido', 'recusado'].includes(p.st) ? p.st : 'triagem', movimento_id: nz(p.mov), itens: p.itens || [], prioridade: p.prio === 'urgente' ? 'urgente' : 'normal', nota_ro: nz(p.nota), motivo: nz(p.motivo), origem_id: nz(p.origem), itens_pedidos: p.itensPedidos || null, triado_em: p.triado ? dt(p.triado.d) : null, triado_por: p.triado ? nz(p.triado.por) : null, compra: p.compra ? { fornecedor: p.compra.forn, oc: p.compra.oc || null, previsao: dt(p.compra.prev), valor: n(p.compra.valor), obs: p.compra.obs || null } : null, historico: p.hist || [] })).sort((x, y) => (x.origem_id ? 1 : 0) - (y.origem_id ? 1 : 0)), ['id']);
    const LS = J('a360listas');
    await upsert('listas_materiais', (LS.listas || []).map(l => ({ id: l.id, cc: nz(l.cc), titulo: l.titulo, tipo: nz(l.tipo), para: dt(l.para), status: nz(l.st), itens: l.itens || [], historico: l.hist || [], pedido_id: nz(l.ped), criado: dt(l.criado), por: nz(l.por) })), ['id']);

    // ---------- financeiro ----------
    const FN = J('a360fin');
    await upsert('fin_contas', (FN.contas || []).map(c => ({ id: c.id, nome: c.nome, saldo: n(c.saldo) ?? 0, data: dt(c.data) })), ['id']);
    await upsert('fin_titulos', (FN.tit || []).map(t => ({ id: t.id, tipo: t.tipo, descricao: t.desc, parte: nz(t.parte), fornecedor_id: nz(t.fid), cliente_id: nz(t.cli), cc: nz(t.cc), categoria: nz(t.cat), valor: n(t.valor) ?? 0, bruto: n(t.bruto), emissao: dt(t.emissao), vencimento: dt(t.venc) || dt(t.emissao) || new Date().toISOString().slice(0, 10), status: t.status, documento: nz(t.doc), origem: nz(t.orig), referencia: nz(t.ref), obs: nz(t.obs), nota: nz(t.nota), baixa_data: dt(t.liq?.data), baixa_valor: n(t.liq?.valor), baixa_conta: nz(t.liq?.conta) })), ['id']);
    await upsert('fin_recorrentes', (FN.rec || []).map(r => ({ id: r.id, tipo: r.tipo || 'pag', descricao: r.desc, valor: n(r.valor), dia: n(r.dia), categoria: nz(r.cat), parte: nz(r.parte), cc: nz(r.cc), inicio: dt(r.inicio), ativo: r.ativo !== false })), ['id']);
    await upsert('fin_notas', (FN.notas || []).map(x => ({ id: x.id, tipo: x.tipo, numero: n(x.numero), serie: nz(x.serie), emissao: dt(x.emissao), tomador: nz(x.tomNome), tomador_doc: nz(x.tomCnpj), cc: nz(x.cc), valor: n(x.valor), descricao: nz(x.desc), titulo_id: nz(x.tit), dados: { ...x, xml: undefined }, xml: nz(x.xml) })), ['id']);
    if (FN.cfg) await upsert('fin_config', [{ id: 1, dados: FN.cfg }], ['id']);

    // ---------- frota ----------
    const FR = J('a360frota');
    await upsert('frota_veiculos', (FR.vei || []).map(v => ({ id: v.id, placa: v.placa, modelo: nz(v.modelo), tipo: nz(v.tipo), ano: nz(v.ano), combustivel: nz(v.comb), km_inicial: n(v.km0) ?? 0, responsavel: nz(v.resp), renavam: nz(v.renavam), ativo: v.ativo !== false })), ['id']);
    await upsert('frota_uso', (FR.uso || []).map(u => ({ id: u.id, veiculo_id: u.v, data: dt(u.data), motorista: nz(u.mot), cc: nz(u.cc), km_saida: n(u.kmI), km_chegada: n(u.kmF), trajeto: nz(u.trajeto), obs: nz(u.obs) })), ['id']);
    const abs = [];
    for (const a of FR.abs || []) abs.push({ id: a.id, veiculo_id: a.v, data: dt(a.data), km: n(a.km), litros: n(a.litros), valor: n(a.valor), posto: nz(a.posto), motorista: nz(a.mot), cc: nz(a.cc), pago: !!a.pago,
      foto_path: a.foto ? await subir('fotos-campo', `abastecimentos/${a.id}-cupom.jpg`, a.foto) : null, preco_litro: n(a.preco), foto_preco_path: a.fotoPreco ? await subir('fotos-campo', `abastecimentos/${a.id}-preco.jpg`, a.fotoPreco) : null, dif_preco: n(a.difPreco) });
    await upsert('frota_abastecimentos', abs, ['id']);
    await upsert('frota_manutencoes', (FR.man || []).map(m => ({ id: m.id, veiculo_id: m.v, data: dt(m.data), tipo: nz(m.tipo), descricao: nz(m.desc), oficina: nz(m.oficina), km: n(m.km), valor: n(m.valor), prox_km: n(m.proxKm), prox_data: dt(m.proxData) })), ['id']);
    await upsert('frota_documentos', (FR.doc || []).map(d => ({ id: d.id, veiculo_id: d.v, tipo: nz(d.tipo), vencimento: dt(d.venc), valor: n(d.valor), obs: nz(d.obs), pago: !!d.pago })), ['id']);

    // ---------- atividades da demanda (atividade, quantidade, valor) e documentos da demanda ----------
    const ccs = new Set(dem.map(d => d.cc)), ARQ = Object.fromEntries((bk.arquivos || []).map(a => [a.id, a]));
    await upsert('demanda_itens', Object.entries(CAD.itens || {}).filter(([cc]) => ccs.has(cc)).flatMap(([cc, L]) => (L || []).filter(i => n(i.qtd) > 0 && n(i.valor) > 0).map(i => ({ cc, id: i.id, codigo: nz(i.cod), atividade: i.atividade, qtd: n(i.qtd), un: nz(i.un), valor: n(i.valor), grupo: nz(i.grupo), origem: nz(i.origem) }))), ['cc', 'id']);
    const docsDem = [];
    for (const [cc, L] of Object.entries(CAD.anexos || {})) { if (!ccs.has(cc)) continue;
      for (const a of L || []) docsDem.push({ id: a.id, cc, nome: a.nome, mime: nz(a.mime), tamanho: n(a.size), caminho: ARQ[a.id] ? await subir('anexos', `${cc}/${a.id}-${String(a.nome).replace(/[^\w.-]+/g, '_')}`, ARQ[a.id].data) : null, criado_em: a.em ? a.em + 'T12:00:00-03:00' : undefined }); }
    await upsert('demanda_documentos', docsDem, ['id']);

    // ---------- certificado digital A1 (só os dados; a senha nunca existiu no backup) ----------
    const CE = J('a360cert'), certs = [...(CE.hist || []).map(c => ({ ...c, ativo: false })), ...(CE.atual ? [{ ...CE.atual, ativo: true }] : [])];
    await upsert('fin_certificados', certs.filter(c => c.id && dt(c.ate)).map(c => ({ id: c.id, tipo: c.tipo || 'A1', titular: c.titular, cnpj: nz(c.cnpj), emissor: nz(c.emissor), numero_serie: nz(c.serie), impressao_digital: nz(c.impressao), valido_de: dt(c.de), valido_ate: dt(c.ate), arquivo_nome: nz(c.arquivo), ativo: c.ativo, avisos: CE.avisos || {}, incluido_por: nz(c.por) })), ['id']);

    // ---------- controle de obras (atividades definidas pelo R.O.) ----------
    const CT = J('a360ctrl'), atvIds = new Set();
    await upsert('obra_atividades', (CT.at || []).filter(a => ccs.has(a.cc) && dt(a.prazo)).map(a => { atvIds.add(a.id); return { id: a.id, cc: a.cc, item_id: nz(a.item), titulo: a.titulo, qtd: n(a.qtd), un: nz(a.un), responsavel: U(a.resp), inicio: dt(a.inicio), prazo: dt(a.prazo), classificacao: ['urgente', 'andamento', 'restricao', 'concluido'].includes(a.cls) ? a.cls : 'andamento', restricao: a.cls === 'restricao' ? (a.restricao || 'não informada') : nz(a.restricao), obs: nz(a.obs), concluida_em: dt(a.concl), criado_por: U(a.por), historico: a.hist || [], tipo: ['laudo', 'acesso'].includes(a.tipo) ? a.tipo : null }; }), ['id']);

    // ---------- documentos técnicos das tarefas (laudo e solicitação de acesso; nunca há RG/CPF no backup) ----------
    const DC = J('a360docs'), docsTec = [];
    for (const [aid, d] of Object.entries(DC.docs || {})) {
      if (!atvIds.has(aid)) continue;
      const fotos = [];
      for (const [i, f] of (d.fotos || []).entries()) { const p = ARQ[f.id] ? await subir('anexos', `docs-tecnicos/${aid}-${i + 1}`, ARQ[f.id].data) : null; if (p) fotos.push(p); }
      const { fotos: _f, rev, emitidas, ...dados } = d;
      docsTec.push({ atividade_id: aid, cc: (CT.at || []).find(a => a.id === aid).cc, tipo: d.tipo, revisao: rev || 0, emissoes: emitidas || [], dados: { ...dados, legendas: (d.fotos || []).map(f => f.leg || '') }, fotos });
    }
    await upsert('obra_documentos_tecnicos', docsTec, ['atividade_id']);

    // ---------- comunicados e grupos ----------
    const CM = J('a360com');
    await upsert('com_grupos', (CM.grp || []).map(g => ({ id: g.id, nome: g.nome, descricao: nz(g.desc), regra: g.regra || {}, pessoas: (g.pessoas || []).map(U).filter(Boolean), chat: g.chat !== false, ativo: g.ativo !== false, criado_por: U(g.por) })), ['id']);
    await upsert('comunicados', (CM.com || []).map(c => ({ id: c.id, titulo: c.titulo, texto: c.texto, prioridade: c.prio || 'normal', pede_ciente: !!c.ciente, grupos: c.grupos || [], de: U(c.de), criado_em: c.em })), ['id']);
    await upsert('comunicado_destinos', (CM.com || []).flatMap(c => (c.para || []).map(id => ({ comunicado_id: c.id, perfil_id: U(id), lido_em: (c.lidos || {})[id] || null, ciente_em: (c.cientes || {})[id] || null }))).filter(x => x.perfil_id), ['comunicado_id', 'perfil_id']);

    // ---------- extrato bancário importado ----------
    const EX = J('a360extrato'), contasFin = new Set((FN.contas || []).map(c => c.id)), titIds = new Set((FN.tit || []).map(t => t.id));
    await upsert('fin_extrato_lotes', (EX.lotes || []).map(l => ({ id: l.id, conta_id: contasFin.has(l.conta) ? l.conta : nz(l.conta), arquivo: nz(l.arquivo), formato: nz(l.formato), saldo_final: l.saldo ? n(l.saldo.valor) : null, saldo_data: l.saldo ? dt(l.saldo.data) : null, qtd: n(l.qtd), importado_por: nz(l.por), criado_em: dt(l.em) })), ['id']);
    await upsert('fin_extrato_movimentos', (EX.mov || []).filter(m => dt(m.data) && m.chave).map(m => ({ id: m.id, lote_id: nz(m.lote), conta_id: nz(m.conta), data: dt(m.data), valor: n(m.valor), descricao: nz(m.desc), documento: nz(m.doc), fitid: nz(m.fitid), chave: m.chave, titulo_id: m.conc && titIds.has(m.conc.tit) ? m.conc.tit : null, conciliado_em: m.conc ? dt(m.conc.em) : null, conciliado_por: m.conc ? nz(m.conc.por) : null, ignorado: nz(m.ign) })), ['id']);

    // ---------- app de campo (fotos vão para o Storage, se houver chave) ----------
    const CP = J('a360campo');
    const tar = [];
    for (const t of CP.tar || []) {
      const fotos = [];
      for (const [i, f] of ((t.res && t.res.fotos) || []).entries()) { const p = await subir('fotos-campo', `${t.cc}/${t.id}-${i + 1}.jpg`, f); if (p) fotos.push(p); }
      tar.push({ id: t.id, data: dt(t.data), hora: nz(t.hora), cc: nz(t.cc), titulo: t.titulo, descricao: nz(t.desc), responsavel: nz(t.resp), equipe: t.equipe || [], item_codigo: nz(t.item), meta: n(t.qtd), prioridade: nz(t.prio), exige_foto: t.foto !== false, status: t.st, resultado: t.res ? { ...t.res, fotos: undefined } : null, fotos, programada_por: nz(t.por), criado: dt(t.criado), atividade_id: atvIds.has(t.atv) ? t.atv : null });
    }
    await upsert('campo_tarefas', tar, ['id']);
    await upsert('campo_presencas', (CP.pres || []).map(p => ({ id: p.id, nome: p.nome, funcao: nz(p.funcao), empresa: nz(p.empresa), cc: nz(p.cc), data: dt(p.data), entrada: nz(p.ent), saida: nz(p.sai) })), ['id']);
    const oc = [];
    for (const o of CP.oc || []) oc.push({ id: o.id, cc: nz(o.cc), data: dt(o.data), hora: nz(o.hora), tipo: nz(o.tipo), texto: nz(o.txt), quem: nz(o.quem), foto_path: o.foto ? await subir('fotos-campo', `${o.cc}/${o.id}.jpg`, o.foto) : null });
    await upsert('campo_ocorrencias', oc, ['id']);
    await upsert('campo_fim_servico', (CP.fim || []).map(f => ({ id: f.id, cc: nz(f.cc), data: dt(f.data), hora: nz(f.hora), nome: nz(f.nome), resumo: nz(f.resumo), feitas: n(f.feitas), parciais: n(f.parc), pendentes: n(f.pend) })), ['id']);
    const dia = [];
    for (const x of CP.dia || []) { if (!dt(x.data) || !x.serv) continue; const fotos = [];
      for (const [i, f] of (x.fotos || []).entries()) { const p = await subir('fotos-campo', `${x.cc}/${x.id}-${i + 1}.jpg`, f); if (p) fotos.push(p); }
      dia.push({ id: x.id, cc: x.cc, data: dt(x.data), por: x.por, enviado_em: (dt(x.env) || dt(x.data)) + 'T' + (x.hora || '12:00') + ':00-03:00', atraso_dias: n(x.atraso), motivo: nz(x.motivo), equipe: x.equipe || [], servicos: x.serv, ocorrencias: nz(x.ocorr), clima: nz(x.clima), fotos }); }
    await upsert('campo_diarios', dia, ['id']);
    await upsert('campo_combustivel', (CP.gas || []).map(g => ({ id: g.id, cc: nz(g.cc), data: dt(g.data), hora: nz(g.hora), tipo: nz(g.tipo), texto: nz(g.txt), foto_path: null })), ['id']);

    // ---------- comunicação ----------
    const NU = J('a360nucleo');
    const conv = c => c.startsWith('dm:') ? 'dm:' + c.slice(3).split('|').map(x => U(x) || x).sort().join('|') : c;
    const convs = new Set((NU.msgs || []).map(m => conv(m.conv)));
    for (const d of dem) convs.add('obra:' + d.cc);
    await upsert('chat_conversas', [...convs].map(id => ({ id, tipo: id === 'geral' ? 'geral' : id.startsWith('obra:') ? 'obra' : id.startsWith('grp:') ? 'grupo' : 'dm', nome: id === 'geral' ? 'Geral · Armant' : id.startsWith('obra:') ? 'Obra ' + id.slice(5) : id.startsWith('grp:') ? ((CM.grp || []).find(g => g.id === id.slice(4)) || {}).nome || id : null })), ['id']);
    await upsert('chat_mensagens', (NU.msgs || []).filter(m => U(m.de)).map(m => ({ id: m.id, conversa_id: conv(m.conv), de: U(m.de), texto: m.txt, sistema: !!m.sys, criado_em: m.t })), ['id']);
    await upsert('chat_destaques', (NU.dest || []).filter(d => U(d.por) && U(d.para)).map(d => ({ id: d.id, mensagem_id: d.msg, conversa_id: conv(d.conv), por: U(d.por), para: U(d.para), nota: nz(d.nota), status: d.st === 'resolvido' ? 'resolvido' : 'aberto', criado_em: d.em, resolvido_em: nz(d.res) })), ['id']);
    const leit = []; for (const [uid, r] of Object.entries(NU.lidas || {})) for (const [c, t] of Object.entries(r)) if (U(uid)) leit.push({ perfil_id: U(uid), conversa_id: conv(c), lido_ate: t });
    await upsert('chat_leituras', leit.filter(l => convs.has(l.conversa_id)), ['perfil_id', 'conversa_id']);
    await upsert('notificacoes', (NU.notif || []).filter(x => U(x.para)).map(x => ({ id: uuidDe(x.id), para: U(x.para), de: U(x.de), de_nome: nz(x.deNome), tipo: nz(x.tipo), titulo: x.titulo, texto: nz(x.texto), link: nz(x.link), popup: x.pop !== false, lida: !!x.lida, criado_em: x.em })), ['id']);
    await upsert('atribuicoes', (NU.atr || []).filter(a => U(a.de) && U(a.para)).map(a => ({ id: a.id, de: U(a.de), para: U(a.para), titulo: a.titulo, descricao: nz(a.desc), prazo: dt(a.prazo), prioridade: nz(a.prio), cc: nz(a.cc), link: nz(a.link), status: a.st, historico: a.hist || [], criado_em: a.em })), ['id']);
    await upsert('reunioes', (NU.reun || []).filter(r => U(r.por)).map(r => ({ id: r.id, titulo: r.titulo, data: dt(r.data), hora: nz(r.hora), cc: nz(r.cc), pauta: nz(r.pauta), link: r.link, por: U(r.por), participantes: (r.part || []).map(U).filter(Boolean), criado_em: r.em })), ['id']);
    // o registro do protótipo entra na auditoria como histórico
    await db.query(`delete from public.auditoria where tabela like 'protótipo · %'`); // reimportar não duplica
    for (const l of NU.log || []) await db.query(`insert into public.auditoria(em, usuario, usuario_nome, tabela, operacao, registro) values ($1,$2,$3,$4,$5,$6)`,
      [l.t, U(l.uid), l.nome, 'protótipo · ' + l.mod, { criou: 'INSERT', alterou: 'UPDATE', excluiu: 'DELETE' }[l.acao] || 'LOGIN', (l.acao + ': ' + l.txt).slice(0, 400)]);
    total.auditoria = (NU.log || []).length;

    // ---------- RH (documentos vão para o Storage, se houver chave) ----------
    const RH = J('a360rh');
    await upsert('rh_viagens', (RH.via || []).filter(v => U(v.uid)).map(v => ({ id: v.id, solicitante: U(v.uid), destino: v.destino, ida: dt(v.ida), volta: dt(v.volta), motivo: nz(v.motivo), cc: nz(v.cc), transporte: nz(v.trans), adiantamento: n(v.adiant) ?? 0, hospedagem: !!v.hosp, obs: nz(v.obs), status: v.st, historico: v.hist || [], criado_em: nz(v.em) })), ['id']);
    const arqs = Object.fromEntries((bk.arquivos || []).map(a => [a.id, a]));
    const docs = [];
    for (const d of RH.docs || []) { if (!U(d.uid)) continue; const a = arqs[d.id]; const p = a && a.data ? await subir('documentos-rh', `${U(d.uid)}/${d.id}-${(d.nome || 'arquivo').replace(/[^\w.\-]+/g, '_')}`, a.data) : null; docs.push({ id: d.id, perfil_id: U(d.uid), tipo: d.tipo, validade: dt(d.val), obs: nz(d.obs), arquivo_nome: nz(d.nome), tamanho: n(d.size), mime: nz(d.mime), storage_path: p, enviado_por: U(d.por), criado_em: nz(d.em) }); }
    await upsert('rh_documentos', docs, ['id']);
  }

  await db.query(`insert into public.auditoria(usuario_nome, tabela, operacao, registro, depois) values ('importação', '(backup)', 'SQL', $1, $2)`,
    ['Backup de ' + bk.gerado + ' importado', JSON.stringify(total)]);
  await db.query('commit');
  console.log('Importação concluída:'); for (const [t, k] of Object.entries(total)) console.log('  ' + t.padEnd(24) + k);
} catch (e) {
  await db.query('rollback').catch(() => {});
  console.error('ERRO: nada foi gravado. ' + e.message);
  process.exitCode = 1;
} finally { await db.end(); }

// ---------- utilidades ----------
function lerEAP(arq) {
  const tentativas = [arq, 'web/obras-data.js', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'web', 'obras-data.js')].filter(x => typeof x === 'string');
  for (const a of tentativas) { try { const s = fs.readFileSync(a, 'utf8'); return JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;\s*$/, '')); } catch {} }
  return null;
}
async function subir(bucket, caminho, dataUrl) {
  const url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !dataUrl || !String(dataUrl).startsWith('data:')) return null;
  const [cab, b64] = dataUrl.split(','), tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${caminho.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { Authorization: 'Bearer ' + chave, apikey: chave, 'Content-Type': tipo, 'x-upsert': 'true' }, body: Buffer.from(b64, 'base64') });
  if (!r.ok) { console.log('Aviso: não subiu ' + caminho + ' (' + r.status + ')'); return null; }
  total['arquivos enviados'] = (total['arquivos enviados'] || 0) + 1; return bucket + '/' + caminho;
}
function uuidDe(s) { const h = [...String(s)].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619)) >>> 0, 2166136261).toString(16).padStart(8, '0'); const x = (h + Buffer.from(String(s)).toString('hex') + '0'.repeat(32)).slice(0, 32); return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`; }
function carregarEnv() { for (const a of ['.env', path.join('..', '.env')]) { try { for (const l of fs.readFileSync(a, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } return; } catch {} } }
function sair(msg) { console.error(msg); process.exit(1); }
