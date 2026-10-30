const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { dateValue, importBop, importFuel, mergeImportedRows } = require("../scripts/import-workbooks");
const { normalizeReport } = require("../lib/data");

function createSheet(name, headers) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(name);
  headers.forEach((value, index) => {
    sheet.getCell(4, index + 1).value = value;
  });
  return sheet;
}

test("workbook importer preserves BOP and fuel transactions and ignores unnumbered subtotals", () => {
  const bop = createSheet("BOP", ["Tanggal", "NO", "NAMA", "NOMOR POLISI", "TYPE ARMADA", "TUJUAN", "Tanggal Lapor"]);
  [
    new Date("2026-06-02T00:00:00.000Z"),
    1,
    "SAIFUL",
    "F 8053 BF",
    "MB",
    "Bogor",
    new Date("2026-06-02T00:00:00.000Z"),
    10000,
    20000,
    null,
    null,
    null,
    null,
    null,
    5000,
    null,
    null,
    "Parkir dan bongkar"
  ].forEach((value, index) => { bop.getCell(5, index + 1).value = value; });
  bop.getRow(6).getCell(1).value = "TOTAL";
  bop.getRow(6).getCell(8).value = 35000;

  const fuel = createSheet("BBM CASH", ["TGL LAPOR", "NO", "NAMA", "NOMOR POLISI", "TYPE ARMADA", "TUJUAN", "TANGGAL ISI"]);
  [
    new Date("2026-06-01T00:00:00.000Z"),
    1,
    "ENDANG",
    "B 9633 TCO",
    "CDD STANDAR",
    "Banjarnegara",
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-05-31T00:00:00.000Z"),
    333860,
    6800,
    262531,
    262207,
    324,
    49.097,
    6.59,
    "SPBU 33-41202",
    ""
  ].forEach((value, index) => { fuel.getCell(5, index + 1).value = value; });
  fuel.getRow(6).getCell(9).value = 333860;
  fuel.getCell("D7").value = { formula: "VLOOKUP(C7,'Master Data'!B$2:C$17,2,0)", result: { error: "#N/A" } };
  fuel.getCell("E7").value = { formula: "VLOOKUP(D7,'Master Data'!C$2:D$17,2,0)", result: { error: "#N/A" } };
  fuel.getCell("B7").value = 1;
  fuel.getCell("D8").value = "[object Object]";

  const bopRows = importBop(bop, "2026-06");
  const fuelRows = importFuel(fuel, "2026-06");
  assert.equal(bopRows.length, 1);
  assert.deepEqual(
    [bopRows[0].date, bopRows[0].driver, bopRows[0].plate, bopRows[0].parking, bopRows[0].loading, bopRows[0].organda],
    ["2026-06-02", "SAIFUL", "F 8053 BF", 10000, 20000, 5000]
  );
  assert.equal(bopRows[0].note, "Parkir dan bongkar");
  assert.equal(fuelRows.length, 1);
  assert.deepEqual(
    [fuelRows[0].reportDate, fuelRows[0].fillDate, fuelRows[0].previousFillDate, fuelRows[0].fuelCost, fuelRows[0].currentKm, fuelRows[0].previousKm, fuelRows[0].spbu],
    ["2026-06-01", "2026-06-01", "2026-05-31", 333860, 262531, 262207, "SPBU 33-41202"]
  );
  assert.equal(fuelRows[0].plate, "B 9633 TCO");
  assert.equal(fuelRows.some((row) => row.id.endsWith("-7") || row.id.endsWith("-8")), false);
  assert.equal(normalizeReport({ bop: bopRows, fuel: fuelRows }).fuel.length, 1);
});

test("Excel dates and report merging remain valid and idempotent", () => {
  assert.equal(dateValue({ value: new Date("2026-08-06T00:00:00.000Z") }), "2026-08-06");
  assert.equal(dateValue({ value: 46240 }), "2026-08-06");
  assert.equal(dateValue({ value: "6/8/2026" }), "2026-08-06");

  const existing = [
    { id: "empty-row", driver: "", plate: "", date: "", parking: null },
    { id: "manual-row", driver: "DARMAN", plate: "B 9178 TCP", date: "2026-06-01", parking: 5000 }
  ];
  const imported = [
    { id: "import-2026-06-bop-row-5", driver: "SAIFUL", plate: "F 8053 BF", date: "2026-06-02", parking: 10000 }
  ];
  const merged = mergeImportedRows(existing, imported);
  assert.deepEqual(merged.map((row) => row.id), ["manual-row", "import-2026-06-bop-row-5"]);
  assert.deepEqual(mergeImportedRows(merged, imported), merged);
});
