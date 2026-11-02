# Armant 360 · passo 2: cria todas as tabelas, regras de acesso, registro (auditoria) e o superadmin
. (Join-Path $PSScriptRoot "_comum.ps1")
$senhaDb = Ler-Env "SUPABASE_DB_PASSWORD"
if (-not $senhaDb) { Parar "Rode antes o 01-criar-projeto.ps1" }

Passo "Superadmin: $SuperEmail"
$seed = Join-Path $Raiz "supabase\migrations\20261028000099_superadmin.sql"
$txt = [System.IO.File]::ReadAllText($seed)
$novo = [regex]::Replace($txt, "'[^'@\s]+@[^'\s]+'", "'" + $SuperEmail.ToLower() + "'")
if ($novo -ne $txt) { [System.IO.File]::WriteAllText($seed, $novo, (New-Object System.Text.UTF8Encoding($false))); Ok "e-mail do superadmin ajustado" }

Passo "Enviando as migrações ao banco (responda Y para confirmar)"
Rodar "supabase db push" { npx supabase db push --password $senhaDb }
Ok "banco criado"

Passo "Conferindo"
Rodar "Conferência" { node scripts/super.mjs usuarios }
Write-Host ""
Write-Host "Pronto. Próximo: .\powershell\03-funcoes.ps1" -ForegroundColor Green
