/**
 * Test actual actions.json file
 */

const { validateActions } = require('./lib/validate-actions.js');
const actions = require('./actions.json');

console.log('Testing actual actions.json configuration...\n');

try {
  validateActions(actions);
  console.log('✓ PASS: actions.json is valid');
} catch (err) {
  console.log('✗ FAIL:', err.message);
  process.exit(1);
}
