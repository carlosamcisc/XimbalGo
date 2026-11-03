// Runs on the macOS EAS builder after Expo prebuild. The output must be signed
// separately before it can be installed on an iPhone.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (exit ${result.status}, signal ${result.signal ?? 'none'}).`);
  }
}

function main() {
  if (process.platform !== 'darwin') {
    throw new Error('Run this build on a macOS EAS worker; Xcode is required.');
  }
  for (const name of [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_URL_UBICACION_COMPARTIDA',
  ]) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Set ${name} in the production environment on EAS before building.`);
    }
  }

  const root = process.cwd();
  const ios = path.join(root, 'ios');
  run('pod', ['install'], ios);

  const workspaces = fs.readdirSync(ios).filter((name) => name.endsWith('.xcworkspace'));
  if (workspaces.length !== 1) {
    throw new Error(`Expected one app workspace in ios/, found ${workspaces.length}.`);
  }
  const workspace = workspaces[0];
  const scheme = path.basename(workspace, '.xcworkspace');
  const output = path.join(root, 'build', 'ios-unsigned');
  fs.mkdirSync(output, { recursive: true });

  run('xcodebuild', [
    '-workspace', path.join(ios, workspace),
    '-scheme', scheme,
    '-configuration', 'Release',
    '-sdk', 'iphoneos',
    '-destination', 'generic/platform=iOS',
    '-derivedDataPath', path.join(output, 'DerivedData'),
    'CODE_SIGNING_ALLOWED=NO',
    'CODE_SIGNING_REQUIRED=NO',
    'CODE_SIGN_IDENTITY=',
    'build',
  ]);

  const products = path.join(output, 'DerivedData', 'Build', 'Products', 'Release-iphoneos');
  const apps = fs.readdirSync(products).filter((name) => name.endsWith('.app'));
  if (apps.length !== 1) {
    throw new Error(`Expected one iPhone app, found ${apps.length}.`);
  }
  const app = path.join(products, apps[0]);
  if (!fs.existsSync(path.join(app, 'main.jsbundle'))) {
    throw new Error('The Release app is missing main.jsbundle; refusing to package an app that needs Metro.');
  }

  // Use a fresh staging directory so reruns cannot include an older application.
  const staging = fs.mkdtempSync(path.join(output, 'package-'));
  const payload = path.join(staging, 'Payload');
  fs.mkdirSync(payload);
  run('ditto', [app, path.join(payload, apps[0])]);
  const ipa = path.join(output, 'app.ipa');
  run('ditto', ['-c', '-k', '--keepParent', 'Payload', ipa], staging);
  if (!fs.existsSync(ipa) || fs.statSync(ipa).size === 0) {
    throw new Error('The unsigned IPA was not generated.');
  }
  console.log(`Unsigned iPhone IPA ready: ${ipa}`);
  console.log('Sign this IPA before installing it on an iPhone.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
