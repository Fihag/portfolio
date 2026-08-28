# Poll API · 多 API 账户轮询代理

一个轻量、零依赖的 Node.js 代理：把**多个上游 API 账户**（OpenAI 兼容 / Anthropic / Gemini）聚合成**一个下游入口**。下游只需要一个 API Key，代理会自动按权重轮询切换账户，遇错自动故障切换 + 冷却退避。

类似 one-api / new-api 的核心轮询能力，但更轻，专门给个人自用。

## 特性

- **权重轮询**：每个账户可配权重（1-99），按平滑加权轮询（SWRR）分配流量
- **故障切换**：遇 429 / 5xx / 连接失败自动重试下一个账户，失败账户进入指数冷却
- **多格式兼容**：
  - 下游统一收 **OpenAI 格式**（`/v1/chat/completions` 等）
  - 上游支持 **openai-compatible**（原样转发）/ **anthropic** / **gemini**（自动转换，含流式 SSE 转换）
  - 也支持下游以 **Anthropic 格式**调用（`/v1/messages`）
- **流式转发**：SSE 原样透传 / 跨格式流式转换，均可正常使用
- **余额监控**：定时查询 openai-compatible 账户余额（如 ChatGPT 账户 / dashboard/billing）
- **Web 管理界面**：增删改账户、一键测试连接、查余额、看请求统计与实时日志
- **模型路由**：按账户配置的模型白名单路由；`/v1/models` 自动聚合所有账户模型

## 快速开始

需要 Node.js ≥ 18。

```bash
cd poll
node server.js                # 默认读取 config.json
node server.js --config my.json --port 8080
```

启动后：

- 下游 API 入口：`http://127.0.0.1:7891/v1/chat/completions`
- 管理界面：`http://127.0.0.1:7891/admin`（默认 `admin / admin123`）

## 配置

所有配置在 `config.json`（改端口/策略需重启；账户/设置可在管理界面在线修改并自动保存）：

```jsonc
{
  "port": 3000,
  "host": "0.0.0.0",
  "downstreamKeys": [],        // 下游允许的 API Key 列表; 留空 = 完全开放(不建议)
  "adminUser": "admin",        // 管理界面登录
  "adminPass": "admin123",
  "strategy": "weighted-round-robin",
  "retryOnFail": true,
  "maxRetries": 2,             // 每个请求最多尝试的账户数(含首个)
  "cooldownSeconds": 30,       // 失败冷却基数(指数退避)
  "cooldownMaxSeconds": 300,   // 冷却上限
  "balanceInterval": 3600,     // 余额自动检查间隔(秒), 0 = 关闭
  "accounts": [
    {
      "id": "deepseek-a",
      "name": "deepseek-a",
      "type": "openai-compatible",   // openai-compatible | anthropic | gemini
      "baseURL": "https://api.deepseek.com",
      "apiKey": "sk-xxx",
      "weight": 3,
      "models": [],                   // 模型白名单, 空 = 支持全部
      "enabled": true,
      "note": ""
    }
  ]
}
```

## 下游用法

OpenAI 格式（ChatGPT / 各类客户端 / Open WebUI / LobeChat 等，把 base_url 指到代理即可）：

```bash
curl http://127.0.0.1:7891/v1/chat/completions \
  -H "Authorization: Bearer sk-你的下游Key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"你好"}]}'
```

Anthropic 格式（把 base_url 指到代理，`x-api-key` 填下游 Key）：

```bash
curl http://127.0.0.1:7891/v1/messages \
  -H "x-api-key: sk-你的下游Key" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}'
```

## 支持的账户类型与转换

| 上游类型 | 说明 | 转换 |
|---|---|---|
| `openai-compatible` | DeepSeek / Moonshot / one-api / new-api / 任意 OpenAI 兼容网关 | 原样透传（流式/工具全部可用） |
| `anthropic` | 官方 Claude API | 下游 OpenAI 格式 → Anthropic 格式（含流式 SSE 转换） |
| `gemini` | 官方 Gemini API | 下游 OpenAI 格式 → Gemini generateContent（含流式 SSE 转换） |

> 说明：格式转换主要支持文本/多模态/基础工具调用；复杂工具调用（tool 循环）建议优先使用 openai-compatible 类型的上游网关，以获得最完整兼容。

## 目录结构

```
poll/
├── server.js            # 主程序(HTTP 代理 + 管理 API + 静态 UI)
├── config.json          # 配置文件
├── lib/
│   ├── config.js        # 配置加载/账户规范化
│   ├── state.js         # 运行时状态
│   ├── router.js        # 权重轮询 + 故障切换 + 冷却
│   ├── providers.js     # 上游请求构造/转发
│   ├── convert.js       # OpenAI/Anthropic/Gemini 格式互转(含流式)
│   └── balance.js       # 余额查询
├── ui/                  # Web 管理界面(原生 HTML/JS/CSS)
└── test/                # 端到端测试(mock 上游)
```

## 测试

自带端到端测试（mock 5 种上游，验证鉴权/轮询/故障切换/流式/多格式转换/管理 API）：

```bash
node test/run-test.js
```

## 说明

- 账户在管理界面增删改后会自动写回 `config.json`
- 统计与日志保存在内存，重启后归零
- 本工具供个人自用/学习，请遵守上游平台的条款
