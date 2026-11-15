const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

// Exercise screen handlers with native widgets and APIs stubbed; device layout needs hardware QA.
function mountScreen(name, api, modules = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const alerts = [];
  const backHandlers = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useCallback: (fn) => fn,
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) {
        slots[index] = deps;
        effects.push(fn);
      }
    },
  };
  react.useRef = (initial) => {
    const [ref] = react.useState({ current: initial });
    return ref;
  };
  const native = Object.fromEntries(['View', 'Text', 'TextInput', 'ScrollView', 'ActivityIndicator', 'TouchableOpacity', 'Switch', 'KeyboardAvoidingView'].map((key) => [key, key]));
  native.StyleSheet = { create: (value) => value };
  native.BackHandler = { addEventListener: (_name, handler) => { backHandlers.push(handler); return { remove() {} }; } };
  native.Alert = { alert: (...args) => alerts.push(args) };
  native.Platform = { OS: 'ios' };
  const filename = path.join(__dirname, '../src/screens', name + '.js');
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') return native;
      if (id === '../services/api') return api;
      if (id in modules) return modules[id];
      if (id === '../components/AppButton' || id === './CompanyManagement') return id;
      throw new Error('Missing test module: ' + id);
    },
  });
  const props = { token: 'session', onBack() {}, onNavigate() {} };
  function render() {
    cursor = 0;
    tree = module.exports.default(props);
    const pending = effects; effects = [];
    pending.forEach((fn) => fn());
    return tree;
  }
  function nodes(node) {
    return node && typeof node === 'object' ? [node, ...(node.props?.children || []).flatMap(nodes)] : [];
  }
  render();
  return {
    props, alerts, back: () => backHandlers.at(-1)(),
    async settle() { await new Promise(setImmediate); render(); },
    nodes: () => nodes(tree),
    button: (title) => nodes(tree).find((node) => node.props.title === title),
  };
}

test('dashboard only shows platform management after a successful permission check', async () => {
  for (const status of [undefined, 401, 403, 500, 200]) {
    const screen = mountScreen('DashboardScreen', {
      companyRequest: async () => { if (status !== 200) throw Object.assign(new Error('offline'), { status }); return []; },
      fetchProfile: async () => ({}), fetchLatestRoadmap: async () => null,
    });
    await screen.settle();
    const shown = screen.nodes().some((node) => node.props.children.includes('إدارة المنصة'));
    assert.equal(shown, status === 200);
  }
});

test('candidate detail and edits use the selected company, job and current server notes', async () => {
  const calls = [];
  const screen = mountScreen('CompanyScreen', {
    fetchProfile: async () => ({ id: 1 }),
    companyRequest: async (_token, requestPath, company, method, body) => {
      calls.push({ requestPath, company, method, body });
      if (requestPath === '/companies/mine') return [{ company_id: 'company-1', status: 'approved', name: 'Company' }];
      if (requestPath === '/recruiter/jobs') return [{ job_id: 'job-1', title: 'Role', required_skills: [] }];
      if (requestPath.endsWith('/candidates')) return { candidates: [{ candidate_id: 'candidate-1', full_name: 'Candidate', matched_skills: [], pipeline_status: 'discovered', notes: 'stale' }] };
      if (requestPath.endsWith('/status')) return {};
      assert.equal(requestPath, '/recruiter/candidates/candidate-1/profile?job_id=job-1');
      return { pipeline_status: 'contacted', notes: 'current job note', skills: [], experience: [], education: [], projects: [] };
    },
  });
  await screen.settle();
  await screen.button('عرض وظائف الشركة').props.onPress(); await screen.settle();
  await screen.button('عرض المرشحين').props.onPress(); await screen.settle();
  await screen.button('عرض الملف والمتابعة').props.onPress(); await screen.settle();
  const notes = screen.nodes().find((node) => node.props.accessibilityLabel === 'ملاحظات المرشح');
  assert.equal(notes.props.value, 'current job note');
  notes.props.onChangeText('edited'); await screen.settle();
  await screen.button('حفظ المرحلة والملاحظات').props.onPress();
  assert.equal(calls.at(-1).company, 'company-1');
  assert.equal(calls.at(-1).requestPath, '/recruiter/jobs/job-1/candidates/candidate-1/status');
  assert.equal(calls.at(-1).body.pipeline_status, 'contacted');
  assert.equal(calls.at(-1).body.notes, 'edited');
});

test('a failed voice upload keeps the same recording available for retry', async () => {
  const uploads = [];
  let recordings = 0;
  const screen = mountScreen('MockInterviewScreen', {
    fetchLatestRoadmap: async () => ({ analysis_id: 'analysis', top_jobs: [{ job_title: 'Engineer' }] }),
    startMockInterview: async () => ({ session_id: 'interview', messages: [] }),
    sendVoiceAnswer: async (_token, _session, uri) => { uploads.push(uri); if (uploads.length === 1) throw new Error('offline'); return { messages: [] }; },
  }, {
    'expo-audio': {
      useAudioRecorder: () => ({ prepareToRecordAsync: async () => {}, record: () => recordings++, stop: async () => {}, uri: 'file:///answer.m4a' }),
      RecordingPresets: { HIGH_QUALITY: {} }, requestRecordingPermissionsAsync: async () => ({ granted: true }), setAudioModeAsync: async () => {},
    },
  });
  await screen.settle();
  await screen.nodes().find((node) => node.props.accessibilityLabel === 'بدء التسجيل الصوتي').props.onPress();
  await screen.settle();
  await screen.nodes().find((node) => node.props.accessibilityLabel === 'إيقاف وإرسال التسجيل').props.onPress();
  await screen.settle();
  assert.ok(screen.button('إعادة إرسال التسجيل'));
  await screen.button('إعادة إرسال التسجيل').props.onPress(); await screen.settle();
  assert.deepEqual(uploads, ['file:///answer.m4a', 'file:///answer.m4a']);
  assert.equal(recordings, 1);
  assert.equal(screen.button('إعادة إرسال التسجيل'), undefined);
});

test('account deletion requires confirmation and preserves the draft when deletion is refused', async () => {
  for (const status of [200, 409]) {
    const actions = [];
    const screen = mountScreen('ProfileScreen', {
      fetchProfile: async () => ({ id: 4, full_name: 'Candidate', email: 'candidate@example.com' }),
      getRecruiterConsent: async () => ({ opted_in: false }),
      companyRequest: async (_token, requestPath, _company, method) => {
        assert.equal(requestPath, '/profile'); assert.equal(method, 'DELETE');
        actions.push('delete');
        if (status === 409) throw Object.assign(new Error('owner'), { status });
        return {};
      },
    }, {
      'expo-secure-store': {},
      '../services/draft': { createDraftStore: (_storage, id) => ({ clear: async () => { assert.equal(id, 4); actions.push('clear'); } }) },
    });
    screen.props.onAccountDeleted = async () => actions.push('logout');
    await screen.settle();
    screen.button('حذف حسابي نهائيًا').props.onPress();
    assert.deepEqual(actions, []);
    await screen.alerts.at(-1)[2].find((action) => action.style === 'destructive').onPress();
    assert.deepEqual(actions, status === 200 ? ['delete', 'clear', 'logout'] : ['delete']);
  }
});

test('Android back returns from platform management after loading completes', async () => {
  let finish;
  let backs = 0;
  const screen = mountScreen('AdminScreen', { companyRequest: () => new Promise((resolve) => { finish = resolve; }) });
  screen.props.onBack = () => backs++;
  await screen.settle();
  assert.equal(screen.back(), true); assert.equal(backs, 0);
  finish([]); await screen.settle();
  assert.equal(screen.back(), true); assert.equal(backs, 1);
});

test('roadmap blocks Android back while saving and returns home afterwards', async () => {
  let finish;
  let backs = 0;
  const screen = mountScreen('RoadmapScreen', {
    fetchLatestRoadmap: async () => ({ analysis_id: 'analysis', roadmap: [{ month: 1, skills_to_learn: ['Python'] }] }),
    toggleMilestoneSkill: () => new Promise((resolve) => { finish = resolve; }),
  });
  screen.props.onBack = () => backs++;
  await screen.settle();
  screen.nodes().find((node) => node.props.accessibilityRole === 'checkbox').props.onPress();
  await screen.settle();
  assert.equal(screen.back(), true); assert.equal(backs, 0);
  finish({}); await screen.settle();
  assert.equal(screen.back(), true); assert.equal(backs, 1);
});
