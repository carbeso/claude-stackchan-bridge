# StackChan 表情與動作系統

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

## 持續動畫系統

系統支援持續播放的動畫循環，適用於需要持續視覺回饋的狀態。

### 動畫管理

```javascript
let currentAnimation = null;

function stopCurrentAnimation() {
  if (currentAnimation) {
    clearInterval(currentAnimation);
    currentAnimation = null;
  }
}
```

**重要原則**：每個 action 執行前都必須呼叫 `stopCurrentAnimation()`，避免多個動畫同時運行。

### 範例 1：眼睛左右移動（思考中）

```javascript
tool: () => {
  stopCurrentAnimation();
  let direction = 1;
  let position = 0;
  
  currentAnimation = setInterval(() => {
    position += direction * 15;
    if (position >= 50 || position <= -50) {
      direction *= -1;  // 到達邊界時反向
    }
    sendAvatar(
      { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
      { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
      { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
    );
  }, 800);  // 每 800ms 更新一次
}
```

**調整參數**：
- `direction * 15`：每次移動的步進量（越大移動越快）
- `±50`：移動範圍（眼球左右擺動幅度）
- `800`：更新頻率（毫秒），越小動畫越流暢但負載越高

### 範例 2：隨機眨眼

```javascript
working: () => {
  stopCurrentAnimation();
  sendMotion(0, 500, 300);  // 低頭
  
  let blinkState = false;
  currentAnimation = setInterval(() => {
    if (Math.random() > 0.7) {  // 30% 機率眨眼
      blinkState = !blinkState;
      sendAvatar(
        { x: 0, y: 0, rotation: 0, weight: blinkState ? 20 : 100, size: 0 },
        { x: 0, y: 0, rotation: 0, weight: blinkState ? 20 : 100, size: 0 },
        NORMAL_FACE.mouth
      );
    }
  }, 1500);  // 每 1.5 秒檢查一次
}
```

### 範例 3：呼吸效果（嘴巴開合）

```javascript
breathing: () => {
  stopCurrentAnimation();
  let breath = 0;
  let direction = 1;
  
  currentAnimation = setInterval(() => {
    breath += direction * 5;
    if (breath >= 20 || breath <= 0) {
      direction *= -1;
    }
    sendAvatar(
      NORMAL_FACE.leftEye,
      NORMAL_FACE.rightEye,
      { x: 0, y: 0, rotation: 0, weight: breath, size: 0 }  // 嘴巴緩慢開合
    );
  }, 1000);
}
```

## 動作設計建議

### 速度控制

- **快速反應**（200-300）：適用於警報、錯誤等需要立即注意的動作
- **正常速度**（400-500）：適用於一般互動、點頭、搖頭
- **緩慢移動**（600-800）：適用於思考、觀察等狀態

**警告**：speed 超過 700 會讓馬達轉得太快，建議保持在 500 以下。

### 組合動作（動作 + 表情）

```javascript
done: () => {
  stopCurrentAnimation();
  // 1. 先設定開心表情
  sendAvatar(
    { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
    { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
    { x: 0, y: 20, rotation: 0, weight: 35, size: 0 }
  );
  
  // 2. 點頭動作序列
  sendMotion(0, 100, 400);
  setTimeout(() => sendMotion(0, 350, 400), 400);
  setTimeout(() => sendMotion(0, 100, 400), 800);
  
  // 3. 恢復正常
  setTimeout(() => {
    sendMotion(0, REST, 300);
    sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
  }, 1500);
}
```

### 表情轉場技巧

1. **立即切換**：直接發送新表情（適用於驚訝、警報）
2. **漸變切換**：透過 setInterval 逐步改變參數值
3. **序列動作**：使用 setTimeout 串接多個表情

## API 使用

### 發送表情

```javascript
// 方法 1：直接呼叫 sendAvatar
sendAvatar(
  { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },  // leftEye
  { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },  // rightEye
  { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }     // mouth
);

// 方法 2：使用 NORMAL_FACE 常數
sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
```

### HTTP API

```bash
# 觸發動作（會自動處理表情 + 動畫）
curl -X POST http://127.0.0.1:7331/action \
  -H "Content-Type: application/json" \
  -d '{"action":"tool"}'

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
```

## 表情創意範例

### 疑惑（單眼瞇起）

```javascript
{
  leftEye: { x: 20, y: -10, rotation: 0, weight: 100, size: 0 },  // 正常
  rightEye: { x: 20, y: -10, rotation: 0, weight: 40, size: -20 }, // 瞇眼
  mouth: { x: -10, y: 0, rotation: 0, weight: 15, size: 0 }        // 嘴巴歪一邊
}
```

### 困倦（眼睛半閉）

```javascript
{
  leftEye: { x: 0, y: 10, rotation: 0, weight: 60, size: -10 },
  rightEye: { x: 0, y: 10, rotation: 0, weight: 60, size: -10 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 }  // 微張嘴（打哈欠）
}
```

### 生氣（眉毛下壓效果）

```javascript
{
  leftEye: { x: 0, y: -20, rotation: -200, weight: 90, size: -15 },
  rightEye: { x: 0, y: -20, rotation: 200, weight: 90, size: -15 },
  mouth: { x: 0, y: -10, rotation: 0, weight: 0, size: -20 }  // 嘴巴抿緊
}
```

## 除錯技巧

1. **眼睛消失問題**：確認 `weight` 值不為 0（0 = 閉眼）
2. **動作不流暢**：降低 setInterval 頻率或減少步進量
3. **表情卡住**：檢查是否有忘記呼叫 `stopCurrentAnimation()`
4. **參數超出範圍**：依照上述規格表檢查每個參數的最大最小值

## 進階應用

### 情緒狀態機

```javascript
const EMOTIONS = {
  happy: { leftEye: {...}, rightEye: {...}, mouth: {...} },
  sad: { leftEye: {...}, rightEye: {...}, mouth: {...} },
  angry: { leftEye: {...}, rightEye: {...}, mouth: {...} }
};

function setEmotion(emotion) {
  const expr = EMOTIONS[emotion];
  sendAvatar(expr.leftEye, expr.rightEye, expr.mouth);
}
```

### 表情插值（平滑轉場）

```javascript
function morphExpression(from, to, duration) {
  const steps = 10;
  const interval = duration / steps;
  let step = 0;
  
  const timer = setInterval(() => {
    step++;
    const t = step / steps;
    
    const leftEye = {
      x: from.leftEye.x + (to.leftEye.x - from.leftEye.x) * t,
      y: from.leftEye.y + (to.leftEye.y - from.leftEye.y) * t,
      weight: from.leftEye.weight + (to.leftEye.weight - from.leftEye.weight) * t,
      // ... 其他參數
    };
    
    sendAvatar(leftEye, rightEye, mouth);
    
    if (step >= steps) clearInterval(timer);
  }, interval);
}
```

## 參考資源

- [GitHub Issue #1 - 控制要精確一點](https://github.com/carbeso/claude-stackchan-bridge/issues/1)
- [StackChan 官方 Repo](https://github.com/m5stack/StackChan)
- WebSocket 協定：`0x03` controlAvatar 訊息格式

---

**提示**：表情設計沒有標準答案，多嘗試不同參數組合，找出最適合你應用場景的表情！
