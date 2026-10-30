const { createInitialData, normalizeMaster, normalizeReport } = require("../../lib/data");
const { createWorkbook } = require("../../lib/workbook");

const tableName = "ett_app_state";
const accessCookie = "ett_access";
const refreshCookie = "ett_refresh";
const refreshLifetime = 30 * 24 * 60 * 60;
const maximumBodyBytes = 2 * 1024 * 1024;

function jsonResponse(statusCode, value, options = {}) {
  const response = {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY"
    },
    body: JSON.stringify(value)
  };
  if (options.cookies?.length) response.multiValueHeaders = { "Set-Cookie": options.cookies };
  return response;
}

function configFromEnvironment() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ETT_ALLOWED_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !ETT_ALLOWED_EMAIL) {
    const error = new Error("Konfigurasi Supabase belum lengkap. Periksa environment variables Netlify.");
    error.statusCode = 503;
    throw error;
  }
  let projectUrl;
  try {
    projectUrl = new URL(SUPABASE_URL);
  } catch {
    const error = new Error("SUPABASE_URL tidak valid.");
    error.statusCode = 503;
    throw error;
  }
  if (projectUrl.protocol !== "https:" || projectUrl.username || projectUrl.password) {
    const error = new Error("SUPABASE_URL harus menggunakan HTTPS.");
    error.statusCode = 503;
    throw error;
  }
  return {
    baseUrl: projectUrl.origin,
    anonKey: SUPABASE_ANON_KEY,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    allowedEmail: ETT_ALLOWED_EMAIL.trim().toLocaleLowerCase("en-US")
  };
}

function requestPath(event) {
  const source = event.rawUrl || `https://${event.headers?.host || "localhost"}${event.path || "/"}`;
  let pathname = new URL(source).pathname;
  const prefixes = ["/.netlify/functions/api", "/api"];
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (pathname === prefix) {
        pathname = "/";
        changed = true;
        break;
      }
      if (pathname.startsWith(`${prefix}/`)) {
        pathname = pathname.slice(prefix.length);
        changed = true;
        break;
      }
    }
  }
  return pathname;
}

function parseCookies(event) {
  const value = event.headers?.cookie || event.headers?.Cookie || "";
  const cookies = new Map();
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    try {
      cookies.set(key, decodeURIComponent(cookieValue));
    } catch {
      continue;
    }
  }
  return cookies;
}

function sessionCookies(tokens) {
  const accessMaxAge = Math.max(60, Math.min(Number(tokens.expires_in) || 3600, 3600));
  return [
    `${accessCookie}=${encodeURIComponent(tokens.access_token)}; Path=/; Max-Age=${accessMaxAge}; HttpOnly; Secure; SameSite=Strict`,
    `${refreshCookie}=${encodeURIComponent(tokens.refresh_token)}; Path=/; Max-Age=${refreshLifetime}; HttpOnly; Secure; SameSite=Strict`
  ];
}

function clearSessionCookies() {
  return [
    `${accessCookie}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    `${refreshCookie}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
  ];
}

function trustedOrigin(event) {
  const origin = event.headers?.origin;
  const host = event.headers?.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function readBody(event, maximumBytes = maximumBodyBytes) {
  if (typeof event.body !== "string") return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
  if (raw.length > maximumBytes) {
    const error = new Error("Ukuran data terlalu besar.");
    error.statusCode = 413;
    throw error;
  }
  try {
    const body = JSON.parse(raw.toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    const error = new Error("Format permintaan tidak valid.");
    error.statusCode = 400;
    throw error;
  }
}

async function supabaseAuth(config, pathname, method = "GET", payload) {
  const response = await fetch(`${config.baseUrl}/auth/v1${pathname}`, {
    method,
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
      ...(payload?.accessToken ? { Authorization: `Bearer ${payload.accessToken}` } : {})
    },
    ...(payload?.body ? { body: JSON.stringify(payload.body) } : {})
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }
  return { response, result };
}

function authUnavailable() {
  const error = new Error("Layanan autentikasi sedang tidak tersedia.");
  error.statusCode = 503;
  return error;
}

async function verifyUser(config, accessToken) {
  const { response, result } = await supabaseAuth(config, "/user", "GET", { accessToken });
  if (response.ok) return result;
  if (response.status === 401 || response.status === 403) return null;
  throw authUnavailable();
}

async function refreshSession(config, refreshToken) {
  const { response, result } = await supabaseAuth(config, "/token?grant_type=refresh_token", "POST", {
    body: { refresh_token: refreshToken }
  });
  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok || !result.access_token || !result.refresh_token || !result.user) throw authUnavailable();
  if (String(result.user.email || "").toLocaleLowerCase("en-US") !== config.allowedEmail) return null;
  return result;
}

async function authenticatedSession(event, config) {
  const cookies = parseCookies(event);
  const accessToken = cookies.get(accessCookie);
  const refreshToken = cookies.get(refreshCookie);
  if (accessToken) {
    const user = await verifyUser(config, accessToken);
    if (user && String(user.email || "").toLocaleLowerCase("en-US") === config.allowedEmail) {
      return { user, cookies: [] };
    }
  }
  if (!refreshToken) return { user: null, cookies: clearSessionCookies() };
  const tokens = await refreshSession(config, refreshToken);
  if (!tokens) return { user: null, cookies: clearSessionCookies() };
  return { user: tokens.user, cookies: sessionCookies(tokens) };
}

function parseMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.reports || typeof raw.reports !== "object" || Array.isArray(raw.reports)) {
    throw new Error("Data laporan cloud memiliki format yang tidak valid.");
  }
  const master = normalizeMaster(raw.master);
  const reports = {};
  for (const [month, report] of Object.entries(raw.reports)) {
    if (!parseMonth(month)) throw new Error(`Periode laporan ${month} tidak valid.`);
    reports[month] = normalizeReport(report);
  }
  return { master, reports };
}

function databaseUrl(config) {
  return `${config.baseUrl}/rest/v1/${tableName}`;
}

async function databaseRequest(config, pathname, options = {}) {
  const response = await fetch(`${databaseUrl(config)}${pathname}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const error = new Error("Database Supabase gagal memproses permintaan. Periksa tabel dan izin database.");
    error.statusCode = response.status >= 500 ? 503 : 502;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function loadCloudStore(config) {
  const rows = await databaseRequest(config, "?select=payload&id=eq.main");
  if (!Array.isArray(rows)) throw new Error("Respons database Supabase tidak valid.");
  if (!rows.length) return createInitialData();
  return normalizeStore(rows[0].payload);
}

async function saveCloudReport(config, month, master, report) {
  await databaseRequest(config, "/rpc/save_ett_report", {
    method: "POST",
    body: JSON.stringify({ p_month: month, p_master: master, p_report: report })
  });
}

function queryParameter(event, name) {
  if (event.queryStringParameters?.[name]) return event.queryStringParameters[name];
  return new URL(event.rawUrl || `https://${event.headers?.host || "localhost"}${event.path || "/"}`)
    .searchParams.get(name);
}

async function route(event, config, pathname) {
  const method = event.httpMethod || "GET";

  if (pathname === "/session" && method === "GET") {
    const session = await authenticatedSession(event, config);
    return jsonResponse(200, { authenticated: Boolean(session.user), authMode: "email" }, { cookies: session.cookies });
  }

  if (pathname === "/login" && method === "POST") {
    if (!trustedOrigin(event)) return jsonResponse(403, { error: "Asal permintaan tidak diizinkan." });
    const { email, password } = readBody(event, 16 * 1024);
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return jsonResponse(400, { error: "Email dan kata sandi wajib diisi." });
    }
    if (email.trim().toLocaleLowerCase("en-US") !== config.allowedEmail) {
      return jsonResponse(401, { error: "Email atau kata sandi tidak benar." }, { cookies: clearSessionCookies() });
    }
    const { response, result } = await supabaseAuth(config, "/token?grant_type=password", "POST", {
      body: { email: email.trim(), password }
    });
    if (response.status === 400 || response.status === 401) {
      return jsonResponse(401, { error: "Email atau kata sandi tidak benar." }, { cookies: clearSessionCookies() });
    }
    if (!response.ok || !result.access_token || !result.refresh_token || !result.user) throw authUnavailable();
    if (String(result.user.email || "").toLocaleLowerCase("en-US") !== config.allowedEmail) {
      return jsonResponse(403, { error: "Akun ini tidak diizinkan mengakses laporan." }, { cookies: clearSessionCookies() });
    }
    return jsonResponse(200, { authenticated: true }, { cookies: sessionCookies(result) });
  }

  if (pathname === "/logout" && method === "POST") {
    if (!trustedOrigin(event)) return jsonResponse(403, { error: "Asal permintaan tidak diizinkan." });
    return jsonResponse(200, { authenticated: false }, { cookies: clearSessionCookies() });
  }

  const session = await authenticatedSession(event, config);
  if (!session.user) {
    return jsonResponse(401, { error: "Sesi berakhir. Silakan masuk kembali." }, { cookies: session.cookies });
  }

  if (pathname === "/data" && method === "GET") {
    const month = queryParameter(event, "month");
    if (!parseMonth(month)) return jsonResponse(400, { error: "Periode bulan tidak valid." }, { cookies: session.cookies });
    const store = await loadCloudStore(config);
    return jsonResponse(200, {
      master: store.master,
      report: store.reports[month] || { bop: [], fuel: [] },
      fuelHistory: Object.entries(store.reports).flatMap(([reportMonth, report]) =>
        reportMonth === month ? [] : report.fuel.map((row) => ({ ...row, month: reportMonth }))
      ),
      availableMonths: Object.keys(store.reports).sort()
    }, { cookies: session.cookies });
  }

  if (pathname === "/data" && method === "PUT") {
    if (!trustedOrigin(event)) return jsonResponse(403, { error: "Asal permintaan tidak diizinkan." }, { cookies: session.cookies });
    const month = queryParameter(event, "month");
    if (!parseMonth(month)) return jsonResponse(400, { error: "Periode bulan tidak valid." }, { cookies: session.cookies });
    const body = readBody(event);
    let report;
    try {
      report = normalizeReport(body.report);
    } catch (error) {
      return jsonResponse(400, { error: error.message }, { cookies: session.cookies });
    }
    let master;
    try {
      master = normalizeMaster(body.master);
    } catch (error) {
      return jsonResponse(400, { error: error.message }, { cookies: session.cookies });
    }
    await saveCloudReport(config, month, master, report);
    return jsonResponse(200, { saved: true }, { cookies: session.cookies });
  }

  if (pathname === "/export" && method === "GET") {
    const month = queryParameter(event, "month");
    if (!parseMonth(month)) return jsonResponse(400, { error: "Periode bulan tidak valid." }, { cookies: session.cookies });
    const store = await loadCloudStore(config);
    const workbook = await createWorkbook(store, month);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Laporan-Operasional-ETT-${month}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      },
      body: Buffer.from(workbook).toString("base64"),
      isBase64Encoded: true,
      ...(session.cookies.length ? { multiValueHeaders: { "Set-Cookie": session.cookies } } : {})
    };
  }

  return jsonResponse(404, { error: "Halaman tidak ditemukan." }, { cookies: session.cookies });
}

async function handler(event) {
  try {
    const config = configFromEnvironment();
    return await route(event, config, requestPath(event));
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) console.error("Netlify API error:", error.message);
    return jsonResponse(statusCode, {
      error: statusCode >= 500 ? error.message || "Layanan laporan tidak tersedia." : error.message
    });
  }
}

exports.handler = handler;
exports.parseMonth = parseMonth;
exports.requestPath = requestPath;
