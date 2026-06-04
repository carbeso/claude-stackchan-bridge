/**
 * Logger Module with Timestamp and Rotation
 *
 * 提供帶時間戳的日誌輸出，並支援按日期自動 rotation。
 * 日誌同時輸出到 console 和檔案（logs/ 目錄）。
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logDir = 'logs') {
    this.logDir = path.resolve(__dirname, '..', logDir);
    this.currentDate = null;
    this.logStream = null;

    // 確保日誌目錄存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.initLogFile();
  }

  /**
   * 取得格式化的時間戳
   * @returns {string} 格式: 2026-05-26 17:30:45.123
   */
  getTimestamp() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 8); // HH:MM:SS
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${date} ${time}.${ms}`;
  }

  /**
   * 取得當前日期（用於日誌檔名）
   * @returns {string} 格式: 2026-05-26
   */
  getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 初始化或更新日誌檔案
   * 當日期變更時自動 rotate 到新檔案
   */
  initLogFile() {
    const date = this.getCurrentDate();

    // 如果日期未變更且 stream 已存在，無需重新初始化
    if (this.currentDate === date && this.logStream) {
      return;
    }

    // 關閉舊的 stream
    if (this.logStream) {
      this.logStream.end();
    }

    // 建立新的日誌檔案
    this.currentDate = date;
    const logFile = path.join(this.logDir, `stackchan-${date}.log`);
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // 寫入日誌輪替標記
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 0) {
      this.writeToFile(`\n${'='.repeat(80)}\n`);
      this.writeToFile(`[logger] Log session started at ${this.getTimestamp()}\n`);
      this.writeToFile(`${'='.repeat(80)}\n`);
    }
  }

  /**
   * 寫入日誌檔案
   * @param {string} message
   */
  writeToFile(message) {
    // 檢查是否需要 rotate（日期變更）
    if (this.getCurrentDate() !== this.currentDate) {
      this.initLogFile();
    }

    if (this.logStream) {
      this.logStream.write(message);
    }
  }

  /**
   * 格式化日誌訊息
   * @param {string} level 日誌等級 (INFO, WARN, ERROR)
   * @param {string} tag 標籤 (如 stackchan, action-controller)
   * @param {string} message 訊息內容
   * @returns {string}
   */
  format(level, tag, message) {
    const timestamp = this.getTimestamp();
    return `[${timestamp}] [${level}] [${tag}] ${message}`;
  }

  /**
   * 輸出 INFO 等級日誌
   */
  info(tag, message) {
    const formatted = this.format('INFO', tag, message);
    console.log(formatted);
    this.writeToFile(formatted + '\n');
  }

  /**
   * 輸出 WARN 等級日誌
   */
  warn(tag, message) {
    const formatted = this.format('WARN', tag, message);
    console.warn(formatted);
    this.writeToFile(formatted + '\n');
  }

  /**
   * 輸出 ERROR 等級日誌
   */
  error(tag, message) {
    const formatted = this.format('ERROR', tag, message);
    console.error(formatted);
    this.writeToFile(formatted + '\n');
  }

  /**
   * 清理舊日誌檔案
   * @param {number} daysToKeep 保留天數，預設 7 天
   */
  cleanOldLogs(daysToKeep = 7) {
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(this.logDir);
      files.forEach(file => {
        if (file.startsWith('stackchan-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stat = fs.statSync(filePath);

          if (now - stat.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            this.info('logger', `清理舊日誌: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('logger', `清理舊日誌失敗: ${error.message}`);
    }
  }

  /**
   * 關閉日誌系統
   */
  close() {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// 建立全域 logger 實例
const logger = new Logger();

// 程式退出時關閉日誌
process.on('exit', () => {
  logger.close();
});

process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

module.exports = logger;
