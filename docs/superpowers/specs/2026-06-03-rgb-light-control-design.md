# RGB 燈光控制功能設計文檔

**日期**: 2026-06-03  
**版本**: 1.0  
**狀態**: 設計完成，待實作  
**相關 Issue**: [#10 ✨ RGB 燈光基本控制](https://github.com/carbeso/claude-stackchan-bridge/issues/10)

---

## 目標

為 StackChan Bridge 新增 RGB 燈光控制功能，支援左右眼獨立設定顏色，透過 Dance 系統 (0x14) 實現。

## 背景

### 原廠協議分析

透過研究原廠 StackChan 代碼（App 端和 Server 端），發現以下關鍵事實：

#### 1. 訊息類型設計

原廠使用**三種獨立的控制訊息**：

- **ControlMotion (0x04)** - 控制伺服機動作（yaw/pitch）
- **ControlAvatar (0x03)** - 控制表情（leftEye/rightEye/mouth）
- **Dance (0x14)** - 複合控制（表情 + 動作 + RGB + 時序）

#### 2. App 端實作策略

在 `app/lib/view/home/avatar.dart:342-365` 的 `sendDanceData()` 方法中：

```dart
void sendDanceData(DanceData data) {
  // 分別發送兩個獨立指令
  final expressionData = ExpressionData(
    leftEye: data.leftEye,
    rightEye: data.rightEye,
    mouth: data.mouth,
  );
  AppState.shared.sendWebSocketMessage(
    .controlAvatar,  // 0x03
    data: expressionMessageData,
  );

  final motionData = MotionData(
    pitchServo: data.pitchServo,
    yawServo: data.yawServo,
  );
  AppState.shared.sendWebSocketMessage(
    .controlMotion,  // 0x04
    data: motionMessageData,
  );
}
```

**關鍵發現：**
- Motion 和 Avatar **本來就是獨立的訊息類型**
- App 端**不追蹤狀態**，直接發送新值
- 即時控制場景使用專用訊息，不使用 Dance

#### 3. Dance 系統實作

在 `app/lib/view/home/dance.dart:131-139` 的播放邏輯中：

```dart
// 單幀播放核心邏輯
final jsonString = jsonEncode([currentData.toJson()]);
AppState.shared.sendWebSocketMessage(
  .dance,  // 0x14
  data: jsonString.toUint8List(),
);
```

**Dance 數據結構**（`app/lib/model/dance_list.dart:68-103`）：

```dart
class DanceData {
  ExpressionItem leftEye;
  ExpressionItem rightEye;
  ExpressionItem mouth;
  MotionDataItem yawServo;
  MotionDataItem pitchServo;
  
  String leftRgbColor;   // 預設 "#000000"
  String rightRgbColor;  // 預設 "#000000"
  
  int durationMs;
}
```

**關鍵發現：**
- RGB 是 DanceData 的**必要欄位**
- 預設值為 `"#000000"`（黑色/關閉）
- **RGB 只能透過 Dance (0x14) 發送**

#### 4. 協議格式

**Dance 訊息格式：**
```
[0x14][length: 4 bytes][MAC: 12 bytes][JSON array string]
```

**JSON Payload 範例：**
```json
[
  {
    "leftEye": {"x": 0, "y": 0, "rotation": 0, "weight": 100, "size": 0},
    "rightEye": {"x": 0, "y": 0, "rotation": 0, "weight": 100, "size": 0},
    "mouth": {"x": 0, "y": 0, "rotation": 0, "weight": 0, "size": 0},
    "yawServo": {"angle": 0, "speed": 500},
    "pitchServo": {"angle": 250, "speed": 500},
    "leftRgbColor": "#FF0000",
    "rightRgbColor": "#FF0000",
    "durationMs": 1000
  }
]
```

**注意事項：**
- Payload 是 **JSON 陣列字串**，即使只有一幀也要用 `[...]` 包裹
- 與 Motion/Avatar 不同，Dance 的 JSON 前面**不需要加 MAC 地址**（MAC 已在二進位協議層包含）

---

## 設計決策

### 為何不追蹤狀態？

經過原廠代碼分析，決定**不實作狀態追蹤**，理由如下：

1. **原廠設計哲學**
   - Motion 和 Avatar 本身就是獨立訊息
   - App 端不追蹤狀態，直接發送新值
   - 設備端負責維護實際狀態

2. **協議層面限制**
   - RGB 只能透過 Dance (0x14) 發送
   - Dance 必須包含完整的表情和動作數據
   - 無法單獨發送 RGB 而不影響其他參數

3. **實作複雜度**
   - 狀態追蹤需要修改現有 `sendMotion()` 和 `sendAvatar()`
   - 需處理初始狀態、同步問題、錯誤恢復等
   - 增加系統複雜度，但收益有限

4. **使用場景**
   - RGB 燈光通常與特定表情/動作配合使用
   - 獨立使用時，使用預設表情（NORMAL_FACE）是合理的
   - 需要複雜編排時，應使用完整的 Dance 系統（未來功能）

### 簡化方案

**設計：**
- `sendRgb()` 使用固定預設值：
  - 表情：`NORMAL_FACE`（眼睛全開、嘴巴閉合）
  - 動作：`yaw=0, pitch=250`（REST position）
- 構造單幀 Dance 數據發送
- 與 `sendMotion()` / `sendAvatar()` 保持獨立

**優點：**
- 實作簡單，易於維護
- 行為可預測
- 不影響現有功能
- 符合原廠設計哲學

**缺點：**
- 改變 RGB 時會重置表情和動作到預設值
- 無法在保持當前表情/動作的同時單獨改變 RGB

**緩解措施：**
- 在文檔中明確說明此行為
- 提供組合使用範例（先設定動作/表情，再設定 RGB）
- 未來可實作完整 Dance 系統支援複雜編排

---

## 功能規格

### API 設計

#### Provider 層新增方法

```javascript
/**
 * 發送 RGB 燈光控制指令
 * 
 * 注意：此方法會將表情重置為 NORMAL_FACE，動作重置為 REST position
 * 
 * @param {string} leftColor - 左眼 RGB 顏色（HEX 格式，如 "#FF0000"）
 * @param {string} rightColor - 右眼 RGB 顏色（HEX 格式）
 * @param {number} durationMs - 持續時間（毫秒），預設 0 表示持續顯示
 * @returns {boolean} 是否成功發送
 */
sendRgb(leftColor, rightColor, durationMs = 0)
```

**實作原理：**

1. 構造單幀 DanceData 物件：
   ```javascript
   const danceFrame = [{
     leftEye: NORMAL_FACE.leftEye,
     rightEye: NORMAL_FACE.rightEye,
     mouth: NORMAL_FACE.mouth,
     yawServo: { angle: 0, speed: 500 },
     pitchServo: { angle: 250, speed: 500 },
     leftRgbColor: leftColor,
     rightRgbColor: rightColor,
     durationMs: durationMs
   }];
   ```

2. 序列化為 JSON 字串：
   ```javascript
   const jsonString = JSON.stringify(danceFrame);
   ```

3. 發送 Dance (0x14) 訊息：
   ```javascript
   this.sendBinary(0x14, Buffer.from(jsonString, 'utf8'));
   ```

**錯誤處理：**
- 設備離線時靜默失敗
- 記錄警告日誌：`[provider-origin] RGB 指令未發送 - 裝置狀態: 離線`
- 返回 `false` 表示發送失敗

#### Actions 層測試動作

```javascript
/**
 * RGB 燈光測試動作
 * 展示基本顏色循環：紅 → 綠 → 藍 → 白 → 關閉
 */
async function rgb_test(provider, abortSignal)
```

**測試流程：**

1. **紅色** - `#FF0000` (1000ms)
2. **綠色** - `#00FF00` (1000ms)
3. **藍色** - `#0000FF` (1000ms)
4. **白色** - `#FFFFFF` (1000ms)
5. **關閉** - `#000000`

**支援中止：**
- 檢查 `abortSignal?.aborted`
- 在每個顏色切換前檢查
- 支援 `wait()` 函數的中止機制

---

## 協議細節

### Dance (0x14) 訊息結構

```
+--------+----------------+------------------+------------------------+
| Byte 0 | Bytes 1-4      | Bytes 5-16       | Bytes 17+              |
+--------+----------------+------------------+------------------------+
| 0x14   | Length (BE)    | MAC Address (12B)| JSON Array String      |
+--------+----------------+------------------+------------------------+
```

### JSON Payload 完整結構

```json
[
  {
    "leftEye": {
      "x": 0,         // -100 ~ 100
      "y": 0,         // -100 ~ 100
      "rotation": 0,  // -1800 ~ 1800 (1/10 度)
      "weight": 100,  // 0 ~ 100 (100=全開, 0=全閉)
      "size": 0       // -100 ~ 100 (正=放大, 負=縮小)
    },
    "rightEye": { /* 同 leftEye */ },
    "mouth": {
      "x": 0,
      "y": 0,
      "rotation": 0,
      "weight": 0,    // 0 ~ 100 (0=閉嘴, 100=張大)
      "size": 0
    },
    "yawServo": {
      "angle": 0,     // -1280 ~ 1280 (對應 -128° ~ 128°)
      "speed": 500    // 0 ~ 1000
    },
    "pitchServo": {
      "angle": 250,   // 0 ~ 900 (對應 0° ~ 90°), 250 = REST
      "speed": 500
    },
    "leftRgbColor": "#FF0000",   // HEX 格式
    "rightRgbColor": "#FF0000",
    "durationMs": 1000           // 持續時間（毫秒）
  }
]
```

### 參考值

```javascript
const REST = 250;  // 25° resting position

const NORMAL_FACE = {
  leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
};
```

---

## 實作計畫

### 檔案修改

1. **`providers/origin-stackchan.js`**
   - 新增 `sendRgb(leftColor, rightColor, durationMs)` 方法
   - 位置：在 `sendAvatar()` 方法之後
   - 使用現有的 `sendBinary()` 基礎設施

2. **`actions.js`**
   - 新增 `rgb_test()` 函數
   - 在 `module.exports` 中導出
   - 新增註解說明 RGB 測試功能

3. **`PROTOCOL_RESEARCH.md`**
   - 新增「原廠代碼分析」章節
   - 記錄 Motion/Avatar 獨立性
   - 記錄 App 端不追蹤狀態的發現
   - 記錄 Dance 系統的 RGB 整合

4. **`CLAUDE.md`**
   - 更新「參數規格」章節，新增 RGB 說明
   - 更新「新增動作」章節，新增 RGB 使用範例
   - 新增「RGB 燈光控制」獨立章節

### 實作步驟

1. ✅ 完成設計文檔
2. ⏳ 實作 `sendRgb()` 方法
3. ⏳ 新增 `rgb_test()` 動作
4. ⏳ 更新協議研究文檔
5. ⏳ 更新用戶文檔
6. ⏳ 測試功能
7. ⏳ Git commit

---

## 測試計畫

### 單元測試

**測試項目：**

- [ ] 基本顏色（紅、綠、藍）
- [ ] 白色（全亮）
- [ ] 黑色（關閉）
- [ ] 左右眼設定相同顏色
- [ ] 設備離線時的錯誤處理

**測試指令：**

```bash
# 執行 RGB 測試動作
npm run action rgb_test

# 或直接使用 Node.js
node harnesses/claude/action.js rgb_test
```

**預期結果：**

```
[action] rgb_test: RGB 燈光測試
  → 紅色
  → 綠色
  → 藍色
  → 白色
  → 關閉
```

### 整合測試

**測試場景：**

1. **與表情組合**
   ```javascript
   await provider.sendAvatar(EXPRESSIONS.happy.leftEye, ...);
   await provider.sendRgb('#00FF00', '#00FF00');  // 預期：表情會被重置
   ```

2. **與動作組合**
   ```javascript
   await provider.sendMotion(-500, 300, 600);
   await provider.sendRgb('#FF0000', '#FF0000');  // 預期：動作會被重置
   ```

3. **快速切換顏色**
   ```javascript
   await provider.sendRgb('#FF0000', '#FF0000');
   await provider.sendRgb('#00FF00', '#00FF00');
   await provider.sendRgb('#0000FF', '#0000FF');
   // 預期：順利切換，無錯誤
   ```

4. **中止測試**
   - 執行 `rgb_test` 動作
   - 在執行過程中觸發其他動作（如 `idle`）
   - 預期：`rgb_test` 被中止，不會繼續執行

---

## 待確認項目

### 硬體相關

- [x] **RGB LED 硬體支援** ✅
  - 硬體確認支援 RGB LED
  - 透過設定頁和 AI Agent (MCP tool) 可正常控制
  - 整片燈珠一起變色（無法單獨控制單一燈珠）

- [?] **Dance 訊息 RGB 控制** ⚠️
  - 協議格式已確認正確
  - 固件有 RGB 解析和應用邏輯
  - 但實測未能成功觸發（可能需要特定條件或固件版本）
  - 需進一步研究或等待原廠固件更新

### 功能限制

- [ ] **顏色格式驗證**
  - 是否需要驗證 HEX 格式（如 `#RRGGBB`）
  - 錯誤格式時的處理方式
  - 建議：初版不驗證，依賴設備端處理

- [ ] **左右眼獨立控制**
  - 確認左右眼可以設定不同顏色
  - 測試不對稱顏色的效果
  - 建議：在 `rgb_test` 中新增測試案例

### 未來擴充

- [ ] **完整 Dance 系統**
  - 支援多幀動作編排
  - 支援音樂同步
  - 支援複雜的表情+動作+RGB 組合
  - 建議：作為獨立功能（Issue #11）

- [ ] **RGB 動畫**
  - 顏色漸變
  - 呼吸燈效果
  - 彩虹循環
  - 建議：作為預定義動作（在 `actions.js` 中實作）

---

## 參考資料

### 原廠代碼位置

**Server 端（Go）：**
- `server/internal/web_socket/web_socket.go:734-740` - Dance 訊息處理

**App 端（Dart）：**
- `app/lib/model/msg_type.dart:23` - Dance 訊息類型定義
- `app/lib/model/dance_list.dart:68-103` - DanceData 資料結構
- `app/lib/model/expression_data.dart:139-155` - RgbData 類別
- `app/lib/view/home/dance.dart:131-139` - Dance 播放邏輯
- `app/lib/view/home/avatar.dart:342-365` - sendDanceData 實作

### 相關文檔

- `PROTOCOL_RESEARCH.md` - 完整協議研究報告
- `CLAUDE.md` - 使用者文檔
- `EXPRESSIONS.md` - 表情系統說明

### GitHub Issue

- [#10 ✨ RGB 燈光基本控制](https://github.com/carbeso/claude-stackchan-bridge/issues/10)

---

## 實作狀態

**實驗性功能 (Experimental)**

### 已完成
- ✅ 協議分析與格式確認
- ✅ `sendRgb()` 方法實作
- ✅ `rgb_test` 測試動作
- ✅ 文檔完善

### 已知限制
- ⚠️ 透過 Dance (0x14) 訊息控制 RGB 在實測中未能成功觸發
- ⚠️ 原因可能為：
  1. 需要特定的固件版本或配置
  2. 需要在特定模式下（如 Dance App）才能生效
  3. 可能需要額外的初始化步驟
  4. 固件中 Timeline 的 RGB 應用邏輯可能有條件限制

### 替代方案
當前可用的 RGB 控制方式：
- 透過 AI Agent 使用 MCP tool `self.robot.set_led_color`
- 在設備設定頁面手動控制
- 這兩種方式已驗證可正常工作

### 後續計畫
- 等待原廠固件更新或文檔
- 研究 MCP 客戶端實作的可行性
- 持續追蹤 [issue #10](https://github.com/carbeso/claude-stackchan-bridge/issues/10)

---

## 版本歷史

| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|----------|
| 1.0 | 2026-06-03 | Claude | 初始版本，完成設計與實作 |

---

## 附錄：設計考量

### 為何不使用專用的 RGB 訊息類型？

**問題：** 為何不新增 `0x1B ControlRgb` 這樣的專用訊息？

**答案：**
1. 原廠協議已定義 Dance 系統作為 RGB 載體
2. 設備端可能未實作專用 RGB 訊息處理
3. 保持與原廠協議相容，避免自訂擴充
4. Dance 系統足夠靈活，可滿足需求

### 為何 Payload 是 JSON 陣列而非物件？

**問題：** Dance 的 JSON payload 為何是 `[{...}]` 而非 `{...}`？

**答案：**
1. 原廠設計支援多幀動作序列
2. 即使只有一幀，也使用陣列保持一致性
3. 未來擴充時無需修改協議格式
4. 從原廠代碼 `dance.dart:136` 可見：
   ```dart
   final jsonString = jsonEncode([currentData.toJson()]);
   ```

### 為何不在 sendBinary 中自動加 MAC？

**問題：** 為何 Dance JSON 前面不需要 MAC，但 Motion/Avatar 需要？

**答案：**
1. `sendBinary()` 已在二進位層加入 MAC（payload = macBuf + dataBuf）
2. Motion/Avatar 的 JSON 格式是 `"MAC+{...}"`（字串拼接）
3. Dance 的 Payload 直接是 JSON，MAC 已在外層包含
4. 不同的歷史設計選擇，兩種方式都有效

這些設計決策基於對原廠代碼的深入分析，確保相容性與可維護性。
