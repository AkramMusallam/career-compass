const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('candidate profile requests include the selected job for isolated notes', () => {
  const requests = [];
  const source = fs.readFileSync(require.resolve('../src/api/endpoints.js'), 'utf8')
    .replace('import apiClient from "./client";', '')
    .replaceAll('export ', '');
  const context = { apiClient: { get: (url, options) => requests.push({ url, options }) } };
  vm.runInNewContext(source + '\ngetCandidateProfile("candidate-1", "job-2");', context);
  assert.equal(requests[0].url, '/recruiter/candidates/candidate-1/profile');
  assert.equal(requests[0].options.params.job_id, 'job-2');
});
