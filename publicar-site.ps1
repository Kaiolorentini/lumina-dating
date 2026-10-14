# ============================================
# LUMINA — PUBLICAR O SITE (landing + app web)
# publicar-site.ps1  (fica na raiz do app: C:\Users\kaio2\vesper\lumina-dating)
#
# 13/10/2026. A landing continua na raiz do site; o app web vai para
# /app. Este script:
#   1. exporta o app para web (pasta dist-web, com baseUrl /app);
#   2. confere se o export saiu certo;
#   3. troca a pasta landing-page\public\app pelo export novo
#      (a landing em si não é tocada);
#   4. publica o Hosting:
#        sem parâmetro  -> canal de PRÉVIA (endereço temporário, 7 dias)
#        -Producao      -> https://lumina-ff667.web.app (oficial)
#
# Uso:
#   .\publicar-site.ps1            # prévia para testar
#   .\publicar-site.ps1 -Producao  # oficial
#
# Ordem de deploy do projeto: functions -> regras -> hosting.
# Este script faz só o hosting.
# ============================================

param(
  [switch]$Producao
)

$ErrorActionPreference = 'Stop'

$AppRoot     = 'C:\Users\kaio2\vesper\lumina-dating'
$LandingRoot = 'C:\Users\kaio2\vesper\landing-page'
$Export      = Join-Path $AppRoot 'dist-web'
$Destino     = Join-Path $LandingRoot 'public\app'

function Falhar($msg) {
  Write-Host ""
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $AppRoot 'app.json')))         { Falhar "Pasta do app não encontrada: $AppRoot" }
if (-not (Test-Path (Join-Path $LandingRoot 'firebase.json'))) { Falhar "Pasta da landing não encontrada: $LandingRoot" }

# 1. Export do app
Write-Host "1/4  Exportando o app para web..." -ForegroundColor Cyan
Set-Location $AppRoot
if (Test-Path $Export) { Remove-Item $Export -Recurse -Force }
npx expo export --platform web --output-dir dist-web
if ($LASTEXITCODE -ne 0) { Falhar "o export do app falhou (veja a mensagem acima)." }

# 2. Conferência
Write-Host "2/4  Conferindo o export..." -ForegroundColor Cyan
$indexHtml = Join-Path $Export 'index.html'
if (-not (Test-Path $indexHtml)) { Falhar "dist-web\index.html não foi gerado." }
$html = Get-Content $indexHtml -Raw -Encoding UTF8
if ($html -notmatch '/app/_expo/') { Falhar "o index.html não aponta para /app/_expo. Confira o experiments.baseUrl no app.json." }
if ($html -notmatch 'notranslate')  { Falhar "o index.html não é o public\index.html do Lumina (falta o notranslate)." }

# 3. Copia para a landing (só a pasta app)
Write-Host "3/4  Copiando para landing-page\public\app..." -ForegroundColor Cyan
if (Test-Path $Destino) { Remove-Item $Destino -Recurse -Force }
New-Item -ItemType Directory -Force $Destino | Out-Null
Copy-Item (Join-Path $Export '*') $Destino -Recurse -Force

# 4. Deploy do hosting
Set-Location $LandingRoot
if ($Producao) {
  Write-Host "4/4  Publicando no endereço OFICIAL..." -ForegroundColor Yellow
  firebase deploy --only hosting
} else {
  Write-Host "4/4  Publicando no canal de PRÉVIA (7 dias)..." -ForegroundColor Cyan
  firebase hosting:channel:deploy teste-app --expires 7d
}
if ($LASTEXITCODE -ne 0) { Set-Location $AppRoot; Falhar "o deploy do hosting falhou." }

Set-Location $AppRoot
Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
if (-not $Producao) {
  Write-Host "Abra o endereço de prévia mostrado acima e teste / , /entrar , /criadores e /app."
  Write-Host "Se estiver tudo certo: .\publicar-site.ps1 -Producao"
}
