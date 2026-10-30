const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline");
const { scryptSync, randomBytes, timingSafeEqual } = require("node:crypto");

const dataDirectory = path.join(__dirname, "data");
const authPath = path.join(dataDirectory, "auth.json");

function readSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Jalankan perintah ini langsung dari terminal interaktif."));
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
      if (key.ctrl && key.name === "c") {
        finish(new Error("Setup dibatalkan."));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
      } else if (key.name === "backspace") {
        if (value.length > 0) process.stdout.write("\b \b");
        value = value.slice(0, -1);
      } else if (/^\d$/.test(character || "") && value.length < 12) {
        value += character;
        process.stdout.write("*");
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

function encodePin(pin, salt) {
  return scryptSync(pin, salt, 64).toString("base64");
}

function isValidPin(pin) {
  return /^\d{6,12}$/.test(pin);
}

async function main() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const changing = process.argv.includes("--change");
  let existing = null;
  try {
    existing = JSON.parse(await fs.readFile(authPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (existing && !changing) {
    throw new Error("PIN sudah diatur. Gunakan perintah npm run change-pin untuk menggantinya.");
  }
  if (!existing && changing) {
    throw new Error("PIN belum diatur. Jalankan npm run setup terlebih dahulu.");
  }
  if (existing) {
    const currentPin = await readSecret("PIN saat ini (input tampil sebagai *): ");
    const currentHash = Buffer.from(encodePin(currentPin, Buffer.from(existing.salt, "base64")), "base64");
    const savedHash = Buffer.from(existing.hash, "base64");
    if (currentHash.length !== savedHash.length || !timingSafeEqual(currentHash, savedHash)) {
      throw new Error("PIN saat ini tidak cocok.");
    }
  }

  const pin = await readSecret("Buat PIN baru (6–12 angka, input tampil sebagai *): ");
  if (!isValidPin(pin)) throw new Error("PIN harus terdiri dari 6 sampai 12 angka.");
  const confirmation = await readSecret("Ulangi PIN (input tampil sebagai *): ");
  if (pin !== confirmation) throw new Error("PIN tidak cocok.");

  const salt = randomBytes(16);
  const auth = {
    version: 1,
    salt: salt.toString("base64"),
    hash: encodePin(pin, salt)
  };
  await fs.writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(existing ? "PIN berhasil diperbarui.\n" : "PIN berhasil diatur. Jalankan npm start untuk membuka web.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
