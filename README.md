# Armant 360 · back-end (Supabase) e roteiro de produção

Leia o **ROTEIRO.md**. Resumo do caminho no PowerShell, de dentro desta pasta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
Get-ChildItem -Recurse | Unblock-File
.\powershell\00-preparar-windows.ps1
.\powershell\01-criar-projeto.ps1
.\powershell\02-banco.ps1
.\powershell\03-funcoes.ps1
.\powershell\04-importar-dados.ps1
.\powershell\05-site.ps1
.\powershell\06-login-google.ps1
```

Depois: `07-backup.ps1`, `08-agendar-backup.ps1` e `09-superadmin.ps1` (comandos do superadmin).

Os scripts PowerShell foram escritos e revisados, mas **não foram executados** no ambiente onde foram feitos (sem PowerShell lá). O banco, a importação, o backup, os comandos do superadmin e a ponte do site foram testados (seção 9 do roteiro).
