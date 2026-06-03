# StackChan 完整協議研究報告

基於 M5Stack StackChan 原廠代碼的完整通訊協議分析。

## 研究來源
- Server 端: https://github.com/m5stack/StackChan/tree/main/server/internal/web_socket
- App 端: https://github.com/m5stack/StackChan/tree/main/app/lib

---

## 完整訊息類型列表

| 代碼 | 名稱 | 方向 | 功能 | 已實作 |
|------|------|------|------|--------|
| 0x01 | Opus | 雙向 | 音訊串流傳輸（Opus 編碼） | ❌ |
| 0x02 | Jpeg | 雙向 | 影像串流傳輸（JPEG 格式） | ❌ |
| 0x03 | ControlAvatar | App→Device | **控制表情（眼睛、嘴巴）** | ✅ |
| 0x04 | ControlMotion | App→Device | **控制伺服機動作（yaw/pitch）** | ✅ |
| 0x05 | OnCamera | Server→Device | 啟動攝影機 | ❌ |
| 0x06 | OffCamera | Server→Device | 關閉攝影機 | ❌ |
| 0x07 | TextMessage | 雙向 | **文字訊息傳送** | ❌ |
| 0x09 | RequestCall | App→Device | 發起視訊通話請求 | ❌ |
| 0x0A | RefuseCall | Device→App | 拒絕通話 | ❌ |
| 0x0B | AgreeCall | Device→App | 接受通話 | ❌ |
| 0x0C | HangupCall | 雙向 | 掛斷通話 | ❌ |
| 0x0D | UpdateDeviceName | App→Device | 更新設備名稱 | ❌ |
| 0x0E | GetDeviceName | 雙向 | 查詢設備名稱 | ❌ |
| 0x0F | inCall | Server→App | 通話進行中狀態通知 | ❌ |
| 0x10 | ping | Server→Client | 心跳檢測 | ✅ |
| 0x11 | pong | Client→Server | 心跳回應 | ✅ |
| 0x12 | OnPhoneScreen | App→Device | **啟動手機螢幕投影** | ❌ |
| 0x13 | OffPhoneScreen | App→Device | **關閉手機螢幕投影** | ❌ |
| 0x14 | **Dance** | App→Device | **舞蹈指令（複合動作序列）** | ❌ |
| 0x15 | GetAvatarPosture | Device→App | 查詢當前表情姿態 | ❌ |
| 0x16 | DeviceOffline | Server→App | 設備離線通知 | （自動） |
| 0x17 | DeviceOnline | Server→App | 設備上線通知 | （自動） |
| 0x18 | OnAudio | Server→Device | 啟動音訊串流 | ❌ |
| 0x19 | OffAudio | Server→Device | 關閉音訊串流 | ❌ |
| 0x1A | AimedTakePhoto | App→Device | **指定拍照** | ❌ |

---

## 重點新發現功能

### 1. 🎭 舞蹈系統 (Dance - 0x14)

**功能描述:**  
發送完整的舞蹈編排序列，每個 `DanceData` 幀包含：
- 表情控制（左眼、右眼、嘴巴）
- 動作控制（yaw/pitch 伺服機）
- **RGB 燈光控制**（左右眼顏色）
- 時序控制（每幀持續時間 durationMs）

**資料結構 (來自 app/lib/model/dance_list.dart):**
```json
{
  "danceData": [
    {
      "leftEye": { "x": 0, "y": 0, "rotation": 0, "weight": 100, "size": 0 },
      "rightEye": { "x": 0, "y": 0, "rotation": 0, "weight": 100, "size": 0 },
      "mouth": { "x": 0, "y": 0, "rotation": 0, "weight": 0, "size": 0 },
      "yawServo": { "angle": 0, "speed": 500 },
      "pitchServo": { "angle": 250, "speed": 500 },
      "leftRgbColor": "#FF0000",
      "rightRgbColor": "#00FF00",
      "durationMs": 1000
    }
  ],
  "danceName": "動作名稱",
  "musicUrl": "音樂 URL（選填）"
}
```

**協議格式:**
```
[0x14][length: 4 bytes][MAC: 12 bytes][JSON payload]
```

**用途:**
- 複雜的動作編排（表情 + 動作 + 燈光同步）
- 配合音樂播放的舞蹈表演
- 可儲存和重播的動作序列

---

### 2. 💡 RGB 燈光控制

**發現位置:** `app/lib/model/expression_data.dart` 中的 `RgbData` 類別

**資料結構:**
```dart
class RgbData {
  String? leftRgbColor = "#FFFFFF";   // 左眼 RGB 顏色（HEX）
  double? leftRgbDuration = 0.0;      // 左眼持續時間（秒）
  String? rightRgbColor = "#FFFFFF";  // 右眼 RGB 顏色（HEX）
  double? rightRgbDuration = 0.0;     // 右眼持續時間（秒）
}
```

**整合方式:**
- RGB 控制整合在 `DanceData` 中
- 顏色格式: `"#RRGGBB"` (HEX 字串)
- Duration 控制燈光持續時間

---

### 3. 📱 手機螢幕投影 (OnPhoneScreen/OffPhoneScreen - 0x12/0x13)

**功能描述:**  
控制 StackChan 設備顯示手機螢幕內容（可能是透過 JPEG 串流實現）

**Server 端邏輯 (web_socket.go:712-733):**
```go
case OnPhoneScreen:
    // Show phone screen
    macAddr := string(payload)
    stackChanClient := getStackChanClient(macAddr)
    if stackChanClient != nil {
        if stackChanClient.GetPhoneScreen() == false {
            stackChanClient.SetPhoneScreen(true)
            stackChanSendMessage(ctx, stackChanClient, messageType, msg)
        }
    }

case OffPhoneScreen:
    // Hide phone screen
    macAddr := string(payload)
    stackChanClient := getStackChanClient(macAddr)
    if stackChanClient != nil {
        if stackChanClient.GetPhoneScreen() == true {
            stackChanClient.SetPhoneScreen(false)
            stackChanSendMessage(ctx, stackChanClient, messageType, msg)
        }
    }
```

**協議格式:**
```
[0x12 or 0x13][length: 4 bytes][MAC address]
```

---

### 4. 💬 文字訊息 (TextMessage - 0x07)

**功能描述:**  
向 StackChan 設備發送文字訊息（可能在螢幕上顯示或轉語音）

**Server 端邏輯 (web_socket.go:563-580):**
```go
case TextMessage:
    if payload == nil || len(payload) < 12 {
        logger.Warningf(ctx, "Payload too short, cannot parse MAC address: %v", payload)
        return
    }
    macAddr := string(payload[:12])
    data := payload[12:]  // 文字內容
    newMsg := createMessage(msgType, data)
    stackChanClient := getStackChanClient(macAddr)
    if stackChanClient != nil {
        stackChanSendMessage(ctx, stackChanClient, messageType, newMsg)
    }
```

**協議格式:**
```
[0x07][length: 4 bytes][MAC: 12 bytes][text content (UTF-8)]
```

---

### 5. 📸 指定拍照 (AimedTakePhoto - 0x1A)

**功能描述:**  
觸發 StackChan 設備拍照並回傳影像

**Server 端邏輯 (web_socket.go:746-751):**
```go
case AimedTakePhoto:
    stackChanClient := getStackChanClient(client.GetMac())
    if stackChanClient != nil {
        stackChanClient.SetAimedTakePhotoAppClient(client)
        stackChanSendMessage(ctx, stackChanClient, messageType, msg)
    }
```

**協議格式:**
```
[0x1A][length: 4 bytes][payload]
```

---

### 6. 🎥 音訊/影像串流 (Opus/Jpeg - 0x01/0x02)

**功能描述:**  
雙向音訊和影像串流，用於視訊通話功能

**特性:**
- **訂閱機制**: Server 維護訂閱者列表
- **自動管理**: 無訂閱者時自動發送 OffCamera/OffAudio
- **多客戶端**: 支援多個 App 同時接收串流

**協議格式:**
```
[0x01 or 0x02][length: 4 bytes][MAC: 12 bytes][binary data]
```

---

### 7. 🔧 MotionDataItem 的 rotate 參數

**新發現參數:**  
除了 `angle` 和 `speed`，`MotionDataItem` 還有 `rotate` 參數

**資料結構 (app/lib/model/expression_data.dart:113-130):**
```dart
class MotionDataItem {
  int angle;    // 角度位置
  int speed;    // 速度
  int rotate;   // 旋轉（連續轉動？）

  Map<String, dynamic> toJson() {
    if (angle != 0) {
      return {'angle': angle, 'speed': speed};
    } else if (rotate != 0) {
      return {'rotate': rotate, 'speed': speed};  // rotate 模式
    } else {
      return {'angle': angle, 'speed': speed};
    }
  }
}
```

**推測用途:**
- `angle`: 移動到特定角度（絕對位置）
- `rotate`: 連續旋轉（相對運動或持續轉動）

---

## 協議通用格式

### 二進位訊息結構
```
+--------+----------------+------------------+
| Byte 0 | Bytes 1-4      | Bytes 5+         |
+--------+----------------+------------------+
| Type   | Length (BE)    | Payload          |
+--------+----------------+------------------+
```

- **Type**: 1 byte, 訊息類型代碼
- **Length**: 4 bytes, Big-Endian 整數，payload 長度
- **Payload**: 可變長度資料

### App → Device 訊息的 Payload 格式
大多數控制指令的 payload 結構：
```
+-------------------+------------------+
| Bytes 0-11        | Bytes 12+        |
+-------------------+------------------+
| MAC Address (12B) | Data (JSON/Raw)  |
+-------------------+------------------+
```

---

## 建議實作優先級

### 🔥 高優先級（立即可用）

1. **Dance 舞蹈系統** (0x14)
   - 最強大的複合控制功能
   - 支援表情、動作、RGB 燈光同步
   - 可實現複雜的動作編排

2. **TextMessage 文字訊息** (0x07)
   - 簡單易實作
   - 可能觸發 TTS 語音
   - 與 AI Agent 整合自然

3. **RGB 燈光控制**
   - 整合在 Dance 系統中
   - 增加視覺反饋豐富度

### ⚡ 中優先級（擴充功能）

4. **OnPhoneScreen/OffPhoneScreen** (0x12/0x13)
   - 螢幕投影功能
   - 可能需要設備端支援

5. **AimedTakePhoto** (0x1A)
   - 拍照功能
   - 需處理回傳的影像資料

6. **GetAvatarPosture** (0x15)
   - 查詢當前表情狀態
   - 可用於狀態同步

### 🔮 低優先級（進階功能）

7. **音訊/影像串流** (0x01/0x02)
   - 需要複雜的串流處理
   - 頻寬需求高
   - 適合視訊通話場景

8. **通話控制** (0x09-0x0C)
   - 完整的通話管理系統
   - 需搭配音訊/影像串流

---

## 實作建議

### 1. Dance 系統實作範例

```javascript
/**
 * 發送舞蹈指令
 * @param {Array} danceFrames - 舞蹈幀陣列
 */
function sendDance(provider, danceFrames) {
  const danceList = {
    danceData: danceFrames.map(frame => ({
      leftEye: frame.leftEye,
      rightEye: frame.rightEye,
      mouth: frame.mouth,
      yawServo: { angle: frame.yaw, speed: frame.speed },
      pitchServo: { angle: frame.pitch, speed: frame.speed },
      leftRgbColor: frame.leftRgbColor || "#FFFFFF",
      rightRgbColor: frame.rightRgbColor || "#FFFFFF",
      durationMs: frame.duration
    }))
  };

  const jsonPayload = JSON.stringify(danceList);
  provider.sendBinary(0x14, jsonPayload);
}
```

### 2. TextMessage 實作範例

```javascript
/**
 * 發送文字訊息
 * @param {string} text - 文字內容
 */
function sendTextMessage(provider, text) {
  const textBuffer = Buffer.from(text, 'utf8');
  provider.sendBinary(0x07, textBuffer);
}
```

### 3. RGB 燈光控制範例

```javascript
// 在 Dance 動作中加入 RGB 控制
const happyWithLight = {
  leftEye: EXPRESSIONS.happy.leftEye,
  rightEye: EXPRESSIONS.happy.rightEye,
  mouth: EXPRESSIONS.happy.mouth,
  yaw: 0,
  pitch: 450,
  speed: 400,
  leftRgbColor: "#00FF00",   // 綠色
  rightRgbColor: "#00FF00",
  duration: 1000
};
```

---

## 待確認問題

1. **RGB 硬體支援**: 需確認 StackChan 硬體是否有 RGB LED
2. **rotate 參數行為**: `MotionDataItem.rotate` 的實際行為需實測
3. **螢幕投影格式**: OnPhoneScreen 的影像格式和傳輸方式
4. **TextMessage TTS**: 文字訊息是否自動轉語音，或僅顯示
5. **Dance 執行方式**: Dance 指令是立即執行還是排程執行

---

## 原廠代碼分析（2026-06-03 更新）

### 控制訊息的獨立性

透過分析原廠 App 代碼（`app/lib/view/home/avatar.dart:342-365`），發現關鍵設計：

**App 端實作策略：**

```dart
void sendDanceData(DanceData data) {
  // 分別發送兩個獨立指令
  final expressionData = ExpressionData(...);
  AppState.shared.sendWebSocketMessage(.controlAvatar, data: ...);  // 0x03

  final motionData = MotionData(...);
  AppState.shared.sendWebSocketMessage(.controlMotion, data: ...);  // 0x04
}
```

**關鍵發現：**

1. **Motion (0x04) 和 Avatar (0x03) 是真正獨立的訊息類型**
   - 不需要組合發送
   - 不需要狀態追蹤
   - 可以單獨控制

2. **App 端不追蹤狀態**
   - 直接發送新值，不記錄上一次的狀態
   - 設備端負責維護實際狀態
   - 簡單直接的控制模式

3. **RGB 只能透過 Dance (0x14) 發送**
   - 沒有專用的 RGB 訊息類型
   - RGB 是 DanceData 的一部分
   - Dance 必須包含完整的表情、動作、RGB 數據

### Dance 系統的實作方式

**播放邏輯**（`app/lib/view/home/dance.dart:131-139`）：

```dart
// 單幀播放
final jsonString = jsonEncode([currentData.toJson()]);
AppState.shared.sendWebSocketMessage(.dance, data: jsonString.toUint8List());
```

**DanceData 結構**（`app/lib/model/dance_list.dart:68-103`）：

```dart
class DanceData {
  ExpressionItem leftEye, rightEye, mouth;
  MotionDataItem yawServo, pitchServo;
  String leftRgbColor;   // 預設 "#000000"
  String rightRgbColor;  // 預設 "#000000"
  int durationMs;
}
```

**關鍵發現：**

1. **Payload 是 JSON 陣列**
   - 即使只有一幀，也要用 `[{...}]` 包裹
   - 與 Motion/Avatar 的 JSON 格式不同

2. **RGB 是必要欄位**
   - 預設值為 `"#000000"`（黑色/關閉）
   - 即使不使用 RGB，也會在數據中包含

3. **協議格式差異**
   - Motion/Avatar: `[MAC][JSON string]` (JSON 前綴 MAC)
   - Dance: `[Binary header with MAC][JSON array]` (MAC 在二進位層)

### 設計啟示

基於這些發現，StackChan Bridge 的設計決策：

1. **保持 Motion/Avatar 獨立** ✅
   - 已實作，符合原廠設計
   - 不需要修改

2. **RGB 使用 Dance (0x14)** ✅
   - 實作 `sendRgb()` 方法
   - 使用單幀 Dance 發送
   - 不追蹤狀態，使用預設值

3. **未來完整 Dance 系統** 🔮
   - 支援多幀動作編排
   - 支援音樂同步
   - 作為獨立功能開發

---

## 總結

原廠協議支援的功能遠超目前實作：

**目前已實作**: 
- Motion (0x04)
- Avatar (0x03)
- RGB 燈光控制（透過 Dance 0x14）✨ NEW
- Ping/Pong (0x10/0x11)

**可立即新增**:
- 🎭 **完整 Dance 舞蹈系統** - 多幀編排、音樂同步
- 💬 **文字訊息** - 與 AI 對話整合
- 📱 **螢幕投影** - 擴充顯示功能
- 📸 **拍照功能** - 視覺輸入

這些新功能將大幅提升 StackChan Bridge 的能力，特別是 **Dance 系統**可以實現複雜的情感表達和動作編排。
