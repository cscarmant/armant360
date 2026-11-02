// Armant 360 · superadmin pelo terminal (conexão direta ao banco: passa por cima de todas as regras)
// Uso (pelo PowerShell: .\powershell\08-superadmin.ps1 <comando> ...):
//   usuarios                         lista perfis (nível, setor, obras, se já entrou com o Google)
//   nivel <email> <0-6>              muda o nível de alguém (6 = superadmin)
//   obras <email> CC-2026-001,CC-..  define as obras designadas
//   bloquear <email> | liberar <email>
//   estado                           módulos guardados (fase 1), versão e tamanho
//   ver <chave> [arquivo.json]       baixa um módulo inteiro para um arquivo (ex.: ver a360fin fin.json)
//   gravar <chave> <arquivo.json>    sobe o arquivo editado como nova versão do módulo (todos recebem na hora)
//   registro [n]                     últimas n alterações (padrão 30)
//   desfazer <id>                    desfaz a alteração <id> do registro
//   sql "<comando>"                  qualquer SQL; SELECT mostra as linhas
import fs from 'node:fs';
import pg from 'pg';

for (const l of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { DATABASE_URL, SUPER_EMAIL } = process.env;
if (!DATABASE_URL) { console.error('Falta DATABASE_URL no .env'); process.exit(1); }
const [cmd, a1, a2] = process.argv.slice(2);
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: /localhost|127\.0\.0\.1|host=\//.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
await db.connect();
const q = (s, p) => db.query(s, p);
const registrar = (registro, depois) => q(`insert into public.auditoria(usuario_nome, tabela, operacao, registro, depois) values ('superadmin (terminal)', '(terminal)', 'SQL', $1, $2)`, [registro.slice(0, 400), depois ? JSON.stringify(depois) : null]);
// fase 1: o app lê usuários, níveis e obras do módulo a360acesso; o perfil do banco e o módulo andam juntos
async function noApp(email, mudar) {
  const r = await q(`select dados from public.estado_modulo where chave = 'a360acesso'`);
  if (!r.rowCount) return;
  const d = r.rows[0].dados, u = (d.users || []).find((x) => String(x.email).toLowerCase() === email.toLowerCase());
  if (!u) return;
  mudar(u);
  await q(`update public.estado_modulo set dados = $1, versao = versao + 1, atualizado_por = 'terminal' where chave = 'a360acesso'`, [JSON.stringify(d)]);
}
const mostra = (rows) => rows.length ? console.table(rows) : console.log('(nenhuma linha)');

try {
  switch (cmd) {
    case 'usuarios':
      mostra((await q(`select id, nome, email, nivel, setor, array_to_string(obras, ',') obras, ativo, auth_id is not null as entrou from public.perfis order by nivel desc, nome`)).rows); break;
    case 'nivel': {
      const n = Number(a2); if (!a1 || !(n >= 0 && n <= 6)) throw new Error('Uso: nivel <email> <0-6>');
      const r = await q(`update public.perfis set nivel = $2 where email = lower($1) returning id, nome, nivel`, [a1, n]);
      if (!r.rowCount) throw new Error('Perfil não encontrado: ' + a1);
      await noApp(a1, (u) => { u.nivel = n; });
      await registrar(`nível de ${a1} → ${n}`); mostra(r.rows); break;
    }
    case 'obras': {
      const lista = String(a2 || '').split(',').map((x) => x.trim()).filter(Boolean);
      const r = await q(`update public.perfis set obras = $2 where email = lower($1) returning id, nome, obras`, [a1, lista]);
      if (!r.rowCount) throw new Error('Perfil não encontrado: ' + a1);
      await noApp(a1, (u) => { u.obras = lista; });
      await registrar(`obras de ${a1} → ${lista.join(',') || '(nenhuma)'}`); mostra(r.rows); break;
    }
    case 'bloquear': case 'liberar': {
      const r = await q(`update public.perfis set ativo = $2 where email = lower($1) returning id, nome, ativo`, [a1, cmd === 'liberar']);
      if (!r.rowCount) throw new Error('Perfil não encontrado: ' + a1);
      await noApp(a1, (u) => { u.ativo = cmd === 'liberar'; });
      await registrar(`${cmd} ${a1}`); mostra(r.rows);
      if (cmd === 'bloquear') console.log('O perfil foi desativado: a pessoa perde o acesso aos dados na hora. Para derrubar também o login do Google, use o painel (Console → Servidor · logins).');
      break;
    }
    case 'estado':
      mostra((await q(`select chave, versao, atualizado_por, to_char(atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as quando, pg_size_pretty(length(dados::text)::bigint) as tamanho from public.estado_modulo order by chave`)).rows); break;
    case 'ver': {
      const r = await q(`select dados, versao from public.estado_modulo where chave = $1`, [a1]);
      if (!r.rowCount) throw new Error('Módulo não encontrado: ' + a1);
      const arq = a2 || `${a1}.json`; fs.writeFileSync(arq, JSON.stringify(r.rows[0].dados, null, 2));
      console.log(`Versão ${r.rows[0].versao} de ${a1} salva em ${arq}. Edite e suba com: gravar ${a1} ${arq}`); break;
    }
    case 'gravar': {
      if (!a1 || !a2) throw new Error('Uso: gravar <chave> <arquivo.json>');
      if (!/^a360/.test(a1)) throw new Error('A chave começa com a360 (veja o comando estado).');
      const dados = JSON.parse(fs.readFileSync(a2, 'utf8'));
      const r = await q(`insert into public.estado_modulo(chave, dados, versao, atualizado_por) values ($1, $2, 1, 'terminal')
        on conflict (chave) do update set dados = excluded.dados, versao = public.estado_modulo.versao + 1, atualizado_por = 'terminal' returning versao`, [a1, JSON.stringify(dados)]);
      await registrar(`gravou ${a1} pelo terminal (versão ${r.rows[0].versao})`);
      console.log(`${a1} agora está na versão ${r.rows[0].versao}. Quem está com o app aberto recebe a mudança.`); break;
    }
    case 'registro':
      mostra((await q(`select id, to_char(em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS') as quando, usuario_nome as quem, operacao, tabela, left(registro, 60) as registro from public.auditoria order by id desc limit $1`, [Number(a1) || 30])).rows); break;
    case 'desfazer': {
      // desfazer() exige o superadmin: age em nome dele dentro desta transação
      await q('begin');
      const s = await q(`select auth_id::text from public.perfis where email = lower($1) and nivel >= 6`, [SUPER_EMAIL || '']);
      if (!s.rowCount || !s.rows[0].auth_id) throw new Error('O superadmin (SUPER_EMAIL no .env) precisa ter entrado pelo menos uma vez com o Google.');
      await q(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', json_build_object('sub', $1)::text, true)`, [s.rows[0].auth_id]);
      const r = await q(`select public.desfazer($1) as resultado`, [Number(a1)]);
      await q('commit'); console.log(r.rows[0].resultado); break;
    }
    case 'sql': {
      if (!a1) throw new Error('Uso: sql "select ..."');
      await registrar('SQL pelo terminal: ' + a1, { comando: a1 });
      const r = await q(a1);
      for (const x of [].concat(r)) x.rows && x.rows.length ? console.table(x.rows) : console.log(`${x.command || 'OK'} ${x.rowCount ?? ''}`.trim());
      break;
    }
    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'));
  }
} catch (e) {
  await q('rollback').catch(() => {});
  console.error('Erro:', e.message); process.exitCode = 1;
} finally { await db.end(); }
