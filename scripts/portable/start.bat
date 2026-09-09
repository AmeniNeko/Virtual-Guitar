@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo.
  echo 使用 Python 启动，请手动打开 http://localhost:8080/
  echo.
  start "" http://localhost:8080/
  python -m http.server 8080
  goto :end
)

echo.
echo   未找到 Node.js 或 Python，无法启动本地服务器。
echo.
echo   请安装其中之一后重试：
echo     Node.js  https://nodejs.org/
echo     Python   https://www.python.org/
echo.
pause

:end
