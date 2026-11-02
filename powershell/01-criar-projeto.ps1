# Armant 360 · passo 1: ferramentas, conta do Supabase, projeto e chaves (.env)
. (Join-Path $PSScriptRoot "_comum.ps1")
Exigir "node" "Rode antes: .\powershell\00-preparar-windows.ps1"

Passo "Instalando as ferramentas do projeto (Supabase CLI e driver do banco)"
Rodar "npm install" { npm install --no-fund --no-audit }
Ok "ferramentas instaladas em node_modules"

Passo "Entrando na sua conta do Supabase (o navegador vai abrir)"
Write-Host "    Se ainda não tem conta: crie em https://supabase.com com o Gmail $SuperEmail"
Rodar "Login no Supabase" { npx supabase login }

Passo "Projeto no Supabase"
$ref = Ler-Env "SUPABASE_REF"
$senhaDb = Ler-Env "SUPABASE_DB_PASSWORD"
if ($ref) {
  Ok "usando o projeto já configurado: $ref"
} else {
  $ja = Perguntar "Você já criou o projeto pelo painel do Supabase? (s/n)" "n"
  if ($ja -eq "s") {
    $ref = Perguntar "Cole o Project ID (painel > Project Settings > General > Project ID)"
    $seg = Read-Host "Senha do banco que você escolheu ao criar o projeto" -AsSecureString
    $senhaDb = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seg))
  } else {
    Rodar "Listar organizações" { npx supabase orgs list }
    $org = Perguntar "Copie e cole o ID da organização (coluna ID da lista acima)"
    $senhaDb = Senha-Aleatoria 24
    Rodar "Criar projeto" { npx supabase projects create $Projeto --org-id $org --db-password $senhaDb --region $Regiao }
    $ref = ""
    try {
      $lista = Lista-Json ((npx supabase projects list -o json) | Out-String)
      $p = @($lista | Where-Object { $_.name -eq $Projeto })[0]
      if ($p) { $ref = if ($p.ref) { $p.ref } else { $p.id } }
    } catch { }
    if (-not $ref) { $ref = Perguntar "Projeto criado. Cole o Project ID dele (painel > Project Settings > General)" }
    Ok "projeto criado: $ref (a criação do banco leva 1 a 2 minutos)"
    Start-Sleep -Seconds 90
  }
  Gravar-Env "SUPABASE_REF" $ref
  Gravar-Env "SUPABASE_DB_PASSWORD" $senhaDb
  Gravar-Env "SUPABASE_URL" "https://$ref.supabase.co"
  Gravar-Env "SUPER_EMAIL" $SuperEmail
}

Passo "Ligando esta pasta ao projeto"
Rodar "supabase link" { npx supabase link --project-ref $ref --password $senhaDb }

Passo "Buscando as chaves de acesso"
try {
  # prefere as chaves "legacy" (anon e service_role); se o projeto só tiver as novas, usa publishable e secret
  $chaves = Lista-Json ((npx supabase projects api-keys --project-ref $ref --reveal -o json) | Out-String)
  $anon = @($chaves | Where-Object { $_.name -eq "anon" })[0].api_key
  if (-not $anon) { $anon = @($chaves | Where-Object { $_.type -eq "publishable" })[0].api_key }
  $serv = @($chaves | Where-Object { $_.name -eq "service_role" })[0].api_key
  if (-not $serv) { $serv = @($chaves | Where-Object { $_.type -eq "secret" })[0].api_key }
} catch { $anon = ""; $serv = "" }
if (-not $anon) { $anon = Perguntar "Cole a chave pública: 'anon' (aba Legacy API Keys) ou 'publishable' (sb_publishable_...), em Project Settings > API Keys" }
if (-not $serv) { $serv = Perguntar "Cole a chave secreta: 'service_role' (Legacy) ou 'secret' (sb_secret_...). Não mande para ninguém" }
Gravar-Env "SUPABASE_ANON_KEY" $anon
Gravar-Env "SUPABASE_SERVICE_ROLE_KEY" $serv
Ok "chaves guardadas no .env"

Passo "Endereço do banco para os scripts (importar, backup, superadmin)"
$db = Ler-Env "DATABASE_URL"
if (-not $db) {
  Write-Host "    No painel do Supabase clique em 'Connect' (topo) > aba 'Connection string' > 'Session pooler'."
  Write-Host "    Copie a linha que começa com postgresql://postgres.${ref}:..."
  $db = Perguntar "Cole aqui"
  $db = $db.Replace("[YOUR-PASSWORD]", [uri]::EscapeDataString($senhaDb))
  Gravar-Env "DATABASE_URL" $db
}
Rodar "Teste de conexão" { node scripts/testar-conexao.mjs }

Write-Host ""
Write-Host "Pronto. Próximo: .\powershell\02-banco.ps1" -ForegroundColor Green
