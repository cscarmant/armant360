# Armant 360 · passo 6: liga o "Entrar com Google" e diz ao Supabase qual é o endereço do site
. (Join-Path $PSScriptRoot "_comum.ps1")
$ref = Ler-Env "SUPABASE_REF"; $site = Ler-Env "SITE_URL"
if (-not $ref -or -not $site) { Parar "Rode antes o 01 e o 05." }

Passo "1) Credencial do Google (faça no navegador, 5 minutos)"
Write-Host "    a. Abra https://console.cloud.google.com/ com o $SuperEmail e crie um projeto 'Armant 360'."
Write-Host "    b. Menu 'APIs e serviços' > 'Tela de permissão OAuth' (Google Auth Platform): tipo Externo, nome Armant 360,"
Write-Host "       e-mail de suporte $SuperEmail. Publique o app (status 'Em produção') para qualquer Gmail conseguir entrar."
Write-Host "    c. 'Credenciais' > 'Criar credenciais' > 'ID do cliente OAuth' > tipo 'Aplicativo da Web'."
Write-Host "       Origens JavaScript autorizadas:  $site"
Write-Host "       URIs de redirecionamento autorizados:  https://$ref.supabase.co/auth/v1/callback"
Write-Host "    d. Copie o 'ID do cliente' e a 'Chave secreta do cliente'."
$gid = Perguntar "ID do cliente do Google"
$gsec = Perguntar "Chave secreta do cliente do Google"
if (-not $gid -or -not $gsec) { Parar "Sem a credencial do Google não dá para entrar no sistema." }

Passo "2) Token de acesso do Supabase (para este script configurar o login por você)"
Write-Host "    Abra https://supabase.com/dashboard/account/tokens > 'Generate new token' (nome: armant360-roteiro)."
$tok = Perguntar "Cole o token (Enter para fazer à mão no painel)"

$corpo = @{
  site_url                  = $site
  uri_allow_list            = "$site,$site/**"
  external_google_enabled   = $true
  external_google_client_id = $gid
  external_google_secret    = $gsec
  external_email_enabled    = $false
  disable_signup            = $false
} | ConvertTo-Json

if ($tok) {
  Passo "Configurando o login no Supabase"
  try {
    Invoke-RestMethod -Method Patch -Uri "https://api.supabase.com/v1/projects/$ref/config/auth" `
      -Headers @{ Authorization = "Bearer $tok" } -ContentType "application/json" -Body $corpo | Out-Null
    Ok "Google ligado; site $site autorizado"
  } catch { Parar ("A configuração falhou: " + $_.Exception.Message + " · Faça à mão (abaixo).") }
} else {
  Aviso "Faça à mão no painel do Supabase:"
  Write-Host "    Authentication > Sign In / Providers > Google: ligue, cole o ID e a chave secreta, salve."
  Write-Host "    Authentication > URL Configuration: Site URL = $site ; Redirect URLs: adicione $site/**"
}
Write-Host ""
Write-Host "Teste agora: abra $site, clique em 'Entrar com Google' e use o $SuperEmail." -ForegroundColor Green
Write-Host "Quem não estiver cadastrado vê 'Acesso pendente' e você recebe o pedido no app (e por e-mail, se ligou o Resend)."
