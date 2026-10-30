const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { createInitialData, normalizeMaster, normalizeReport } = require("../lib/data");
const { createWorkbook } = require("../lib/workbook");
const { hostIsAllowed } = require("../server");

test("the exported workbook preserves the three report sheets and computes totals", async () => {
  const store = createInitialData();
  store.reports["2026-10"] = {
    bop: [
      {
        id: "bop-1",
        date: "2026-10-03",
        driver: "SAIFUL",
        plate: "F 8053 BF",
        type: "MB",
        destination: "Bogor",
        reportDate: "2026-10-04",
        parking: 10000,
        loading: 20000,
        unloading: 30000,
        maintenance: null,
        escort: null,
        illegalLevy: null,
        kir: null,
        organda: null,
        other: null,
        note: "Catatan"
      }
    ],
    fuel: [
      {
        id: "fuel-1",
        reportDate: "2026-10-04",
        driver: "SAIFUL",
        plate: "F 8053 BF",
        type: "MB",
        destination: "Bogor",
        fillDate: "2026-10-03",
        previousFillDate: "2026-10-01",
        fuelCost: 200000,
        pricePerLiter: 10000,
        currentKm: 1200,
        previousKm: 200,
        spbu: "34.123.01",
        note: ""
      }
    ]
  };

  const buffer = await createWorkbook(store, "2026-10");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Master Data", "BOP", "BBM CASH"]);
  const master = workbook.getWorksheet("Master Data");
  assert.equal(master.getCell("B2").value, "SAIFUL");
  assert.equal(master.getCell("F2").value, "Dalam Kota");

  const bop = workbook.getWorksheet("BOP");
  assert.equal(bop.getCell("A4").value, "Tanggal");
  assert.equal(bop.getCell("Q5").value.formula, "SUM(H5:P5)");
  assert.equal(bop.getCell("Q5").value.result, 60000);
  assert.equal(bop.getCell("Q6").value.formula, "SUM(Q5:Q5)");
  assert.equal(bop.getCell("Q6").value.result, 60000);
  assert.equal(bop.autoFilter, "A4:R5");
  assert.equal(bop.pageSetup.printArea, "A1:R6");

  const fuel = workbook.getWorksheet("BBM CASH");
  assert.equal(fuel.getCell("A4").value, "TGL LAPOR");
  assert.equal(fuel.getCell("M5").value.formula, 'IF(COUNTA(K5:L5)<2,"",K5-L5)');
  assert.equal(fuel.getCell("M5").value.result, 1000);
  assert.equal(fuel.getCell("N5").value.result, 20);
  assert.equal(fuel.getCell("O5").value.result, 50);
  assert.equal(fuel.getCell("I6").value.result, 200000);
  assert.equal(fuel.getCell("N6").value.result, 20);
  assert.equal(fuel.getCell("O6").value.result, 50);
  assert.equal(fuel.getCell("A5").value instanceof Date, true);
  assert.equal(fuel.getCell("N5").numFmt.includes("0.00"), true);
});

test("the workbook safely exports empty monthly reports without formula errors", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createWorkbook(createInitialData(), "2026-10"));

  const bop = workbook.getWorksheet("BOP");
  const fuel = workbook.getWorksheet("BBM CASH");
  assert.equal(bop.getCell("Q5").value.formula, "SUM(H5:P5)");
  assert.equal(bop.getCell("Q6").value.formula, "SUM(Q5:Q5)");
  assert.equal(fuel.getCell("M5").value.formula, 'IF(COUNTA(K5:L5)<2,"",K5-L5)');
  assert.equal(fuel.getCell("N5").value.formula, 'IF(OR(I5="",J5="",J5=0),"",I5/J5)');
  assert.equal(fuel.getCell("O5").value.formula, 'IF(OR(M5="",N5="",N5=0),"",M5/N5)');
  assert.equal(fuel.getCell("I6").value.formula, "SUM(I5:I5)");
  assert.equal(fuel.getCell("N6").value.formula, "SUM(N5:N5)");
});

test("input normalization rejects malformed data and keeps valid report fields", () => {
  const initial = createInitialData();
  assert.equal(normalizeMaster(initial.master).vehicles.length, 16);
  assert.equal(normalizeMaster(initial.master).allowances.length, 18);
  assert.throws(() => normalizeMaster({ vehicles: [], allowances: [{ id: "x", destination: "", role: "", amount: -1 }] }));
  assert.throws(() => normalizeReport({ bop: [], fuel: "invalid" }));
  assert.throws(() => normalizeReport({
    bop: [{ id: "bad-date", date: "2026-02-30", driver: "", plate: "", type: "", destination: "", reportDate: "", parking: null, loading: null, unloading: null, maintenance: null, escort: null, illegalLevy: null, kir: null, organda: null, other: null, note: "" }],
    fuel: []
  }));
});

test("the dashboard fleet summary matches the template master data", () => {
  const vehicles = createInitialData().master.vehicles;
  const counts = vehicles.reduce((result, vehicle) => {
    result[vehicle.type] = (result[vehicle.type] || 0) + 1;
    return result;
  }, {});

  assert.equal(vehicles.length, 16);
  assert.equal(new Set(vehicles.map((vehicle) => vehicle.driver).filter(Boolean)).size, 14);
  assert.deepEqual(counts, {
    MB: 2,
    CC: 2,
    CDE: 4,
    "CDD STANDAR": 5,
    "CDD EKSTRA PANJANG": 3
  });
});

test("LAN requests accept only the expected HTTPS host and port", () => {
  const hostnames = new Set(["127.0.0.1", "localhost", "ett-host", "192.168.1.25"]);
  assert.equal(hostIsAllowed("127.0.0.1:3443", 3443, hostnames), true);
  assert.equal(hostIsAllowed("ETT-HOST:3443", 3443, hostnames), true);
  assert.equal(hostIsAllowed("192.168.1.25:3443", 3443, hostnames), true);
  assert.equal(hostIsAllowed("attacker.example:3443", 3443, hostnames), false);
  assert.equal(hostIsAllowed("127.0.0.1:443", 3443, hostnames), false);
  assert.equal(hostIsAllowed("127.0.0.1:3443@attacker.example", 3443, hostnames), false);
  assert.equal(hostIsAllowed(undefined, 3443, hostnames), false);
});
