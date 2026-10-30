const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline");
const { normalizeMaster, normalizeReport } = require("../lib/data");

const storePath = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "store.json");

function normalizeLocalStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.reports || typeof raw.reports !== "object" || Array.isArray(raw.reports)) {
    throw new Error("Struktur data/store.json tidak valid.");
  }
  const reports = {};
  for (const [month, report] of Object.entries(raw.reports)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Periode laporan ${month} tidak valid.`);
    reports[month] = normalizeReport(report);
  }
  return { master: normalizeMaster(raw.master), reports };
}

function promptLine(prompt) {
  if (!process.stdin.isTTY) return Promise.reject(new Error("Jalankan migrasi dari PowerShell/Terminal interaktif."));
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Jalankan migrasi dari PowerShell/Terminal interaktif."));
  }
  return new Promise((resolve, reject) => {
    readline.emitKeypressEvents(process.stdin);
    const previousRawMode = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(prompt);
    let value = "";
    const finish = (error) => {
      process.stdin.removeListener("keypress", onKeypress);
      process.stdin.setRawMode(previousRawMode);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") finish(new Error("Migrasi dibatalkan."));
      else if (key.name === "return" || key.name === "enter") finish();
      else if (key.name === "backspace") {
        if (value.length) process.stdout.write("\b \b");
        value = value.slice(0, -1);
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
        process.stdout.write("*".repeat(character.length));
      }
    };
    process.stdin.on("keypress", onKeypress);
  });
}

async function requestCloud(url, key, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke Supabase. Periksa jaringan dan URL project.");
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error("Tabel belum tersedia. Jalankan supabase/schema.sql di SQL Editor Supabase terlebih dahulu.");
    if (response.status === 401 || response.status === 403) throw new Error("Kunci Supabase tidak valid atau tidak memiliki izin.");
    throw new Error(`Supabase menolak permintaan migrasi (HTTP ${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function migrateStore(store, projectUrl, serviceRoleKey, confirmOverwrite) {
  const parsedUrl = new URL(projectUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("URL project harus berupa alamat HTTPS Supabase yang valid.");
  }
  if (!serviceRoleKey) throw new Error("Service role key wajib diisi.");
  const baseUrl = parsedUrl.origin;
  const tableUrl = `${baseUrl}/rest/v1/ett_app_state`;
  const existing = await requestCloud(`${tableUrl}?select=id&id=eq.main`, serviceRoleKey);
  if (Array.isArray(existing) && existing.length && !confirmOverwrite) {
    throw new Error("Data cloud sudah berisi laporan. Migrasi dibatalkan agar data cloud tidak tertimpa.");
  }
  await requestCloud(`${tableUrl}?on_conflict=id`, serviceRoleKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "main", payload: store, updated_at: new Date().toISOString() })
  });
  return Object.keys(store.reports).sort();
}

async function main() {
  const raw = JSON.parse(await fs.readFile(storePath, "utf8"));
  const store = normalizeLocalStore(raw);
  const projectUrl = await promptLine("Supabase Project URL: ");
  const serviceRoleKey = await promptSecret("Supabase service_role key (input disamarkan): ");
  const confirmation = await promptLine("Data laporan akan disalin ke Supabase. Ketik MIGRATE untuk melanjutkan: ");
  if (confirmation !== "MIGRATE") throw new Error("Migrasi dibatalkan; data lokal tidak diubah.");
  const months = await migrateStore(store, projectUrl, serviceRoleKey, true);
  process.stdout.write(`Migrasi selesai. ${months.length} periode laporan tersalin: ${months.join(", ")}.\n`);
  process.stdout.write("Database cloud diperbarui; data/store.json lokal tetap tidak berubah.\n");
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Migrasi Supabase gagal: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { migrateStore, normalizeLocalStore };
