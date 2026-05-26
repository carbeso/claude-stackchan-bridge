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
const { validateActions } = require('./lib/validate-actions');
const logger = require('./lib/logger');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ACTIONS_PATH = path.join(__dirname, 'actions.json');

/**
 * ActionController - 動作序列執行與取消機制
 *
 * 解決 Agent 快速切換狀態（如 thinking → tool → done）時，
 * 舊動作序列與新動作序列重疊執行導致機器人動作混亂的問題。
 *
 * 核心機制：
 * - 每次執行新動作前，自動取消舊動作的所有待執行步驟
 * - 所有 setTimeout timer ID 都被追蹤，可隨時全部清除
 * - 支援 motion（伺服機動作）和 avatar（表情變換）兩種步驟類型
 */
class ActionController {
  /**
   * @param {object} provider - 通訊 Provider 實例（需實作 sendMotion, sendAvatar）
   */
  constructor(provider) {
    this.provider = provider;
    this.timers = [];
    this.currentAction = null;
  }

  /**
   * 取消當前動作序列
   * 清除所有排程中的 setTimeout，防止舊動作繼續執行
   */
  cancel() {
    if (this.timers.length === 0) {
      return;
    }

    // 在清除前記錄數量（清除後 timers 會變空陣列）
    const timerCount = this.timers.length;
    const cancelledAction = this.currentAction;

    // 清除所有待執行的計時器
    this.timers.forEach(timerId => clearTimeout(timerId));
    this.timers = [];
    this.currentAction = null;

    logger.info('action-controller', `已取消動作: ${cancelledAction} (清除 ${timerCount} 個待執行步驟)`);
  }

  /**
   * 執行動作序列
   * 先取消舊動作，再排程新動作的所有步驟
   *
   * @param {string} actionName - 動作名稱
   * @param {Array} steps - 動作步驟陣列
   * @returns {boolean} 是否成功排程
   */
  run(actionName, steps) {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      logger.error('action-controller', `動作 "${actionName}" 無有效步驟`);
      return false;
    }

    // 先取消舊動作
    this.cancel();

    this.currentAction = actionName;
    logger.info('action-controller', `開始執行動作: ${actionName} (${steps.length} 個步驟)`);

    // 排程每個步驟
    steps.forEach((step, index) => {
      const exec = () => {
        // 執行後從 timers 中移除自己
        this.timers = this.timers.filter(id => id !== timerId);

        if (step.type === 'motion') {
          this.provider.sendMotion(step.yaw, step.pitch, step.speed);
        } else if (step.type === 'avatar') {
          this.provider.sendAvatar(step.leftEye, step.rightEye, step.mouth);
        } else {
          logger.warn('action-controller', `未知的步驟類型: ${step.type} (動作: ${actionName}, 步驟: ${index})`);
        }

        // 若所有步驟已完成，清除 currentAction
        if (this.timers.length === 0) {
          logger.info('action-controller', `動作完成: ${actionName}`);
          this.currentAction = null;
        }
      };

      // 依據 delay 決定立即執行或延遲排程
      let timerId;
      if (typeof step.delay === 'number' && step.delay > 0) {
        timerId = setTimeout(exec, step.delay);
        this.timers.push(timerId);
      } else {
        // delay 為 0 或未指定時，仍使用 setTimeout(fn, 0) 以確保可取消性
        timerId = setTimeout(exec, 0);
        this.timers.push(timerId);
      }
    });

    return true;
  }

  /**
   * 回傳當前 ActionController 狀態
   */
  getStatus() {
    return {
      currentAction: this.currentAction,
      pendingSteps: this.timers.length
    };
  }
}

const PORT = 7331;

// 讀取設定檔與動作定義
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let actions = {};
if (fs.existsSync(ACTIONS_PATH)) {
  actions = JSON.parse(fs.readFileSync(ACTIONS_PATH, 'utf8'));

  // 驗證配置格式與參數範圍
  try {
    validateActions(actions);
  } catch (error) {
    logger.error('stackchan', `配置驗證失敗: ${error.message}`);
    logger.error('stackchan', '請檢查 actions.json 是否符合規格');
    process.exit(1);  // 配置錯誤時終止程式
  }
} else {
  logger.warn('stackchan', `找不到 ${ACTIONS_PATH}，使用空配置`);
}

/**
 * 初始化通訊 Provider
 * 目前預設使用 OriginStackChanProvider (對接原廠 WebSocket 協議)
 * 若未來有 BLE 或 MQTT 需求，可在此更換實作。
 */
const provider = new OriginStackChanProvider(config);
const actionController = new ActionController(provider);

// 建立 HTTP Server 監聽來自 Harness 的指令
const server = http.createServer((req, res) => {
  // 處理動作觸發請求: POST /action { "action": "action_name" }
  if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { action } = JSON.parse(body);
        const steps = actions[action];
        if (!steps) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
          return;
        }
        actionController.run(action, steps);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, action, ...provider.getStatus(), ...actionController.getStatus() }));
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
  logger.info('stackchan', `橋接伺服器已啟動: http://127.0.0.1:${PORT}`);
  logger.info('stackchan', `當前 Provider: ${provider.constructor.name}`);
  logger.info('stackchan', `設備 MAC: ${config.deviceMac}`);
  logger.info('stackchan', `已載入動作: ${Object.keys(actions).join(', ')}`);

  // 開始建立 WebSocket 連線
  provider.connect();
});
