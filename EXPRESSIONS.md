# StackChan 表情與動作系統

> **⚠️ 架構變更說明**：從 2026-05-25 起（PR #9），表情系統已從舊的 setInterval 動畫遷移至 **JavaScript 動作定義**（`actions.js`）。本文件提供表情參數規格與設計參考，實際使用請參考 `actions.js` 中的動作函數實作。

本文件說明 StackChan 的表情控制參數與動畫系統，提供靈活的表情設計參考。

## 參數規格（來自 [issue #1](https://github.com/carbeso/claude-stackchan-bridge/issues/1)）

### 眼珠控制（leftEye / rightEye）

| 參數 | 最小值 | 最大值 | 預設值 | 說明 |
|------|--------|--------|--------|------|
| `x` | -100 | 100 | 0 | X軸左右移動（-100靠左，100靠右，0置中） |
| `y` | -100 | 100 | 0 | Y軸上下移動（-100向上，100向下，0置中） |
| `rotation` | -1800 | 1800 | 0 | 順時針旋轉角度 |
| `weight` | 0 | 100 | 100 | 眼睛開合度（**100全開，0往下閉**） |
| `size` | -100 | 100 | 0 | 眼睛大小（-100最小，100最大，0預設） |

**重要**：`weight` 語義與直覺相反 - 100 表示眼睛全開，0 表示閉眼。

### 嘴巴控制（mouth）

| 參數 | 最小值 | 最大值 | 預設值 | 說明 |
|------|--------|--------|--------|------|
| `x` | -100 | 100 | 0 | X軸左右移動（-100靠左，100靠右，0置中） |
| `y` | -100 | 100 | 0 | Y軸上下移動（-100靠上，100靠下，0置中） |
| `rotation` | -1800 | 1800 | 0 | 順時針旋轉角度 |
| `weight` | 0 | 100 | 0 | 嘴巴開合度（**0閉嘴，100張嘴**） |
| `size` | -100 | 100 | 0 | 嘴巴大小（預設0） |

### 動作控制（Servo）

#### Yaw Servo（左右轉頭）

| 參數 | 最小值 | 最大值 | 預設值 | 說明 |
|------|--------|--------|--------|------|
| `angle` | -1280 | 1280 | 0 | 左右角度 |
| `speed` | 0 | 1000 | 500 | 轉動速度（**建議 200-500，過高會轉太快**） |
| `rotate` | -1000 | 1000 | 0 | 持續旋轉（與 angle/speed 無關，需下一個指令停止） |

#### Pitch Servo（上下點頭）

| 參數 | 最小值 | 最大值 | 預設值 | 說明 |
|------|--------|--------|--------|------|
| `angle` | 0 | 900 | 200 | 上下角度（**建議 REST=250，約25度**） |
| `speed` | 0 | 1000 | 500 | 轉動速度（**建議 200-500**） |

## 表情設計範例

以下範例展示表情參數設計，實際使用時需包裝為 async 函數。完整範例請參考 `actions.js`。

### 正常表情（NORMAL_FACE）

```javascript
const NORMAL_FACE = {
  leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },   // 眼睛全開
  rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }        // 嘴巴閉合
};
```

### 開心（微笑 + 大眼睛）

```javascript
{
  leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },   // 眼睛變大
  rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
  mouth: { x: 0, y: 20, rotation: 0, weight: 35, size: 0 }       // 微笑（嘴巴向下+微張）
}
```

### 思考（眼睛往右上看 + 瞇眼）

```javascript
{
  leftEye: { x: 40, y: -10, rotation: 0, weight: 85, size: 0 },   // 往右上看
  rightEye: { x: 40, y: -10, rotation: 0, weight: 85, size: 0 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
}
```

### 驚訝（瞇眼 + 張嘴）

```javascript
{
  leftEye: { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },    // 瞇眼 + 變小
  rightEye: { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },
  mouth: { x: 0, y: 30, rotation: 0, weight: 70, size: 0 }        // 張嘴驚訝
}
```

### 眨眼

```javascript
// 閉眼
{
  leftEye: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 },
  rightEye: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 },
  mouth: NORMAL_FACE.mouth
}

// 睜眼（回到 weight: 100）
```

## 在 actions.js 中實作動作

### 基本結構

所有動作必須是 async 函數，接收 `provider` 和 `abortSignal` 參數。查看 `actions.js` 獲取完整範例。

```javascript
// 範例：簡單動作
async function done(provider, abortSignal) {
  console.log('[action] done: 開心點頭');
  
  // 設定開心表情
  await provider.sendAvatar(
    EXPRESSIONS.happy.leftEye,
    EXPRESSIONS.happy.rightEye,
    EXPRESSIONS.happy.mouth
  );
  
  // 點頭序列
  await provider.sendMotion(0, 100, 400);
  await wait(400, abortSignal);
  await provider.sendMotion(0, 350, 400);
  await wait(400, abortSignal);
  
  // 恢復正常
  await provider.sendMotion(0, 250, 300);
  await provider.sendAvatar(
    NORMAL_FACE.leftEye,
    NORMAL_FACE.rightEye,
    NORMAL_FACE.mouth
  );
}
```

### 持續動畫（使用 AbortSignal）

無限循環動作必須檢查 `abortSignal` 並捕獲 `AbortError`：

```javascript
async function thinking(provider, abortSignal) {
  console.log('[action] thinking: 眼睛左右移動');
  let direction = 1;
  let position = 0;
  
  try {
    while (!abortSignal?.aborted) {
      position += direction * 15;
      if (position >= 50 || position <= -50) {
        direction *= -1;
      }
      await provider.sendAvatar(
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
      );
      await wait(800, abortSignal);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] thinking 已中止');
    } else {
      throw err;
    }
  }
}
```

**調整參數**：
- `direction * 15`：每次移動的步進量
- `±50`：移動範圍
- `800`：更新頻率（毫秒）

## 動作設計建議

### 速度控制

- **快速反應**（200-300）：警報、錯誤
- **正常速度**（400-500）：一般互動、點頭、搖頭
- **緩慢移動**（600-800）：思考、觀察

**警告**：speed 超過 700 會讓馬達轉得太快，建議保持在 500 以下。

### 表情轉場技巧

1. **立即切換**：直接發送新表情
2. **漸變切換**：透過 while 循環逐步改變參數值
3. **序列動作**：使用 `await wait()` 串接多個表情

## API 使用

### HTTP API

```bash
# 觸發動作
curl -X POST http://127.0.0.1:7331/action \
  -H "Content-Type: application/json" \
  -d '{"action":"done"}'

# 直接控制表情
curl -X POST http://127.0.0.1:7331/avatar \
  -H "Content-Type: application/json" \
  -d '{
    "leftEye": {"x":0,"y":0,"rotation":0,"weight":100,"size":0},
    "rightEye": {"x":0,"y":0,"rotation":0,"weight":100,"size":0},
    "mouth": {"x":0,"y":0,"rotation":0,"weight":0,"size":0}
  }'

# 直接控制動作
curl -X POST http://127.0.0.1:7331/motion \
  -H "Content-Type: application/json" \
  -d '{"yaw":0,"pitch":250,"speed":400}'

# 查詢狀態
curl http://127.0.0.1:7331/status
```

## 表情創意範例

### 疑惑（單眼瞇起）

```javascript
{
  leftEye: { x: 20, y: -10, rotation: 0, weight: 100, size: 0 },
  rightEye: { x: 20, y: -10, rotation: 0, weight: 40, size: -20 },
  mouth: { x: -10, y: 0, rotation: 0, weight: 15, size: 0 }
}
```

### 困倦（眼睛半閉）

```javascript
{
  leftEye: { x: 0, y: 10, rotation: 0, weight: 60, size: -10 },
  rightEye: { x: 0, y: 10, rotation: 0, weight: 60, size: -10 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 }
}
```

### 生氣（眉毛下壓效果）

```javascript
{
  leftEye: { x: 0, y: -20, rotation: -200, weight: 90, size: -15 },
  rightEye: { x: 0, y: -20, rotation: 200, weight: 90, size: -15 },
  mouth: { x: 0, y: -10, rotation: 0, weight: 0, size: -20 }
}
```

## 除錯技巧

1. **眼睛消失**：確認 `weight` 不為 0
2. **動作不流暢**：降低 `wait()` 頻率或減少步進量
3. **動作被中斷**：檢查 `abortSignal` 是否正確傳入
4. **參數超出範圍**：依照規格表檢查參數
5. **無限循環未停止**：確認 while 條件有檢查 `!abortSignal?.aborted`

## 參考資源

- [GitHub Issue #1 - 控制要精確一點](https://github.com/carbeso/claude-stackchan-bridge/issues/1)
- [StackChan 官方 Repo](https://github.com/m5stack/StackChan)
- WebSocket 協定：`0x03` controlAvatar 訊息格式
- 完整實作範例：`actions.js`

---

**提示**：表情設計沒有標準答案，多嘗試不同參數組合，找出最適合你應用場景的表情！
