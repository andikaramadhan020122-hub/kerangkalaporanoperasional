@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   LAPORAN OPERASIONAL PT. ETT BOGOR
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang Node.js 18 atau lebih baru, lalu jalankan file ini kembali.
  pause
  exit /b 1
)

if not exist "node_modules\exceljs\package.json" (
  call :install_dependencies
  if errorlevel 1 exit /b 1
)
if not exist "node_modules\selfsigned\package.json" (
  call :install_dependencies
  if errorlevel 1 exit /b 1
)

if not exist "data\auth.json" (
  echo Menyiapkan aplikasi untuk pertama kali...
  call npm.cmd run setup
  if errorlevel 1 (
    echo.
    echo Pengaturan PIN gagal. Klik file ini kembali untuk mencoba lagi.
    pause
    exit /b 1
  )
)

echo.
echo Tautan web: https://127.0.0.1:3443
echo Biarkan jendela ini tetap terbuka selama menggunakan web.
echo.
node server.js --open
if errorlevel 1 (
  echo.
  echo Server berhenti karena terjadi kesalahan. Periksa pesan di atas.
  pause
)
exit /b

:install_dependencies
echo Menyiapkan aplikasi untuk pertama kali...
call npm.cmd install
if errorlevel 1 (
  echo.
  echo Instalasi gagal. Periksa koneksi internet, lalu klik file ini kembali.
  pause
  exit /b 1
)
exit /b 0
