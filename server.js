/**
 * StackChan Bridge Server
 *
 * 此程式作為 AI Harnesses (如 Claude Code, Hermes Agent) 與 StackChan 機器人之間的橋樑。
 * 它接收 HTTP POST 請求，並根據 actions.json 中定義的動作序列透過 Provider 控制機器人。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const OriginStackChanProvider = require('./providers/origin-stackchan');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ACTIONS_PATH = path.join(__dirname, 'actions.json');
const PORT = 7331;

// 讀取設定檔與動作定義
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let actions = {};
if (fs.existsSync(ACTIONS_PATH)) {
  actions = JSON.parse(fs.readFileSync(ACTIONS_PATH, 'utf8'));
}

/**
 * 初始化通訊 Provider
 * 目前預設使用 OriginStackChanProvider (對接原廠 WebSocket 協議)
 * 若未來有 BLE 或 MQTT 需求，可在此更換實作。
 */
const provider = new OriginStackChanProvider(config);

/**
 * 執行指定的動作序列
 * @param {string} actionName 動作名稱 (對應 actions.json 中的 key)
 * @returns {boolean} 是否成功觸發
 */
function runAction(actionName) {
  const steps = actions[actionName];
  if (!steps) {
    console.error(`[stackchan] 未定義的動作: ${actionName}`);
    return false;
  }

  // 遍歷動作序列中的每一個步驟
  steps.forEach(step => {
    if (step.type === 'motion') {
      // 處理伺服機動作 (yaw, pitch, speed)
      const exec = () => provider.sendMotion(step.yaw, step.pitch, step.speed);
      if (typeof step.delay === 'number') {
        setTimeout(exec, step.delay);
      } else {
        exec();
      }
    } else if (step.type === 'avatar') {
      // 處理表情變換 (眼睛、嘴巴)
      const exec = () => provider.sendAvatar(step.leftEye, step.rightEye, step.mouth);
      if (typeof step.delay === 'number') {
        setTimeout(exec, step.delay);
      } else {
        exec();
      }
    }
  });
  return true;
}

// 建立 HTTP Server 監聽來自 Harness 的指令
const server = http.createServer((req, res) => {
  // 處理動作觸發請求: POST /action { "action": "action_name" }
  if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { action } = JSON.parse(body);
        if (runAction(action)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, action, ...provider.getStatus() }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
        }
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
  console.log(`[stackchan] 已載入動作: ${Object.keys(actions).join(', ')}`);

  // 開始建立 WebSocket 連線
  provider.connect();
});
