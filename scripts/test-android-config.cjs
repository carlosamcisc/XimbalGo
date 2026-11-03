const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

test('el manifiesto Android permite los trabajos persistentes de TaskManager', async () => {
  const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const { stdout } = await promisify(execFile)(process.execPath, [
    cli, 'config', '--type', 'introspect', '--json',
  ], {
    env: {
      ...process.env,
      EXPO_OFFLINE: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_NO_TELEMETRY: '1',
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  const config = JSON.parse(stdout);
  const manifest = config._internal.modResults.android.manifest.manifest;
  const permission = manifest['uses-permission'].find(
    (entry) => entry.$['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED'
  );
  assert.ok(permission, 'TaskManager usa setPersisted(true), que requiere RECEIVE_BOOT_COMPLETED');
  assert.equal(permission.$['android:maxSdkVersion'], undefined);
});
