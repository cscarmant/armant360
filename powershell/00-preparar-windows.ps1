# Armant 360 · passo 0: instala o que o computador precisa (Git e Node.js) — rode uma vez
. (Join-Path $PSScriptRoot "_comum.ps1")

Passo "Conferindo o winget (instalador do Windows)"
Exigir "winget" "Atualize o 'Instalador de Aplicativo' pela Microsoft Store e abra o PowerShell de novo."
Ok "winget disponível"

function Instalar([string]$cmd, [string]$id, [string]$nome) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { Ok "$nome já instalado"; return }
  Passo "Instalando $nome"
  winget install --id $id -e --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Parar "Não consegui instalar $nome pelo winget." }
}
Instalar "git" "Git.Git" "Git"
Instalar "node" "OpenJS.NodeJS.LTS" "Node.js LTS"

# recarrega o PATH sem precisar fechar o PowerShell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Exigir "node" "Feche e abra o PowerShell e rode este script de novo."
Ok ("Node " + (node -v) + " · npm " + (npm -v))
Write-Host ""
Write-Host "Pronto. Próximo: .\powershell\01-criar-projeto.ps1" -ForegroundColor Green
