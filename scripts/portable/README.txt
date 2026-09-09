Virtual Guitar v0.2 — 便携版
================================

使用方法
--------
1. 解压到任意文件夹（路径尽量不含中文与空格）
2. 启动：
     Windows        双击 start.bat
     macOS / Linux  终端里执行  ./start.sh
3. 浏览器会自动打开 http://localhost:8080/

需要 Node.js 或 Python 之一，用来起本地服务器。

为什么不能直接双击 index.html？
  浏览器禁止 file:// 页面加载 ES 模块和音频采样（CORS 限制），
  所以必须通过本地 HTTP 服务器打开。

采样音源
--------
四套音源已包含在 sounds/ 目录中（约 1.3 GB）：

  FSS Steel String Guitar        GPL-3.0-or-later（FreePats 特殊例外）
  Spanish Classical Guitar       CC0-1.0
  Electric Guitar FSBS (clean)   CC0-1.0
  Electric Guitar FSBS (dist1)   CC0-1.0

完整署名与来源见 THIRD_PARTY_SAMPLES.md。

操作提示
--------
  点击琴弦        发出该音
  按住不放        持续发声，松开后自然衰减
  横向拖过多根弦  扫弦（向下拖=下扫，向上拖=上扫）
  顶部「力度」    同时决定音量与音色层次
  「人性化」      轻微随机化时序与力度，让连续演奏更自然

版本
----
v0.2
