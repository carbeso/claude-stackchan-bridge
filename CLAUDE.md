# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

StackChan Bridge 是一個讓 AI Harnesses (如 Claude Code, Hermes Agent) 透過 StackChan 機器人做出動作反應的橋接伺服器。

**架構流程:**
```
Harness Hooks → harnesses/<name>/action.js → HTTP → server.js (Bridge) → Provider → WebSocket → StackChan
```

## 開發指令

### 啟動與測試
```bash
# 開發模式（nodemon 自動重載）
npm start

# 一般模式
npm run start:plain

# 執行特定動作（測試用）
npm run action <動作名稱>
# 或
node harnesses/claude/action.js <動作名稱>
```

### 配置驗證
動作定義在 `actions.js` 修改後，執行驗證：
```bash
node -e "const {validateActions} = require('./lib/validate-actions'); const actions = require('./actions.json'); validateActions(actions);"
```

Server 啟動時會自動驗證配置。

## 核心架構

### 1. Server (server.js)
- **HTTP Server** 監聽 `127.0.0.1:7331`，接收來自 Harness 的動作請求
- **ActionController** 執行動作序列並管理取消機制，避免快速切換狀態時動作混亂
- **Provider 層** 抽象通訊協定，目前使用 `OriginStackChanProvider`（WebSocket + RSA 認證）

**HTTP 端點:**
- `POST /action` - 觸發動作：`{"action": "動作名稱"}`
- `POST /motion` - 直接控制伺服機：`{"yaw": 0, "pitch": 250, "speed": 500}`
- `POST /avatar` - 直接控制表情：`{"leftEye": {...}, "rightEye": {...}, "mouth": {...}}`
- `GET /status` - 獲取連線與設備狀態

### 2. 動作系統 (actions.js)
所有動作以 **JavaScript 函數**定義，支援：
- 簡單的線性步驟序列（await + wait）
- 複雜的循環與動畫（while loop + AbortSignal）
- 條件判斷與狀態管理

**函數簽名:**
```javascript
async function action_name(provider, abortSignal) {
  // provider.sendMotion(yaw, pitch, speed)
  // provider.sendAvatar(leftEye, rightEye, mouth)
  // provider.sendRgb(leftColor, rightColor, durationMs)
  // await wait(ms, abortSignal)
}
```

**AbortSignal 機制:**
當新動作被觸發時，舊動作會被自動中止。所有動作函數必須：
- 接收並檢查 `abortSignal?.aborted`
- 在 `wait()` 中傳入 `abortSignal`
- 在無限循環動作中定期檢查 `abortSignal`

### 3. Provider 層 (providers/origin-stackchan.js)
負責與 StackChan 後端的 WebSocket 連線：
- **認證機制**: RSA-OAEP SHA-256 加密 `MAC|random|timestamp`
- **二進位協議**:
  - `0x04` Motion - 控制伺服機（yaw/pitch/speed）
  - `0x03` Avatar - 控制表情（leftEye/rightEye/mouth）
  - `0x14` Dance - 控制 RGB 燈光（leftRgbColor/rightRgbColor/durationMs）
  - `0x10` Ping - 心跳維持連線（30秒間隔）
  - `0x17` Device Online - 設備上線訊號
  - `0x16` Device Offline - 設備下線訊號
- **自動重連**: 斷線後 5 秒自動重試
- **狀態追蹤**: `connected`（WebSocket 連線）, `deviceOnline`（機器人設備）

### 4. Harness 整合
- **Claude Code**: 透過 `~/.claude/settings.json` 配置 hooks
- **Hermes Agent**: 將 `harnesses/hermes/` 複製到 `~/.hermes/hooks/stackchan-bridge/`

通用 CLI：`harnesses/claude/action.js <動作名稱>` 發送 HTTP POST 至 Bridge Server

### 5. 日誌系統 (lib/logger.js)
- 按日期自動 rotation (`logs/stackchan-YYYY-MM-DD.log`)
- 同時輸出至 console 和檔案
- 帶時間戳格式：`[YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] [TAG] message`

## 參數規格

### Motion（伺服機）
- `yaw`: 水平角度 (-1280~1280，對應 -128° ~ 128°)
- `pitch`: 垂直角度 (0~900，對應 0° ~ 90°)
- `speed`: 運動速度 (0~1000)
- `REST = 250` (25° resting position)

### Avatar（表情）
每個部位（leftEye, rightEye, mouth）有以下參數：
- `x`, `y`: 位置偏移 (-100~100)
- `rotation`: 旋轉角度 (-1800~1800，以 1/10 度為單位，例如 180 = 18°)
- `weight`: 強度 (0~100，眼睛: 100=全開/0=全閉，嘴巴: 0=閉嘴/100=張大)
- `size`: 大小調整 (-100~100，眼睛: 正值放大/負值縮小)

### RGB（燈光）
透過 Dance 系統 (0x14) 控制 RGB 燈光：
- `leftRgbColor`: 左眼顏色（HEX 格式，如 `"#FF0000"` 紅色）
- `rightRgbColor`: 右眼顏色（HEX 格式）
- `durationMs`: 持續時間（毫秒，0 = 持續顯示）

**注意**: 使用 `provider.sendRgb()` 時會將表情重置為 NORMAL_FACE，動作重置為 REST position。

參考：
- Motion 詳細參數：[issue #1](https://github.com/carbeso/claude-stackchan-bridge/issues/1)
- Avatar 參數與範例：`EXPRESSIONS.md`
- RGB 燈光控制：[issue #10](https://github.com/carbeso/claude-stackchan-bridge/issues/10)

## 新增動作

1. 在 `actions.js` 中新增 async 函數
2. 使用 `provider.sendMotion()`, `provider.sendAvatar()`, 或 `provider.sendRgb()`
3. 使用 `await wait(ms, abortSignal)` 控制延遲
4. 無限循環動作必須檢查 `abortSignal?.aborted`
5. 在 `module.exports` 中導出函數

**範例（簡單動作）:**
```javascript
async function my_action(provider, abortSignal) {
  console.log('[action] my_action: 描述');
  await provider.sendMotion(-500, 300, 600);
  await wait(500, abortSignal);
  await provider.sendMotion(0, 450, 400);
}
```

**範例（循環動畫）:**
```javascript
async function my_loop(provider, abortSignal) {
  console.log('[action] my_loop: 循環動畫');
  try {
    while (!abortSignal?.aborted) {
      await provider.sendAvatar(EXPRESSIONS.blink.leftEye, ...);
      await wait(1000, abortSignal);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] my_loop 已中止');
    } else {
      throw err;
    }
  }
}
```

**範例（RGB 燈光）:**
```javascript
async function my_rgb_action(provider, abortSignal) {
  console.log('[action] my_rgb_action: RGB 燈光效果');
  
  // 紅色燈光 1 秒
  await provider.sendRgb('#FF0000', '#FF0000');
  await wait(1000, abortSignal);
  
  // 綠色燈光 1 秒
  await provider.sendRgb('#00FF00', '#00FF00');
  await wait(1000, abortSignal);
  
  // 關閉燈光
  await provider.sendRgb('#000000', '#000000');
}
```

## 配置管理

### config.json (必須設定)
```json
{
  "backendServer": "SERVER_IP:12800",
  "token": "LOGIN_TOKEN",
  "deviceMac": "DEVICE_MAC",
  "deviceId": "DEVICE_UUID",
  "serverPublicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

**取得連線資訊:**
1. 登入取得 token: `curl -X POST "http://SERVER:12800/stackChan/v2/user/login" -H "Content-Type: application/json" -d '{"username":"USER","password":"PASS"}'`
2. 取得裝置列表: `curl "http://SERVER:12800/stackChan/v2/devices" -H "token: TOKEN"`
3. RSA 公鑰需從 StackChan App (APK) 中提取

## 注意事項

### 動作設計原則
- **保持簡短**: 動作應在 2-3 秒內完成，避免阻塞後續狀態
- **可中斷性**: 所有長時間動作必須支援 AbortSignal
- **避免重疊**: ActionController 會自動取消舊動作，但設計時應考慮快速切換的影響
- **參數範圍**: 超出範圍的參數會導致機器人異常，啟動時使用 validate-actions 驗證

### 錯誤處理
- Provider 未連線時，sendMotion/sendAvatar 會返回 false 並記錄警告
- Bridge Server 未啟動時，harness action.js 會捕獲錯誤避免 Harness 當機
- AbortError 是正常中止信號，不應視為異常

### 表情系統
- `EXPRESSIONS` 預定義常用表情（happy, sad, angry, thinking, surprised, blink）
- `NORMAL_FACE` 為預設表情（眼睛全開、嘴巴閉合）
- 動作結束後通常需要恢復 `NORMAL_FACE` 避免表情殘留

## 除錯技巧

1. **檢查連線狀態**: `curl http://127.0.0.1:7331/status`
2. **手動測試動作**: `node harnesses/claude/action.js done`
3. **直接控制伺服機**: `curl -X POST http://127.0.0.1:7331/motion -d '{"yaw":0,"pitch":450,"speed":500}' -H "Content-Type: application/json"`
4. **查看即時日誌**: `tail -f logs/stackchan-$(date +%Y-%m-%d).log`
5. **測試表情變化**: `curl -X POST http://127.0.0.1:7331/avatar -d '{"leftEye":{...},"rightEye":{...},"mouth":{...}}' -H "Content-Type: application/json"`
