const vehicleSeed = [
  { driver: "SAIFUL", plate: "F 8053 BF", type: "MB" },
  { driver: "GILANG", plate: "B 9495 TCO", type: "MB" },
  { driver: "MAD UDIN", plate: "B 9778 TXW", type: "CC" },
  { driver: "AANG", plate: "B 9717 KCG", type: "CC" },
  { driver: "DAMAN", plate: "B 9942 FFX", type: "CDE" },
  { driver: "UDIN B", plate: "B 9126 FXZ", type: "CDE" },
  { driver: "FADLI", plate: "B 9744 TXW", type: "CDE" },
  { driver: "INDA", plate: "B 9128 FXZ", type: "CDE" },
  { driver: "DARMAN", plate: "B 9178 TCP", type: "CDD STANDAR" },
  { driver: "", plate: "B 9633 TCO", type: "CDD STANDAR" },
  { driver: "ENDI", plate: "B 9622 TCO", type: "CDD STANDAR" },
  { driver: "KOSASIH", plate: "F 9443 FH", type: "CDD STANDAR" },
  { driver: "EDO", plate: "F 9446 FH", type: "CDD STANDAR" },
  { driver: "LUKMAN", plate: "B 9446 TCO", type: "CDD EKSTRA PANJANG" },
  { driver: "RIKI", plate: "B 9603 BCU", type: "CDD EKSTRA PANJANG" },
  { driver: "", plate: "B 9683 KCG", type: "CDD EKSTRA PANJANG" }
];

const allowanceSeed = [
  { destination: "Dalam Kota", role: "Driver", amount: 50000 },
  { destination: "Dalam Kota", role: "Helper", amount: 50000 },
  { destination: "Luarkota dekat Jabodetabek", role: "Driver", amount: 100000 },
  { destination: "Luarkota dekat Jabodetabek", role: "Driver", amount: 100000 },
  { destination: "PT Dover", role: "Driver", amount: 150000 },
  { destination: "PT Dover", role: "Helper", amount: 100000 },
  { destination: "Banyumas / Purwokerto", role: "Driver", amount: 200000 },
  { destination: "Banyumas / Purwokerto", role: "Helper", amount: 150000 },
  { destination: "Banyumas / Purwokerto > Semarang / Salatiga", role: "Driver", amount: 250000 },
  { destination: "Banyumas / Purwokerto > Semarang / Salatiga", role: "Helper", amount: 200000 },
  { destination: "Semarang / Salatiga", role: "Driver", amount: 250000 },
  { destination: "Semarang / Salatiga", role: "Helper", amount: 200000 },
  { destination: "Banyumas > Semarang / Salatiga > Jogja", role: "Driver", amount: 300000 },
  { destination: "Banyumas > Semarang / Salatiga > Jogja", role: "Helper", amount: 250000 },
  { destination: "Sidoarjo", role: "Driver", amount: 350000 },
  { destination: "Sidoarjo", role: "Helper", amount: 300000 },
  { destination: "Sidoarjo / Porong > Banyumas", role: "Driver", amount: 450000 },
  { destination: "Sidoarjo / Porong > Banyumas", role: "Helper", amount: 350000 }
];

function createInitialData() {
  return {
    master: {
      vehicles: vehicleSeed.map((vehicle, index) => ({ ...vehicle, id: `vehicle-${index + 1}` })),
      allowances: allowanceSeed.map((allowance, index) => ({ ...allowance, id: `allowance-${index + 1}` }))
    },
    reports: {}
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, field) {
  if (typeof value !== "string" || value.length > 500) {
    throw new Error(`Kolom ${field} harus berupa teks maksimal 500 karakter.`);
  }
  return value;
}

function numeric(value, field) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000_000) {
    throw new Error(`Nilai ${field} tidak valid.`);
  }
  return parsed;
}

function dateText(value, field) {
  const result = text(value, field);
  if (result === "") return result;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) throw new Error(`Tanggal ${field} harus menggunakan format YYYY-MM-DD.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== result) throw new Error(`Tanggal ${field} tidak valid.`);
  return result;
}

function recordId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 80) {
    throw new Error("ID data tidak valid.");
  }
  return value;
}

function rows(value, maximum, mapRow, name) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`Jumlah data ${name} tidak valid (maksimal ${maximum} baris).`);
  }
  const result = value.map(mapRow);
  const ids = result.map((row) => row.id);
  if (new Set(ids).size !== ids.length) throw new Error(`ID data ${name} harus unik.`);
  return result;
}

function normalizeMaster(master) {
  if (!isObject(master)) throw new Error("Data master tidak valid.");
  return {
    vehicles: rows(master.vehicles, 500, (row) => {
      if (!isObject(row)) throw new Error("Data kendaraan tidak valid.");
      return {
        id: recordId(row.id),
        driver: text(row.driver, "Driver"),
        plate: text(row.plate, "Nomor polisi"),
        type: text(row.type, "Tipe armada")
      };
    }, "kendaraan"),
    allowances: rows(master.allowances, 500, (row) => {
      if (!isObject(row)) throw new Error("Data uang inap tidak valid.");
      return {
        id: recordId(row.id),
        destination: text(row.destination, "Tujuan uang inap"),
        role: text(row.role, "Peran uang inap"),
        amount: numeric(row.amount, "uang inap")
      };
    }, "uang inap")
  };
}

const bopFields = {
  date: "Tanggal",
  driver: "Nama",
  plate: "Nomor polisi",
  type: "Tipe armada",
  destination: "Tujuan",
  reportDate: "Tanggal lapor",
  parking: "Parkir",
  loading: "Muat",
  unloading: "Bongkar",
  maintenance: "Maintenance",
  escort: "Kawalan",
  illegalLevy: "Pungut liar",
  kir: "KIR",
  organda: "Organda",
  other: "Situasional",
  note: "Keterangan"
};

const fuelFields = {
  reportDate: "Tanggal lapor",
  driver: "Nama",
  plate: "Nomor polisi",
  type: "Tipe armada",
  destination: "Tujuan",
  fillDate: "Tanggal isi",
  previousFillDate: "Tanggal isi sebelumnya",
  fuelCost: "BBM terpakai",
  pricePerLiter: "Harga per liter",
  currentKm: "KM isi sekarang",
  previousKm: "KM isi sebelumnya",
  spbu: "Nomor SPBU",
  note: "Keterangan"
};

function normalizeReport(report) {
  if (!isObject(report)) throw new Error("Data laporan tidak valid.");
  const normalizeReportRows = (source, fields, label) => rows(source, 2000, (row) => {
    if (!isObject(row)) throw new Error(`Data ${label} tidak valid.`);
    const result = { id: recordId(row.id) };
    for (const [field, title] of Object.entries(fields)) {
      result[field] = ["date", "reportDate", "fillDate", "previousFillDate"].includes(field)
        ? dateText(row[field], title)
        : field === "parking" || field === "loading" || field === "unloading" ||
        field === "maintenance" || field === "escort" || field === "illegalLevy" ||
        field === "kir" || field === "organda" || field === "other" ||
        field === "fuelCost" || field === "pricePerLiter" || field === "currentKm" ||
        field === "previousKm"
        ? numeric(row[field], title)
        : text(row[field], title);
    }
    return result;
  }, label);

  return {
    bop: normalizeReportRows(report.bop, bopFields, "BOP"),
    fuel: normalizeReportRows(report.fuel, fuelFields, "BBM")
  };
}

module.exports = {
  createInitialData,
  normalizeMaster,
  normalizeReport
};
