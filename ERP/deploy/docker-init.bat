@echo off
chcp 65001 >nul
echo === ERP Docker Init ===

echo.
echo [1/3] Running migrations...
docker compose exec backend python manage.py migrate --noinput

echo.
echo [2/3] Collecting static files...
docker compose exec backend python manage.py collectstatic --noinput --clear

echo.
echo [3/3] Creating superuser...
echo Nhap thong tin tai khoan admin:
docker compose exec backend python manage.py createsuperuser

echo.
echo === HOAN TAT! ===
echo Truy cap: http://localhost hoac http://192.168.1.100
pause
