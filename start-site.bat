@echo off
REM Start de website op een lokale server en open hem in je browser.
REM Dubbelklik dit bestand. Sluit het venster om de server te stoppen.

setlocal
set PORT=4173
set DIR=%~dp0

echo.
echo   Beijer Elektro - lokale website
echo   ------------------------------------
echo   De site wordt geopend op http://localhost:%PORT%
echo   Stoppen: sluit dit venster.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Geen Node.js gevonden. Je kunt de site ook gewoon openen
  echo   door dubbel te klikken op index.html.
  echo.
  start "" "%DIR%index.html"
  pause
  exit /b
)

start "" http://localhost:%PORT%
node "%DIR%server.js"

endlocal
