const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareReview } = require('../src/services/review');

test('review preserves edited fields and converts numbers and technologies', () => {
  const data = { extraction_id: 'e', projects: [{ title: ' App ', description: 'details', technologies: 'Python، React' }], education: [{ degree: 'BSc', institution: 'University', year: '2020' }], experience: [{ title: 'Dev', company: 'Company', duration_months: '12', description: 'work' }] };
  const result = prepareReview(data, ['Python']);
  assert.deepEqual(result.projects[0], { title: 'App', description: 'details', technologies: ['Python', 'React'] });
  assert.equal(result.education[0].year, 2020);
  assert.equal(result.experience[0].duration_months, 12);
  assert.equal(data.education[0].year, '2020');
});

test('review rejects incomplete records and invalid numbers', () => {
  const data = { extraction_id: 'e', projects: [], education: [{ degree: 'BSc', institution: '', year: '2x' }], experience: [] };
  assert.throws(() => prepareReview(data, ['Python']), /سنة التخرج/);
  data.education[0].year = '';
  data.projects.push({ title: ' ', technologies: [] });
  assert.throws(() => prepareReview(data, ['Python']), /اسم المشروع/);
});
