const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validApiUrl } = require('../scripts/check-build-env.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('release API requires an HTTPS URL without credentials or loopback', () => {
  assert.equal(validApiUrl('https://example.com/api'), true);
  for (const value of [undefined, 'http://example.com/api', 'https://localhost/api', 'https://127.0.0.1/api', 'https://user:pass@example.com/api', 'https://example.com/api?key=secret']) assert.equal(validApiUrl(value), false);
});

test('native app configuration references real PNG assets and both app identifiers', () => {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const splash = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  for (const asset of [config.icon, config.android.adaptiveIcon.foregroundImage, splash[1].image]) {
    const png = fs.readFileSync(path.join(root, asset));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1024);
    assert.equal(png.readUInt32BE(20), 1024);
  }
  assert.match(config.android.package, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
  assert.equal(config.android.package, config.ios.bundleIdentifier);
});
