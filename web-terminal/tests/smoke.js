/* 冒烟测试:在 Node 中模拟终端上下文,验证 fs + commands 逻辑(不依赖 DOM)。
 * 运行: node tests/smoke.js
 */
'use strict';

const { VFS } = require('../js/fs.js');
const { COMMANDS, parseRedirect, parseCommandLine } = require('../js/commands.js');

let failures = 0;
let passed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✔ ' + msg); }
  else { failures++; console.error('  ✘ FAIL: ' + msg); }
}

const fs = new VFS();
// 预置(与 main.js 相同的初始化路径,逐级创建)
for (const d of ['/etc', '/tmp', '/home', '/home/user', '/home/user/projects', '/usr', '/usr/bin', '/var', '/var/log']) fs.mkdir(d);
fs.writeFile('/home/user/notes.txt', 'line1\nline2\nline3\n');
fs.writeFile('/home/user/names.txt', 'banana\napple\ncherry\n');
fs.writeFile('/home/user/dup.txt', 'b\na\nb\nc\n');
fs.writeFile('/home/user/nums.txt', '10\n2\n1\n');
fs.writeFile('/home/user/tiny.txt', 'tiny\n');
fs.writeFile('/etc/hostname', 'webterm\n');
fs.writeFile('/etc/app.conf', '[ai]\nenabled = true\nmodel = ornith\n');
fs.writeFile('/home/user/.bashrc', '# rc\nexport EDITOR=vim\n');
fs.writeFile('/var/log/access.log', 'GET /x HTTP/1.1" 200 12\nGET /y HTTP/1.1" 404 0\nGET /z HTTP/1.1" 200 34\n');

const term = {
  bootTime: Date.now(),
  lastExit: 0,
  history: [],
  env: {},
  clear() {},
};
const cwdState = { cwd: '/' };

function run(line) {
  let out = '';
  const errs = [];
  fs.cwd = cwdState.cwd; // 与真实终端 runCommand 的同步一致
  const ctx = {
    fs, term,
    cwd: cwdState.cwd,
    args: [],
    out: (s) => { out += s + '\n'; },
    outRaw: (s) => { out += s; },
    error: (s) => errs.push(s),
    setCwd: (p) => { cwdState.cwd = p; fs.cwd = p; },
    isRedirected: () => false,
  };
  const { command, stdoutFile, append } = parseRedirect(line);
  const { name, args } = parseCommandLine(command);
  ctx.args = args;
  const cmd = COMMANDS[name];
  let code;
  if (!cmd) { errs.push(`bash: ${name}: command not found`); code = 127; }
  else {
    code = cmd.fn(ctx) || 0;
    if (stdoutFile) {
      const old = fs.get(stdoutFile);
      const base = append && old && old.isFile ? old.content : '';
      fs.writeFile(stdoutFile, base + out);
    }
  }
  term.lastExit = code;
  // 去掉结尾换行造成的多余空行
  const lines = out.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return { text: out, lines, errs, code };
}

console.log('== 导航 ==');
assert(run('pwd').lines[0] === '/', 'pwd 输出根目录');
assert(run('cd /etc') && cwdState.cwd === '/etc', 'cd /etc 成功');
assert(run('cd ..') && cwdState.cwd === '/', 'cd .. 返回根');
assert(run('cd ~') && cwdState.cwd === '/home/user', 'cd ~ 到用户主目录');
assert(run('cd /home/user/../user/projects') && cwdState.cwd === '/home/user/projects', 'cd 复杂路径归一化');
assert(run('cd /no/such/dir').code === 1, 'cd 不存在目录报错');
run('cd /etc');
run('cd -');
assert(cwdState.cwd === '/home/user/projects', 'cd - 返回上次目录');
run('cd /home/user');
assert(run('ls /etc').lines[0].includes('hostname'), 'ls 列出 etc 内容');
assert(run('ls -a /home/user').lines[0].includes('notes.txt'), 'ls -a 包含普通文件');

console.log('== 文件操作 ==');
run('echo hello world > /tmp/a.txt');
assert(fs.get('/tmp/a.txt').content.trim() === 'hello world', 'echo 重定向写文件');
run('echo second >> /tmp/a.txt');
assert(fs.get('/tmp/a.txt').content.includes('second'), '>> 追加写文件');
assert(run('cat /tmp/a.txt').text.includes('hello world'), 'cat 读取文件');
assert(run('cat /tmp/a.txt').text.includes('second'), 'cat 读到追加内容');
run('mkdir /tmp/sub');
run('mkdir -p /tmp/deep/x/y');
assert(fs.isDir('/tmp/deep/x/y'), 'mkdir -p 递归创建');
run('mv /tmp/a.txt /tmp/sub/a2.txt');
assert(fs.get('/tmp/sub/a2.txt') && !fs.get('/tmp/a.txt'), 'mv 移动文件');
run('cp -r /tmp/sub /tmp/copy');
assert(fs.get('/tmp/copy/a2.txt'), 'cp -r 递归复制');
run('rm /tmp/copy/a2.txt');
assert(!fs.exists('/tmp/copy/a2.txt'), 'rm 删除文件');
run('rm /tmp/copy');
assert(fs.exists('/tmp/copy'), 'rm 非递归删除目录被拒绝');
run('rm -r /tmp/copy');
assert(!fs.exists('/tmp/copy'), 'rm -r 删除目录');
run('touch /tmp/new.txt');
assert(fs.exists('/tmp/new.txt'), 'touch 创建空文件');

console.log('== 查看类 ==');
assert(run('head -n 2 /home/user/notes.txt').text === 'line1\nline2\n', 'head -n 2');
assert(run('tail -n 1 /home/user/notes.txt').text === 'line3\n', 'tail -n 1');
assert(run('tail -f /home/user/notes.txt').text === 'line1\nline2\nline3\n', 'tail -f 忽略且仍输出');
assert(run('tac /home/user/notes.txt').text === 'line3\nline2\nline1\n', 'tac 反向输出行');
assert(run('sort /home/user/names.txt').text === 'apple\nbanana\ncherry\n', 'sort 排序行');
assert(run('sort -r /home/user/names.txt').text === 'cherry\nbanana\napple\n', 'sort -r 降序');
assert(run('sort -u /home/user/dup.txt').text === 'a\nb\nc\n', 'sort -u 去重');
assert(run('sort -n /home/user/nums.txt').text === '1\n2\n10\n', 'sort -n 数值排序');
assert(run('hexdump /etc/hostname').lines[0].includes('77 65 62 74'), 'hexdump 十六进制(webterm)');
assert(run('hexdump -C /etc/hostname').lines[0].includes('77 65 62 74'), 'hexdump -C 兼容');
assert(run('grep line2 /home/user/notes.txt').text.includes('line2'), 'grep 匹配行');
assert(run('grep -n line /home/user/notes.txt').text.includes('2:line2'), 'grep -n 行号');
assert(run('grep -r "GET" /var/log').text.includes('access.log'), 'grep -r 递归目录');
assert(run('grep -c line /home/user/notes.txt').text.includes(':3'), 'grep -c 计数');
assert(run('grep -c " 200 " /var/log/access.log').text.includes(':2'), 'grep -c 引号模式计数');
assert(run('wc -l /home/user/notes.txt').lines[0].startsWith('3'), 'wc -l 行数=3');
assert(run('cat -n /home/user/notes.txt').text.includes('1\tline1'), 'cat -n 带行号');
const found = run('find /tmp -name "*.txt"');
assert(found.lines.length === 2 && found.text.includes('a2.txt') && found.text.includes('new.txt'), 'find 找到 2 个 txt');
assert(run('find /home/user -type d').text.includes('projects'), 'find -type d 目录');
assert(run('find /home/user -type f -size +20c').text.includes('names.txt'), 'find -size 过滤');
assert(run('tree /tmp').lines.length > 2, 'tree 输出多行');
assert(run('tree -a /home/user').text.includes('.bashrc'), 'tree -a 隐藏文件');
assert(run('cal 2 2026').text.includes('2 月 2026'), 'cal 显示指定月份');
assert(run('cal').lines.length >= 7, 'cal 默认当月多行');
assert(run('du /home/user').lines[0].match(/^\d+ B/), 'du 统计字节数');
assert(run('du -h /home/user').lines[0].match(/^[\d.]+[KMB]/), 'du -h 人类可读');
assert(run('df').text.includes('vfs:/'), 'df 显示虚拟磁盘');
assert(run('df -h').text.includes('vfs:/'), 'df -h 兼容');
assert(run('ls -a /home/user').text.includes('.bashrc'), 'ls -a 显示隐藏文件');
assert(run('ls -lh /home/user').text.includes('notes.txt'), 'ls -lh 长格式');
assert(run('date +%F').lines[0].match(/^\d{4}-\d{2}-\d{2}$/), 'date +%F 格式化');
assert(run('date -s 2024-01-01').code === 1, 'date -s 被拒绝');

console.log('== 系统/娱乐 ==');
assert(run('echo exit_code_is_$?').text.match(/exit_code_is_\d+/), 'echo $? 展开');
assert(run('whoami').lines[0] === 'user', 'whoami');
assert(run('uname -a').lines[0].includes('WebTerminal'), 'uname -a');
assert(run('uname -r').lines[0] === '1.0.0', 'uname -r 内核版本');
assert(run('hostname').lines[0] === 'webterm', 'hostname');
assert(run('date').lines[0].includes('年'), 'date 中文日期');
assert(run('uptime').lines[0].includes('load average'), 'uptime');
assert(run('history').lines.length === term.history.length, 'history 列出历史');
assert(run('help ls').text.includes('ls'), 'help ls 显示单个命令');
assert(run('man -k grep').text.includes('grep'), 'man -k 搜索关键词');
assert(run('banner HI').text.includes('#'), 'banner 大字输出');
assert(run('cowsay hi').text.includes('(oo)'), 'cowsay 输出奶牛');
assert(run('neofetch').lines.length >= 10, 'neofetch 多行输出');
assert(run('help').text.includes('WebTerminal'), 'help 帮助输出');
assert(run('man ls').text.includes('ls'), 'man 手册');
assert(run('ls -la /home/user').text.includes('notes.txt'), 'ls -la 详细列表');
assert(run('sudo whoami').code === 1, 'sudo 返回 1');
assert(run('nonexistent_cmd').code === 127, '未知命令 127');
assert(run('fortune').lines.length === 1 && run('fortune').text.length > 0, 'fortune 输出名言');
assert(run('env').text.includes('USER=user'), 'env 显示环境变量');
run('export NAME=webterm');
assert(run('echo $NAME').text.includes('webterm'), 'export 自定义变量被 echo 展开');
assert(run('export').text.includes('NAME=webterm'), 'export 无参数列出全部');

console.log('== 路径安全 ==');
assert(run('cd /home/user') && run('cat ../notes.txt').code === 1, 'cat 不存在的文件报错');
run('cd /');
assert(run('rm -rf /').errs.length > 0 && fs.exists('/'), 'rm -rf / 被安全拒绝');
run('cd /home/user');
run('echo keep > f.txt');
run('mv f.txt subdir'); // 目标不存在 => 当作重命名到 subdir
assert(fs.get('/home/user/subdir') && fs.get('/home/user/subdir').content.trim() === 'keep', 'mv 重命名文件');

console.log('');
console.log(`结果: ${passed} 通过, ${failures} 失败`);
if (failures === 0) console.log('✔ 全部通过');
else { console.error('✘ 有失败项'); process.exit(1); }
