@echo off
chcp 65001 >nul
echo ============================================
echo  Деплой Worker jarvi-brain (мозг + /tts голос + /stt СЛУХ Whisper)
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$k=Get-Content 'E:\Projects\jarvis\Подсказка\КЛЮЧИ_И_ДОСТУПЫ.md' -Raw -Encoding UTF8; if($k -match 'cfut_[A-Za-z0-9_\-]{20,}'){$env:CLOUDFLARE_API_TOKEN=$matches[0]; Set-Location 'D:\pavel-site\docs\worker'; npx --yes wrangler deploy -c wrangler-jarvi.toml} else {Write-Host 'CFUT-токен не найден в КЛЮЧИ' -ForegroundColor Red}"
echo.
echo ============================================
echo  Готово. Если видишь строку 'Deployed jarvi-brain' выше — успех.
echo  Скажи Claude результат.
echo ============================================
pause
