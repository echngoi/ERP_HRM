@echo off
chcp 65001 >nul
echo ========================================
echo   ERP UPDATE - %date% %time%
echo ========================================

echo.
echo [1/5] Pull code moi (neu dung Git)...
cd /d C:\erp
git pull origin main 2>nul || echo Khong dung Git, bo qua.

echo.
echo [2/5] Cap nhat backend dependencies...
cd /d C:\erp\backend
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo.
echo [3/5] Chay migration...
python manage.py migrate --noinput

echo.
echo [4/5] Thu thap static files...
python manage.py collectstatic --noinput --clear

echo.
echo [5/5] Build frontend...
cd /d C:\erp\frontend
call npm install --silent
call npm run build

echo.
echo Restart Daphne service...
C:\nssm\nssm.exe restart erp-backend

echo.
echo ========================================
echo   CAP NHAT HOAN TAT!  %date% %time%
echo ========================================
pause
