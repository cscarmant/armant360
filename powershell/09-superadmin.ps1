# Armant 360 · superadmin pelo terminal: passa por cima de todas as regras do banco
# Exemplos:
#   .\powershell\09-superadmin.ps1 usuarios
#   .\powershell\09-superadmin.ps1 nivel fulano@gmail.com 5
#   .\powershell\09-superadmin.ps1 obras fulano@gmail.com CC-2026-001,CC-2026-002
#   .\powershell\09-superadmin.ps1 bloquear fulano@gmail.com
#   .\powershell\09-superadmin.ps1 estado
#   .\powershell\09-superadmin.ps1 ver a360fin financeiro.json      (edite o arquivo)
#   .\powershell\09-superadmin.ps1 gravar a360fin financeiro.json   (todos recebem na hora)
#   .\powershell\09-superadmin.ps1 registro 50
#   .\powershell\09-superadmin.ps1 desfazer 1234
#   .\powershell\09-superadmin.ps1 sql "select nome, nivel from perfis"
. (Join-Path $PSScriptRoot "_comum.ps1")
if ($args.Count -eq 0) { node scripts/super.mjs; exit 0 }
node scripts/super.mjs @args
exit $LASTEXITCODE
