# Armant 360 · cópia de segurança do banco inteiro e dos arquivos (pasta backups\)
# Restaurar uma cópia:  .\powershell\07-backup.ps1 -Restaurar backups\armant360-AAAA-MM-DD-HHMM.json
param([string]$Restaurar = "")
. (Join-Path $PSScriptRoot "_comum.ps1")
if ($Restaurar) {
  Passo "Restaurando $Restaurar (apaga o banco atual e volta para a cópia)"
  Rodar "restauração" { node scripts/backup.mjs --restaurar "$Restaurar" }
} else {
  Passo "Fazendo a cópia"
  Rodar "backup" { node scripts/backup.mjs }
  # mantém as 30 cópias mais recentes
  $todas = @(Get-ChildItem (Join-Path $Raiz "backups") -Filter "armant360-*.json" | Sort-Object LastWriteTime -Descending)
  if ($todas.Count -gt 30) {
    $todas | Select-Object -Skip 30 | ForEach-Object {
      $pasta = $_.FullName -replace "\.json$", "-arquivos"
      Remove-Item $_.FullName -Force
      if (Test-Path $pasta) { Remove-Item $pasta -Recurse -Force }
    }
    Ok "cópias antigas apagadas (ficam as 30 últimas)"
  }
  Aviso "Guarde a pasta backups também no Google Drive da empresa (tem dados pessoais: LGPD)."
}
