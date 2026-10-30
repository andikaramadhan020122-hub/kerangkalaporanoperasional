const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { createInitialData, normalizeMaster, normalizeReport } = require("../lib/data");

const root = path.resolve(__dirname, "..");
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const storePath = path.join(dataDirectory, "store.json");
const defaultSourceDirectory = "Z:\\KERANGKA LAPORAN OPERASIONAL BULANAN\\BERKAS DATA PT. ETT BOGOR\\2026";
const months = [
  ["2026-06", "LAPORAN OPERASIONAL PER BULAN JUNI PT. ETT BOGOR.xlsx"],
  ["2026-07", "LAPORAN OPERASIONAL PER BULAN JULI PT. ETT BOGOR.xlsx"],
  ["2026-08", "LAPORAN OPERASIONAL PER BULAN PT. ETT BOGOR AGUSTUS 2026.xlsx"],
  ["2026-09", "LAPORAN OPERASIONAL PER BULAN PT. ETT BOGOR SEPTEMBER 2026.xlsx"],
  ["2026-10", "LAPORAN OPERASIONAL PER BULAN OKTOBER PT. ETT BOGOR.xlsx"]
];

const bopColumns = ["Tanggal", "NO", "NAMA", "NOMOR POLISI", "TYPE ARMADA", "TUJUAN", "TANGGAL LAPOR"];
const fuelColumns = ["TGL LAPOR", "NO", "NAMA", "NOMOR POLISI", "TYPE ARMADA", "TUJUAN", "TANGGAL ISI"];

function valueOf(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value) {
      const result = value.result ?? "";
      return result && typeof result === "object" && "error" in result ? "" : result;
    }
    if ("error" in value) return "";
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((item) => item.text).join("");
    return "";
  }
  return value;
}

function textValue(cell) {
  const value = valueOf(cell);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function dateValue(cell) {
  const value = valueOf(cell);
  if (value === "" || value === null || value === undefined) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  const candidate = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(candidate);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  throw new Error(`Tanggal Excel tidak dikenali: ${candidate}`);
}

function numberValue(cell) {
  const value = valueOf(cell);
  if (value === "" || value === null || value === undefined || (typeof value === "object" && "error" in value)) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isReportRow(row) {
  const sequence = numberValue(row.getCell(2));
  const driver = textValue(row.getCell(3));
  const plate = textValue(row.getCell(4));
  return sequence !== null && sequence > 0 && (driver !== "" || plate !== "");
}

function validateHeaders(sheet, expected) {
  if (!sheet) throw new Error("Sheet laporan yang diperlukan tidak ditemukan.");
  for (const [index, expectedValue] of expected.entries()) {
    const actual = textValue(sheet.getCell(4, index + 1)).toLocaleUpperCase("id-ID");
    if (actual !== expectedValue.toLocaleUpperCase("id-ID")) {
      throw new Error(`Header ${sheet.name}!${sheet.getCell(4, index + 1).address} tidak sesuai: diharapkan "${expectedValue}", ditemukan "${actual}".`);
    }
  }
}

function importBop(sheet, month) {
  validateHeaders(sheet, bopColumns);
  const records = [];
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!isReportRow(row)) continue;
    records.push({
      id: `import-${month}-bop-row-${rowNumber}`,
      date: dateValue(row.getCell(1)),
      driver: textValue(row.getCell(3)),
      plate: textValue(row.getCell(4)),
      type: textValue(row.getCell(5)),
      destination: textValue(row.getCell(6)),
      reportDate: dateValue(row.getCell(7)),
      parking: numberValue(row.getCell(8)),
      loading: numberValue(row.getCell(9)),
      unloading: numberValue(row.getCell(10)),
      maintenance: numberValue(row.getCell(11)),
      escort: numberValue(row.getCell(12)),
      illegalLevy: numberValue(row.getCell(13)),
      kir: numberValue(row.getCell(14)),
      organda: numberValue(row.getCell(15)),
      other: numberValue(row.getCell(16)),
      note: textValue(row.getCell(18))
    });
  }
  return records;
}

function importFuel(sheet, month) {
  validateHeaders(sheet, fuelColumns);
  const records = [];
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (!isReportRow(row)) continue;
    records.push({
      id: `import-${month}-fuel-row-${rowNumber}`,
      reportDate: dateValue(row.getCell(1)),
      driver: textValue(row.getCell(3)),
      plate: textValue(row.getCell(4)),
      type: textValue(row.getCell(5)),
      destination: textValue(row.getCell(6)),
      fillDate: dateValue(row.getCell(7)),
      previousFillDate: dateValue(row.getCell(8)),
      fuelCost: numberValue(row.getCell(9)),
      pricePerLiter: numberValue(row.getCell(10)),
      currentKm: numberValue(row.getCell(11)),
      previousKm: numberValue(row.getCell(12)),
      spbu: textValue(row.getCell(16)),
      note: textValue(row.getCell(17))
    });
  }
  return records;
}

async function readWorkbook(file, month) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return {
    bop: importBop(workbook.getWorksheet("BOP"), month),
    fuel: importFuel(workbook.getWorksheet("BBM CASH"), month)
  };
}

function hasReportContent(row) {
  return Object.entries(row).some(([key, value]) =>
    key !== "id" && value !== "" && value !== null && value !== undefined && value !== "[object Object]"
  );
}

function mergeImportedRows(existing, imported) {
  const result = existing.filter(hasReportContent);
  const existingIds = new Set(result.map((row) => row.id));
  for (const row of imported) {
    if (existingIds.has(row.id)) continue;
    result.push(row);
    existingIds.add(row.id);
  }
  return result;
}

async function readStore() {
  try {
    const existing = JSON.parse(await fs.readFile(storePath, "utf8"));
    if (!existing || typeof existing !== "object" || !existing.master || !existing.reports || typeof existing.reports !== "object") {
      throw new Error("Struktur data/store.json tidak valid; impor dihentikan agar data tidak tertimpa.");
    }
    return {
      master: normalizeMaster(existing.master),
      reports: Object.fromEntries(
        Object.entries(existing.reports).map(([month, report]) => [month, normalizeReport(report)])
      )
    };
  } catch (error) {
    if (error.code === "ENOENT") return createInitialData();
    throw error;
  }
}

async function writeStore(store, dryRun) {
  if (dryRun) return null;
  await fs.mkdir(dataDirectory, { recursive: true });
  let backupPath = null;
  try {
    await fs.access(storePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${storePath}.backup-${timestamp}`;
    await fs.copyFile(storePath, backupPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, storePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  return backupPath;
}

async function main() {
  const args = process.argv.slice(2);
  const sourceDirectory = path.resolve(args.find((arg) => !arg.startsWith("--")) || defaultSourceDirectory);
  const dryRun = args.includes("--dry-run");
  const store = await readStore();
  const summary = [];

  for (const [month, filename] of months) {
    const sourceFile = path.join(sourceDirectory, filename);
    const imported = await readWorkbook(sourceFile, month);
    const report = store.reports[month] || { bop: [], fuel: [] };
    const before = {
      bop: report.bop.filter(hasReportContent).length,
      fuel: report.fuel.filter(hasReportContent).length
    };
    const combined = {
      bop: mergeImportedRows(report.bop, imported.bop),
      fuel: mergeImportedRows(report.fuel, imported.fuel)
    };
    const normalized = normalizeReport(combined);
    store.reports[month] = normalized;
    summary.push({
      month,
      source: filename,
      importedBop: imported.bop.length,
      importedFuel: imported.fuel.length,
      addedBop: normalized.bop.length - before.bop,
      addedFuel: normalized.fuel.length - before.fuel
    });
  }

  if (dryRun) {
    process.stdout.write("Pratinjau impor (tidak ada file yang diubah):\n");
  } else {
    const backupPath = await writeStore(store, false);
    process.stdout.write(backupPath ? `Backup data tersimpan di: ${backupPath}\n` : "Database baru akan dibuat; tidak ada laporan lama untuk dicadangkan.\n");
  }

  for (const item of summary) {
    process.stdout.write(
      `${item.month}: BOP ${item.addedBop} baris baru, BBM ${item.addedFuel} baris baru ` +
      `(sumber: ${item.importedBop} BOP, ${item.importedFuel} BBM)\n`
    );
  }
  if (!dryRun) process.stdout.write("Impor selesai. Tutup dan jalankan ulang START-WEB.bat agar perubahan dimuat.\n");
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Impor workbook gagal: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  dateValue,
  importBop,
  importFuel,
  mergeImportedRows,
  readWorkbook
};
