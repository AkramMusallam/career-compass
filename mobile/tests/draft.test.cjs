const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDraftStore } = require('../src/services/draft');

function memoryStorage() {
  const values = new Map();
  return { values, getItemAsync: async (key) => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async (key) => { values.delete(key); } };
}

test('drafts survive reload, support unicode, and are isolated by user', async () => {
  const storage = memoryStorage();
  const first = createDraftStore(storage, 1);
  const draft = { stage: 'review', data: { extraction_id: 'a', text: 'مهارة😀'.repeat(200) }, skills: 'Python' };
  await first.save(draft);
  assert.deepEqual(await createDraftStore(storage, 1).load(), draft);
  assert.equal(await createDraftStore(storage, 2).load(), null);
  await first.clear();
  assert.equal(await first.load(), null);
});

test('failed draft update preserves the previous saved version', async () => {
  const storage = memoryStorage();
  const store = createDraftStore(storage, 1);
  await store.save({ version: 1 });
  const original = storage.setItemAsync;
  storage.setItemAsync = async (key, value) => { if (key.endsWith('.manifest')) throw new Error('storage failure'); return original(key, value); };
  await assert.rejects(store.save({ version: 2 }), /storage failure/);
  assert.deepEqual(await store.load(), { version: 1 });
});
