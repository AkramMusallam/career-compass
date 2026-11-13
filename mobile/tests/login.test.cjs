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

test('profile update sends the authenticated name change', async () => {
  let request;
  const { updateProfile } = loadLogin(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ full_name: 'New Name' }) };
  });
  const result = await updateProfile('secret', 'New Name');
  assert.equal(result.full_name, 'New Name');
  assert.match(request.url, /\/profile$/);
  assert.equal(request.options.method, 'PUT');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.options.body), { full_name: 'New Name' });
});

test('company requests include the selected company and reject forbidden responses', async () => {
  let options;
  const { companyRequest } = loadLogin(async (_url, request) => {
    options = request;
    return { ok: false, status: 403 };
  });
  await assert.rejects(companyRequest('secret', '/recruiter/jobs', 'company-1'), /403/);
  assert.equal(options.headers.Authorization, 'Bearer secret');
  assert.equal(options.headers['X-Company-Id'], 'company-1');
});

test('job creation sends the selected company and job data', async () => {
  let request;
  const { companyRequest } = loadLogin(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ job_id: 'job-1' }) };
  });
  await companyRequest('secret', '/recruiter/jobs', 'company-1', 'POST', { title: 'Developer', required_skills: ['Python'] });
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['X-Company-Id'], 'company-1');
  assert.deepEqual(JSON.parse(request.options.body), { title: 'Developer', required_skills: ['Python'] });
});

test('candidate updates send the selected company and job-specific status', async () => {
  let request;
  const { companyRequest } = loadLogin(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({}) };
  });
  await companyRequest('secret', '/recruiter/jobs/job-1/candidates/candidate-1/status', 'company-1', 'POST', { pipeline_status: 'shortlisted', notes: 'Follow up' });
  assert.match(request.url, /\/jobs\/job-1\/candidates\/candidate-1\/status$/);
  assert.equal(request.options.headers['X-Company-Id'], 'company-1');
  assert.deepEqual(JSON.parse(request.options.body), { pipeline_status: 'shortlisted', notes: 'Follow up' });
});

test('team invitation uses the owner endpoint and reports delivery status', async () => {
  let request;
  const { companyRequest } = loadLogin(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ delivery: 'failed' }) };
  });
  const result = await companyRequest('secret', '/companies/company-1/invitations', null, 'POST', { email: 'member@example.com' });
  assert.equal(result.delivery, 'failed');
  assert.match(request.url, /\/companies\/company-1\/invitations$/);
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.options.body), { email: 'member@example.com' });
});

test('owner review exposes authorization errors and submits status changes', async () => {
  let options;
  const { companyRequest } = loadLogin(async (_url, request) => {
    options = request;
    return request.method === 'GET' ? { ok: false, status: 403 } : { ok: true, json: async () => ({ status: 'approved' }) };
  });
  await assert.rejects(companyRequest('secret', '/companies/review'), (error) => error.status === 403);
  const result = await companyRequest('secret', '/companies/c1/status', null, 'PATCH', { status: 'approved' });
  assert.equal(result.status, 'approved');
  assert.equal(options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(options.body), { status: 'approved' });
});

test('analysis errors retain the server status for safe retry handling', async () => {
  const { analysisRequest } = loadLogin(async () => ({ ok: false, status: 401 }));
  await assert.rejects(analysisRequest('secret', '/assessment'), (error) => error.status === 401 && error.message.includes('الجلسة'));
});

test('only authenticated unauthorized responses notify the current session', async () => {
  const { analysisRequest, login, setUnauthorizedHandler } = loadLogin(async () => ({ ok: false, status: 401 }));
  const expired = [];
  setUnauthorizedHandler((token) => expired.push(token));
  await assert.rejects(login('a@example.com', 'bad'));
  assert.deepEqual(expired, []);
  await assert.rejects(analysisRequest('active-token', '/assessment'));
  assert.deepEqual(expired, ['active-token']);
});

test('roadmap save times out rather than waiting indefinitely', async () => {
  const { toggleMilestoneSkill } = loadLogin((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), (callback) => setTimeout(callback, 0));
  await assert.rejects(toggleMilestoneSkill('secret', 'analysis', 'Python', true), /aborted/);
});

test('profile fetch is bounded when the server is unreachable', async () => {
  const { fetchProfile } = loadLogin((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), (callback) => setTimeout(callback, 0));
  await assert.rejects(fetchProfile('secret'), /aborted/);
});

test('recruiter sharing is read and changed explicitly for the signed-in user', async () => {
  const calls = [];
  const { getRecruiterConsent, updateRecruiterConsent } = loadLogin(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ opted_in: options.method === 'PUT' }) };
  });
  assert.equal((await getRecruiterConsent('secret')).opted_in, false);
  assert.equal((await updateRecruiterConsent('secret', true)).opted_in, true);
  await updateRecruiterConsent('secret', false);
  assert.match(calls[0].url, /\/settings\/recruiter-consent$/);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(calls[1].options.body), { opted_in: true });
  assert.deepEqual(JSON.parse(calls[2].options.body), { opted_in: false });
});
