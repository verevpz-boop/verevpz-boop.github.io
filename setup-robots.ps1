# setup-robots.ps1 - запустить из D:\pavel-site\
# PowerShell: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# Затем: cd D:\pavel-site && .\setup-robots.ps1

$projectRoot = "D:\\pavel-site"
$targetDir = "$projectRoot\\public\\models\\robot-candidates"
$downloadsDir = "$env:USERPROFILE\\Downloads"
$appDir = "$projectRoot\\app\\robot-test"

# Создаём папки
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

Write-Host "Папки созданы: $targetDir" -ForegroundColor Green

# Перемещаем файлы из Downloads
$files = @{
  "REPORT.md" = "$targetDir\\REPORT.md"
  "page.tsx" = "$appDir\\page.tsx"
  "download-robots.js" = "$projectRoot\\download-robots.js"
}

foreach ($fileName in $files.Keys) {
  $src = "$downloadsDir\\$fileName"
  $dst = $files[$fileName]
  if (Test-Path $src) {
    Move-Item -Force $src $dst
    Write-Host "✓ $fileName -> $dst" -ForegroundColor Green
  } else {
    Write-Host "✗ $fileName не найден в Downloads" -ForegroundColor Yellow
  }
}

# Скачиваем .glb файлы с Sketchfab (без логина, публичные модели)
Write-Host "\nСкачиваем .glb файлы..." -ForegroundColor Cyan

$models = @(
  @{ Id="240c1f80db55416a99fa2ccd33da0efc"; File="candidate_1.glb"; Name="BOT VIPE ANIMATION" },
  @{ Id="56d5d623bb6c40faaa951aca02080510"; File="candidate_2.glb"; Name="BOT NEIL ANIMATION" },
  @{ Id="3dbf07385d1b471a96dce6de6cba97d6"; File="candidate_3.glb"; Name="Sci-Fi Camera Drone" },
  @{ Id="20dd7f7bdc9a4c36aef491f12afa14d8"; File="candidate_4.glb"; Name="Floating Robot" },
  @{ Id="1a68794ab6834f8e94d0f5de7e03a7af"; File="candidate_5.glb"; Name="Zeb" }
)

foreach ($m in $models) {
  $dest = "$targetDir\\$($m.File)"
  if (Test-Path $dest) {
    Write-Host "  ✓ $($m.File) уже существует" -ForegroundColor Gray
    continue
  }
  
  $apiUrl = "https://sketchfab.com/i/archives/latest?archiveType=glb&model=$($m.Id)&textureMaxResolution=1024"
  Write-Host "  Загрузка $($m.Name)..." -NoNewline
  
  try {
    $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -Headers @{"User-Agent"="Mozilla/5.0"}
    $json = $response.Content | ConvertFrom-Json
    if ($json.url) {
      Invoke-WebRequest -Uri $json.url -OutFile $dest -UseBasicParsing
      $sizeMB = [math]::Round((Get-Item $dest).Length / 1MB, 1)
      Write-Host " ✓ ($($sizeMB) MB)" -ForegroundColor Green
    } else {
      Write-Host " ✗ нужен логин" -ForegroundColor Yellow
      Write-Host "    Скачай вручную: https://sketchfab.com/3d-models/$($m.Id)#download" -ForegroundColor DarkYellow
    }
  } catch {
    Write-Host " ✗ $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Скачай вручную: https://sketchfab.com/3d-models/$($m.Id)#download" -ForegroundColor DarkYellow
  }
}

Write-Host "\nГотово! Открой: http://localhost:3000/robot-test" -ForegroundColor Green
Write-Host "Отчёт: $targetDir\\REPORT.md" -ForegroundColor Green
