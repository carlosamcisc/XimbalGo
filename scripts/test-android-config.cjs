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

  assert.ok(manifest['uses-permission'].some(
    entry => entry.$['android:name'] === 'android.permission.POST_NOTIFICATIONS'
  ), 'Android 13+ necesita POST_NOTIFICATIONS');
  const metadata = manifest.application[0]['meta-data'];
  assert.ok(metadata.some(entry =>
    entry.$['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
    && entry.$['android:value'] === 'reservas'
  ), 'FCM debe usar el canal de reservaciones');
  assert.equal(config._internal.modResults.ios.entitlements['aps-environment'], 'development');
  assert.equal(config.extra.pushEnvironment, process.env.EXPO_PUBLIC_PUSH_ENVIRONMENT ?? 'development');
});
