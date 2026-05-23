const crypto = require('crypto');
const WebSocket = require('ws');

class StackChanV2Provider {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.connected = false;
    this.deviceOnline = false;
    this.reconnectTimer = null;
    this.onStatusChange = null;
  }

  generateAuthorization(mac) {
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const rand = Array.from({ length: mac.length }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      const ts = Math.floor(Date.now() / 1000);
      return crypto.publicEncrypt(
        {
          key: this.config.serverPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(`${mac}|${rand}|${ts}`)
      ).toString('base64');
    } catch (e) {
      console.error('[provider-v2] Failed to encrypt authorization. Check your serverPublicKey in config.json.');
      return null;
    }
  }

  sendBinary(msgType, jsonData) {
    if (!this.ws || !this.connected) return false;
    const macBuf = Buffer.from(this.config.deviceMac, 'utf8');
    const dataBuf = Buffer.from(JSON.stringify(jsonData));
    const payload = Buffer.concat([macBuf, dataBuf]);
    const header = Buffer.alloc(5);
    header.writeUInt8(msgType, 0);
    header.writeUInt32BE(payload.length, 1);
    this.ws.send(Buffer.concat([header, payload]));
    return true;
  }

  sendMotion(yaw, pitch, speed) {
    return this.sendBinary(0x04, {
      type: 'bleMotion',
      pitchServo: { angle: pitch, speed },
      yawServo: { angle: yaw, speed }
    });
  }

  sendAvatar(leftEye, rightEye, mouth) {
    return this.sendBinary(0x03, {
      type: 'bleAvatar',
      leftEye: leftEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
      rightEye: rightEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
      mouth: mouth || { x: 0, y: 0, rotation: 0, weight: 0, size: 50 }
    });
  }

  connect() {
    if (!this.config.backendServer || !this.config.serverPublicKey || !this.config.deviceMac) {
      console.log('[provider-v2] Missing config.');
      return;
    }

    const auth = this.generateAuthorization(this.config.deviceMac);
    if (!auth) {
      console.error('[provider-v2] Auth generation failed. Connection aborted.');
      return;
    }
    const wsUrl = `ws://${this.config.backendServer}/stackChan/ws?deviceType=App&deviceId=${this.config.deviceId}`;

    console.log(`[provider-v2] Connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl, { headers: { Authorization: auth } });

    this.ws.on('open', () => {
      this.connected = true;
      console.log('[provider-v2] WebSocket connected');
      if (this.onStatusChange) this.onStatusChange();
    });

    this.ws.on('message', (data) => {
      if (Buffer.isBuffer(data) && data.length >= 5) {
        const t = data.readUInt8(0);
        if (t === 0x17) {
          this.deviceOnline = true;
          console.log('[provider-v2] Device ONLINE');
          if (this.onStatusChange) this.onStatusChange();
        } else if (t === 0x16) {
          this.deviceOnline = false;
          console.log('[provider-v2] Device offline');
          if (this.onStatusChange) this.onStatusChange();
        }
      }
    });

    this.ws.on('close', (code) => {
      this.connected = false;
      this.deviceOnline = false;
      console.log(`[provider-v2] Disconnected (${code}). Reconnecting in 5s...`);
      if (this.onStatusChange) this.onStatusChange();
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('[provider-v2] Error:', err.message);
    });

    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.connected) {
        const ping = Buffer.alloc(5);
        ping.writeUInt8(0x10, 0);
        ping.writeUInt32BE(0, 1);
        this.ws.send(ping);
      }
    }, 30000);
  }

  getStatus() {
    return {
      connected: this.connected,
      deviceOnline: this.deviceOnline,
      deviceMac: this.config.deviceMac
    };
  }
}

module.exports = StackChanV2Provider;
