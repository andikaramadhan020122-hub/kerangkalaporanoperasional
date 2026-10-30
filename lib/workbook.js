const ExcelJS = require("exceljs");

const company = "PT. ESTIKA TATA TIARA BOGOR";
const address = "Jl. Sholeh Iskandar No.69, RT.05/RW.08, Kedungbadak, Tanah Sareal, Kota Bogor, Jawa Barat";

const bopColumns = [
  { header: "Tanggal", key: "date", width: 13, kind: "date" },
  { header: "NO", key: "number", width: 7 },
  { header: "NAMA", key: "driver", width: 19 },
  { header: "NOMOR POLISI", key: "plate", width: 17 },
  { header: "TYPE ARMADA", key: "type", width: 19 },
  { header: "TUJUAN", key: "destination", width: 32 },
  { header: "Tanggal Lapor", key: "reportDate", width: 13, kind: "date" },
  { header: "Parkir", key: "parking", width: 15, kind: "money" },
  { header: "Muat", key: "loading", width: 15, kind: "money" },
  { header: "Bongkar", key: "unloading", width: 15, kind: "money" },
  { header: "Maintenance", key: "maintenance", width: 15, kind: "money" },
  { header: "Kawalan", key: "escort", width: 15, kind: "money" },
  { header: "Pungut Liar", key: "illegalLevy", width: 15, kind: "money" },
  { header: "KIR", key: "kir", width: 15, kind: "money" },
  { header: "Organda", key: "organda", width: 15, kind: "money" },
  { header: "Situasional (Lain-lain)", key: "other", width: 20, kind: "money" },
  { header: "TOTAL PENGELUARAN", key: "total", width: 19, kind: "money" },
  { header: "Keterangan", key: "note", width: 28 }
];

const fuelColumns = [
  { header: "TGL LAPOR", key: "reportDate", width: 13, kind: "date" },
  { header: "NO", key: "number", width: 7 },
  { header: "NAMA", key: "driver", width: 19 },
  { header: "NOMOR POLISI", key: "plate", width: 17 },
  { header: "TYPE ARMADA", key: "type", width: 19 },
  { header: "TUJUAN", key: "destination", width: 30 },
  { header: "TANGGAL ISI", key: "fillDate", width: 13, kind: "date" },
  { header: "TGL ISI SEBELUMNYA", key: "previousFillDate", width: 18, kind: "date" },
  { header: "BBM TERPAKAI", key: "fuelCost", width: 17, kind: "money" },
  { header: "PRICE/L", key: "pricePerLiter", width: 15, kind: "money" },
  { header: "KM ISI SEKARANG", key: "currentKm", width: 17, kind: "decimal" },
  { header: "KM ISI SEBELUMNYA", key: "previousKm", width: 19, kind: "decimal" },
  { header: "JARAK TEMPUH", key: "distance", width: 16, kind: "decimal" },
  { header: "LITER", key: "liters", width: 13, kind: "decimal" },
  { header: "SKALA", key: "scale", width: 13, kind: "decimal" },
  { header: "No SPBU", key: "spbu", width: 16 },
  { header: "KETERANGAN", key: "note", width: 28 }
];

function excelDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

function numeric(value) {
  return value === null || value === "" || value === undefined ? 0 : Number(value);
}

function formula(cell, expression, result) {
  cell.value = { formula: expression, result };
}

function styleHeader(row) {
  row.height = 34;
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173B5E" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCAD5E0" } },
      left: { style: "thin", color: { argb: "FFCAD5E0" } },
      bottom: { style: "thin", color: { argb: "FFCAD5E0" } },
      right: { style: "thin", color: { argb: "FFCAD5E0" } }
    };
  });
}

function styleBodyRow(row, index) {
  row.height = 23;
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, color: { argb: "FF233548" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index % 2 === 0 ? "FFF4F7FA" : "FFFFFFFF" }
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "hair", color: { argb: "FFE0E7EF" } },
      left: { style: "hair", color: { argb: "FFE0E7EF" } },
      bottom: { style: "hair", color: { argb: "FFE0E7EF" } },
      right: { style: "hair", color: { argb: "FFE0E7EF" } }
    };
  });
}

function styleTitle(sheet, endColumn, title, period) {
  sheet.mergeCells(1, 1, 1, endColumn);
  sheet.mergeCells(2, 1, 2, endColumn);
  sheet.mergeCells(3, 1, 3, endColumn);
  sheet.getCell("A1").value = company;
  sheet.getCell("A2").value = address;
  sheet.getCell("A3").value = `${title} — ${period}`;
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 28;
  sheet.getCell("A1").font = { name: "Aptos Display", size: 15, bold: true, color: { argb: "FF173B5E" } };
  sheet.getCell("A2").font = { name: "Aptos", size: 9, color: { argb: "FF64748B" } };
  sheet.getCell("A3").font = { name: "Aptos Display", size: 13, bold: true, color: { argb: "FF173B5E" } };
  for (const rowNumber of [1, 2, 3]) {
    sheet.getCell(`A${rowNumber}`).alignment = { vertical: "middle", horizontal: "left" };
  }
}

function applyColumnFormats(row, columns) {
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    if (column.kind === "date") cell.numFmt = "dd/mm/yyyy";
    if (column.kind === "money") cell.numFmt = '"Rp" #,##0;[Red]("Rp" #,##0);-';
    if (column.kind === "decimal") cell.numFmt = "#,##0.00;[Red](#,##0.00);-";
  });
}

function addBopSheet(workbook, report, periodLabel) {
  const sheet = workbook.addWorksheet("BOP", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }] });
  sheet.properties.defaultRowHeight = 22;
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  sheet.pageSetup.printTitlesRow = "1:4";
  sheet.pageSetup.horizontalCentered = true;
  sheet.columns = bopColumns.map(({ header, key, width }) => ({ header, key, width }));
  styleTitle(sheet, bopColumns.length, "RINCIAN BOP", periodLabel);
  const header = sheet.getRow(4);
  bopColumns.forEach((column, index) => { header.getCell(index + 1).value = column.header; });
  styleHeader(header);

  const records = report.bop.length ? report.bop : [{}];
  records.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    bopColumns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      if (column.key === "number") {
        cell.value = index + 1;
      } else if (column.key === "total") {
        const sum = ["parking", "loading", "unloading", "maintenance", "escort", "illegalLevy", "kir", "organda", "other"]
          .reduce((total, key) => total + numeric(item[key]), 0);
        formula(cell, `SUM(H${rowNumber}:P${rowNumber})`, sum);
      } else if (column.kind === "date") {
        cell.value = excelDate(item[column.key]);
      } else if (column.kind === "money") {
        cell.value = item[column.key] ?? null;
      } else {
        cell.value = item[column.key] ?? "";
      }
    });
    styleBodyRow(row, index);
    applyColumnFormats(row, bopColumns);
  });

  const firstDataRow = 5;
  const lastDataRow = 4 + records.length;
  const totalRowNumber = lastDataRow + 1;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(6).value = "TOTAL";
  for (let column = 8; column <= 17; column += 1) {
    const letter = bopColumns[column - 1].key === "total" ? "Q" : String.fromCharCode(64 + column);
    const result = records.reduce((sum, item) => {
      if (column === 17) {
        return sum + ["parking", "loading", "unloading", "maintenance", "escort", "illegalLevy", "kir", "organda", "other"]
          .reduce((rowTotal, key) => rowTotal + numeric(item[key]), 0);
      }
      const key = bopColumns[column - 1].key;
      return sum + numeric(item[key]);
    }, 0);
    formula(totalRow.getCell(column), `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, result);
  }
  totalRow.height = 25;
  totalRow.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FF173B5E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EEF5" } };
    cell.border = { top: { style: "medium", color: { argb: "FF173B5E" } } };
    cell.alignment = { vertical: "middle" };
  });
  applyColumnFormats(totalRow, bopColumns);
  sheet.autoFilter = { from: "A4", to: `R${lastDataRow}` };
  sheet.pageSetup.printArea = `A1:R${totalRowNumber}`;
  return sheet;
}

function addFuelSheet(workbook, report, periodLabel) {
  const sheet = workbook.addWorksheet("BBM CASH", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }] });
  sheet.properties.defaultRowHeight = 22;
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  sheet.pageSetup.printTitlesRow = "1:4";
  sheet.pageSetup.horizontalCentered = true;
  sheet.columns = fuelColumns.map(({ header, key, width }) => ({ header, key, width }));
  styleTitle(sheet, fuelColumns.length, "RINCIAN BBM RFID", periodLabel);
  sheet.mergeCells(1, 19, 1, 26);
  sheet.getCell("S1").value = "Catatan: jarak tempuh, liter, dan skala dihitung otomatis.";
  sheet.getCell("S1").font = { name: "Aptos", size: 9, italic: true, color: { argb: "FF64748B" } };
  const header = sheet.getRow(4);
  fuelColumns.forEach((column, index) => { header.getCell(index + 1).value = column.header; });
  styleHeader(header);

  const records = report.fuel.length ? report.fuel : [{}];
  records.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    fuelColumns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      if (column.key === "number") {
        cell.value = index + 1;
      } else if (column.key === "distance") {
        const distance = item.currentKm !== null && item.currentKm !== undefined && item.previousKm !== null && item.previousKm !== undefined
          ? Number(item.currentKm) - Number(item.previousKm)
          : "";
        formula(cell, `IF(COUNTA(K${rowNumber}:L${rowNumber})<2,"",K${rowNumber}-L${rowNumber})`, distance);
      } else if (column.key === "liters") {
        const liters = numeric(item.pricePerLiter) > 0 && item.fuelCost !== null && item.fuelCost !== undefined
          ? Number(item.fuelCost) / Number(item.pricePerLiter)
          : "";
        formula(cell, `IF(OR(I${rowNumber}="",J${rowNumber}="",J${rowNumber}=0),"",I${rowNumber}/J${rowNumber})`, liters);
      } else if (column.key === "scale") {
        const distance = item.currentKm !== null && item.previousKm !== null
          ? Number(item.currentKm) - Number(item.previousKm)
          : null;
        const liters = numeric(item.pricePerLiter) > 0 && item.fuelCost !== null
          ? Number(item.fuelCost) / Number(item.pricePerLiter)
          : null;
        const scale = liters ? distance / liters : "";
        formula(cell, `IF(OR(M${rowNumber}="",N${rowNumber}="",N${rowNumber}=0),"",M${rowNumber}/N${rowNumber})`, scale);
      } else if (column.kind === "date") {
        cell.value = excelDate(item[column.key]);
      } else if (column.kind === "money" || column.kind === "decimal") {
        cell.value = item[column.key] ?? null;
      } else {
        cell.value = item[column.key] ?? "";
      }
    });
    styleBodyRow(row, index);
    applyColumnFormats(row, fuelColumns);
  });

  const firstDataRow = 5;
  const lastDataRow = 4 + records.length;
  const totalRowNumber = lastDataRow + 1;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "TOTAL";
  for (const column of ["I", "N", "O"]) {
    const columnIndex = fuelColumns.findIndex((entry) => entry.key === ({ I: "fuelCost", N: "liters", O: "scale" })[column]) + 1;
    const result = records.reduce((sum, item) => {
      if (column === "I") return sum + numeric(item.fuelCost);
      if (column === "N") return sum + (numeric(item.pricePerLiter) > 0 ? numeric(item.fuelCost) / numeric(item.pricePerLiter) : 0);
      if (numeric(item.pricePerLiter) <= 0) return sum;
      const distance = item.currentKm !== null && item.previousKm !== null
        ? Number(item.currentKm) - Number(item.previousKm)
        : 0;
      return sum + distance / (numeric(item.fuelCost) / numeric(item.pricePerLiter));
    }, 0);
    formula(totalRow.getCell(columnIndex), `SUM(${column}${firstDataRow}:${column}${lastDataRow})`, result);
  }
  totalRow.height = 25;
  totalRow.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FF173B5E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EEF5" } };
    cell.border = { top: { style: "medium", color: { argb: "FF173B5E" } } };
    cell.alignment = { vertical: "middle" };
  });
  applyColumnFormats(totalRow, fuelColumns);
  sheet.autoFilter = { from: "A4", to: `Q${lastDataRow}` };
  sheet.pageSetup.printArea = `A1:Q${totalRowNumber}`;
  return sheet;
}

function addMasterSheet(workbook, master) {
  const sheet = workbook.addWorksheet("Master Data", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "NO", key: "number", width: 7 },
    { header: "DRIVER", key: "driver", width: 22 },
    { header: "NOPOL", key: "plate", width: 18 },
    { header: "TYPE", key: "type", width: 24 },
    { header: "", key: "spacer", width: 3 },
    { header: "TUJUAN UANG INAP", key: "destination", width: 48 },
    { header: "PERAN", key: "role", width: 16 },
    { header: "NOMINAL (RP)", key: "amount", width: 20 }
  ];
  const header = sheet.getRow(1);
  ["NO", "DRIVER", "NOPOL", "TYPE", "", "TUJUAN UANG INAP", "PERAN", "NOMINAL (RP)"]
    .forEach((value, index) => { header.getCell(index + 1).value = value; });
  styleHeader(header);

  const count = Math.max(master.vehicles.length, master.allowances.length);
  for (let index = 0; index < count; index += 1) {
    const row = sheet.getRow(index + 2);
    const vehicle = master.vehicles[index];
    const allowance = master.allowances[index];
    if (vehicle) {
      row.getCell(1).value = index + 1;
      row.getCell(2).value = vehicle.driver;
      row.getCell(3).value = vehicle.plate;
      row.getCell(4).value = vehicle.type;
    }
    if (allowance) {
      row.getCell(6).value = allowance.destination;
      row.getCell(7).value = allowance.role;
      row.getCell(8).value = allowance.amount;
      row.getCell(8).numFmt = '"Rp" #,##0;[Red]("Rp" #,##0);-';
    }
    styleBodyRow(row, index);
  }
  sheet.autoFilter = { from: "A1", to: `H${Math.max(count + 1, 1)}` };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return sheet;
}

function formatMonth(month) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1, 1));
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

async function createWorkbook(store, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT. Estika Tata Tiara Bogor";
  workbook.subject = `Laporan operasional bulanan ${formatMonth(month)}`;
  workbook.title = `Laporan Operasional PT. ETT Bogor - ${formatMonth(month)}`;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties = { fullCalcOnLoad: true };
  const report = store.reports[month] || { bop: [], fuel: [] };
  const periodLabel = formatMonth(month);
  addMasterSheet(workbook, store.master);
  addBopSheet(workbook, report, periodLabel);
  addFuelSheet(workbook, report, periodLabel);
  return workbook.xlsx.writeBuffer();
}

module.exports = { createWorkbook };
