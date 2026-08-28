/* ============================================================
 * main.js — 启动与初始化
 * 构建虚拟文件系统、预置文件、显示欢迎横幅
 * ============================================================ */

'use strict';

(function () {
  const fs = new VFS();

  /* ---------- 预置虚拟文件系统 ---------- */

  // 基础目录
  for (const d of ['/bin', '/etc', '/home', '/home/user', '/home/user/projects',
    '/home/user/projects/web-terminal', '/home/user/projects/notes-app',
    '/home/user/projects/scripts', '/tmp', '/usr', '/usr/bin', '/usr/share',
    '/usr/share/doc', '/var', '/var/log', '/srv', '/mnt']) {
    fs.mkdir(d);
  }

  // 根目录欢迎文件
  fs.writeFile('/welcome.txt',
    '欢迎使用 WebTerminal!\n' +
    '\n' +
    '这是一个完全运行在浏览器中的类终端系统:\n' +
    '  · 虚拟文件系统(VFS)只存在于内存,刷新页面即还原\n' +
    '  · 支持 Tab 补全、命令历史、重定向(> >>)\n' +
    '  · 有 neofetch / cowsay / matrix / snake 等趣味命令\n' +
    '\n' +
    '输入 help 查看全部命令。\n');

  fs.writeFile('/home/user/README.md',
    '# WebTerminal 用户手册\n' +
    '\n' +
    '这是一个基于 Web 技术实现的类终端系统(纯前端,零依赖)。\n' +
    '\n' +
    '## 快速上手\n' +
    '\n' +
    '```\n' +
    'ls            # 查看当前目录\n' +
    'cd projects   # 进入目录\n' +
    'cat README.md # 查看文件\n' +
    'echo 你好 > a.txt   # 写入文件\n' +
    'cat a.txt     # 读取文件\n' +
    'rm a.txt      # 删除文件\n' +
    '```\n' +
    '\n' +
    '## 快捷键\n' +
    '\n' +
    '| 按键 | 功能 |\n' +
    '| --- | --- |\n' +
    '| Tab | 自动补全 |\n' +
    '| ↑ / ↓ | 命令历史 |\n' +
    '| Ctrl+L | 清屏 |\n' +
    '| Ctrl+C | 取消当前输入 |\n' +
    '| Ctrl+A / Ctrl+E | 行首 / 行尾 |\n' +
    '\n' +
    '试试这些命令:`neofetch`、`banner`、`cowsay`、`matrix`、`snake`。\n');

  fs.writeFile('/home/user/notes.txt',
    '备忘:\n' +
    '  · 文件系统每次刷新都会重置,重要内容记得导出\n' +
    '  · echo 支持 $? $USER $HOME $PWD $HOSTNAME 变量\n' +
    '  · 路径支持绝对(/etc)、相对(../)、~ 三种写法\n' +
    '  · > 覆盖写文件,>> 追加写文件\n');

  fs.writeFile('/home/user/hello.js',
    '// hello.js — WebTerminal 示例脚本\n' +
    'function greet(name) {\n' +
    '  return `Hello, ${name}!`;\n' +
    '}\n' +
    'console.log(greet("WebTerminal"));\n' +
    'console.log("这是一个纯前端的虚拟终端系统");\n');

  fs.writeFile('/home/user/projects/web-terminal/README.md',
    '# web-terminal 项目说明\n' +
    '\n' +
    '本项目即当前运行的终端本身:\n' +
    '\n' +
    '```\n' +
    'web-terminal/\n' +
    '├── index.html   页面骨架\n' +
    '├── style.css    终端主题样式\n' +
    '└── js/\n' +
    '    ├── fs.js        虚拟文件系统\n' +
    '    ├── terminal.js  终端核心(渲染/输入/补全)\n' +
    '    ├── commands.js  命令实现\n' +
    '    └── main.js      初始化与欢迎页\n' +
    '```\n' +
    '\n' +
    '零依赖,双击 index.html 即可运行。\n');

  fs.writeFile('/etc/hostname', 'webterm\n');
  fs.writeFile('/etc/motd',
    '欢迎来到 WebTerminal!\n' +
    '这是一个纯前端实现的类终端系统,文件系统位于浏览器内存中。\n' +
    '输入 help 查看可用命令。\n');

  fs.writeFile('/etc/shells',
    '# 系统可用的 Shell\n' +
    '/bin/sh\n' +
    '/bin/bash\n' +
    '/bin/wtsh\n' +
    '/usr/bin/zsh\n');

  fs.writeFile('/etc/app.conf',
    '# WebTerminal 示例配置文件(INI 风格)\n' +
    '[terminal]\n' +
    'prompt = "user@webterm"\n' +
    'history_size = 500\n' +
    'beep = false\n' +
    '\n' +
    '[theme]\n' +
    'name = "dark-green"\n' +
    'cursor_blink = true\n' +
    '\n' +
    '[ai]\n' +
    'enabled = true\n' +
    'model = "ornith-1.0-9b"\n');

  fs.writeFile('/home/user/.bashrc',
    '# ~/.bashrc — 环境配置示例(纯展示,不影响实际行为)\n' +
    'export EDITOR=vim\n' +
    'export LANG=zh_CN.UTF-8\n' +
    'alias ll="ls -l"\n' +
    'alias la="ls -a"\n' +
    'alias grep="grep --color"\n' +
    'echo "Welcome back, user!"\n');

  fs.writeFile('/home/user/TODO.txt',
    '待办清单(示例):\n' +
    '  [x] 搭好 WebTerminal 框架\n' +
    '  [x] 实现虚拟文件系统\n' +
    '  [x] 接入外部 AI 模型(ai 命令)\n' +
    '  [ ] 给终端加管道 | 支持\n' +
    '  [ ] 支持多标签页\n' +
    '  [ ] 支持主题切换\n' +
    '\n' +
    '技巧:可以用 grep 在文件里搜索关键字。\n');

  fs.writeFile('/home/user/projects/notes-app/README.md',
    '# notes-app(示例项目)\n' +
    '\n' +
    '一个虚构的记事本应用,用来演示 WebTerminal 的目录结构。\n' +
    '\n' +
    '```\n' +
    'notes-app/\n' +
    '├── index.html\n' +
    '├── app.js\n' +
    '└── README.md\n' +
    '```\n' +
    '\n' +
    '练习:用 `tree /home/user/projects/notes-app` 查看它的目录树。\n');

  fs.writeFile('/home/user/projects/scripts/backup.sh',
    '#!/bin/sh\n' +
    '# 示例备份脚本(纯展示,不会真正执行)\n' +
    'SRC=/home/user/projects\n' +
    'DST=/tmp/backup\n' +
    'mkdir -p "$DST"\n' +
    'cp -r "$SRC" "$DST"\n' +
    'echo "备份完成: $DST"\n');

  fs.writeFile('/usr/share/doc/manual.txt',
    'WebTerminal 命令参考手册(扩展版)\n' +
    '====================================\n' +
    '\n' +
    '【快捷键】\n' +
    '  Tab          自动补全命令名与路径\n' +
    '  ↑ / ↓        浏览命令历史\n' +
    '  Ctrl+L       清屏\n' +
    '  Ctrl+C       取消当前输入\n' +
    '  Ctrl+A / E   光标到行首 / 行尾\n' +
    '  Ctrl+U       清空整行\n' +
    '\n' +
    '【重定向】\n' +
    '  echo hello > a.txt    写入文件(覆盖)\n' +
    '  echo world >> a.txt   追加到文件末尾\n' +
    '  cat a.txt > b.txt     复制文件内容\n' +
    '\n' +
    '【变量】\n' +
    '  echo $?              上次命令退出码\n' +
    '  echo $HOME           用户主目录\n' +
    '  echo $PWD            当前目录\n' +
    '  export NAME=value    自定义环境变量(export 命令)\n' +
    '\n' +
    '【路径】\n' +
    '  绝对路径:/etc/hostname\n' +
    '  相对路径:../projects\n' +
    '  主目录:  ~ 或 ~/projects\n' +
    '\n' +
    '【练习建议】\n' +
    '  cat /welcome.txt                      开始的地方\n' +
    '  grep enabled /etc/app.conf            搜索配置\n' +
    '  tail -n 3 /var/log/access.log         查看日志末尾\n' +
    '  cal 2026                              查看日历\n' +
    '  fortune                               随机名言\n' +
    '  hexdump /etc/hostname                 十六进制查看\n');

  fs.writeFile('/usr/share/doc/changelog.md',
    '# 更新日志\n' +
    '\n' +
    '## v1.1.0(当前)\n' +
    '- 新增 ai 命令,外接 ornith-1.0-9b 模型\n' +
    '- 新增 cal / tac / sort / env / export / df / du / hexdump / fortune 命令\n' +
    '- 丰富预置文件系统内容\n' +
    '- 修复 Backspace 与 Ctrl+A 在输入法下的问题\n' +
    '\n' +
    '## v1.0.0\n' +
    '- 终端核心:渲染、输入、历史、Tab 补全、ANSI 颜色\n' +
    '- 虚拟文件系统与 30+ 命令\n' +
    '- 娱乐命令:neofetch / banner / cowsay / matrix / snake\n');

  fs.writeFile('/var/log/access.log',
    '127.0.0.1 - - [12/Jan/2026:08:12:01 +0800] "GET /index.html HTTP/1.1" 200 986\n' +
    '127.0.0.1 - - [12/Jan/2026:08:12:05 +0800] "GET /style.css HTTP/1.1" 200 4045\n' +
    '127.0.0.1 - - [12/Jan/2026:08:13:22 +0800] "POST /api/chat HTTP/1.1" 200 512\n' +
    '127.0.0.1 - - [12/Jan/2026:08:14:47 +0800] "GET /js/commands.js HTTP/1.1" 200 36890\n' +
    '127.0.0.1 - - [12/Jan/2026:08:15:03 +0800] "GET /favicon.ico HTTP/1.1" 404 0\n' +
    '127.0.0.1 - - [12/Jan/2026:08:16:30 +0800] "POST /api/login HTTP/1.1" 401 88\n' +
    '\n' +
    '提示:试试 grep " 401 " /var/log/access.log 找失败的请求。\n');

  fs.writeFile('/var/log/system.log',
    '[ok] 2025-01-01 00:00:00 初始化虚拟文件系统\n' +
    '[ok] 2025-01-01 00:00:00 挂载 /home/user\n' +
    '[ok] 2025-01-01 00:00:00 启动 wtsh 1.0.0\n' +
    '[info] 随时可以用 cat 查看本日志\n');

  /* ---------- 欢迎横幅 ---------- */

  function bannerText() {
    const d = new Date();
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    const pad = (n) => String(n).padStart(2, '0');
    const now = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weeks[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const W = Math.min(64, Math.max(40, Math.floor((window.innerWidth - 80) / 14)));
    const bar = '─'.repeat(W);
    return (
      '\n' +
      `  \x1b[1;32m╭${bar}╮\x1b[0m\n` +
      `  \x1b[1;32m│\x1b[0m  \x1b[1;36mWebTerminal\x1b[0m \x1b[90mv1.0.0\x1b[0m — 基于 Web 的类终端系统\n` +
      `  \x1b[1;32m│\x1b[0m  输入 \x1b[33mhelp\x1b[0m 查看命令 · \x1b[33mTab\x1b[0m 补全 · \x1b[33m↑/↓\x1b[0m 历史\n` +
      `  \x1b[1;32m│\x1b[0m  虚拟文件系统已就绪,试试 \x1b[33mcat README.md\x1b[0m\n` +
      `  \x1b[1;32m╰${bar}╯\x1b[0m\n` +
      `\x1b[90mLast login: ${now} from 127.0.0.1\x1b[0m\n` +
      '\n'
    );
  }

  /* ---------- 启动 ---------- */

  const term = new Terminal(document.getElementById('term'));
  term.vfs = fs;

  window.__showBanner = function () {
    term.clear();
    term.print(bannerText());
    term.updateToolbar();
  };

  term.attach();
  window.__showBanner();
})();
