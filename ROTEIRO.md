# Roteiro de produção do back-end · Armant 360

Este roteiro coloca o Armant 360 em um servidor de verdade. Os dados passam a ser os mesmos em todos os computadores e celulares. O login é feito com Google, os arquivos ficam guardados na nuvem, o chat e os avisos chegam na hora, e o superadmin tem controle total.

Tudo roda pelo **PowerShell do Windows**. São 7 scripts em sequência (00 a 06), mais 3 para o dia a dia (07 a 09).

---

## 1. Como fica

| Peça | Serviço | Para quê |
|---|---|---|
| Banco de dados | **Supabase** (Postgres) | Todas as tabelas, as regras de acesso, o registro de tudo e o desfazer |
| Login | Supabase Auth + **Google** | Só com conta Gmail cadastrada; quem não está cadastrado vira pedido de acesso |
| Arquivos | Supabase Storage | Fotos do campo, documentos do RH, notas fiscais |
| Tempo real | Supabase Realtime | Mudanças de outra pessoa, chat, avisos e pedidos de acesso chegam na hora |
| Funções | Supabase Edge Functions | `admin` (superadmin gerencia logins), `email` (avisa a pessoa: tarefa nova, tarefa atribuída, conta criada) e `aviso-email` (pedido de acesso) |
| Site | **Netlify** | O mesmo Armant 360 de hoje, com a ponte para o Supabase |
| E-mail | **Resend** (opcional) | Avisa o superadmin quando alguém pede acesso |

Use o mesmo Gmail (`valentim.arr@gmail.com`) em todas as contas. Assim tudo fica no nome do dono.

### Custos (conferir em cada site; os preços mudam)

- **Supabase Free**: 500 MB de banco, 1 GB de arquivos e 50 mil usuários por mês.
  - O projeto **pausa depois de 7 dias sem uso** e **não tem backup automático**.
  - Para uso real da empresa, recomendo o **Pro (cerca de US$ 25 por mês)**: não pausa, faz backup diário e dá mais espaço.
- **Netlify Free**: suficiente para o site.
- **Resend Free**: 3 mil e-mails por mês.
- **Google Cloud**: o login com Google é grátis.

---

## 2. Antes de começar (uma vez)

1. Crie as contas com o Gmail da empresa:
   - [supabase.com](https://supabase.com)
   - [netlify.com](https://netlify.com)
   - [console.cloud.google.com](https://console.cloud.google.com)
   - [resend.com](https://resend.com) (opcional)
2. Ative a **verificação em duas etapas** no Google, no Supabase e no Netlify. Quem entra nessas contas tem o sistema inteiro.
3. No protótipo atual, baixe o backup em **Painel do superadmin > Registro e backup > Baixar backup**. O arquivo se chama `armant360-backup-….json` e é ele que leva os dados de hoje para o servidor.
4. Descompacte este pacote em uma pasta fixa, por exemplo `C:\Armant360\backend-armant360`.
5. Abra o **PowerShell** (menu Iniciar > digite PowerShell) e rode, uma vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
cd C:\Armant360\backend-armant360
Get-ChildItem -Recurse | Unblock-File
notepad .\powershell\config.ps1
```

No `config.ps1`, confira o e-mail do superadmin e a região (`sa-east-1` = São Paulo). Salve e feche.

---

## 3. Passo a passo no PowerShell

Rode sempre de dentro da pasta do pacote (`cd C:\Armant360\backend-armant360`).

| # | Comando | O que faz | Você precisa |
|---|---|---|---|
| 0 | `.\powershell\00-preparar-windows.ps1` | Instala o Git e o Node.js pelo winget | Aceitar a instalação (5 min) |
| 1 | `.\powershell\01-criar-projeto.ps1` | Instala o Supabase CLI e entra na sua conta. Cria o projeto (ou liga um que você já criou) e guarda as chaves no `.env` | Fazer login no navegador, escolher a organização e colar o endereço do banco (veja abaixo) |
| 2 | `.\powershell\02-banco.ps1` | Cria as 45 tabelas, as regras de acesso, o registro (auditoria), os arquivos, o tempo real e o superadmin | Responder **Y** |
| 3 | `.\powershell\03-funcoes.ps1` | Publica as funções `admin`, `email` e `aviso-email` e liga os e-mails | O endereço do Google Apps Script e/ou a chave do Resend (pode pular) |
| 4 | `.\powershell\04-importar-dados.ps1` | Leva o backup do protótipo para o banco (sem backup, leva só a lista de serviços da obra) | O arquivo de backup (pega o mais recente da pasta Downloads) |
| 5 | `.\powershell\05-site.ps1` | Monta o site (sem os dados reais do contrato) e publica no Netlify | Entrar no Netlify e dar nome ao site; colar o endereço que aparecer |
| 6 | `.\powershell\06-login-google.ps1` | Liga o "Entrar com Google" e autoriza o endereço do site | Criar a credencial no Google (o script mostra cada clique) e um token do Supabase |

**Endereço do banco (passo 1):** no painel do Supabase, clique em **Connect** (no topo), aba **Connection string**, opção **Session pooler**. Copie a linha `postgresql://postgres.<projeto>:[YOUR-PASSWORD]@…`. O script troca `[YOUR-PASSWORD]` pela senha sozinho.

**Pronto:** abra o endereço do site, clique em **Entrar com Google** e use o Gmail do superadmin.

### Depois, no dia a dia

| Comando | Para quê |
|---|---|
| `.\powershell\05-site.ps1` | Publicar de novo depois de mudar algo na pasta `web` |
| `.\powershell\02-banco.ps1` | Aplicar uma migração nova (arquivo novo em `supabase\migrations`) |
| `.\powershell\07-backup.ps1` | Copiar o banco inteiro e os arquivos para `backups\` |
| `.\powershell\07-backup.ps1 -Restaurar backups\armant360-….json` | Voltar o banco para uma cópia (pede para digitar RESTAURAR) |
| `.\powershell\08-agendar-backup.ps1` | Backup automático todo dia às 23h (Agendador de Tarefas) |
| `.\powershell\09-superadmin.ps1 …` | Comandos do superadmin pelo terminal (seção 5) |

---

## 4. Como as pessoas entram

1. O superadmin cadastra a pessoa em **Usuários e acessos**, com Gmail, nível, setor e obras. Não precisa de senha: o login é o Google.
2. A pessoa abre o site e clica em **Entrar com Google**. O sistema liga o Google ao cadastro pelo e-mail.
3. Quem entra sem cadastro vê **Acesso pendente**. Nesse momento:
   - o pedido aparece para o administrador no app, em Usuários e acessos > Solicitações (em tempo real);
   - o administrador recebe um e-mail, se o Resend estiver ligado.
4. O administrador aprova o pedido e a pessoa clica em "Já fui liberado".

O login aceita **só Gmail** (a regra que você pediu). Se a Armant passar a usar Google Workspace com domínio próprio, basta ligar a opção `outrosDominios` no `config.js` gerado pelo `scripts/montar-site.mjs`.

Pelo protocolo de segurança, o login por e-mail e senha fica **desligado** no Supabase. Ninguém consegue criar uma conta com o e-mail de outra pessoa, e o cadastro só é ligado a um e-mail **confirmado**.

---

### E-mails para as pessoas

A pessoa recebe e-mail quando ganha uma tarefa nova (Controle de obras ou programação do campo), quando alguém atribui uma tarefa a ela, quando vira R.O. de uma obra e quando a conta dela é criada.
- **Google Apps Script** (recomendado para começar): sai do Gmail que publicar o script (`scripts/aviso-email-armant360.gs`), até cerca de 100 e-mails por dia. O 03-funcoes.ps1 pede o endereço.
- **Resend**: para mandar a qualquer pessoa, precisa do domínio **armant.com.br** verificado no Resend (registros DNS). Sem domínio, só entrega para o dono da conta.

## 4b. Módulos que dependem do servidor

### Certificado digital A1 (Financeiro → Notas fiscais)
- O arquivo `.pfx` vai para o cofre privado `certificados`, que só o superadmin e a gestão do Financeiro (nível 4 ou mais) abrem. **A senha nunca é guardada**: ela só serve para ler os dados no navegador.
- Todo dia, por volta das 8h (Brasília), o banco confere a validade (`pg_cron`, ligado pelo `03-funcoes.ps1` → `ligar-aviso-email.mjs` quando o Resend está configurado) e avisa no app e por e-mail 60, 30, 15, 7, 3 e 1 dia antes, no dia e toda semana depois de vencido.

### Extrato bancário e Conta Azul (Financeiro → Extrato e conciliação)
- Arquivos de extrato (OFX, CSV, Excel, PDF) funcionam sem configurar nada.
- **Conta Azul:** o `03-funcoes.ps1` pergunta o *Client ID* e o *Client Secret*, depois de você criar um aplicativo em https://developers.contaazul.com com a conta da Armant. A URL de redirecionamento do aplicativo é `https://<projeto>.supabase.co/functions/v1/contaazul`. Depois, no site: **Conectar à Conta Azul** e **Sincronizar**.
- Os tokens da Conta Azul ficam numa tabela que **só o servidor** lê (nem o superadmin pelo site). Só a gestão do Financeiro conecta e sincroniza. A sincronização traz contas financeiras com saldo, contas a receber e a pagar, sem duplicar.

### Menu do R.O. e Compras
- Os pedidos de material do App de campo nascem em **triagem**. O R.O. da obra encaminha cada material para o almoxarifado ou para Compras; Compras registra fornecedor, OC e previsão.
- No banco (migração 011), o campo só **cria** pedidos das obras em que está designado. Ele não altera nem pula a triagem. O R.O. só tria as obras dele.

### Comunicados e documentos técnicos
- **Comunicados:** grupos por setor, obra, nível ou pessoas e "Li e estou ciente". No banco, cada pessoa só marca o próprio ciente, e só a gestão (nível 4+, RH, Diretoria) cria grupos e envia.
- **Laudo técnico e solicitação de acesso:** são tarefas do Controle de obras.
  - O banco **recusa** gravar um documento técnico que contenha um número no formato de CPF.
  - RG e CPF só são digitados na janela de impressão.

### Consumo e custos (Painel do superadmin)
- A ponte mede o que cada aparelho baixa e envia do servidor (banco, arquivos, funções, login e tempo real) e manda um resumo a cada 5 minutos, ao esconder a página e ao sair (`registrar_uso`, migração 013).
- O painel junta isso ao tamanho real do banco e dos arquivos, aos usuários ativos e aos e-mails enviados, e projeta a conta no Supabase Free e Pro e no Resend, para hoje, 6 e 12 meses. Preços, limites, número de usuários e dólar são editáveis na tela.
- O tráfego é uma **estimativa pelo lado do aplicativo** (o tamanho das respostas), não a fatura do Supabase. Compare com **Settings → Usage** no painel do Supabase no primeiro mês e ajuste.
- Uma fotografia diária (tamanho do banco e dos arquivos) é tirada às 23h50 pelo `pg_cron`, para o histórico de crescimento.

## 5. Poderes do superadmin

O superadmin (nível 6) pode tudo, em todas as camadas.

**No banco**
1. **Passa por cima de todas as regras.** Toda tabela tem a regra `superadmin_tudo`: ele lê, cria, altera e exclui qualquer registro, de qualquer módulo e de qualquer obra.
2. **Ninguém mexe no superadmin.** Quem gere acessos (nível 5) não consegue rebaixar, bloquear nem criar outro superadmin. Só um superadmin promove alguém a nível 6.
3. **Registro de tudo.** Toda inclusão, alteração e exclusão, em qualquer tabela, vira uma linha no registro com antes, depois, quem e quando.
4. **Desfazer.** Qualquer linha do registro pode ser desfeita: volta o valor anterior, apaga o que foi criado ou recria o que foi excluído.
5. **Atividades da demanda aprovada** (atividade, quantidade, valor): só o superadmin cadastra, altera e exclui. No app, na ficha do centro de custo; no banco, a tabela `demanda_itens` (as demais pessoas só leem).

**No app**

5. **Console de dados** (Painel do superadmin > Console):
   - ver, editar, criar e excluir qualquer registro de qualquer módulo, exportar e zerar um módulo;
   - **Ver como** qualquer pessoa, para conferir o que ela enxerga e agir por ela.
6. **Painel do servidor**, no mesmo Console, que só aparece para o nível 6:
   - **Logins:** todas as contas do Google, com último acesso, e os botões bloquear, liberar e excluir. O bloqueio derruba a pessoa de todos os aparelhos.
   - **SQL:** qualquer comando no banco. Fica no registro.
   - **Registro:** as últimas alterações, com o botão **Desfazer**.

**Fora do app**

7. **Terminal** (`09-superadmin.ps1`):

```powershell
.\powershell\09-superadmin.ps1 usuarios
.\powershell\09-superadmin.ps1 nivel fulano@gmail.com 5
.\powershell\09-superadmin.ps1 obras fulano@gmail.com CC-2026-001,CC-2026-002
.\powershell\09-superadmin.ps1 bloquear fulano@gmail.com
.\powershell\09-superadmin.ps1 estado
.\powershell\09-superadmin.ps1 ver a360fin financeiro.json
.\powershell\09-superadmin.ps1 gravar a360fin financeiro.json
.\powershell\09-superadmin.ps1 registro 50
.\powershell\09-superadmin.ps1 desfazer 1234
.\powershell\09-superadmin.ps1 sql 'select nome, nivel, setor from perfis'
```

   - `ver` baixa um módulo inteiro para editar no Bloco de Notas, e `gravar` sobe a versão editada. Quem estiver com o app aberto recebe na hora.
   - Escreva o SQL entre aspas simples. Os textos dentro dele usam aspas simples dobradas, por exemplo `'... where email = ''a@gmail.com'''`.
8. **Painel do Supabase** (dono da conta): o Table Editor mostra e edita as tabelas, e o SQL Editor executa qualquer comando.
9. **Backup e restauração** completos (`07-backup.ps1`).

---

## 6. Fases: o que já funciona e o que vem depois

### Fase 1 (este pacote): o sistema de hoje, compartilhado

- Cada módulo é guardado inteiro no banco (tabela `estado_modulo`), com controle de versão.
- Se duas pessoas mexem ao mesmo tempo, a ponte junta as mudanças registro a registro, pelo id. Uma mudança não apaga a outra.
- A mudança de outra pessoa chega em tempo real. A página recarrega sozinha quando você não está digitando; se estiver, aparece um aviso com o botão "Atualizar".
- Sem internet, as mudanças ficam guardadas no aparelho e sobem quando a conexão voltar.
- Fotos e documentos vão para o Storage, e a pessoa abre de qualquer aparelho.
- A lista de serviços da obra (dados reais do contrato TJ-RS) **não vai para o site público**. Ela vem do banco e só aparece depois do login.

**Limites da fase 1, que a fase 2 resolve:**
- **Quem entrou consegue baixar pelo navegador os dados de todos os módulos**, inclusive RH (viagens, adiantamentos e a lista de documentos) e frota. O app esconde o que a pessoa não pode ver, mas um técnico conseguiria ler. Por isso, na fase 1, só dê login a quem é da equipe e já poderia ver esses dados.
- Exceção já protegida na fase 1: o **arquivo** de cada documento do RH só abre para quem enviou e para o RH.
- O chat atualiza recarregando a página, ou seja, não é instantâneo enquanto a pessoa digita.
- Comunicados (`a360com`), documentos técnicos (`a360docs`), extrato (`a360extrato`) e pedidos de material (`a360mat`) também estão nesta situação: as regras das tabelas da migração 011 só passam a valer na fase 2.

### Fase 2: cada módulo nas suas tabelas

As tabelas separadas **já existem** no banco, com as regras de acesso por nível, setor e obra, e o `04-importar-dados.ps1` **já as preenche**. Falta trocar, módulo a módulo, a leitura e a gravação do app para essas tabelas.

| Ordem | Módulo | Ganho | Esforço |
|---|---|---|---|
| 1 | RH (viagens, documentos) e Frota | Dados pessoais (LGPD) só para a pessoa, o gestor e o RH/frota | 3 dias |
| 2 | Chat, notificações, tarefas atribuídas | Mensagens instantâneas; cada um só baixa o que é seu | 2 a 3 dias |
| 3 | App de campo (tarefas, fotos, RDO, fim de serviço, gasolina) | Fotos por obra; o campo só vê as obras designadas | 3 dias |
| 4 | Obras (EAP, lançamentos, aditivos, medições) | Histórico por lançamento; relatórios no banco | 4 dias |
| 5 | Financeiro (títulos, notas, contas) | Só o financeiro baixa dados financeiros | 3 dias |
| 6 | Materiais, almoxarifado, listas, Comercial, Cadastros, **triagem do R.O. e Compras** | Estoque calculado no banco (`v_estoque`); o campo só pede na obra dele; cada setor só baixa o seu | 4 dias |
| 7 | Comunicados e documentos técnicos | Cada um só baixa os comunicados dele; o laudo só para quem trabalha na obra | 2 dias |
| 8 | Extrato bancário e certificado | Lançamentos do banco só para o Financeiro | 1 dia |

Durante a fase 2, os módulos que ainda não migraram continuam na fase 1. Nada para de funcionar.

---

## 7. Segurança e LGPD

- **`.env` é segredo.** A `SERVICE_ROLE_KEY` e o `DATABASE_URL` abrem o banco inteiro. Não mande o arquivo por WhatsApp nem por e-mail e não suba no Git (o `.gitignore` já exclui).
- A chave **anon** que vai no site é pública por natureza. Quem protege os dados são as regras do banco (RLS), testadas aqui.
- Os backups (`backups\`) têm dados pessoais. Guarde-os no Drive da empresa, com acesso restrito.
- **Dados pessoais na fase 1:** os arquivos dos documentos do RH já abrem só para quem enviou e para o RH. Os demais dados de RH e frota ficam legíveis para qualquer pessoa com login (seção 6), por isso RH e Frota são os primeiros da fase 2.
- **A partir da fase 2:** CPF, placas e documentos ficam só onde o RH e a frota veem, e os documentos do RH em pastas por pessoa (cada um vê os seus e o RH vê todos). As regras já estão no banco e testadas.
- O registro guarda quem fez o quê. Defina por quanto tempo guardar (pergunta em aberto).
- Tudo fica em São Paulo (`sa-east-1`).

---

## 8. Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "a execução de scripts foi desabilitada neste sistema" | Rode `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e `Get-ChildItem -Recurse \| Unblock-File` |
| "Não encontrei 'node'" logo depois do passo 0 | Feche e abra o PowerShell |
| Erro no `functions deploy` falando de Docker | Atualize o CLI (`npm i -D supabase@latest`) e rode o 03 de novo. O `--use-api` dispensa o Docker |
| "Não conectou" no teste do banco | Copie de novo o **Session pooler** e confira a senha no `.env` (linha `DATABASE_URL`) |
| Google: "redirect_uri_mismatch" | No Google Cloud, a URI de redirecionamento deve ser exatamente `https://<projeto>.supabase.co/auth/v1/callback` |
| O 01 pede para colar as chaves | Em Project Settings > API Keys, use a aba **Legacy API Keys** (anon e service_role); se não existir, use a publishable e a secret |
| Você mesmo vê "Acesso pendente" | O e-mail do Google é diferente do `$SuperEmail`. Rode `09-superadmin.ps1 usuarios` |
| Site parado / "project paused" | É o plano Free depois de 7 dias sem uso: entre no painel e clique em **Restore**. O Pro não pausa |
| "Sem conexão com o servidor" no app | As mudanças ficam no aparelho e sobem quando a internet voltar |

---

## 9. O que foi testado e o que não foi

**Testado aqui (Linux, Postgres 16 local imitando o Supabase):**
- As 13 migrações mais a do superadmin, aplicadas do zero, com **101 verificações de regras de acesso, todas aprovadas**:
  - 39 em `teste-permissoes.sql`;
  - 19 do Controle de obras em `teste-controle.sql`;
  - 15 do certificado em `teste-certificado.sql`;
  - 18 da triagem, compras, comunicados e documentos técnicos em `teste-ro-comunicados.sql`;
  - 10 do consumo de dados em `teste-consumo.sql` (só o superadmin vê o painel; cada pessoa só soma o próprio uso; valores absurdos são recusados).

  Entre elas:
  - o campo só vê a obra designada e não vê o financeiro;
  - o superadmin vê e altera tudo;
  - o desfazer funciona;
  - um e-mail não confirmado não toma um perfil;
  - um gestor (nível 5) não rebaixa, não desativa e não cria superadmin;
  - o arquivo de documento do RH de outra pessoa não aparece;
  - um pedido de acesso é aprovado ao criar o perfil;
  - o campo não pede material em obra de outro nem pula a triagem (este teste achou uma regra antiga larga demais, já corrigida na 011);
  - cada pessoa só marca o próprio "ciente";
  - um laudo com CPF (000.000.000-00) é recusado, mas número de série e telefone passam.
- A função `contaazul` contra o servidor de testes oficial da Conta Azul (10 verificações em `teste-contaazul.ts`).
- A importação de um backup com os módulos novos: triagem dividida, compra, grupo, comunicado com ciente, laudo com foto, solicitação de acesso e extrato importado.
- A importação do backup do protótipo (431 linhas em 45 tabelas), rodando duas vezes sem duplicar.
- Backup e restauração do banco inteiro.
- Os comandos do superadmin pelo terminal, inclusive o desfazer.
- A ponte do site com um Supabase simulado e duas pessoas ao mesmo tempo, **25 verificações aprovadas em 3 rodadas seguidas**:
  - login, dados compartilhados, tempo real e conflito juntado;
  - pedido de acesso, arquivos e painel do servidor;
  - EAP vinda do banco, nenhuma recarga em cadeia com duas pessoas paradas, mudança recusada pelo servidor sem insistir e saída.
  - Refeito em 29/10 com os módulos novos e a medição de consumo, no site montado pelo `montar-site.mjs` (`node teste-local/teste-ponte.cjs publicar <backup.json> <pasta> web/obras-data.js`): **26 verificações aprovadas em 4 rodadas seguidas**, inclusive a medição de bytes. A recarga em cadeia que aparecia às vezes foi corrigida: ao recarregar a página, o sistema registrava "saiu" e "entrou", e isso fazia o outro aparelho recarregar.
- Controle de obras e R.O. no banco: o R.O. decide as atividades só da obra dele e manda para o campo; o responsável muda a classificação mas não o prazo; "Atrasado" é calculado; atividades da demanda só o superadmin altera; diário atrasado só da obra designada e nunca do dia de hoje.
- O site sem servidor (modo protótipo): 57 telas, sem erros. Também testes de ponta a ponta:
  - várias obras por pessoa;
  - Menu do R.O. e Compras (15 verificações, inclusive um R.O. de fora do setor Obras);
  - comunicados (13);
  - laudo e solicitação de acesso (18, inclusive o Excel da lista com a coluna CPF vazia);
  - prestação de contas do veículo com foto do preço na bomba (10);
  - Gantt com subitens (8);
  - certificado A1 (16);
  - extrato (24).

  Mais e mais testes de ponta a ponta com o e-mail e a planilha reais do Banrisul (importação, atividades, controle de obras, e-mails), o Painel do R.O., o diário atrasado, o Dia a Dia e o "Entrar com Google".
- As opções do Supabase CLI usadas nos scripts, conferidas na versão 2.122.0.

**Não executado aqui (fazer no seu computador):**
- **Os scripts PowerShell.** O PowerShell não pôde ser instalado neste ambiente; os scripts foram escritos para o Windows PowerShell 5.1 e revisados, mas rodam pela primeira vez na sua máquina. Se algum passo parar, a mensagem diz o que fazer, e o script pode ser rodado de novo sem estragar o que já foi feito.
- A criação real do projeto no Supabase, o login real com Google, o envio de e-mails (Apps Script/Resend) e a publicação no Netlify.
- A conexão real com a Conta Azul (precisa do aplicativo criado no portal de desenvolvedores com a conta da Armant).

---

## 10. Conteúdo do pacote

```
backend-armant360/
  ROTEIRO.md                 este roteiro
  package.json               ferramentas (Supabase CLI, driver do banco)
  .env.example               modelo dos segredos (o .env de verdade é criado pelo 01)
  powershell/                00 a 09 + config.ps1 + _comum.ps1
  supabase/
    config.toml
    migrations/              001 base · 002 tabelas · 003 regras · 004 registro e superadmin
                             005 arquivos e tempo real · 006 ponte fase 1 · 007 login · 008 controle de obras
                             009 certificado A1 · 010 extrato e Conta Azul · 011 R.O., compras, comunicados e laudos
                             012 preço do litro e foto do preço no abastecimento · 013 consumo e custos · 099 superadmin
    functions/admin/         poderes do superadmin sobre os logins
    functions/email/         e-mail para a pessoa (tarefa nova, atribuída, conta criada)
    functions/aviso-email/   e-mail de pedido de acesso e aviso do certificado (Resend)
    functions/contaazul/     conexão e sincronização com a Conta Azul
  scripts/                   importar-backup · backup · super · ligar-aviso-email · montar-site · testar-conexao
  web/                       o site (Armant 360 + ponte-supabase.js + config.js)
  teste-local/               testes usados aqui (regras do banco e ponte)
```
