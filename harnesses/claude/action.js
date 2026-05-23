/**
 * StackChan Action CLI
 *
 * 供 AI Harnesses (如 Claude Code Hooks) 呼叫的通用命令列工具。
 * 接收一個動作名稱，並向 Bridge Server 發送觸發請求。
 */

const http = require('http');

// 從命令列參數獲取動作名稱: node action.js <action_name>
const action = process.argv[2];
if (!action) {
  console.log('使用方法: node action.js <動作名稱>');
  process.exit(0);
}

// 準備發送給 Bridge Server 的 JSON 數據
const data = JSON.stringify({ action });

/**
 * 發送 HTTP POST 請求至本地 Bridge Server
 */
const req = http.request({
  hostname: '127.0.0.1',
  port: 7331,
  path: '/action',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 2000
}, (res) => {
  // 接收回應但不做特殊處理
  res.resume();
});

// 錯誤處理: 避免 Bridge Server 未啟動時導致 Harness 當機
req.on('error', (err) => {
  console.error(`[action] 無法連線至 Bridge Server: ${err.message}`);
});

req.on('timeout', () => {
  req.destroy();
});

// 送出請求
req.write(data);
req.end();
