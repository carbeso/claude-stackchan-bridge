const http = require('http');

const action = process.argv[2];
if (!action) {
  process.exit(0);
}

const data = JSON.stringify({ action });
const req = http.request({
  hostname: '127.0.0.1',
  port: 7331,
  path: '/action',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  timeout: 2000
}, (res) => {
  res.resume();
});

req.on('error', () => {});
req.on('timeout', () => { req.destroy(); });
req.write(data);
req.end();
