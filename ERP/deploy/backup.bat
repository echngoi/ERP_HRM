@echo off
chcp 65001 >nul
set BACKUP_DIR=C:\erp\backups
set DATE_STR=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set DATE_STR=%DATE_STR: =0%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

copy "C:\erp\backend\db.sqlite3" "%BACKUP_DIR%\db_%DATE_STR%.sqlite3" >nul
echo [%date% %time%] Backup thanh cong: db_%DATE_STR%.sqlite3 >> "%BACKUP_DIR%\backup.log"
echo Backup xong: %BACKUP_DIR%\db_%DATE_STR%.sqlite3

rem Xoa backup cu hon 30 ngay
forfiles /p "%BACKUP_DIR%" /m "db_*.sqlite3" /d -30 /c "cmd /c del @file" 2>nul
