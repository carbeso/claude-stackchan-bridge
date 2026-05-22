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
const ACTIONS = {
  working: () => {
    sendMotion(0, 600, 300);
  },
  done: () => {
    sendMotion(0, 200, 500);
    setTimeout(() => sendMotion(0, 500, 500), 400);
    setTimeout(() => sendMotion(0, 200, 500), 800);
    setTimeout(() => sendMotion(0, 450, 300), 1200);
  },
  tool: () => {
    sendMotion(-400, 450, 600);
    setTimeout(() => sendMotion(400, 450, 600), 500);
    setTimeout(() => sendMotion(0, 450, 400), 1000);
  },
  error: () => {
    sendMotion(-300, 450, 700);
    setTimeout(() => sendMotion(300, 450, 700), 250);
    setTimeout(() => sendMotion(-300, 450, 700), 500);
    setTimeout(() => sendMotion(300, 450, 700), 750);
    setTimeout(() => sendMotion(0, 450, 400), 1000);
  },
  idle: () => {
    sendMotion(0, 450, 200);
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
  console.log('[stackchan] POST /action {"action":"working|done|tool|error|idle"}');
  connectWebSocket();
});
