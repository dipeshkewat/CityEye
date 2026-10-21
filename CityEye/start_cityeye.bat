@echo off
echo ===================================================
echo       STARTING CITYEYE MUNICIPAL AI PLATFORM
echo ===================================================

cd /d "%~dp0backend"
start "CityEye Backend (FastAPI)" "C:\Users\chira\AppData\Local\Programs\Python\Python313\python.exe" run.py

timeout /t 2 >nul

cd /d "%~dp0frontend"
start "CityEye Frontend (Vite React)" cmd /c "npm run dev"

timeout /t 3 >nul

echo Opening CityEye Dashboard in your browser...
start http://localhost:5173

echo.
echo [OK] CityEye is now live!
echo      - Frontend: http://localhost:5173
echo      - Backend:  http://localhost:8000/docs
echo.
pause
