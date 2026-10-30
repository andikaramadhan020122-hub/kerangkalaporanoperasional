((root) => {
  function defaultPriceForType(type) {
    const normalized = String(type || "").trim().toLocaleUpperCase("id-ID");
    if (normalized === "MB") return 10000;
    if (["CC", "CDE", "CDD STANDAR", "CDD EKSTRA PANJANG"].includes(normalized)) return 6800;
    return null;
  }

  function findPreviousFuelEntry(records, options) {
    const plate = String(options.plate || "").trim().toLocaleUpperCase("id-ID");
    const driver = String(options.driver || "").trim().toLocaleLowerCase("id-ID");
    if (!plate && !driver) return null;
    const fillDate = String(options.fillDate || "");
    const matches = records.filter((record) => {
      if (!record.fillDate) return false;
      if (options.excludeId && record.id === options.excludeId && record.month === options.excludeMonth) return false;
      const sameVehicle = plate
        ? String(record.plate || "").trim().toLocaleUpperCase("id-ID") === plate
        : String(record.driver || "").trim().toLocaleLowerCase("id-ID") === driver;
      return sameVehicle && (!fillDate || record.fillDate < fillDate);
    });
    matches.sort((left, right) => String(right.fillDate).localeCompare(String(left.fillDate)));
    return matches[0] || null;
  }

  function vehicleFieldsForSelection(vehicle) {
    return {
      driver: vehicle.driver,
      plate: vehicle.plate,
      type: vehicle.type
    };
  }

  const utilities = { defaultPriceForType, findPreviousFuelEntry, vehicleFieldsForSelection };
  if (typeof module !== "undefined" && module.exports) module.exports = utilities;
  root.ETTFuelUtils = utilities;
})(globalThis);
