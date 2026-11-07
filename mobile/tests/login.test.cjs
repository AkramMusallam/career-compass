const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadLogin(fetch, setTimeoutFn = setTimeout) {
  const source = fs.readFileSync(require.resolve('../src/services/api.js'), 'utf8')
    .replace('import { Platform } from "react-native";', 'const Platform = { OS: "android" };')
    .replaceAll('export ', '');
  const context = { fetch, setTimeout: setTimeoutFn, clearTimeout, AbortController, TypeError, FormData, process };
  vm.runInNewContext(source, context);
  return context;
}

test('login returns the access token', async () => {
  const { login } = loadLogin(async () => ({ ok: true, json: async () => ({ access_token: 'token' }) }));
  assert.equal((await login('a@example.com', 'password')).access_token, 'token');
});

test('login reports a timeout instead of remaining pending', async () => {
  const { login } = loadLogin((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), (callback) => setTimeout(callback, 0));
  await assert.rejects(login('a@example.com', 'password'), /تعذر الاتصال بالخادم/);
});

test('registration sends the name, email and password', async () => {
  let request;
  const { register } = loadLogin(async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({}) };
  });
  await register('Test User', 'a@example.com', 'Password1');
  assert.match(request.url, /\/register$/);
  assert.deepEqual(request.body, { full_name: 'Test User', email: 'a@example.com', password: 'Password1' });
});

test('password reset uses the recovery endpoint', async () => {
  let path;
  const { forgotPassword } = loadLogin(async (url) => {
    path = url;
    return { ok: true, json: async () => ({}) };
  });
  await forgotPassword('a@example.com');
  assert.match(path, /\/forgot-password$/);
});

test('analysis requests include authentication and the submitted data', async () => {
  let request;
  const { analysisRequest } = loadLogin(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ analysis_id: '123' }) };
  });
  const result = await analysisRequest('secret', '/analyze', { extraction_id: 'e', assessment_id: 'a' });
  assert.equal(result.analysis_id, '123');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.options.body), { extraction_id: 'e', assessment_id: 'a' });
});
