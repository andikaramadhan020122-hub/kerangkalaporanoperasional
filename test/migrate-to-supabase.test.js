const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialData } = require("../lib/data");
const { migrateStore, normalizeLocalStore } = require("../scripts/migrate-to-supabase");

test("local store validation preserves all report periods and rejects invalid periods", () => {
  const store = createInitialData();
  store.reports["2026-10"] = { bop: [], fuel: [] };
  assert.deepEqual(Object.keys(normalizeLocalStore(store).reports), ["2026-10"]);
  assert.throws(() => normalizeLocalStore({
    ...store,
    reports: { "October 2026": { bop: [], fuel: [] } }
  }), /Periode laporan/);
});

test("Supabase migration uploads only after checking an empty remote table", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const store = createInitialData();
  store.reports["2026-10"] = { bop: [], fuel: [] };
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return { status: 200, ok: true, async json() { return []; } };
    }
    return { status: 204, ok: true, async json() { return null; } };
  };

  const months = await migrateStore(store, "https://ett-test.supabase.co", "secret-test-key", true);
  assert.deepEqual(months, ["2026-10"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.apikey, "secret-test-key");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    id: "main",
    payload: store,
    updated_at: JSON.parse(calls[1].options.body).updated_at
  });
});

test("Supabase migration refuses to overwrite a populated remote table without confirmation", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let writes = 0;
  global.fetch = async () => {
    writes += 1;
    return { status: 200, ok: true, async json() { return [{ id: "main" }]; } };
  };
  await assert.rejects(
    migrateStore(createInitialData(), "https://ett-test.supabase.co", "secret-test-key", false),
    /dibatalkan/
  );
  assert.equal(writes, 1);
});
