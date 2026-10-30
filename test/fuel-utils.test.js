const test = require("node:test");
const assert = require("node:assert/strict");
const { defaultPriceForType, findPreviousFuelEntry, vehicleFieldsForSelection } = require("../public/fuel-utils");

test("fuel price follows the configured fleet type rates", () => {
  assert.equal(defaultPriceForType("MB"), 10000);
  assert.equal(defaultPriceForType(" mb "), 10000);
  for (const type of ["CC", "CDE", "CDD STANDAR", "CDD EKSTRA PANJANG"]) {
    assert.equal(defaultPriceForType(type), 6800);
  }
  assert.equal(defaultPriceForType("UNKNOWN"), null);
});

test("previous fuel entry is the latest earlier fill for the same vehicle", () => {
  const records = [
    { id: "june", month: "2026-06", plate: "F 8053 BF", fillDate: "2026-06-10", currentKm: 1000 },
    { id: "july", month: "2026-07", plate: "F 8053 BF", fillDate: "2026-07-12", currentKm: 1800 },
    { id: "other-vehicle", month: "2026-07", plate: "B 9126 FXZ", fillDate: "2026-07-14", currentKm: 2500 },
    { id: "same-day", month: "2026-07", plate: "F 8053 BF", fillDate: "2026-07-15", currentKm: 2000 },
    { id: "later", month: "2026-08", plate: "F 8053 BF", fillDate: "2026-08-03", currentKm: 2400 }
  ];

  assert.equal(findPreviousFuelEntry(records, {
    plate: "F 8053 BF",
    fillDate: "2026-07-15"
  }).id, "july");
  assert.equal(findPreviousFuelEntry(records, {
    plate: "F 8053 BF",
    fillDate: ""
  }).id, "later");
  assert.equal(findPreviousFuelEntry(records, {
    plate: "F 8053 BF",
    fillDate: "2026-07-15",
    excludeId: "july",
    excludeMonth: "2026-07"
  }).id, "june");
  assert.equal(findPreviousFuelEntry(records, {
    driver: "Saiful",
    fillDate: "2026-07-15"
  }), null);
  assert.equal(findPreviousFuelEntry(records, { plate: "UNKNOWN" }), null);
});

test("master vehicle data is copied only as a one-time explicit selection", () => {
  const vehicle = { id: "vehicle-1", driver: "SAIFUL", plate: "F 8053 BF", type: "MB" };
  const draft = { driver: "", plate: "", type: "" };
  Object.assign(draft, vehicleFieldsForSelection(vehicle));
  assert.deepEqual(draft, { driver: "SAIFUL", plate: "F 8053 BF", type: "MB" });

  draft.driver = "DRIVER MANUAL";
  draft.plate = "F 1234 AB";
  assert.deepEqual(draft, { driver: "DRIVER MANUAL", plate: "F 1234 AB", type: "MB" });
  assert.deepEqual(vehicle, { id: "vehicle-1", driver: "SAIFUL", plate: "F 8053 BF", type: "MB" });
});
