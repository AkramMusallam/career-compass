const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadEndpoints() {
  const calls = [];
  const source = fs.readFileSync(require.resolve('../src/api/endpoints.js'), 'utf8')
    .replace('import apiClient from "./client";', '')
    .replaceAll('export const ', 'var ');
  const context = {
    apiClient: {
      get: (url, options) => calls.push({ method: 'GET', url, options }),
      post: (url, body, options) => calls.push({ method: 'POST', url, body, options }),
      put: (url, body, options) => calls.push({ method: 'PUT', url, body, options }),
      patch: (url, body, options) => calls.push({ method: 'PATCH', url, body, options }),
      delete: (url, options) => calls.push({ method: 'DELETE', url, options }),
    },
  };
  vm.runInNewContext(source, context);
  return { ...context, calls };
}

test('endpoints enforce POST /shared/exchange, CAS company version, extension token, support approval, and logout', () => {
  const ep = loadEndpoints();
  ep.getSharedAnalysis('share-secret');
  ep.updateCompanyReviewStatus('comp-1', 'approved', 3);
  ep.approveSupportGrant('grant-9');
  ep.createExtensionToken();
  ep.logoutUser();
  ep.verifyEmail('verify-tok');

  const calls = JSON.parse(JSON.stringify(ep.calls));
  assert.deepEqual(calls[0], {
    method: 'POST',
    url: '/shared/exchange',
    body: { share_token: 'share-secret' },
  });
  assert.deepEqual(calls[1], {
    method: 'PATCH',
    url: '/companies/comp-1/status',
    body: { status: 'approved', expected_version: 3 },
  });
  assert.deepEqual(calls[2], {
    method: 'POST',
    url: '/support/grants/grant-9/approve',
  });
  assert.deepEqual(calls[3], {
    method: 'POST',
    url: '/extension/token',
  });
  assert.deepEqual(calls[4], {
    method: 'POST',
    url: '/logout',
  });
  assert.deepEqual(calls[5], {
    method: 'POST',
    url: '/verify-email',
    body: { token: 'verify-tok' },
  });
});

test('fragmentToken extracts hash token and scrubs URL via history.replaceState', () => {
  const replaced = [];
  const source = fs.readFileSync(require.resolve('../src/utils/fragmentToken.js'), 'utf8')
    .replaceAll('export ', '');
  const context = {
    URLSearchParams,
    Map,
    Date,
    window: {
      location: {
        pathname: '/reset-password',
        search: '',
        hash: '#token=reset-abc-123',
      },
      history: {
        replaceState: (state, title, url) => {
          replaced.push({ state, title, url });
          context.window.location.pathname = url;
          context.window.location.hash = '';
        },
      },
    },
  };
  vm.runInNewContext(source, context);
  const extracted = context.readFragmentToken({ paramToken: '', cleanPath: '/reset-password' });
  assert.equal(extracted, 'reset-abc-123');
  assert.deepEqual(JSON.parse(JSON.stringify(replaced)), [{ state: null, title: '', url: '/reset-password' }]);
});

test('chrome extension validateJwtToken requires extension_match and rejects access tokens', () => {
  const source = fs.readFileSync(require.resolve('../../chrome-extension/popup.js'), 'utf8');
  const listeners = {};
  const context = {
    URL,
    TextDecoder,
    Uint8Array,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    document: {
      addEventListener: (evt, fn) => { listeners[evt] = fn; },
      getElementById: () => null,
    },
    chrome: { storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } } },
  };
  vm.runInNewContext(source, context);

  const makeJwt = (payload) => {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
  };
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  const accessRes = context.validateJwtToken(makeJwt({ sub: '1', type: 'access', exp: futureExp }));
  assert.equal(accessRes.valid, false);
  assert.equal(accessRes.reason, 'wrong_type');

  const extRes = context.validateJwtToken(makeJwt({ sub: '1', type: 'extension_match', scope: 'extension:match', exp: futureExp }));
  assert.equal(extRes.valid, true);
});
