/**
 * StackChan Bridge Server
 *
 * 此程式作為 AI Harnesses (如 Claude Code, Hermes Agent) 與 StackChan 機器人之間的橋樑。
 * 它接收 HTTP POST 請求，並執行 actions.js 中定義的 JavaScript 動作函數透過 Provider 控制機器人。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const OriginStackChanProvider = require('./providers/origin-stackchan');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ACTIONS_JS_PATH = path.join(__dirname, 'actions.js');

const PORT = 7331;

// yaw: -1280~1280, pitch: 0~900, speed: 0~1000
const REST = 250; // 25 度 resting position

// 正常表情 - 依照 GitHub issue #1 規格
// 眼睛: weight 100=全開, size 0=預設
// 嘴巴: weight 0=閉嘴
const NORMAL_FACE = {
  leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
};

// 讀取設定檔與動作定義
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// 載入 JavaScript 動作
let actions = {};
if (fs.existsSync(ACTIONS_JS_PATH)) {
  try {
    actions = require(ACTIONS_JS_PATH);
  } catch (error) {
    console.error(`[stackchan] 載入 actions.js 失敗: ${error.message}`);
    process.exit(1);
  }
} else {
  console.error(`[stackchan] 找不到 ${ACTIONS_JS_PATH}`);
  process.exit(1);
}

/**
 * 初始化通訊 Provider
 * 目前預設使用 OriginStackChanProvider (對接原廠 WebSocket 協議)
 * 若未來有 BLE 或 MQTT 需求，可在此更換實作。
 */
const provider = new OriginStackChanProvider(config);

// 用於中止無限循環動作
let currentActionAbort = null;

// 建立 HTTP Server 監聽來自 Harness 的指令
const server = http.createServer((req, res) => {
  // 處理動作觸發請求: POST /action { "action": "action_name" }
  if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { action } = JSON.parse(body);

        if (typeof actions[action] !== 'function') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
          return;
        }

        // 中止舊的無限循環動作
        if (currentActionAbort) {
          console.log(`[action] 中止前一個動作`);
          currentActionAbort.abort();
        }

        // 為新動作建立 AbortController
        currentActionAbort = new AbortController();
        const abortSignal = currentActionAbort.signal;

        // 非同步執行，不阻塞 HTTP 回應
        actions[action](provider, abortSignal).catch(err => {
          // 被中止時會拋出 AbortError，正常情況
          if (err.name === 'AbortError') {
            console.log(`[action] 動作已中止: ${action}`);
          } else {
            console.error(`[action] 執行失敗: ${action} - ${err.message}`);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, action, ...provider.getStatus() }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  }
  // 直接控制表情: POST /avatar { "leftEye": {...}, "rightEye": {...}, "mouth": {...} }
  else if (req.method === 'POST' && req.url === '/avatar') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { leftEye, rightEye, mouth } = JSON.parse(body);
        provider.sendAvatar(leftEye, rightEye, mouth);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  }
  // 直接控制動作: POST /motion { "yaw": 0, "pitch": 250, "speed": 400 }
  else if (req.method === 'POST' && req.url === '/motion') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { yaw = 0, pitch = REST, speed = 500 } = JSON.parse(body);
        provider.sendMotion(yaw, pitch, speed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, yaw, pitch, speed }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  }
  // 獲取目前機器人與伺服器連接狀態: GET /status
  else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(provider.getStatus()));
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// 啟動伺服器並建立與 StackChan 的連線
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stackchan] 橋接伺服器已啟動: http://127.0.0.1:${PORT}`);
  console.log(`[stackchan] 當前 Provider: ${provider.constructor.name}`);
  console.log(`[stackchan] 設備 MAC: ${config.deviceMac}`);

  const actionList = Object.keys(actions).filter(k => typeof actions[k] === 'function').join(', ');
  console.log(`[stackchan] 已載入動作: ${actionList}`);
  console.log(`[stackchan] 端點:`);
  console.log(`[stackchan]   POST /action  {"action":"action_name"}`);
  console.log(`[stackchan]   POST /motion  {"yaw":0,"pitch":250,"speed":500}`);
  console.log(`[stackchan]   POST /avatar  {"leftEye":{...},"rightEye":{...},"mouth":{...}}`);
  console.log(`[stackchan]   GET  /status`);

  // 開始建立 WebSocket 連線
  provider.connect();
});
