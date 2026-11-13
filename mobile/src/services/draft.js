const CHUNK_SIZE = 400;
const MAX_CHUNKS = 200;

function createDraftStore(storage, userId) {
  if (!/^\d+$/.test(String(userId))) throw new Error("Invalid user ID");
  const prefix = `analysisDraft.${userId}`;
  const manifestKey = `${prefix}.manifest`;
  let queue = Promise.resolve();
  const key = (id, index) => `${prefix}.${id}.${index}`;
  const removeChunks = async (manifest) => {
    if (!manifest || !/^\d+$/.test(manifest.id) || !Number.isInteger(manifest.count) || manifest.count < 0 || manifest.count > MAX_CHUNKS) return;
    for (let i = 0; i < manifest.count; i++) await storage.deleteItemAsync(key(manifest.id, i));
  };
  const manifest = async () => {
    const value = await storage.getItemAsync(manifestKey);
    if (!value) return null;
    const result = JSON.parse(value);
    if (!/^\d+$/.test(result.id) || !Number.isInteger(result.count) || result.count < 1 || result.count > MAX_CHUNKS) throw new Error("Invalid draft");
    return result;
  };
  const serial = (operation) => {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  };
  return {
    load: () => serial(async () => {
      const current = await manifest();
      if (!current) return null;
      const parts = [];
      for (let i = 0; i < current.count; i++) {
        const part = await storage.getItemAsync(key(current.id, i));
        if (part == null) throw new Error("Incomplete draft");
        parts.push(part);
      }
      return JSON.parse(parts.join(""));
    }),
    save: (draft) => serial(async () => {
      const characters = Array.from(JSON.stringify(draft));
      const count = Math.ceil(characters.length / CHUNK_SIZE);
      if (count > MAX_CHUNKS) throw new Error("Draft too large");
      const old = await manifest();
      const id = String(Math.max(Date.now(), Number(old?.id || 0) + 1));
      const next = { id, count };
      try {
        for (let i = 0; i < count; i++) await storage.setItemAsync(key(id, i), characters.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).join(""));
        await storage.setItemAsync(manifestKey, JSON.stringify(next));
      } catch (error) { await removeChunks(next).catch(() => {}); throw error; }
      await removeChunks(old).catch(() => {});
    }),
    clear: () => serial(async () => {
      const old = await manifest();
      await storage.deleteItemAsync(manifestKey);
      await removeChunks(old);
    }),
  };
}

module.exports = { createDraftStore };
