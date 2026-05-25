/**
 * Test script for validate-actions.js
 * 測試驗證器是否正確處理 falsy values
 */

const { validateActions } = require('./lib/validate-actions.js');

console.log('Testing validation fixes...\n');

// Test 1: 正常配置應該通過
console.log('Test 1: Valid motion configuration');
try {
  validateActions({
    test_motion: [
      { type: 'motion', yaw: 0, pitch: 450, speed: 300 }
    ]
  });
  console.log('✓ PASS: Valid motion configuration accepted\n');
} catch (err) {
  console.log('✗ FAIL:', err.message, '\n');
  process.exit(1);
}

// Test 2: 正常的 avatar 配置應該通過
console.log('Test 2: Valid avatar configuration');
try {
  validateActions({
    test_avatar: [
      {
        type: 'avatar',
        leftEye: { x: 0, y: 0, rotation: 0, weight: 50, size: 0 },
        rightEye: { x: 0, y: 0, rotation: 0, weight: 50, size: 0 },
        mouth: { x: 0, y: 0, rotation: 0, weight: 50 }
      }
    ]
  });
  console.log('✓ PASS: Valid avatar configuration accepted\n');
} catch (err) {
  console.log('✗ FAIL:', err.message, '\n');
  process.exit(1);
}

// Test 3: leftEye = 0 應該通過（falsy but valid）
console.log('Test 3: Avatar with falsy values (0, empty string) should fail type check, not presence check');
try {
  validateActions({
    test_falsy: [
      {
        type: 'avatar',
        leftEye: 0,  // falsy value but present
        rightEye: { x: 0, y: 0, rotation: 0, weight: 50, size: 0 },
        mouth: { x: 0, y: 0, rotation: 0, weight: 50 }
      }
    ]
  });
  console.log('✗ FAIL: Should have thrown type error, not presence error\n');
  process.exit(1);
} catch (err) {
  if (err.message.includes('leftEye 必須是物件')) {
    console.log('✓ PASS: Correctly throws type error:', err.message, '\n');
  } else if (err.message.includes('缺少必要屬性 leftEye')) {
    console.log('✗ FAIL: Still throwing presence error (bug not fixed):', err.message, '\n');
    process.exit(1);
  } else {
    console.log('✗ FAIL: Unexpected error:', err.message, '\n');
    process.exit(1);
  }
}

// Test 4: type = 0 應該失敗於值檢查，不是存在檢查
console.log('Test 4: Step with type=0 should fail value check, not presence check');
try {
  validateActions({
    test_type_zero: [
      {
        type: 0,  // falsy value but present
        yaw: 0,
        pitch: 450,
        speed: 300
      }
    ]
  });
  console.log('✗ FAIL: Should have thrown type value error\n');
  process.exit(1);
} catch (err) {
  if (err.message.includes('type 必須是 "motion" 或 "avatar"')) {
    console.log('✓ PASS: Correctly throws type value error:', err.message, '\n');
  } else if (err.message.includes('缺少必要屬性 type')) {
    console.log('✗ FAIL: Still throwing presence error (bug not fixed):', err.message, '\n');
    process.exit(1);
  } else {
    console.log('✗ FAIL: Unexpected error:', err.message, '\n');
    process.exit(1);
  }
}

// Test 5: Array 應該被拒絕
console.log('Test 5: Array input should be rejected');
try {
  validateActions([
    { type: 'motion', yaw: 0, pitch: 450, speed: 300 }
  ]);
  console.log('✗ FAIL: Array should have been rejected\n');
  process.exit(1);
} catch (err) {
  if (err.message.includes('actions 必須是物件')) {
    console.log('✓ PASS: Array correctly rejected:', err.message, '\n');
  } else {
    console.log('✗ FAIL: Unexpected error:', err.message, '\n');
    process.exit(1);
  }
}

// Test 6: 缺少 leftEye 應該失敗
console.log('Test 6: Missing leftEye should fail');
try {
  validateActions({
    test_missing: [
      {
        type: 'avatar',
        rightEye: { x: 0, y: 0, rotation: 0, weight: 50, size: 0 },
        mouth: { x: 0, y: 0, rotation: 0, weight: 50 }
      }
    ]
  });
  console.log('✗ FAIL: Should have thrown missing leftEye error\n');
  process.exit(1);
} catch (err) {
  if (err.message.includes('缺少必要屬性 leftEye')) {
    console.log('✓ PASS: Correctly detects missing leftEye:', err.message, '\n');
  } else {
    console.log('✗ FAIL: Unexpected error:', err.message, '\n');
    process.exit(1);
  }
}

console.log('All tests passed! ✓');
