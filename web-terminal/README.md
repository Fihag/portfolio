# WebTerminal — 基于 Web 的类终端系统

纯前端、零依赖的命令行风格终端模拟器。虚拟文件系统运行在浏览器内存中,带命令历史、Tab 补全、ANSI 彩色输出、重定向,以及若干趣味命令与小游戏。

## 运行

直接双击 `index.html` 即可(普通 `<script>` 标签按序加载,file:// 协议下也能运行);或启动本地服务器:

```powershell
python -m http.server 8123 --directory web-terminal
# 浏览器打开 http://127.0.0.1:8123
```

## 目录结构

```
web-terminal/
├── index.html      页面骨架 + 顶部工具条
├── style.css       终端主题、光标、ANSI 颜色、matrix 层
├── js/
│   ├── fs.js          虚拟文件系统(路径归一化、增删改查、递归复制)
│   ├── commands.js    命令实现(约 30 个)与重定向/参数解析
│   ├── ai-config.js   ai 命令的外部模型配置(base / key / model)
│   ├── terminal.js    终端核心(渲染、输入、历史、Tab 补全、ANSI 解析)
│   └── main.js        初始化、预置文件、欢迎横幅
└── tests/
    ├── smoke.js        命令层冒烟测试(44 项断言)
    ├── terminal-test.js 终端层测试:DOM stub 下渲染/补全/取消/ai(mock)(45 项断言)
    └── ai-e2e.js       真实调用外部模型的端到端验证
```

## 命令

| 分类 | 命令 |
| --- | --- |
| 导航 | `pwd` `cd [- 返回上次]` `ls [-a -l -h]` `tree [-L n] [-a]` `find [-name -type f\|d -size +Nk/-Nk]` |
| 文件 | `cat [-n]` `tac` `touch` `mkdir [-p]` `rm [-r -f]` `mv` `cp [-r]` `head/tail [-n N]` `wc [-l -w -c]` `grep [-v -c -n -r]` `sort [-r -u -n]` `echo [-n]` |
| 查看 | `hexdump [-C]` `du [-h -a]` `df [-h]` |
| 系统 | `clear` `cal [月 年]` `date [+格式]` `whoami` `hostname` `uname [-a -s -r -m]` `uptime` `env` `export NAME=value` `history [-c]` `help [命令]` `man [-k 关键词]` `which` `ps` `exit` `reboot` `poweroff` |
| 娱乐 | `neofetch` `banner` `cowsay` `fortune` `matrix` `snake` `sudo` |
| AI | `ai` |

## 外接 AI 模型(ai 命令)

`ai` 命令通过 OpenAI 兼容接口连接外部模型(默认 `ornith-1.0-9b`),流式输出回复,并在内存中保持会话上下文:

```
ai <问题...>    # 提问
ai -r          # 重置上下文
ai -v          # 查看服务器可用模型
```

接口地址、API Key、模型名都在 `js/ai-config.js` 中,换成任意 OpenAI 兼容服务即可。要求服务端允许 CORS(该内网服务已放行)。

AI 的 system prompt 内置了本终端的完整命令说明、能力边界(不存在的功能会直接说明不支持)与纯文本输出规则;流式输出时会自动清理 Markdown 代码围栏与加粗符号。

## 特性

- **虚拟文件系统**:内存树形结构,支持绝对/相对路径、`~`、`.`、`..`;`echo > file` 写文件、`>>` 追加
- **Tab 补全**:命令名与路径;目录补全自动加尾斜杠;多候选打印列表
- **命令历史**:↑/↓ 浏览,`history` 查看,`history -c` 清空
- **ANSI 颜色**:`\x1b[32m` 等转义序列渲染为彩色
- **快捷键**:`Ctrl+L` 清屏、`Ctrl+C` 取消、`Ctrl+A/E` 行首尾、`Ctrl+U` 清行
- **变量展开**:`echo $? $USER $HOME $PWD $HOSTNAME`,支持 `export NAME=value` 自定义环境变量(`env` 查看)
- **移动端**:隐藏 textarea 捕获输入,软键盘可用,中文输入法正常
- **预置内容**:内置 `/welcome.txt`、`/home/user/README.md` 手册、`/usr/share/doc/manual.txt` 参考手册、示例配置(`/etc/app.conf`)、模拟日志(`/var/log/access.log`,可 grep 练习)等 20+ 文件

## 测试

```powershell
node tests/smoke.js           # 命令层
node tests/terminal-test.js   # 终端层(DOM stub)
```

## 说明

- 文件系统只存在于内存,刷新页面即还原为初始状态
- `sudo` 是彩蛋命令(会"失败"),不会真的提权
- 项目结构刻意保持简单,方便按需扩展新命令(在 `commands.js` 里 `register(name, fn, help)` 即可)
