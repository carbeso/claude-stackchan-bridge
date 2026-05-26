/**
 * StackChan 所有動作定義 - 統一 JavaScript 版本
 *
 * 所有動作都用 JavaScript 定義，支援：
 * - 簡單的線性步驟（序列）
 * - 複雜的循環和動畫邏輯
 * - 條件判斷和狀態管理
 */

// 常數定義
const REST = 250; // 25 度 resting position

const NORMAL_FACE = {
  leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 0 },
  mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
};

const EXPRESSIONS = {
  blink: {
    leftEye: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 },
    rightEye: { x: 0, y: 0, rotation: 0, weight: 20, size: 0 },
    mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
  },

  happy: {
    leftEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
    rightEye: { x: 0, y: 0, rotation: 0, weight: 100, size: 40 },
    mouth: { x: 0, y: 20, rotation: 0, weight: 35, size: 0 }
  },

  thinking: {
    leftEye: { x: 40, y: -10, rotation: 0, weight: 85, size: 0 },
    rightEye: { x: 40, y: -10, rotation: 0, weight: 85, size: 0 },
    mouth: { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
  },

  surprised: {
    leftEye: { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },
    rightEye: { x: 0, y: 0, rotation: 0, weight: 50, size: -30 },
    mouth: { x: 0, y: 30, rotation: 0, weight: 70, size: 0 }
  },

  sad: {
    leftEye: { x: -30, y: 0, rotation: -180, weight: 40, size: 40 },    // 向內旋轉 45° + 眼睛放大（傷心）
    rightEye: { x: 30, y: 0, rotation: 180, weight: 40, size: 40 },     // 向內旋轉 45° + 眼睛放大（傷心）
    mouth: { x: 0, y: -10, rotation: 0, weight: 0, size: -20 }          // 嘴巴抿緊
  },

  angry: {
    leftEye: { x: 30, y: 0, rotation: 180, weight: 40, size: 40 },      // 向外旋轉 45° + 眼睛放大（銳利）
    rightEye: { x: -30, y: 0, rotation: -180, weight: 40, size: 40 },   // 向外旋轉 45° + 眼睛放大（銳利）
    mouth: { x: 0, y: -10, rotation: 0, weight: 0, size: -20 }          // 嘴巴抿緊
  }
};

/**
 * 延遲函數（支持 AbortSignal）
 */
function wait(ms, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    // 監聽 abort 信號
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}

// ============================================================
// 標準動作（來自原 actions.json）
// ============================================================

async function working(provider, abortSignal) {
  console.log('[action] working: 低頭工作');
  await provider.sendMotion(0, 600, 300);
}

async function done(provider, abortSignal) {
  console.log('[action] done: 開心點頭');
  // 眼睛變大 + 微笑
  await provider.sendAvatar(
    EXPRESSIONS.happy.leftEye,
    EXPRESSIONS.happy.rightEye,
    EXPRESSIONS.happy.mouth
  );
  // 點頭序列
  await provider.sendMotion(0, 200, 400);
  await wait(400, abortSignal);
  await provider.sendMotion(0, 500, 400);
  await wait(400, abortSignal);
  await provider.sendMotion(0, 200, 400);
  await wait(400, abortSignal);
  // 回正
  await provider.sendMotion(0, 450, 300);
  await wait(300, abortSignal);
  await provider.sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
}

async function tool(provider, abortSignal) {
  console.log('[action] tool: 執行工具（左右轉頭）');
  await provider.sendMotion(-400, 450, 600);
  await wait(500, abortSignal);
  await provider.sendMotion(400, 450, 600);
  await wait(500, abortSignal);
  await provider.sendMotion(0, 450, 400);
}

async function error(provider, abortSignal) {
  console.log('[action] error: 錯誤（驚訝表情 + 搖頭）');
  await provider.sendAvatar(
    EXPRESSIONS.surprised.leftEye,
    EXPRESSIONS.surprised.rightEye,
    EXPRESSIONS.surprised.mouth
  );
  // 搖頭序列
  await provider.sendMotion(-300, 450, 400);
  await wait(250, abortSignal);
  await provider.sendMotion(300, 450, 400);
  await wait(250, abortSignal);
  await provider.sendMotion(-300, 450, 400);
  await wait(250, abortSignal);
  await provider.sendMotion(300, 450, 400);
  await wait(250, abortSignal);
  await provider.sendMotion(0, 450, 400);
  await wait(300, abortSignal);
  // 恢復表情
  await provider.sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
}

async function idle(provider, abortSignal) {
  console.log('[action] idle: 回正常位置');
  await provider.sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
  await provider.sendMotion(0, 450, 200);
}

async function thinking(provider, abortSignal) {
  console.log('[action] thinking: 思考狀態（眼睛右上看）');
  await provider.sendAvatar(
    EXPRESSIONS.thinking.leftEye,
    EXPRESSIONS.thinking.rightEye,
    EXPRESSIONS.thinking.mouth
  );
  await provider.sendMotion(0, 500, 100);
}

async function startup(provider, abortSignal) {
  console.log('[action] startup: 啟動');
  await provider.sendMotion(0, 450, 500);
}

async function shutdown(provider, abortSignal) {
  console.log('[action] shutdown: 關閉');
  await provider.sendMotion(0, 800, 500);
}

async function talking(provider, abortSignal) {
  console.log('[action] talking: 對話');
  await provider.sendMotion(0, 450, 500);
}

async function sad(provider, abortSignal) {
  console.log('[action] sad: 傷心（眼睛放大 + 向內眼神）');

  // 設定傷心表情
  await provider.sendAvatar(
    EXPRESSIONS.sad.leftEye,
    EXPRESSIONS.sad.rightEye,
    EXPRESSIONS.sad.mouth
  );
}

async function angry(provider, abortSignal) {
  console.log('[action] angry: 生氣（眼睛放大 + 銳利眼神）');

  // 設定生氣表情
  await provider.sendAvatar(
    EXPRESSIONS.angry.leftEye,
    EXPRESSIONS.angry.rightEye,
    EXPRESSIONS.angry.mouth
  );
}

// ============================================================
// 複雜動作（新增）
// ============================================================

async function blink_animation(provider, abortSignal) {
  console.log('[action] blink_animation: 連續 5 次眨眼');

  for (let i = 1; i <= 5; i++) {
    if (abortSignal?.aborted) break;

    await provider.sendAvatar(
      EXPRESSIONS.blink.leftEye,
      EXPRESSIONS.blink.rightEye,
      EXPRESSIONS.blink.mouth
    );
    await wait(150, abortSignal);

    await provider.sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
    await wait(1000, abortSignal);
  }
}

async function thinking_animation(provider, abortSignal) {
  console.log('[action] thinking_animation: 眼睛持續左右移動');

  let direction = 1;
  let position = 0;

  try {
    while (!abortSignal?.aborted) {
      position += direction * 15;

      if (position >= 50) {
        direction = -1;
        position = 50;
      } else if (position <= -50) {
        direction = 1;
        position = -50;
      }

      await provider.sendAvatar(
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: position, y: -10, rotation: 0, weight: 85, size: 0 },
        { x: 0, y: 0, rotation: 0, weight: 0, size: 0 }
      );

      await wait(800, abortSignal);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] thinking_animation 已中止');
    } else {
      throw err;
    }
  }
}

async function working_animation(provider, abortSignal) {
  console.log('[action] working_animation: 低頭 + 隨機眨眼');

  await provider.sendMotion(0, 500, 300);

  let eyeState = 1;

  try {
    while (!abortSignal?.aborted) {
      if (Math.random() > 0.7) {
        eyeState = 1 - eyeState;
        const weight = eyeState ? 100 : 20;
        await provider.sendAvatar(
          { x: 0, y: 0, rotation: 0, weight, size: 0 },
          { x: 0, y: 0, rotation: 0, weight, size: 0 },
          NORMAL_FACE.mouth
        );
      }

      await wait(1500, abortSignal);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] working_animation 已中止');
    } else {
      throw err;
    }
  }
}

async function breathing_animation(provider, abortSignal) {
  console.log('[action] breathing_animation: 嘴巴呼吸效果（開合 + 往下移動）');

  let breath = 0;
  let direction = 1;

  try {
    while (!abortSignal?.aborted) {
      breath += direction * 8; // 加快速度

      if (breath >= 30) {
        direction = -1;
        breath = 30;
      } else if (breath <= 0) {
        direction = 1;
        breath = 0;
      }

      // 嘴巴開合時往下移動，閉合時回到中間
      const mouthY = Math.floor((breath / 30) * 15); // 最多往下移 15

      await provider.sendAvatar(
        NORMAL_FACE.leftEye,
        NORMAL_FACE.rightEye,
        { x: 0, y: mouthY, rotation: 0, weight: breath, size: 0 }
      );

      await wait(600, abortSignal); // 加快更新頻率
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] breathing_animation 已中止');
    } else {
      throw err;
    }
  }
}

async function emotion_sequence(provider, abortSignal) {
  console.log('[action] emotion_sequence: 思考 → 驚訝 → 開心');

  try {
    // 思考
    console.log('  → 思考');
    await provider.sendAvatar(
      EXPRESSIONS.thinking.leftEye,
      EXPRESSIONS.thinking.rightEye,
      EXPRESSIONS.thinking.mouth
    );
    await wait(2000, abortSignal);

    // 驚訝
    console.log('  → 驚訝');
    await provider.sendAvatar(
      EXPRESSIONS.surprised.leftEye,
      EXPRESSIONS.surprised.rightEye,
      EXPRESSIONS.surprised.mouth
    );
    await provider.sendMotion(-300, REST, 400);
    await wait(300, abortSignal);
    await provider.sendMotion(300, REST, 400);
    await wait(2000, abortSignal);

    // 開心
    console.log('  → 開心');
    await provider.sendAvatar(
      EXPRESSIONS.happy.leftEye,
      EXPRESSIONS.happy.rightEye,
      EXPRESSIONS.happy.mouth
    );
    await provider.sendMotion(0, 100, 400);
    await wait(400, abortSignal);
    await provider.sendMotion(0, 350, 400);
    await wait(400, abortSignal);
    await provider.sendMotion(0, 100, 400);
    await wait(400, abortSignal);

    // 恢復
    console.log('  → 恢復正常');
    await provider.sendMotion(0, REST, 300);
    await provider.sendAvatar(NORMAL_FACE.leftEye, NORMAL_FACE.rightEye, NORMAL_FACE.mouth);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] emotion_sequence 已中止');
    } else {
      throw err;
    }
  }
}

async function speed_test(provider, abortSignal) {
  console.log('[action] speed_test: 速度測試');

  const speeds = [200, 400, 600, 800];

  try {
    for (const speed of speeds) {
      if (abortSignal?.aborted) break;

      console.log(`  → 速度: ${speed}`);

      await provider.sendMotion(-500, REST, speed);
      await wait(1000, abortSignal);

      await provider.sendMotion(500, REST, speed);
      await wait(1000, abortSignal);

      await provider.sendMotion(0, REST, speed);
      await wait(500, abortSignal);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[action] speed_test 已中止');
    } else {
      throw err;
    }
  }
}

/**
 * 導出所有動作
 */
module.exports = {
  // 標準動作
  working,
  done,
  tool,
  error,
  idle,
  thinking,
  startup,
  shutdown,
  talking,
  sad,
  angry,

  // 複雜動作
  blink_animation,
  thinking_animation,
  working_animation,
  breathing_animation,
  emotion_sequence,
  speed_test,

  // 常數
  EXPRESSIONS,
  NORMAL_FACE,
  REST
};
