#!/usr/bin/env sh
# Virtual Guitar 便携版启动脚本（macOS / Linux）
cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  exec node server.mjs
fi

if command -v python3 >/dev/null 2>&1; then
  echo ""
  echo "使用 Python 启动，请手动打开 http://localhost:8080/"
  echo ""
  (sleep 1
   xdg-open "http://localhost:8080/" >/dev/null 2>&1 \
     || open "http://localhost:8080/" >/dev/null 2>&1) &
  exec python3 -m http.server 8080
fi

echo ""
echo "  未找到 Node.js 或 Python，无法启动本地服务器。"
echo ""
echo "  请安装其中之一后重试："
echo "    Node.js  https://nodejs.org/"
echo "    Python   https://www.python.org/"
echo ""
exit 1
