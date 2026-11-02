# Armant 360 · passo 3: funções do servidor (admin do superadmin, e-mails e Conta Azul)
. (Join-Path $PSScriptRoot "_comum.ps1")
$ref = Ler-Env "SUPABASE_REF"
if (-not $ref) { Parar "Rode antes o 01-criar-projeto.ps1" }

Passo "E-mail automático (Resend)"
$resend = Ler-Env "RESEND_API_KEY"
if (-not $resend) {
  Write-Host "    Crie uma conta grátis em https://resend.com com o $SuperEmail e gere uma API Key."
  Write-Host "    Sem domínio próprio verificado, o Resend só entrega para o e-mail da própria conta (serve para os avisos)."
  $resend = Perguntar "Cole a API Key do Resend (Enter para pular por enquanto)"
  if ($resend) { Gravar-Env "RESEND_API_KEY" $resend }
}
Passo "E-mail para as pessoas (tarefa nova, tarefa atribuída, conta criada)"
$apps = Ler-Env "APPS_SCRIPT_URL"
if (-not $apps) {
  Write-Host "    Opção 1 (recomendada para começar): Google Apps Script, sai do Gmail que publicar o script (até ~100 e-mails por dia)."
  Write-Host "      Instale com o arquivo entregaveis\aviso-email-armant360.gs (instruções no topo dele) e cole o endereço /exec."
  Write-Host "    Opção 2: Resend com o domínio armant.com.br verificado (sem domínio, o Resend só entrega para o dono da conta)."
  $apps = Perguntar "Endereço do Apps Script (Enter para usar só o Resend)"
  if ($apps) { Gravar-Env "APPS_SCRIPT_URL" $apps }
}
Passo "Conta Azul (opcional: sincroniza contas a receber, a pagar e saldos no Financeiro)"
$caId = Ler-Env "CONTAAZUL_CLIENT_ID"
if (-not $caId) {
  Write-Host "    1. Entre em https://developers.contaazul.com com a conta da Armant na Conta Azul e crie um aplicativo."
  Write-Host "    2. Em 'URL de redirecionamento' coloque: https://$ref.supabase.co/functions/v1/contaazul"
  Write-Host "    3. Copie o Client ID e o Client Secret do aplicativo."
  $caId = Perguntar "Client ID da Conta Azul (Enter para pular por enquanto)"
  if ($caId) { Gravar-Env "CONTAAZUL_CLIENT_ID" $caId; $caSec = Perguntar "Client Secret da Conta Azul"; if ($caSec) { Gravar-Env "CONTAAZUL_CLIENT_SECRET" $caSec } }
}
$caSec = Ler-Env "CONTAAZUL_CLIENT_SECRET"
$segredo = Ler-Env "AVISO_SEGREDO"
if (-not $segredo) { $segredo = Senha-Aleatoria 40; Gravar-Env "AVISO_SEGREDO" $segredo }
$site = Ler-Env "SITE_URL"; if (-not $site) { $site = $SiteUrl }

Passo "Guardando os segredos no Supabase"
$args1 = @("supabase", "secrets", "set", "--project-ref", $ref, "ADMIN_EMAIL=$SuperEmail", "AVISO_SEGREDO=$segredo", "EMAIL_REMETENTE=$Remetente")
if ($resend) { $args1 += "RESEND_API_KEY=$resend" }
if ($apps) { $args1 += "APPS_SCRIPT_URL=$apps" }
if ($site) { $args1 += "SITE_URL=$site" }
if ($caId -and $caSec) { $args1 += "CONTAAZUL_CLIENT_ID=$caId"; $args1 += "CONTAAZUL_CLIENT_SECRET=$caSec" }
Rodar "supabase secrets set" { npx @args1 }

Passo "Publicando a função admin (poderes do superadmin sobre os logins)"
Rodar "deploy admin" { npx supabase functions deploy admin --project-ref $ref --use-api }
Passo "Publicando a função email (avisos para as pessoas)"
Rodar "deploy email" { npx supabase functions deploy email --project-ref $ref --use-api }
Passo "Publicando a função aviso-email"
Rodar "deploy aviso-email" { npx supabase functions deploy aviso-email --project-ref $ref --no-verify-jwt --use-api }
if ($caId -and $caSec) {
  Passo "Publicando a função contaazul (a volta da Conta Azul chega sem login: a função confere o login por conta própria)"
  Rodar "deploy contaazul" { npx supabase functions deploy contaazul --project-ref $ref --no-verify-jwt --use-api }
  Write-Host "    No site: Financeiro -> Extrato e conciliação -> Conectar à Conta Azul." -ForegroundColor Green
} else {
  Aviso "Conta Azul não configurada: o extrato bancário funciona por arquivo (OFX, CSV, Excel, PDF). Rode este script de novo para ligar."
}

if ($resend) {
  Passo "Ligando o aviso por e-mail a cada pedido de acesso"
  Rodar "ligar aviso" { node scripts/ligar-aviso-email.mjs }
} else {
  Aviso "Sem Resend: os pedidos aparecem só no app. Rode este script de novo quando tiver a chave."
}
Write-Host ""
Write-Host "Pronto. Próximo: .\powershell\04-importar-dados.ps1" -ForegroundColor Green
