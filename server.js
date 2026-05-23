const http = require('http');
const fs = require('fs');
const path = require('path');
const StackChanV2Provider = require('./providers/stackchan-v2');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ACTIONS_PATH = path.join(__dirname, 'actions.json');
const PORT = 7331;

let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

let actions = {};
if (fs.existsSync(ACTIONS_PATH)) {
  actions = JSON.parse(fs.readFileSync(ACTIONS_PATH, 'utf8'));
}

// Initialize provider (currently only V2 is supported, but architecture allows more)
const provider = new StackChanV2Provider(config);

function runAction(actionName) {
  const steps = actions[actionName];
  if (!steps) {
    console.error(`[stackchan] Unknown action: ${actionName}`);
    return false;
  }

  steps.forEach(step => {
    if (step.type === 'motion') {
      const exec = () => provider.sendMotion(step.yaw, step.pitch, step.speed);
      if (typeof step.delay === 'number') {
        setTimeout(exec, step.delay);
      } else {
        exec();
      }
    } else if (step.type === 'avatar') {
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

const server = http.createServer((req, res) => {
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
  } else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(provider.getStatus()));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stackchan] Bridge on http://127.0.0.1:${PORT}`);
  console.log(`[stackchan] Provider: ${provider.constructor.name}`);
  console.log(`[stackchan] Device: ${config.deviceMac}`);
  console.log(`[stackchan] Actions loaded: ${Object.keys(actions).join(', ')}`);
  provider.connect();
});
