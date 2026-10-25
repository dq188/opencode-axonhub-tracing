# opencode-axonhub-tracing

为 [AxonHub](https://github.com/looplj/axonhub)（统一 AI 网关）提供请求链路追踪的 [OpenCode v2](https://github.com/anomalyco/opencode) 插件。

插件会为每一次 LLM 请求注入两个 HTTP 头，AxonHub 据此做请求聚合与全链路追踪：

| Header | 来源 | 用途 |
|---|---|---|
| `AH-Thread-Id` | OpenCode 会话 ID（`sessionID`） | 把同一会话的所有请求聚合到一个线程 |
| `AH-Trace-Id` | 当前消息 ID（`messageID`） | 把一次提问（含子请求，如标题生成）聚合为一个追踪 |

只写线程头而不写追踪头的场景不存在：仅在拿到消息 ID 时才写 `AH-Trace-Id`，与 v1 行为一致。

## 工作原理

OpenCode v2 移除了 v1 的 `chat.headers` 钩子，本插件改用 v2 的两个钩子实现：

1. `session.prompt`（消息准入）——记录每个会话最新准入的消息 ID；
2. `model.request`（模型请求，按 `providerID: "axonhub"` 过滤）——把记录的头写入该会话的模型请求。

已验证与 OpenCode v2.0.32 / v2.1.4 兼容（v2 二进制内置插件 API，无需额外依赖）。

## 安装

### 方式一：npm 包（推荐）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-axonhub-tracing"]
}
```

### 方式二：本地目录

```bash
git clone https://github.com/dq188/opencode-axonhub-tracing ~/.config/opencode/plugin-axonhub-tracing
```

```json
{
  "plugins": ["C:\\Users\\dqs\\.config\\opencode\\plugin-axonhub-tracing"]
}
```

## 配置

AxonHub 侧默认即支持这两个头，无需服务端配置（详见 [AxonHub Tracing 文档](https://github.com/looplj/axonhub/blob/unstable/docs/en/guides/tracing.md)）。

如需自定义头名，可用环境变量覆盖：

```bash
export OPENCODE_AXONHUB_TRACING_THREAD_HEADER=AH-Thread-Id
export OPENCODE_AXONHUB_TRACING_TRACE_HEADER=AH-Trace-Id
```

## 验证

1. 在 OpenCode 里发起一次对话（模型走 AxonHub provider）；
2. 登录 AxonHub 控制台，进入项目下的 **追踪（Traces）** 页：
   - 追踪 ID 应为 OpenCode 的消息 ID（`msg_...`）；
   - 同一次提问的多个请求（主请求 + 标题生成等）聚合在同一追踪下；
3. **线程（Threads）** 页：线程 ID 应为 OpenCode 会话 ID（`ses_...`）。

## License

MIT
