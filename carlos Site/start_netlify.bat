@echo off
echo ================================================
echo Demarrage avec Netlify Dev
echo ================================================
echo.

REM Changer vers le repertoire du script
cd /d "%~dp0"

REM Verifier que nous sommes dans le bon repertoire
if not exist "netlify.toml" (
    echo ERREUR: netlify.toml non trouve dans le repertoire courant
    echo Repertoire actuel: %CD%
    pause
    exit /b 1
)

netlify --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Netlify CLI n'est pas installe
    echo Installez-le avec: npm install -g netlify-cli
    pause
    exit /b 1
)

echo.
echo Repertoire de travail: %CD%
echo.
echo Demarrage de Netlify Dev...
echo.
echo Le serveur sera accessible sur http://localhost:8888
echo.
echo URLs utiles:
echo   - Page video: http://localhost:8888/video.html?course=web
echo.
echo Appuyez sur Ctrl+C pour arreter
echo ================================================
echo.

REM Liberer les ports potentiellement bloques par une ancienne session Netlify
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3999 ^| findstr LISTENING') do (
    echo Liberation du port 3999 (PID %%p)...
    taskkill /PID %%p /F >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8888 ^| findstr LISTENING') do (
    echo Liberation du port 8888 (PID %%p)...
    taskkill /PID %%p /F >nul 2>&1
)

netlify dev --port 8888 --dir frontend
