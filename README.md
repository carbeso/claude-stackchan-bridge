# claude-stackchan-bridge

讓 Claude Code, Hermes Agent 等各種 AI Harnesses 透過 StackChan 做出對應動作反應。

## 架構

```
Harness Hooks (Claude/Hermes/...) → action.js (or HTTP) → server.js (Bridge) → Provider → StackChan
```

- **Harnesses**: 支援 Claude Code, Hermes Agent 等。
- **Bridge**: 負責接收指令並根據 `actions.json` 執行動作排程。
- **Provider**: 抽象化的通訊層，目前支援 WebSocket (RSA auth) 連接到 StackChan 後端。

## 動作與狀態 (Actions)

動作定義在 `actions.json` 中，可以自行擴充。預設包含：

| 狀態 | 描述 | StackChan 動作範例 |
|---|---|---|
| `startup` | Agent 啟動 | 恢復預設姿勢 |
| `thinking` | 思考中 | 小幅度動作 |
| `tool` | 執行工具中 | 左右轉頭 |
| `working` | 持續工作中 | 維持特定姿勢 |
| `error` | 發生錯誤 | 搖頭 |
| `done` | 任務完成 | 點頭 |
| `shutdown` | Agent 結束 | 低頭/關機姿勢 |

## 安裝

```bash
npm install
cp config.example.json config.json
# 編輯 config.json 填入你的連線資訊
```

## 取得連線資訊

1. 登入取得 token：
```bash
curl -X POST "http://YOUR_SERVER:12800/stackChan/v2/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'
```

2. 取得裝置列表：
```bash
curl "http://YOUR_SERVER:12800/stackChan/v2/devices" -H "token: YOUR_TOKEN"
```

3. RSA 公鑰需從 StackChan App (APK) 中提取。

## 使用

啟動 bridge server（保持背景執行）：

```bash
node server.js
```

## 擴充

### 新增動作
編輯 `actions.json`，可以定義多個步驟與延遲（delay）：

```json
"my_action": [
  { "type": "motion", "yaw": 100, "pitch": 400, "speed": 500, "delay": 0 },
  { "type": "motion", "yaw": 0, "pitch": 450, "speed": 300, "delay": 500 }
]
```

### 支援新 Harness

#### Hermes Agent
將 `harnesses/hermes/` 目錄複製到 `~/.hermes/hooks/stackchan-bridge/`。

或用 PM2 常駐：

```bash
npx pm2 start server.js --name stackchan
```

## Claude Code 設定

在 `~/.claude/settings.json` 加入 hooks：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node ~/.claude/plugins/stackchan/action.js tool" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "if [ \"$TOOL_EXIT_CODE\" != \"0\" ]; then node ~/.claude/plugins/stackchan/action.js error; fi" }]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "node ~/.claude/plugins/stackchan/action.js done" }]
      }
    ]
  }
}
```

## 協定

透過 StackChan 後端的 WebSocket 二進位協定控制裝置：

- `0x04` controlMotion — `{"type":"bleMotion","pitchServo":{"angle":N,"speed":N},"yawServo":{"angle":N,"speed":N}}`
- `0x03` controlAvatar — `{"type":"bleAvatar","leftEye":{...},"rightEye":{...},"mouth":{...}}`

WebSocket 認證使用 RSA-OAEP SHA-256 加密 `MAC|random|timestamp` 格式。
