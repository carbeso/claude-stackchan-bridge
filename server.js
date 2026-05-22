const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const PORT = 7331;

let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let ws = null;
let connected = false;
let deviceOnline = false;
let reconnectTimer = null;
let currentAnimation = null; // 用於追蹤當前動畫

function generateAuthorization(mac) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const rand = Array.from({ length: mac.length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  const ts = Math.floor(Date.now() / 1000);
  return crypto.publicEncrypt(
    { key: config.serverPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(`${mac}|${rand}|${ts}`)
  ).toString('base64');
}

function sendBinary(msgType, jsonData) {
  if (!ws || !connected) return false;
  const macBuf = Buffer.from(config.deviceMac, 'utf8');
  const dataBuf = Buffer.from(JSON.stringify(jsonData));
  const payload = Buffer.concat([macBuf, dataBuf]);
  const header = Buffer.alloc(5);
  header.writeUInt8(msgType, 0);
  header.writeUInt32BE(payload.length, 1);
  ws.send(Buffer.concat([header, payload]));
  return true;
}

function sendMotion(yaw, pitch, speed) {
  return sendBinary(0x04, {
    type: 'bleMotion',
    pitchServo: { angle: pitch, speed },
    yawServo: { angle: yaw, speed }
  });
}

function sendAvatar(leftEye, rightEye, mouth) {
  return sendBinary(0x03, {
    type: 'bleAvatar',
    leftEye: leftEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
    rightEye: rightEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
    mouth: mouth || { x: 0, y: 0, rotation: 0, weight: 0, size: 50 }
  });
}

function connectWebSocket() {
  if (!config.backendServer || !config.serverPublicKey || !config.deviceMac) {
    console.log('[stackchan] Missing config.');
    return;
  }

  const auth = generateAuthorization(config.deviceMac);
  const wsUrl = `ws://${config.backendServer}/stackChan/ws?deviceType=App&deviceId=${config.deviceId}`;

  console.log(`[stackchan] Connecting...`);
  ws = new WebSocket(wsUrl, { headers: { Authorization: auth } });

  ws.on('open', () => {
    connected = true;
    console.log('[stackchan] WebSocket connected');
  });

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data) && data.length >= 5) {
      const t = data.readUInt8(0);
      if (t === 0x17) {
        deviceOnline = true;
        console.log('[stackchan] Device ONLINE');
      } else if (t === 0x16) {
        deviceOnline = false;
        console.log('[stackchan] Device offline');
      }
    }
  });

  ws.on('close', (code) => {
    connected = false;
    deviceOnline = false;
    console.log(`[stackchan] Disconnected (${code}). Reconnecting in 5s...`);
    reconnectTimer = setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('[stackchan] Error:', err.message);
  });

  setInterval(() => {
    if (ws && connected) {
      const ping = Buffer.alloc(5);
      ping.writeUInt8(0x10, 0);
      ping.writeUInt32BE(0, 1);
      ws.send(ping);
    }
  }, 30000);
}

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

// 停止當前動畫
function stopCurrentAnimation() {
  if (currentAnimation) {
    clearInterval(currentAnimation);
    currentAnimation = null;
  }
}

const ACTIONS = {
  working: () => {
    stopCurrentAnimation();
    // 低頭工作 + 偶爾眨眼
    sendMotion(0, 500, 300);
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
    }, 1500);
  },
  done: () => {
    stopCurrentAnimation();
    // 眼睛變大（開心）+ 微笑 + 點頭
    sendAvatar(
      { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },  // 眼睛變大
      { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
      { x: 0, y: 20, rotation: 0, weight: 35, size: 0 }    // 微笑
    );
    sendMotion(0, 100, 400);      // 速度降為 400
    setTimeout(() => sendMotion(0, 350, 400), 400);
    setTimeout(() => sendMotion(0, 100, 400), 800);
    setTimeout(() => {
      sendMotion(0, REST, 300);
      sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
    }, 1500);
  },
  tool: () => {
    stopCurrentAnimation();
    // 眼睛左右移動（思考中）
    let direction = 1;
    let position = 0;
    currentAnimation = setInterval(() => {
      position += direction * 15;
      if (position >= 50 || position <= -50) {
        direction *= -1;  // 反向
      }
      sendAvatar(
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
      );
    }, 800);
  },
  error: () => {
    stopCurrentAnimation();
    // 眼睛瞇起 + 嘴巴張開（驚訝）+ 搖頭
    sendAvatar(
      { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },  // 瞇眼 + 變小
      { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },
      { x: 0, y: 30, rotation: 0, weight: 70, size: 0 }    // 嘴巴張開驚訝
    );
    sendMotion(-300, REST, 400);  // 速度降為 400
    setTimeout(() => sendMotion(300, REST, 400), 350);
    setTimeout(() => sendMotion(0, REST, 400), 700);
    setTimeout(() => {
      sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
    }, 1800);
  },
  idle: () => {
    stopCurrentAnimation();
    // 回正常
    sendMotion(0, REST, 200);
    sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
  }
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { action } = JSON.parse(body);
        if (ACTIONS[action]) {
          ACTIONS[action]();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, action, deviceOnline }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/motion') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { yaw = 0, pitch = REST, speed = 500 } = JSON.parse(body);
        sendMotion(yaw, pitch, speed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, yaw, pitch, speed }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/avatar') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { leftEye, rightEye, mouth } = JSON.parse(body);
        sendAvatar(leftEye, rightEye, mouth);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connected, deviceOnline, deviceMac: config.deviceMac }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stackchan] Bridge on http://127.0.0.1:${PORT}`);
  console.log(`[stackchan] Device: ${config.deviceMac}`);
  console.log('[stackchan] POST /action  {"action":"working|done|tool|error|idle"}');
  console.log('[stackchan] POST /motion  {"yaw":0,"pitch":350,"speed":500}');
  console.log('[stackchan] POST /avatar  {"leftEye":{...},"rightEye":{...},"mouth":{...}}');
  connectWebSocket();
});
