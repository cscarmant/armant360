# Armant 360 · passo 5: publica o site (Netlify, grátis) já ligado ao Supabase
# Rode de novo sempre que mudar algo na pasta web.
. (Join-Path $PSScriptRoot "_comum.ps1")
if (-not (Ler-Env "SUPABASE_URL")) { Parar "Rode antes o 01-criar-projeto.ps1" }

Passo "Montando a pasta 'publicar' (sem os dados reais do contrato: eles vêm do banco depois do login)"
Rodar "montar site" { node scripts/montar-site.mjs }

Passo "Publicando no Netlify"
Write-Host "    Na primeira vez: o navegador abre para entrar (use o $SuperEmail);"
Write-Host "    depois escolha 'Create & configure a new project' e dê um nome (ex.: armant360)."
Rodar "deploy Netlify" { npx --yes netlify-cli@27 deploy --prod --dir publicar }

$site = Ler-Env "SITE_URL"
if (-not $site) {
  $site = Perguntar "Cole o endereço do site que apareceu acima (linha 'Production URL' ou 'Website URL')"
  $site = $site.TrimEnd("/")
  Gravar-Env "SITE_URL" $site
  $ref = Ler-Env "SUPABASE_REF"
  Rodar "secrets SITE_URL" { npx supabase secrets set --project-ref $ref "SITE_URL=$site" }
  Ok "endereço guardado: $site"
}
Write-Host ""
Write-Host "Site no ar: $site" -ForegroundColor Green
Write-Host "Próximo (só na primeira vez): .\powershell\06-login-google.ps1" -ForegroundColor Green
