# claude-stackchan-bridge

讓 Claude Code 在工作時透過 StackChan 做出對應動作反應。

## 架構

```
Claude Code Hooks → action.js → HTTP → server.js → WebSocket (RSA auth) → StackChan 後端 → 裝置
```

## 動作對應

| Claude Code 事件 | StackChan 動作 |
|---|---|
| 執行工具 (PreToolUse) | 左右轉頭 |
| 工具失敗 (PostToolUse) | 搖頭 |
| 任務完成 (Stop/Notification) | 點頭 |

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
