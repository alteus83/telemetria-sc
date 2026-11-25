@echo off
chcp 65001 >nul
title Telemetria SC - Ponte
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js non e' installato.
  echo  Scaricalo da https://nodejs.org ^(versione LTS^), installalo e riapri questo file.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Prima installazione delle librerie, attendi...
  call npm install
  if errorlevel 1 goto errore
)

if not exist dist (
  echo Preparo la pagina dello schermo...
  call npm run build
  if errorlevel 1 goto errore
)

start "" http://localhost:8787
call npm run ponte
pause
exit /b 0

:errore
echo.
echo Qualcosa e' andato storto: copia il messaggio qui sopra e mandamelo.
pause
exit /b 1
