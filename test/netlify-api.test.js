const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialData } = require("../lib/data");
const { handler, requestPath } = require("../netlify/functions/api");

const environmentKeys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ETT_ALLOWED_EMAIL"];
const allowedUser = { id: "user-1", email: "private@example.com" };

function fakeResponse(status, value) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return value; }
  };
}

function configureEnvironment(t) {
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SUPABASE_URL: "https://ett-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    ETT_ALLOWED_EMAIL: allowedUser.email
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("Netlify API normalizes direct and redirected route paths", () => {
  assert.equal(requestPath({ rawUrl: "https://site.netlify.app/api/data?month=2026-10" }), "/data");
  assert.equal(requestPath({ path: "/.netlify/functions/api/data", headers: { host: "site.netlify.app" } }), "/data");
  assert.equal(requestPath({ path: "/.netlify/functions/api/api/export", headers: { host: "site.netlify.app" } }), "/export");
});

test("Netlify session remains unauthenticated when no session cookies are present", async (t) => {
  configureEnvironment(t);
  const result = await handler({
    httpMethod: "GET",
    rawUrl: "https://site.netlify.app/api/session",
    headers: { host: "site.netlify.app" }
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { authenticated: false, authMode: "email" });
  assert.equal(result.multiValueHeaders["Set-Cookie"].length, 2);
});

test("Netlify login sets secure HTTP-only cookies only for the configured email", async (t) => {
  configureEnvironment(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let authRequest;
  global.fetch = async (url, options) => {
    authRequest = { url: String(url), options };
    return fakeResponse(200, {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      user: allowedUser
    });
  };

  const result = await handler({
    httpMethod: "POST",
    rawUrl: "https://site.netlify.app/api/login",
    headers: { host: "site.netlify.app", origin: "https://site.netlify.app" },
    body: JSON.stringify({ email: allowedUser.email, password: "example-password" })
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { authenticated: true });
  assert.match(authRequest.url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.deepEqual(JSON.parse(authRequest.options.body), { email: allowedUser.email, password: "example-password" });
  assert.equal(result.multiValueHeaders["Set-Cookie"].length, 2);
  assert.ok(result.multiValueHeaders["Set-Cookie"].every((cookie) =>
    cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=Strict")
  ));
});

test("Netlify login rejects an email outside the private allowlist without calling Supabase", async (t) => {
  configureEnvironment(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => { throw new Error("Supabase should not be called"); };
  const result = await handler({
    httpMethod: "POST",
    rawUrl: "https://site.netlify.app/api/login",
    headers: { host: "site.netlify.app", origin: "https://site.netlify.app" },
    body: JSON.stringify({ email: "other@example.com", password: "example-password" })
  });
  assert.equal(result.statusCode, 401);
  assert.equal(JSON.parse(result.body).error, "Email atau kata sandi tidak benar.");
});

test("Netlify data requests verify the account and use the server-only database key", async (t) => {
  configureEnvironment(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const store = createInitialData();
  store.reports["2026-10"] = { bop: [], fuel: [] };
  let databaseRequest;
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/auth/v1/user")) return fakeResponse(200, allowedUser);
    databaseRequest = { url: String(url), options };
    return fakeResponse(200, [{ payload: store }]);
  };

  const result = await handler({
    httpMethod: "GET",
    rawUrl: "https://site.netlify.app/api/data?month=2026-10",
    headers: { host: "site.netlify.app", cookie: "ett_access=valid-access" }
  });

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.master.vehicles.length, 16);
  assert.deepEqual(body.report, { bop: [], fuel: [] });
  assert.equal(databaseRequest.options.headers.apikey, "test-service-role");
  assert.equal(databaseRequest.url, "https://ett-test.supabase.co/rest/v1/ett_app_state?select=payload&id=eq.main");
});

test("Netlify saves report changes through the atomic month-specific database function", async (t) => {
  configureEnvironment(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const store = createInitialData();
  let writeRequest;
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/auth/v1/user")) return fakeResponse(200, allowedUser);
    writeRequest = { url: String(url), options };
    return fakeResponse(204, null);
  };

  const result = await handler({
    httpMethod: "PUT",
    rawUrl: "https://site.netlify.app/api/data?month=2026-10",
    headers: {
      host: "site.netlify.app",
      origin: "https://site.netlify.app",
      cookie: "ett_access=valid-access"
    },
    body: JSON.stringify({ master: store.master, report: { bop: [], fuel: [] } })
  });

  assert.equal(result.statusCode, 200);
  assert.equal(writeRequest.url, "https://ett-test.supabase.co/rest/v1/ett_app_state/rpc/save_ett_report");
  assert.equal(writeRequest.options.headers.apikey, "test-service-role");
  assert.deepEqual(JSON.parse(writeRequest.options.body), {
    p_month: "2026-10",
    p_master: store.master,
    p_report: { bop: [], fuel: [] }
  });
});
