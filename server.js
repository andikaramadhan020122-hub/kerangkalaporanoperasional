const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const { execFile } = require("node:child_process");
const { randomBytes, scryptSync, timingSafeEqual, randomUUID } = require("node:crypto");
const selfsigned = require("selfsigned");
const { createInitialData, normalizeMaster, normalizeReport } = require("./lib/data");
const { createWorkbook } = require("./lib/workbook");

const root = __dirname;
const publicDirectory = path.join(root, "public");
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const storePath = path.join(dataDirectory, "store.json");
const authPath = path.join(dataDirectory, "auth.json");
const keyPath = path.join(dataDirectory, "tls-key.pem");
const certificatePath = path.join(dataDirectory, "tls-cert.pem");
const sessionLifetime = 8 * 60 * 60 * 1000;
const loginWindow = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const allowedHostnames = new Set(["127.0.0.1", "localhost", os.hostname().toLowerCase()]);
let allowedPort = Number(process.env.PORT || 3443);
const sessions = new Map();
const loginAttempts = new Map();
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/fuel-utils.js", ["fuel-utils.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/company-logo.png", ["company-logo.png", "image/png"]]
]);

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  response.setHeader("Cache-Control", "no-store");
}

function hostIsAllowed(hostHeader, port = allowedPort, hostnames = allowedHostnames) {
  if (typeof hostHeader !== "string") return false;
  try {
    const parsed = new URL(`https://${hostHeader}`);
    return parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.port === String(port) &&
      hostnames.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function originIsTrusted(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  return hostIsAllowed(host) && typeof origin === "string" && origin === `https://${host}`;
}

function getSessionId(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("ett_session="));
  return match ? match.slice("ett_session=".length) : "";
}

function authenticated(request) {
  const id = getSessionId(request);
  const expiry = sessions.get(id);
  if (!expiry || expiry < Date.now()) {
    if (id) sessions.delete(id);
    return false;
  }
  return true;
}

function setSessionCookie(response, id) {
  response.setHeader("Set-Cookie", `ett_session=${id}; Path=/; Max-Age=${sessionLifetime / 1000}; HttpOnly; Secure; SameSite=Strict`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "ett_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");
}

function remoteAddress(request) {
  return (request.socket.remoteAddress || "").replace(/^::ffff:/, "");
}

function existingApplicationIsRunning(port) {
  return new Promise((resolve) => {
    const request = https.get({
      hostname: "127.0.0.1",
      port,
      path: "/api/session",
      headers: { Host: `127.0.0.1:${port}` },
      rejectUnauthorized: false,
      timeout: 1500
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2048) request.destroy();
      });
      response.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve(response.statusCode === 200 && typeof result.authenticated === "boolean");
        } catch {
          resolve(false);
        }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

function openBrowser(url) {
  execFile("rundll32.exe", ["url.dll,FileProtocolHandler", url], (error) => {
    if (error) {
      process.stderr.write(`Browser tidak dapat dibuka otomatis. Buka tautan ini: ${url}\n`);
    } else {
      process.stdout.write(`Browser dibuka: ${url}\n`);
    }
  });
}

function checkPin(pin, auth) {
  if (typeof pin !== "string" || !/^\d{6,12}$/.test(pin)) return false;
  const savedHash = Buffer.from(auth.hash, "base64");
  const submittedHash = scryptSync(pin, Buffer.from(auth.salt, "base64"), 64);
  return savedHash.length === submittedHash.length && timingSafeEqual(savedHash, submittedHash);
}

function parseMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeStoredData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.reports || typeof raw.reports !== "object" || Array.isArray(raw.reports)) {
    throw new Error("File data laporan memiliki format yang tidak valid.");
  }
  const master = normalizeMaster(raw.master);
  const reports = {};
  for (const [month, report] of Object.entries(raw.reports)) {
    if (!parseMonth(month)) throw new Error(`Periode laporan ${month} tidak valid.`);
    reports[month] = normalizeReport(report);
  }
  return { master, reports };
}

async function loadStore() {
  try {
    return normalizeStoredData(JSON.parse(await fs.readFile(storePath, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return createInitialData();
    throw error;
  }
}

async function saveStore(store) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${storePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  try {
    await fs.rename(temporaryPath, storePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function readJson(request, maximumBytes = 2 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error("Ukuran data terlalu besar.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Format permintaan tidak valid.");
    error.statusCode = 400;
    throw error;
  }
}

function validRequestSession(request, response) {
  if (!authenticated(request)) {
    sendError(response, 401, "Sesi berakhir. Silakan masuk kembali.");
    return false;
  }
  return true;
}

async function serveStatic(response, pathname) {
  const entry = staticFiles.get(pathname);
  if (!entry) {
    sendError(response, 404, "Halaman tidak ditemukan.");
    return;
  }
  const filePath = path.join(publicDirectory, entry[0]);
  const content = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": entry[1],
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "Cache-Control": "no-cache"
  });
  response.end(content);
}

async function handleRequest(request, response) {
  setSecurityHeaders(response);
  if (!hostIsAllowed(request.headers.host)) {
    sendError(response, 421, "Alamat host tidak diizinkan.");
    return;
  }
  let url;
  try {
    url = new URL(request.url, "https://localhost");
  } catch {
    sendError(response, 400, "Alamat permintaan tidak valid.");
    return;
  }

  if (request.method === "GET" && staticFiles.has(url.pathname)) {
    await serveStatic(response, url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    sendJson(response, 200, { authenticated: authenticated(request), authMode: "pin" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    if (!originIsTrusted(request)) {
      sendError(response, 403, "Asal permintaan tidak diizinkan.");
      return;
    }
    const address = remoteAddress(request);
    const prior = loginAttempts.get(address);
    if (prior && prior.blockedUntil > Date.now()) {
      sendError(response, 429, "Terlalu banyak percobaan. Coba lagi setelah 15 menit.");
      return;
    }
    const auth = JSON.parse(await fs.readFile(authPath, "utf8"));
    const body = await readJson(request, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body) || !checkPin(body.pin, auth)) {
      const attempts = prior && prior.startedAt > Date.now() - loginWindow ? prior.count + 1 : 1;
      loginAttempts.set(address, {
        count: attempts,
        startedAt: prior && prior.startedAt > Date.now() - loginWindow ? prior.startedAt : Date.now(),
        blockedUntil: attempts >= maxLoginAttempts ? Date.now() + loginWindow : 0
      });
      sendError(response, attempts >= maxLoginAttempts ? 429 : 401, "PIN tidak benar.");
      return;
    }
    loginAttempts.delete(address);
    for (const [id, expiry] of sessions) {
      if (expiry < Date.now()) sessions.delete(id);
    }
    const id = randomBytes(32).toString("base64url");
    sessions.set(id, Date.now() + sessionLifetime);
    setSessionCookie(response, id);
    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    if (!originIsTrusted(request)) {
      sendError(response, 403, "Asal permintaan tidak diizinkan.");
      return;
    }
    sessions.delete(getSessionId(request));
    clearSessionCookie(response);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (url.pathname === "/api/data" && request.method === "GET") {
    if (!validRequestSession(request, response)) return;
    const month = url.searchParams.get("month");
    if (!parseMonth(month)) {
      sendError(response, 400, "Periode bulan tidak valid.");
      return;
    }
    const store = await loadStore();
    sendJson(response, 200, {
      master: store.master,
      report: store.reports[month] || { bop: [], fuel: [] },
      fuelHistory: Object.entries(store.reports).flatMap(([reportMonth, report]) =>
        reportMonth === month ? [] : report.fuel.map((row) => ({ ...row, month: reportMonth }))
      ),
      availableMonths: Object.keys(store.reports).sort()
    });
    return;
  }

  if (url.pathname === "/api/data" && request.method === "PUT") {
    if (!validRequestSession(request, response)) return;
    if (!originIsTrusted(request)) {
      sendError(response, 403, "Asal permintaan tidak diizinkan.");
      return;
    }
    const month = url.searchParams.get("month");
    if (!parseMonth(month)) {
      sendError(response, 400, "Periode bulan tidak valid.");
      return;
    }
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendError(response, 400, "Data laporan tidak valid.");
      return;
    }
    let master;
    let report;
    try {
      master = normalizeMaster(body.master);
      report = normalizeReport(body.report);
    } catch (error) {
      sendError(response, 400, error.message);
      return;
    }
    const store = await loadStore();
    store.master = master;
    store.reports[month] = report;
    await saveStore(store);
    sendJson(response, 200, { saved: true });
    return;
  }

  if (url.pathname === "/api/export" && request.method === "GET") {
    if (!validRequestSession(request, response)) return;
    const month = url.searchParams.get("month");
    if (!parseMonth(month)) {
      sendError(response, 400, "Periode bulan tidak valid.");
      return;
    }
    const store = await loadStore();
    const file = await createWorkbook(store, month);
    response.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Operasional-ETT-${month}.xlsx"`,
      "Content-Length": file.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(file);
    return;
  }

  sendError(response, 404, "Halaman tidak ditemukan.");
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

function privateAddresses() {
  const found = new Set();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : `IPv${entry.family}`;
      if (!entry.internal && family === "IPv4" && isPrivateIPv4(entry.address)) {
        found.add(entry.address);
      }
    }
  }
  return [...found];
}

async function tlsCredentials(addresses) {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    const [key, cert] = await Promise.all([
      fs.readFile(keyPath, "utf8"),
      fs.readFile(certificatePath, "utf8")
    ]);
    return { key, cert };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const host = os.hostname();
  const altNames = [
    { type: 2, value: "localhost" },
    { type: 2, value: host },
    { type: 7, ip: "127.0.0.1" },
    ...addresses.map((address) => ({ type: 7, ip: address }))
  ];
  const generated = await selfsigned.generate(
    [{ name: "commonName", value: host }],
    {
      keySize: 2048,
      notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
        { name: "extKeyUsage", serverAuth: true },
        { name: "subjectAltName", altNames }
      ]
    }
  );
  await Promise.all([
    fs.writeFile(keyPath, generated.private, { mode: 0o600 }),
    fs.writeFile(certificatePath, generated.cert, { mode: 0o600 })
  ]);
  return { key: generated.private, cert: generated.cert };
}

async function start() {
  try {
    await fs.access(authPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error("PIN belum diatur. Jalankan npm run setup dari komputer host, lalu npm start.");
  }

  const port = Number(process.env.PORT || 3443);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("PORT harus berupa angka antara 1024 dan 65535.");
  }
  allowedPort = port;
  const addresses = privateAddresses();
  for (const address of addresses) allowedHostnames.add(address.toLowerCase());
  const credentials = await tlsCredentials(addresses);
  const listenAddresses = ["127.0.0.1", ...addresses];
  const activeServers = new Set();
  let localAddressFailed = false;
  for (const address of listenAddresses) {
    const server = https.createServer(credentials, (request, response) => {
      handleRequest(request, response).catch((error) => {
        process.stderr.write(`Permintaan gagal: ${error.message}\n`);
        if (!response.headersSent) {
          sendError(response, error.statusCode || 500, error.statusCode ? error.message : "Terjadi kesalahan saat memproses permintaan.");
        }
        else response.destroy();
      });
    });
    server.on("error", (error) => {
      if (address === "127.0.0.1") {
        localAddressFailed = true;
        process.stderr.write(`Server tidak dapat dijalankan pada ${address}:${port}: ${error.message}\n`);
        if (error.code === "EADDRINUSE") {
          process.stderr.write("Memeriksa apakah aplikasi ETT sudah berjalan...\n");
          existingApplicationIsRunning(port).then((isRunning) => {
            if (isRunning) {
              const url = `https://127.0.0.1:${port}`;
              process.stdout.write("Aplikasi ETT sudah aktif.\n");
              if (process.argv.includes("--open")) {
                process.stdout.write("Membuka halaman aplikasi yang sedang berjalan.\n");
                openBrowser(url);
              }
              return;
            }
            process.exitCode = 1;
            process.stderr.write(`Port ${port} sedang digunakan aplikasi lain. Tutup aplikasi tersebut atau ubah port sebelum menjalankan web ETT.\n`);
          });
        } else {
          process.exitCode = 1;
        }
        for (const activeServer of activeServers) activeServer.close();
      } else {
        process.stderr.write(`Alamat LAN ${address}:${port} tidak tersedia: ${error.message}\n`);
      }
    });
    server.listen(port, address, () => {
      if (localAddressFailed) {
        server.close();
        return;
      }
      activeServers.add(server);
      process.stdout.write(`Web siap: https://${address}:${port}\n`);
      if (address === "127.0.0.1" && process.argv.includes("--open")) {
        openBrowser(`https://127.0.0.1:${port}`);
      }
    });
  }
  if (addresses.length === 0) {
    process.stdout.write("Tidak ditemukan alamat IPv4 LAN pribadi. Web hanya tersedia di komputer host.\n");
  }
}

if (require.main === module) {
  start().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseMonth, normalizeStoredData, hostIsAllowed };
