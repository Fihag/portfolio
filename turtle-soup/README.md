# 海龟汤在线推理游戏 🐢

基于 Web 技术的多人联机海龟汤(情景推理)游戏。房主出题,玩家轮流提问"是/否/无关"问题还原真相,可提交完整汤底由房主判定,猜对即揭晓。

- **前端**:React 18 + Vite 5 + TypeScript(手写暗色样式,零 UI 依赖)
- **后端**:Node.js + Express + Socket.IO(单端口 3000,同时托管前端产物)
- **内网穿透**:ngrok,启动后分享公网地址即可联机
- **AI 出题**:可选接入 OpenAI 兼容接口(默认 `deepseek-v4-flash`)自动生成谜题

## 快速开始

```powershell
# 1. 安装依赖
npm install

# 2. 一键启动(构建前端 → 启动后端 → ngrok 内网穿透)
.\start.ps1
```

启动后会打印**公网地址**(分享给朋友即可联机)与本地地址。浏览器打开本地或公网地址即可游戏。首次使用 ngrok 需先配置:

```
ngrok config add-authtoken <你的authtoken>
```

### 开发模式

```powershell
npm run dev        # 后端 3000 + 前端热更新 5173(vite 代理 /api 与 /socket.io)
```

## 玩法规则

1. 房主在**大厅**创建房间:从题库选题、自定义输入,或 AI 生成
2. 玩家输入**6 位房间码**加入
3. 房主点"开始游戏",汤面展示给所有人
4. 玩家**轮流提问**(只能问能用是/否/无关回答的问题),房主作答,可附加提示
5. 任意玩家可随时**提交汤底还原**,由房主判定对错
6. 猜对即**揭晓汤底**,房主可"再来一局"(同题/换题)

## 账号系统

- **必须注册账号才能游戏**:打开页面后先注册(用户名 2~20 位中文/字母/数字/下划线 + 密码 4~64 位),登录后创建/加入房间
- 游戏内昵称 = 账号用户名,**无法冒用他人名字**;重复用户名注册会被拒绝
- 密码使用 scrypt + 随机盐**哈希存储**(`server/data/users.json`,不存明文),登录后签发 7 天有效的 token
- Socket.IO 连接强制鉴权:未携带有效 token 的连接会被拒绝
- 管理题库入口(`/soups`)与玩家账号分开,使用管理员密码(见下)

## 本地管理页

- `user-admin/`(玩家/房间/IP/申诉后台管理)与 `local-review/`(谜题上传审核)都是**本地管理页面**,只应在本机打开,不要部署到公网
- 访问方式(均通过 localhost 直连本机后端,不经过 ngrok/公网):
  - **用户管理页**:浏览器直接打开 `user-admin/index.html`,默认连接本机后端 `http://127.0.0.1:3000`
  - **审核页**:运行 `node local-review/server.mjs`,然后浏览器打开 `http://127.0.0.1:3001`
- 两个管理页都直接调用后端管理接口,需要 `ADMIN_PASSWORD`(见「题库管理」),公网玩家无法访问这些接口;请勿把它们当成可对外提供的站点

## 谜题上传与审核(本地)

- **玩家提交**:创建房间 → 自定义谜题 → 填好汤面/汤底后点「申请上传题库」,申请数据直接写入本机 `server/data/submissions.json`(公网后端不额外存库)
- **本地审核**:启动审核前端(仅本机,不经过 ngrok/公网):
  ```
  node local-review/server.mjs
  ```
  然后浏览器打开 **http://127.0.0.1:3001**,输入题库管理密码登录
- 审核通过 → 谜题自动写入本机 `server/data/soups.json`,公网题库**立即生效**;拒绝可填原因,记录保留在已处理列表
- 防滥用:未登录不能提交;同一账号 1 分钟最多提交 3 次;审核接口需管理令牌,公网玩家无法访问

## 题库管理

- 页面右上角"题库管理":列表、新增、编辑、删除,**保存即实时生效**(无需重启)
- **需要管理密码**,密码只从环境变量 `ADMIN_PASSWORD` 读取,**没有默认值**;未设置时管理功能不可用(写操作返回 503)。启动前先配置:

```powershell
# 临时设置(当前窗口)
$env:ADMIN_PASSWORD = "你的密码"
node server/index.js

# 或永久设置(Windows 用户环境变量)
setx ADMIN_PASSWORD "你的密码"
```

- **安全机制**:密码不保存在前端,也不随业务请求传输。管理页登录时密码只发送一次到 `POST /api/auth/login`,后端验证后签发 24 小时有效的随机令牌(`X-Admin-Token`),此后写操作凭令牌;令牌存服务端内存,登出或重启服务即失效。

- 内置 39 道谜题,来自 `题库.txt`(已整理去重)
- 题库文件:`server/data/soups.json`;重新整理原始题库:修改后运行 `npm run parse:soups`

## 房主与汤底

- 房主(出题人)在游戏界面始终可见汤底("🔒 汤底(仅房主可见,作答参考)"),便于作答
- 玩家在揭晓前**看不到汤底**;猜对揭晓后全员可见

## AI 出题

- 大厅创建房间与题库管理页均有"✨ AI 生成"入口,输入题材即生成完整谜题(支持按分类/难度出题)
- **密钥只从环境变量读取,源码不落任何密钥**;未配置时 AI 功能不可用,不影响手动出题
- 通过以下环境变量配置(OpenAI 兼容接口):
  - `LLM_BASE_URL`:OpenAI 兼容端点,**默认 `https://opencode.ai/zen/go`**
  - `LLM_API_KEY`:API 密钥,**必填**,未配置则 AI 功能不可用
  - `LLM_MODEL`:模型名,**默认 `deepseek-v4-flash`**

```powershell
$env:LLM_API_KEY  = "你的key"                       # 必填,否则 AI 不可用
$env:LLM_BASE_URL = "https://opencode.ai/zen/go"   # 可选,默认此值
$env:LLM_MODEL    = "deepseek-v4-flash"             # 可选,默认此值
node server/index.js
```

- 注意:`deepseek-v4-flash` 是推理模型,服务端请求固定带 `reasoning_effort: "low"`(默认思考极长会占满输出导致 JSON 为空);该服务偶发不稳定,代码已做多次重试与解析容错;失败时前端会提示并可改用手动输入,不影响游戏

## 房间生命周期

- 房间对局状态(waiting → playing → revealed → 再来一局)只保存在后端进程**内存**中,不写入磁盘
- 后端一旦重启,**所有房间立即清空**,玩家需重新创建/加入房间;这是**预期行为**,对朋友小规模联机足够
- 玩家账号、题库、提交/申诉/消息等数据均持久化在 `server/data/*.json`,不受重启影响

## 技术说明

- **房间状态机**:waiting → playing → revealed → 再来一局
- **Socket.IO 事件**:create_room / join_room / leave_room / start_game / ask_question / answer_question / submit_guess / judge_guess / next_round,状态经 `room_updated` 全量广播
- **汤底保密**:未揭晓时服务端不下发汤底字段
- **断线重连**:按昵称恢复槽位,房主离线 10 分钟自动解散房间
- 房间码 6 位,不含易混淆字符(I/O/0/1)

## 验证

```powershell
npm test                                # 冒烟:健康检查/注册/登录态/题库/房间
$env:TEST_BASE = "http://127.0.0.1:3000"  # 可选,指定测试后端地址(默认 http://127.0.0.1:3100)
node scripts/simulate-game.mjs          # 双客户端模拟一局完整流程(28 项断言)
node scripts/simulate-game.mjs <ngrok公网地址>   # 经公网隧道端到端验证
```

- 提示:冒烟测试每次运行会注册一个测试用户(`smoke*`),同一 IP 5 分钟内最多注册 20 次,连续多次运行若遇到 429,重启测试后端即可
- 另有回归套件 `tests/token-cache.mjs`(token 缓存)、`tests/robustness.mjs`(账号限流/消息 id),可经 `node tests/run-tests.mjs <baseURL> <adminPassword>` 手动串联运行

## 目录结构

```
turtle-soup/
├── tests/
│   ├── smoke.mjs       # 冒烟:健康/注册/登录态/题库/房间
│   ├── token-cache.mjs # token 缓存回归(命中/失效)
│   ├── robustness.mjs  # 账号限流 + 消息 id 不撞
│   └── run-tests.mjs   # 手动串联 token-cache/robustness 回归套件入口
├── start.ps1             # 一键启动(构建+后端+ngrok)
├── scripts/
│   ├── parse-soups.mjs   # 题库.txt → soups.json 解析整理
│   ├── simulate-game.mjs # 双客户端模拟验证
│   ├── dev.mjs           # 开发模式并行启动
│   └── verify-*.mjs      # 验证脚本
├── server/
│   ├── index.js          # Express + Socket.IO 入口
│   ├── rooms.js          # 房间状态机与事件协议
│   ├── data.js           # 题库 CRUD(实时写回 JSON)
│   ├── ai.js             # AI 谜题生成适配器
│   └── data/soups.json   # 题库数据
└── web/                  # React + Vite 前端
    └── src/pages/        # Lobby / Game / SoupAdmin
```
