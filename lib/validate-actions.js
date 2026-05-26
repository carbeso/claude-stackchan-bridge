/**
 * StackChan Bridge - Actions Configuration Validator
 *
 * 驗證 actions.json 配置檔的格式與參數範圍
 * 在 server 啟動時檢查配置錯誤，避免執行時才發現問題
 */

const logger = require('./logger');

/**
 * 驗證數值是否在指定範圍內
 * @param {number} value - 要驗證的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {boolean}
 */
function isInRange(value, min, max) {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * 驗證眼睛參數
 * @param {string} actionName - 動作名稱
 * @param {number} index - 步驟索引
 * @param {string} eyeName - 眼睛名稱（leftEye 或 rightEye）
 * @param {object} eye - 眼睛參數物件
 */
function validateEyeParams(actionName, index, eyeName, eye) {
  if (typeof eye !== 'object' || eye === null) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName} 必須是物件`);
  }

  // 驗證 x (-100~100)
  if (!isInRange(eye.x, -100, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName}.x 必須在 -100~100 範圍內`);
  }

  // 驗證 y (-100~100)
  if (!isInRange(eye.y, -100, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName}.y 必須在 -100~100 範圍內`);
  }

  // 驗證 rotation (-1800~1800)
  if (!isInRange(eye.rotation, -1800, 1800)) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName}.rotation 必須在 -1800~1800 範圍內`);
  }

  // 驗證 weight (0~100)
  if (!isInRange(eye.weight, 0, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName}.weight 必須在 0~100 範圍內`);
  }

  // 驗證 size (-100~100)
  if (!isInRange(eye.size, -100, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: ${eyeName}.size 必須在 -100~100 範圍內`);
  }
}

/**
 * 驗證嘴巴參數
 * @param {string} actionName - 動作名稱
 * @param {number} index - 步驟索引
 * @param {object} mouth - 嘴巴參數物件
 */
function validateMouthParams(actionName, index, mouth) {
  if (typeof mouth !== 'object' || mouth === null) {
    throw new Error(`[validate] ${actionName}[${index}]: mouth 必須是物件`);
  }

  // 驗證 x (-100~100)
  if (!isInRange(mouth.x, -100, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: mouth.x 必須在 -100~100 範圍內`);
  }

  // 驗證 y (-100~100)
  if (!isInRange(mouth.y, -100, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: mouth.y 必須在 -100~100 範圍內`);
  }

  // 驗證 rotation (-1800~1800)
  if (!isInRange(mouth.rotation, -1800, 1800)) {
    throw new Error(`[validate] ${actionName}[${index}]: mouth.rotation 必須在 -1800~1800 範圍內`);
  }

  // 驗證 weight (0~100)
  if (!isInRange(mouth.weight, 0, 100)) {
    throw new Error(`[validate] ${actionName}[${index}]: mouth.weight 必須在 0~100 範圍內`);
  }
}

/**
 * 驗證 motion 類型步驟
 * @param {string} actionName - 動作名稱
 * @param {number} index - 步驟索引
 * @param {object} step - 步驟物件
 */
function validateMotionStep(actionName, index, step) {
  // 驗證 yaw (-1280~1280)
  if (!isInRange(step.yaw, -1280, 1280)) {
    throw new Error(`[validate] ${actionName}[${index}]: yaw 必須在 -1280~1280 範圍內`);
  }

  // 驗證 pitch (0~900)
  if (!isInRange(step.pitch, 0, 900)) {
    throw new Error(`[validate] ${actionName}[${index}]: pitch 必須在 0~900 範圍內`);
  }

  // 驗證 speed (0~1000)
  if (!isInRange(step.speed, 0, 1000)) {
    throw new Error(`[validate] ${actionName}[${index}]: speed 必須在 0~1000 範圍內`);
  }
}

/**
 * 驗證 avatar 類型步驟
 * @param {string} actionName - 動作名稱
 * @param {number} index - 步驟索引
 * @param {object} step - 步驟物件
 */
function validateAvatarStep(actionName, index, step) {
  // 驗證必要屬性存在
  if (step.leftEye === undefined || step.leftEye === null) {
    throw new Error(`[validate] ${actionName}[${index}]: 缺少必要屬性 leftEye`);
  }
  if (step.rightEye === undefined || step.rightEye === null) {
    throw new Error(`[validate] ${actionName}[${index}]: 缺少必要屬性 rightEye`);
  }
  if (step.mouth === undefined || step.mouth === null) {
    throw new Error(`[validate] ${actionName}[${index}]: 缺少必要屬性 mouth`);
  }

  // 驗證各部位參數
  validateEyeParams(actionName, index, 'leftEye', step.leftEye);
  validateEyeParams(actionName, index, 'rightEye', step.rightEye);
  validateMouthParams(actionName, index, step.mouth);
}

/**
 * 驗證單一步驟
 * @param {string} actionName - 動作名稱
 * @param {number} index - 步驟索引
 * @param {object} step - 步驟物件
 */
function validateStep(actionName, index, step) {
  if (typeof step !== 'object' || step === null) {
    throw new Error(`[validate] ${actionName}[${index}]: 步驟必須是物件`);
  }

  // 驗證 type 屬性存在
  if (step.type === undefined || step.type === null) {
    throw new Error(`[validate] ${actionName}[${index}]: 缺少必要屬性 type`);
  }

  // 驗證 type 值
  if (step.type !== 'motion' && step.type !== 'avatar') {
    throw new Error(`[validate] ${actionName}[${index}]: type 必須是 "motion" 或 "avatar"`);
  }

  // 驗證 delay（選填，如果存在必須是非負數）
  if (step.delay !== undefined) {
    if (typeof step.delay !== 'number' || step.delay < 0) {
      throw new Error(`[validate] ${actionName}[${index}]: delay 必須是非負數`);
    }
  }

  // 根據類型驗證特定參數
  if (step.type === 'motion') {
    validateMotionStep(actionName, index, step);
  } else if (step.type === 'avatar') {
    validateAvatarStep(actionName, index, step);
  }
}

/**
 * 驗證動作步驟陣列
 * @param {string} actionName - 動作名稱
 * @param {Array} steps - 步驟陣列
 */
function validateActionSteps(actionName, steps) {
  if (!Array.isArray(steps)) {
    throw new Error(`[validate] ${actionName}: 必須是陣列`);
  }

  if (steps.length === 0) {
    throw new Error(`[validate] ${actionName}: 至少需要一個步驟`);
  }

  steps.forEach((step, index) => {
    validateStep(actionName, index, step);
  });
}

/**
 * 驗證整個 actions 配置
 * @param {object} actions - actions.json 的內容
 */
function validateActions(actions) {
  if (typeof actions !== 'object' || actions === null || Array.isArray(actions)) {
    throw new Error('[validate] actions 必須是物件');
  }

  const actionNames = Object.keys(actions);
  if (actionNames.length === 0) {
    throw new Error('[validate] actions 至少需要定義一個動作');
  }

  actionNames.forEach(actionName => {
    validateActionSteps(actionName, actions[actionName]);
  });

  // 驗證通過，輸出成功日誌
  logger.info('validate', `配置驗證通過，載入 ${actionNames.length} 個動作`);
}

module.exports = { validateActions };
