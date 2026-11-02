# Armant 360 · funções usadas por todos os scripts (não rode este arquivo sozinho)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz
. (Join-Path $PSScriptRoot "config.ps1")
$ArqEnv = Join-Path $Raiz ".env"

function Passo([string]$texto) { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    !!  $texto" -ForegroundColor Yellow }
function Parar([string]$texto) { Write-Host ""; Write-Host "ERRO: $texto" -ForegroundColor Red; exit 1 }

function Ler-Env([string]$nome) {
  if (-not (Test-Path $ArqEnv)) { return "" }
  foreach ($l in Get-Content $ArqEnv -Encoding UTF8) {
    if ($l -match "^\s*$nome\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"') }
  }
  return ""
}
function Gravar-Env([string]$nome, [string]$valor) {
  $linhas = @()
  if (Test-Path $ArqEnv) { $linhas = @(Get-Content $ArqEnv -Encoding UTF8 | Where-Object { $_ -notmatch "^\s*$nome\s*=" }) }
  $linhas += "$nome=$valor"
  [System.IO.File]::WriteAllLines($ArqEnv, [string[]]$linhas, (New-Object System.Text.UTF8Encoding($false)))
}
function Exigir([string]$cmd, [string]$dica) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Parar "Não encontrei '$cmd'. $dica" }
}
function Rodar([string]$descricao, [scriptblock]$bloco) {
  & $bloco
  if ($LASTEXITCODE -ne 0) { Parar "$descricao falhou (código $LASTEXITCODE). Leia a mensagem acima." }
}
function Perguntar([string]$texto, [string]$padrao = "") {
  $p = if ($padrao) { "$texto [$padrao]" } else { $texto }
  $r = Read-Host $p
  if ([string]::IsNullOrWhiteSpace($r)) { return $padrao } else { return $r.Trim() }
}
function Senha-Aleatoria([int]$n = 32) {
  $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  $b = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return -join ($b | ForEach-Object { $chars[$_ % $chars.Length] })
}
# a saída em JSON do Supabase CLI pode vir como lista ou dentro de um objeto: devolve sempre a lista
function Lista-Json([string]$texto) {
  $o = $texto | ConvertFrom-Json
  if ($o -is [System.Array]) { return $o }
  foreach ($pr in $o.PSObject.Properties) { if ($pr.Value -is [System.Array]) { return $pr.Value } }
  return @($o)
}
