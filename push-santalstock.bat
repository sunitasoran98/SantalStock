@echo off
REM SantalStock: one-click push to GitHub (Cloudflare auto-deploys)
REM Is file ko SantalStock folder ke andar rakho aur double-click karo.
cd /d "%~dp0"
if not exist ".git" (
  echo [X] Ye SantalStock folder nahi hai. push-santalstock.bat ko SantalStock folder me rakho.
  pause
  exit /b 1
)
echo === SantalStock push ===
git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo Koi naya badlav nahi hai. Phir bhi push try kar raha hoon...
) else (
  git commit -m "Update %date% %time:~0,5%"
)
git pull --rebase origin main
git push origin main
if %errorlevel%==0 (
  echo.
  echo [OK] Push ho gaya. Cloudflare 1-2 minute me deploy karega.
) else (
  echo.
  echo [X] Push fail hua. Upar ka error dekho.
)
pause
