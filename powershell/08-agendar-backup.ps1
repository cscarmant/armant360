# Armant 360 · agenda o backup automático todo dia (Agendador de Tarefas do Windows)
. (Join-Path $PSScriptRoot "_comum.ps1")
$script = Join-Path $PSScriptRoot "07-backup.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $Raiz
$quando = New-ScheduledTaskTrigger -Daily -At $HoraBackup
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
try {
  Register-ScheduledTask -TaskName "Armant 360 - backup diario" -Action $acao -Trigger $quando -Settings $config -Description "Copia o banco do Armant 360 para $Raiz\backups" -Force | Out-Null
} catch {
  Parar ("O Windows não deixou agendar (" + $_.Exception.Message + "). Abra o PowerShell como administrador (botão direito > Executar como administrador) e rode de novo.")
}
Ok "backup agendado todo dia às $HoraBackup (o computador precisa estar ligado; se estiver desligado, roda ao ligar)"
Write-Host "    Para ver ou remover: Agendador de Tarefas > 'Armant 360 - backup diario'."
