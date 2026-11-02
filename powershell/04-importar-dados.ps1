# Armant 360 · passo 4: leva os dados do protótipo (arquivo de backup) para o banco
# No protótipo: Painel do superadmin > Registro e backup > Baixar backup  (arquivo armant360-backup-....json)
. (Join-Path $PSScriptRoot "_comum.ps1")

$padrao = ""
$down = Join-Path $env:USERPROFILE "Downloads"
if (Test-Path $down) {
  $ult = Get-ChildItem $down -Filter "armant360-backup-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($ult) { $padrao = $ult.FullName }
}
Passo "Arquivo de backup do protótipo"
$arq = Perguntar "Caminho do arquivo (Enter para usar o mais recente dos Downloads; 'pular' para começar vazio)" $padrao
if (-not $arq -or $arq -eq "pular") {
  Aviso "Sem backup: o sistema começa vazio (o superadmin já existe). Levando só a lista de serviços da obra TJ-RS."
  Rodar "importação da EAP" { node scripts/importar-backup.mjs --so-eap --eap web/obras-data.js }
  exit 0
}
if (-not (Test-Path $arq)) { Parar "Arquivo não encontrado: $arq" }

Passo "Importando (módulos inteiros para a fase 1 e tabelas separadas para a fase 2)"
Rodar "importação" { node scripts/importar-backup.mjs --arquivo "$arq" --eap web/obras-data.js }
Write-Host ""
Write-Host "Pronto. Próximo: .\powershell\05-site.ps1" -ForegroundColor Green
