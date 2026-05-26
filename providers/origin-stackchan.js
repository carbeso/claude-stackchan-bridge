/**
 * Origin StackChan Provider
 *
 * 對接原廠開源版本 StackChan 的通訊協議。
 * 透過 WebSocket 傳輸二進位指令，並使用 RSA-OAEP 進行身份驗證。
 */

const crypto = require('crypto');
const WebSocket = require('ws');
const logger = require('../lib/logger');

class OriginStackChanProvider {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.connected = false;       // 是否已連線至轉發伺服器
    this.deviceOnline = false;    // 機器人設備是否在線
    this.reconnectTimer = null;
    this.onStatusChange = null;
    this.pingInterval = null;
  }

  /**
   * 生成 RSA 加密的身份驗證 Token
   * 格式: MAC|隨機字串|時間戳
   */
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
      logger.error('provider-origin', '身份驗證加密失敗，請檢查 config.json 中的 serverPublicKey。');
      return null;
    }
  }

  /**
   * 封裝並發送二進位協議數據包
   * @param {number} msgType 訊息類型 (0x04: Motion, 0x03: Avatar)
   * @param {object} jsonData 酬載內容
   */
  sendBinary(msgType, jsonData) {
    if (!this.ws || !this.connected) {
      logger.warn('provider-origin', `發送失敗 - WebSocket 未連線 (connected: ${this.connected})`);
      return false;
    }
    try {
      const macBuf = Buffer.from(this.config.deviceMac, 'utf8');
      const dataBuf = Buffer.from(JSON.stringify(jsonData));
      const payload = Buffer.concat([macBuf, dataBuf]);
      const header = Buffer.alloc(5);
      header.writeUInt8(msgType, 0);
      header.writeUInt32BE(payload.length, 1);
      this.ws.send(Buffer.concat([header, payload]));
      return true;
    } catch (error) {
      logger.error('provider-origin', `發送異常: ${error.message}`);
      return false;
    }
  }

  /**
   * 發送伺服機動作指令
   * @param {number} yaw 水平角度
   * @param {number} pitch 垂直角度
   * @param {number} speed 運動速度
   */
  sendMotion(yaw, pitch, speed) {
    const success = this.sendBinary(0x04, {
      type: 'bleMotion',
      pitchServo: { angle: pitch, speed },
      yawServo: { angle: yaw, speed }
    });
    if (!success) {
      logger.warn('provider-origin', `Motion 指令未發送 - 裝置狀態: ${this.deviceOnline ? '在線' : '離線'}`);
    }
    return success;
  }

  /**
   * 發送表情指令
   */
  sendAvatar(leftEye, rightEye, mouth) {
    const success = this.sendBinary(0x03, {
      type: 'bleAvatar',
      leftEye: leftEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
      rightEye: rightEye || { x: 0, y: 0, rotation: 0, weight: 0, size: 100 },
      mouth: mouth || { x: 0, y: 0, rotation: 0, weight: 0, size: 50 }
    });
    if (!success) {
      logger.warn('provider-origin', `Avatar 指令未發送 - 裝置狀態: ${this.deviceOnline ? '在線' : '離線'}`);
    }
    return success;
  }

  /**
   * 建立 WebSocket 連線與事件處理
   */
  connect() {
    if (!this.config.backendServer || !this.config.serverPublicKey || !this.config.deviceMac) {
      logger.info('provider-origin', '設定資訊不足，無法連線。');
      return;
    }

    const auth = this.generateAuthorization(this.config.deviceMac);
    if (!auth) {
      logger.error('provider-origin', '驗證 Token 生成失敗，終止連線。');
      return;
    }

    const wsUrl = `ws://${this.config.backendServer}/stackChan/ws?deviceType=App&deviceId=${this.config.deviceId}`;

    logger.info('provider-origin', `正在連線至 ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl, { headers: { Authorization: auth } });

    this.ws.on('open', () => {
      this.connected = true;
      logger.info('provider-origin', 'WebSocket 已連接');
      if (this.onStatusChange) this.onStatusChange();
    });

    this.ws.on('message', (data) => {
      if (Buffer.isBuffer(data) && data.length >= 5) {
        const t = data.readUInt8(0);
        if (t === 0x17) {
          // 接收到設備在線訊號
          this.deviceOnline = true;
          logger.info('provider-origin', 'StackChan 設備已上線');
          if (this.onStatusChange) this.onStatusChange();
        } else if (t === 0x16) {
          // 接收到設備下線訊號
          this.deviceOnline = false;
          logger.info('provider-origin', 'StackChan 設備已下線');
          if (this.onStatusChange) this.onStatusChange();
        }
      }
    });

    this.ws.on('close', (code) => {
      this.connected = false;
      this.deviceOnline = false;
      logger.info('provider-origin', `連線斷開 (${code})，5秒後嘗試重連...`);
      if (this.onStatusChange) this.onStatusChange();

      // 清除心跳計時器並排程重連
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      logger.error('provider-origin', `連線錯誤: ${err.message}`);
    });

    // 設定定時心跳 (Ping) 以維持連線
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

  /**
   * 獲取當前 Provider 狀態
   */
  getStatus() {
    return {
      connected: this.connected,
      deviceOnline: this.deviceOnline,
      deviceMac: this.config.deviceMac
    };
  }
}

module.exports = OriginStackChanProvider;
