(() => {
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const pinInput = document.getElementById("pinInput");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  let authMode = "pin";
  const monthInput = document.getElementById("monthInput");
  const toast = document.getElementById("toast");
  const saveStatus = document.getElementById("saveStatus");
  const horizontalScrollDock = document.getElementById("horizontalScrollDock");
  const horizontalScrollTrack = document.getElementById("horizontalScrollTrack");
  const horizontalScrollSpacer = document.getElementById("horizontalScrollSpacer");
  const state = {
    month: "",
    availableMonths: [],
    fuelHistory: [],
    master: { vehicles: [], allowances: [] },
    report: { bop: [], fuel: [] },
    tab: "overview"
  };
  let changeVersion = 0;
  let savedVersion = 0;
  let saveTimer = null;
  let savePromise = null;
  let toastTimer = null;
  let activeEntry = null;

  const bopColumns = [
    ["date", "Tanggal", "date"],
    ["number", "NO", "number"],
    ["driver", "Nama", "text"],
    ["plate", "Nomor polisi", "text"],
    ["type", "Tipe armada", "text"],
    ["destination", "Tujuan", "text"],
    ["reportDate", "Tanggal lapor", "date"],
    ["parking", "Parkir", "money"],
    ["loading", "Muat", "money"],
    ["unloading", "Bongkar", "money"],
    ["maintenance", "Maintenance", "money"],
    ["escort", "Kawalan", "money"],
    ["illegalLevy", "Pungut liar", "money"],
    ["kir", "KIR", "money"],
    ["organda", "Organda", "money"],
    ["other", "Situasional (lain-lain)", "money"],
    ["total", "Total pengeluaran", "calculated"],
    ["note", "Keterangan", "text"],
    ["editAction", "", "action"],
    ["deleteAction", "", "action"]
  ];

  const fuelColumns = [
    ["reportDate", "Tgl lapor", "date"],
    ["number", "NO", "number"],
    ["driver", "Nama", "text"],
    ["plate", "Nomor polisi", "text"],
    ["type", "Tipe armada", "text"],
    ["destination", "Tujuan", "text"],
    ["fillDate", "Tanggal isi", "date"],
    ["previousFillDate", "Tgl isi sebelumnya", "date"],
    ["fuelCost", "BBM terpakai", "money"],
    ["pricePerLiter", "Harga/liter", "money"],
    ["currentKm", "KM isi sekarang", "decimal"],
    ["previousKm", "KM isi sebelumnya", "decimal"],
    ["distance", "Jarak tempuh", "calculated"],
    ["liters", "Liter", "calculated"],
    ["scale", "Skala", "calculated"],
    ["spbu", "No SPBU", "text"],
    ["note", "Keterangan", "text"],
    ["editAction", "", "action"],
    ["deleteAction", "", "action"]
  ];
  const entryForms = {
    bop: {
      title: "Rincian BOP",
      description: "Isi detail perjalanan dan biaya operasional. Data dapat dilengkapi bertahap.",
      groups: [
        {
          title: "Informasi perjalanan",
          description: "Data dasar untuk mengenali perjalanan dan armada.",
          fields: [
            ["date", "Tanggal perjalanan", "date"],
            ["driver", "Nama driver", "text"],
            ["plate", "Nomor polisi", "text"],
            ["type", "Tipe armada", "text"],
            ["destination", "Tujuan perjalanan", "text"],
            ["reportDate", "Tanggal laporan", "date"]
          ]
        },
        {
          title: "Rincian pengeluaran",
          description: "Isi nominal pada kategori biaya yang digunakan.",
          fields: [
            ["parking", "Parkir", "money"],
            ["loading", "Muat", "money"],
            ["unloading", "Bongkar", "money"],
            ["maintenance", "Maintenance", "money"],
            ["escort", "Kawalan", "money"],
            ["illegalLevy", "Pungut liar", "money"],
            ["kir", "KIR", "money"],
            ["organda", "Organda", "money"],
            ["other", "Situasional (lain-lain)", "money"]
          ]
        },
        {
          title: "Catatan tambahan",
          description: "Tambahkan keterangan jika diperlukan.",
          fields: [["note", "Keterangan", "text", "textarea"]]
        }
      ]
    },
    fuel: {
      title: "Pengisian BBM",
      description: "Catat pengisian bahan bakar. Jarak, liter, dan skala dihitung otomatis.",
      groups: [
        {
          title: "Informasi pengisian",
          description: "Tanggal pengisian dan kendaraan yang menggunakan BBM.",
          fields: [
            ["reportDate", "Tanggal laporan", "date"],
            ["driver", "Nama driver", "text"],
            ["plate", "Nomor polisi", "text"],
            ["type", "Tipe armada", "text"],
            ["destination", "Tujuan perjalanan", "text"],
            ["fillDate", "Tanggal isi BBM", "date"],
            ["previousFillDate", "Tanggal isi sebelumnya", "date"]
          ]
        },
        {
          title: "Rincian bahan bakar",
          description: "Masukkan nilai biaya dan kilometer pada pengisian.",
          fields: [
            ["fuelCost", "BBM terpakai (Rp)", "money"],
            ["pricePerLiter", "Harga per liter (Rp)", "money"],
            ["currentKm", "KM isi sekarang", "decimal"],
            ["previousKm", "KM isi sebelumnya", "decimal"]
          ]
        },
        {
          title: "SPBU & catatan",
          description: "Informasi tambahan pengisian.",
          fields: [
            ["spbu", "Nomor / nama SPBU", "text"],
            ["note", "Keterangan", "text", "textarea"]
          ]
        }
      ]
    }
  };
  const bopExpenseFields = ["parking", "loading", "unloading", "maintenance", "escort", "illegalLevy", "kir", "organda", "other"];

  const fieldLabels = new Map(
    [...bopColumns, ...fuelColumns].map(([key, label]) => [key, label])
  );
  fieldLabels.set("driver", "Driver / nama");
  fieldLabels.set("plate", "Nomor polisi");
  fieldLabels.set("type", "Tipe armada");
  fieldLabels.set("destination", "Tujuan");
  fieldLabels.set("amount", "Nominal uang inap");
  fieldLabels.set("note", "Keterangan");

  const money = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  });
  const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
  const bopCategories = [
    ["parking", "Parkir"],
    ["loading", "Muat"],
    ["unloading", "Bongkar"],
    ["maintenance", "Maintenance"],
    ["escort", "Kawalan"],
    ["illegalLevy", "Pungut liar"],
    ["kir", "KIR"],
    ["organda", "Organda"],
    ["other", "Situasional"]
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function newId() {
    return crypto.randomUUID();
  }

  function monthLabel(value) {
    if (!value) return "—";
    const [year, month] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
      .format(new Date(year, month - 1, 1));
  }

  function setAuthenticated(isAuthenticated) {
    loginView.hidden = isAuthenticated;
    appView.hidden = !isAuthenticated;
    if (!isAuthenticated) {
      pinInput.value = "";
      passwordInput.value = "";
      window.setTimeout(() => (authMode === "email" ? emailInput : pinInput).focus(), 0);
    }
  }

  function setAuthMode(mode) {
    authMode = mode === "email" ? "email" : "pin";
    const cloudLogin = authMode === "email";
    document.getElementById("pinLoginFields").hidden = cloudLogin;
    document.getElementById("cloudLoginFields").hidden = !cloudLogin;
    pinInput.required = !cloudLogin;
    emailInput.required = cloudLogin;
    passwordInput.required = cloudLogin;
    document.getElementById("loginDescription").textContent = cloudLogin
      ? "Masuk dengan email dan kata sandi akun pribadi Anda."
      : "Masukkan PIN pribadi untuk membuka ruang laporan.";
    document.getElementById("securityNote").lastChild.textContent = cloudLogin
      ? " Login aman melalui Supabase Auth"
      : " Akses pribadi melalui jaringan lokal";
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
  }

  function setSaveStatus(status, message) {
    saveStatus.classList.toggle("is-saving", status === "saving");
    saveStatus.classList.toggle("is-error", status === "error");
    saveStatus.lastChild.textContent = ` ${message}`;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const result = await response.json();
    if (response.status === 401) {
      setAuthenticated(false);
    }
    if (!response.ok) throw new Error(result.error || "Permintaan tidak berhasil.");
    return result;
  }

  async function loadMonth(month) {
    const result = await requestJson(`/api/data?month=${encodeURIComponent(month)}`);
    state.month = month;
    state.availableMonths = Array.isArray(result.availableMonths) ? result.availableMonths : [];
    state.master = result.master;
    state.report = result.report;
    state.fuelHistory = Array.isArray(result.fuelHistory) ? result.fuelHistory : [];
    state.master.vehicles = state.master.vehicles.map((row) => ({ ...row, id: row.id || newId() }));
    state.master.allowances = state.master.allowances.map((row) => ({ ...row, id: row.id || newId() }));
    state.report.bop = state.report.bop.map((row) => ({ ...row, id: row.id || newId() }));
    state.report.fuel = state.report.fuel.map((row) => ({ ...row, id: row.id || newId() }));
    changeVersion = 0;
    savedVersion = 0;
    monthInput.value = month;
    render();
  }

  async function persist() {
    window.clearTimeout(saveTimer);
    if (savePromise) {
      await savePromise;
      if (changeVersion > savedVersion) return persist();
      return;
    }
    if (changeVersion === savedVersion) return;
    const version = changeVersion;
    const snapshot = {
      master: JSON.parse(JSON.stringify(state.master)),
      report: JSON.parse(JSON.stringify(state.report))
    };
    setSaveStatus("saving", "Menyimpan…");
    savePromise = requestJson(`/api/data?month=${encodeURIComponent(state.month)}`, {
      method: "PUT",
      body: JSON.stringify(snapshot)
    }).then(() => {
      savedVersion = version;
      if (!state.availableMonths.includes(state.month)) state.availableMonths.push(state.month);
      state.availableMonths.sort();
      setSaveStatus("saved", "Tersimpan");
      renderArchiveMonths();
    }).catch((error) => {
      setSaveStatus("error", "Belum tersimpan");
      showToast(`Gagal menyimpan: ${error.message}`, true);
      throw error;
    }).finally(() => {
      savePromise = null;
    });
    await savePromise;
    if (changeVersion > savedVersion) scheduleSave();
  }

  function scheduleSave() {
    changeVersion += 1;
    setSaveStatus("saving", "Perubahan belum disimpan");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { persist().catch(() => {}); }, 500);
    updateOverview();
  }

  function rowInput(collection, id, field, value, kind = "text", extra = "") {
    const type = kind === "date" ? "date" : kind === "number" || kind === "money" || kind === "decimal" ? "number" : "text";
    const step = kind === "decimal" ? "0.01" : kind === "money" ? "1000" : "1";
    const accessibleLabel = fieldLabels.get(field) || field;
    const attrs = kind === "number" || kind === "money" || kind === "decimal"
      ? ` min="0" step="${step}" inputmode="decimal"`
      : "";
    const list = field === "driver" ? ' list="driverSuggestions" autocomplete="off"' : "";
    return `<input class="cell-input" type="${type}" aria-label="${escapeHtml(accessibleLabel)}" value="${escapeHtml(value ?? "")}" data-collection="${collection}" data-id="${escapeHtml(id)}" data-field="${field}"${attrs}${list}${extra}>`;
  }

  function dataCell(label, content, className = "") {
    const classAttribute = className ? ` class="${className}"` : "";
    return `<td${classAttribute} data-label="${escapeHtml(label)}">${content}</td>`;
  }

  function tableHeader(columns) {
    return `<thead><tr>${columns.map(([, title]) => `<th>${escapeHtml(title)}</th>`).join("")}</tr></thead>`;
  }

  function deleteCell(collection, id, label) {
    return `<td class="action-cell" data-label="Aksi"><button class="delete-button" type="button" aria-label="Hapus ${escapeHtml(label)}" title="Hapus baris" data-delete="${collection}" data-id="${escapeHtml(id)}">×</button></td>`;
  }

  function editCell(collection, id, label) {
    return `<td class="action-cell" data-label="Aksi"><button class="edit-button" type="button" aria-label="Edit ${escapeHtml(label)}" title="Edit data" data-edit="${collection}" data-id="${escapeHtml(id)}">Edit</button></td>`;
  }

  function displayValue(value, kind = "text") {
    if (value === null || value === undefined || value === "") return "—";
    if (kind === "date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
      if (match) {
        return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" })
          .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      }
    }
    if (kind === "money" && Number.isFinite(Number(value))) return money.format(Number(value));
    if (kind === "decimal" && Number.isFinite(Number(value))) return number.format(Number(value));
    return String(value);
  }

  function bopTotal(row) {
    return ["parking", "loading", "unloading", "maintenance", "escort", "illegalLevy", "kir", "organda", "other"]
      .reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  }

  function fuelValues(row) {
    const distance = row.currentKm !== null && row.currentKm !== "" && row.previousKm !== null && row.previousKm !== ""
      ? Number(row.currentKm) - Number(row.previousKm)
      : null;
    const liters = Number(row.pricePerLiter) > 0 && row.fuelCost !== null && row.fuelCost !== ""
      ? Number(row.fuelCost) / Number(row.pricePerLiter)
      : null;
    const scale = distance !== null && liters ? distance / liters : null;
    return { distance, liters, scale };
  }

  function calculatedCell(value, kind, field) {
    const display = value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : kind === "money" ? money.format(value) : number.format(value);
    const label = [...bopColumns, ...fuelColumns].find((column) => column[0] === field)?.[1] || field;
    return `<td class="calculated-cell" data-label="${escapeHtml(label)}" data-calculated="${field}">${escapeHtml(display)}</td>`;
  }

  function renderBopTable() {
    const table = document.getElementById("bopTable");
    document.getElementById("bopRowCount").textContent = `${state.report.bop.length} catatan`;
    table.innerHTML = `${tableHeader(bopColumns)}<tbody>${state.report.bop.length
      ? state.report.bop.map((row, index) => `<tr data-row="${escapeHtml(row.id)}">
          ${dataCell("Tanggal", escapeHtml(displayValue(row.date, "date")))}
          ${dataCell("NO", index + 1, "number-cell")}
          ${dataCell("Nama", escapeHtml(displayValue(row.driver)))}
          ${dataCell("Nomor polisi", escapeHtml(displayValue(row.plate)))}
          ${dataCell("Tipe armada", escapeHtml(displayValue(row.type)))}
          ${dataCell("Tujuan", escapeHtml(displayValue(row.destination)))}
          ${dataCell("Tanggal lapor", escapeHtml(displayValue(row.reportDate, "date")))}
          ${bopExpenseFields
            .map((field) => {
              const label = bopColumns.find((column) => column[0] === field)?.[1] || field;
              return dataCell(label, escapeHtml(displayValue(row[field], "money")));
            }).join("")}
          ${dataCell("Total pengeluaran", escapeHtml(money.format(bopTotal(row))), "calculated-cell")}
          ${dataCell("Keterangan", escapeHtml(displayValue(row.note)))}
          ${editCell("bop", row.id, "catatan BOP")}
          ${deleteCell("bop", row.id, "catatan BOP")}
        </tr>`).join("")
      : `<tr><td class="empty-row" colspan="${bopColumns.length}">Belum ada catatan BOP. Pilih “Tambah baris” untuk mulai mengisi.</td></tr>`}
      </tbody>`;
  }

  function renderFuelTable() {
    const table = document.getElementById("fuelTable");
    document.getElementById("fuelRowCount").textContent = `${state.report.fuel.length} catatan`;
    table.innerHTML = `${tableHeader(fuelColumns)}<tbody>${state.report.fuel.length
      ? state.report.fuel.map((row, index) => {
        const computed = fuelValues(row);
        return `<tr data-row="${escapeHtml(row.id)}">
          ${dataCell("Tgl lapor", escapeHtml(displayValue(row.reportDate, "date")))}
          ${dataCell("NO", index + 1, "number-cell")}
          ${dataCell("Nama", escapeHtml(displayValue(row.driver)))}
          ${dataCell("Nomor polisi", escapeHtml(displayValue(row.plate)))}
          ${dataCell("Tipe armada", escapeHtml(displayValue(row.type)))}
          ${dataCell("Tujuan", escapeHtml(displayValue(row.destination)))}
          ${dataCell("Tanggal isi", escapeHtml(displayValue(row.fillDate, "date")))}
          ${dataCell("Tgl isi sebelumnya", escapeHtml(displayValue(row.previousFillDate, "date")))}
          ${dataCell("BBM terpakai", escapeHtml(displayValue(row.fuelCost, "money")))}
          ${dataCell("Harga/liter", escapeHtml(displayValue(row.pricePerLiter, "money")))}
          ${dataCell("KM isi sekarang", escapeHtml(displayValue(row.currentKm, "decimal")))}
          ${dataCell("KM isi sebelumnya", escapeHtml(displayValue(row.previousKm, "decimal")))}
          ${calculatedCell(computed.distance, "decimal", "distance")}
          ${calculatedCell(computed.liters, "decimal", "liters")}
          ${calculatedCell(computed.scale, "decimal", "scale")}
          ${dataCell("No SPBU", escapeHtml(displayValue(row.spbu)))}
          ${dataCell("Keterangan", escapeHtml(displayValue(row.note)))}
          ${editCell("fuel", row.id, "catatan BBM")}
          ${deleteCell("fuel", row.id, "catatan BBM")}
        </tr>`;
      }).join("")
      : `<tr><td class="empty-row" colspan="${fuelColumns.length}">Belum ada catatan BBM. Pilih “Tambah pengisian” untuk mulai mengisi.</td></tr>`}
      </tbody>`;
  }

  function renderMasterTables() {
    const vehicleTable = document.getElementById("vehicleTable");
    vehicleTable.innerHTML = `<thead><tr><th>NO</th><th>DRIVER</th><th>NOPOL</th><th>TYPE ARMADA</th><th></th></tr></thead><tbody>${
      state.master.vehicles.length
        ? state.master.vehicles.map((row, index) => `<tr>
            ${dataCell("NO", index + 1, "number-cell")}
            ${dataCell("Driver", rowInput("vehicles", row.id, "driver", row.driver))}
            ${dataCell("Nomor polisi", rowInput("vehicles", row.id, "plate", row.plate))}
            ${dataCell("Tipe armada", rowInput("vehicles", row.id, "type", row.type))}
            ${deleteCell("vehicles", row.id, "kendaraan")}
          </tr>`).join("")
        : `<tr><td class="empty-row" colspan="5">Belum ada kendaraan. Tambahkan kendaraan untuk mulai mengisi laporan.</td></tr>`
    }</tbody>`;

    const allowanceTable = document.getElementById("allowanceTable");
    allowanceTable.innerHTML = `<thead><tr><th>TUJUAN</th><th>PERAN</th><th>NOMINAL (RP)</th><th></th></tr></thead><tbody>${
      state.master.allowances.length
        ? state.master.allowances.map((row) => `<tr>
            ${dataCell("Tujuan", rowInput("allowances", row.id, "destination", row.destination))}
            ${dataCell("Peran", rowInput("allowances", row.id, "role", row.role))}
            ${dataCell("Nominal (Rp)", rowInput("allowances", row.id, "amount", row.amount, "money"))}
            ${deleteCell("allowances", row.id, "tarif uang inap")}
          </tr>`).join("")
        : `<tr><td class="empty-row" colspan="4">Belum ada tarif uang inap.</td></tr>`
    }</tbody>`;

    const suggestions = [...new Set(state.master.vehicles.map((row) => row.driver.trim()).filter(Boolean))];
    document.getElementById("driverSuggestions").innerHTML = suggestions
      .map((driver) => `<option value="${escapeHtml(driver)}"></option>`).join("");
  }

  function entryFields(type) {
    return entryForms[type].groups.flatMap((group) => group.fields);
  }

  function openEntryForm(type, id = null) {
    const config = entryForms[type];
    if (!config) return;
    const collection = collectionFor(type);
    const current = id ? collection.find((row) => row.id === id) : null;
    if (id && !current) {
      showToast("Data yang akan diedit tidak ditemukan.", true);
      return;
    }
    const draft = current ? { ...current } : {};
    for (const [field, , kind] of entryFields(type)) {
      if (!(field in draft)) draft[field] = kind === "money" || kind === "decimal" ? null : "";
    }
    const defaultPrice = type === "fuel" ? window.ETTFuelUtils.defaultPriceForType(draft.type) : null;
    const matchedVehicle = state.master.vehicles.find((vehicle) =>
      vehicle.driver.trim().toLocaleLowerCase("id-ID") === String(draft.driver || "").trim().toLocaleLowerCase("id-ID") &&
      vehicle.plate.trim().toLocaleUpperCase("id-ID") === String(draft.plate || "").trim().toLocaleUpperCase("id-ID") &&
      vehicle.type.trim().toLocaleUpperCase("id-ID") === String(draft.type || "").trim().toLocaleUpperCase("id-ID")
    );
    activeEntry = {
      type,
      id,
      draft,
      autoPrice: current && draft.pricePerLiter === defaultPrice ? defaultPrice : null,
      matchedVehicleId: matchedVehicle?.id || "",
      autoPrevious: { previousFillDate: false, previousKm: false }
    };
    document.getElementById("entryFormEyebrow").textContent = type === "fuel" ? "FORMULIR PENGISIAN BBM" : "FORMULIR BIAYA OPERASIONAL";
    document.getElementById("entryDialogTitle").textContent = id ? `Edit ${config.title}` : `Tambah ${config.title}`;
    document.getElementById("entryFormDescription").textContent = config.description;
    document.getElementById("entryFormError").textContent = "";
    document.getElementById("entryFormSections").innerHTML = config.groups.map((group, index) => `
      <section class="entry-question-card">
        <div class="entry-section-heading"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.description)}</p></div></div>
        <div class="entry-fields-grid">${index === 0 ? `
          <div class="entry-field entry-field-full">
            <label for="entry-vehicle-master">Pilih armada dari Master Data (opsional)</label>
            <select id="entry-vehicle-master" name="vehicleMaster" data-entry-vehicle>
              <option value="">Isi nama dan nomor polisi secara manual</option>
              ${state.master.vehicles.map((vehicle) => `<option value="${escapeHtml(vehicle.id)}"${vehicle.id === activeEntry.matchedVehicleId ? " selected" : ""}>${escapeHtml([vehicle.driver, vehicle.plate, vehicle.type].filter(Boolean).join(" · "))}</option>`).join("")}
            </select>
            <small>Pilihan ini mengisi nama, plat, dan tipe satu kali. Setelahnya ketiga kolom dapat diedit bebas.</small>
          </div>` : ""}${group.fields.map(([field, label, kind, control]) => {
          const inputId = `entry-${field}`;
          const value = draft[field] ?? "";
          const hint = field === "pricePerLiter"
            ? "Terisi otomatis: MB Rp10.000/liter; CC, CDE, CDD Standar, dan CDD Ekstra Panjang Rp6.800/liter."
            : field === "previousFillDate" || field === "previousKm"
              ? "Mengikuti pengisian terakhir kendaraan ini sebelum tanggal pengisian."
              : kind === "money" ? "Masukkan nominal dalam rupiah." : kind === "decimal" ? "Gunakan angka kilometer." : "";
          const input = control === "textarea"
            ? `<textarea id="${inputId}" name="${field}" rows="3" data-entry-field="${field}" placeholder="Tulis jawaban Anda">${escapeHtml(value)}</textarea>`
            : `<input id="${inputId}" name="${field}" type="${kind === "money" || kind === "decimal" ? "number" : kind}" value="${escapeHtml(value)}" data-entry-field="${field}"${kind === "money" || kind === "decimal" ? ` min="0" step="${kind === "decimal" ? "0.01" : "1"}" inputmode="decimal"` : ""} placeholder="${kind === "date" ? "" : "Tulis jawaban Anda"}">`;
          return `<div class="entry-field${control === "textarea" ? " entry-field-full" : ""}"><label for="${inputId}">${escapeHtml(label)}</label>${input}${hint ? `<small>${hint}</small>` : ""}</div>`;
        }).join("")}</div>
      </section>`).join("");
    updateEntryProgress();
    const dialog = document.getElementById("entryDialog");
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("input, textarea")?.focus();
  }

  function updateEntryProgress() {
    if (!activeEntry) return;
    const fields = entryFields(activeEntry.type);
    const completed = fields.filter(([field]) => {
      const value = activeEntry.draft[field];
      return value !== null && value !== undefined && String(value).trim() !== "";
    }).length;
    const percent = fields.length ? Math.round((completed / fields.length) * 100) : 0;
    document.getElementById("entryProgressLabel").textContent = `${percent}%`;
    document.getElementById("entryProgressBar").style.width = `${percent}%`;
  }

  function updateEntryDraft(input) {
    if (!activeEntry) return;
    const field = input.dataset.entryField;
    const fieldConfig = entryFields(activeEntry.type).find(([name]) => name === field);
    if (!fieldConfig) return;
    const [, , kind] = fieldConfig;
    activeEntry.draft[field] = kind === "money" || kind === "decimal"
      ? input.value === "" ? null : Number(input.value)
      : input.value;
    if (["driver", "plate", "type"].includes(field)) {
      const vehicleSelector = document.getElementById("entry-vehicle-master");
      if (vehicleSelector) vehicleSelector.value = "";
    }
    if (field === "previousFillDate" || field === "previousKm") {
      activeEntry.autoPrevious[field] = true;
    }
    if (activeEntry.type === "fuel" && field === "type") {
      applyFuelPrice(input.value);
    }
    if (activeEntry.type === "fuel" && ["driver", "plate"].includes(field)) updatePreviousFuelDefaults();
    if (activeEntry.type === "fuel" && field === "fillDate") {
      updatePreviousFuelDefaults();
    }
    updateEntryProgress();
  }

  function applyFuelPrice(type) {
    const expectedPrice = window.ETTFuelUtils.defaultPriceForType(type);
    const currentPrice = activeEntry.draft.pricePerLiter;
    if (expectedPrice === null) {
      if (activeEntry.autoPrice !== null && currentPrice === activeEntry.autoPrice) {
        activeEntry.draft.pricePerLiter = null;
        const input = document.getElementById("entry-pricePerLiter");
        if (input) input.value = "";
      }
      activeEntry.autoPrice = null;
      return;
    }
    if (currentPrice === null || currentPrice === "" || currentPrice === activeEntry.autoPrice) {
      activeEntry.draft.pricePerLiter = expectedPrice;
      activeEntry.autoPrice = expectedPrice;
      const input = document.getElementById("entry-pricePerLiter");
      if (input) input.value = String(expectedPrice);
      return;
    }
    activeEntry.autoPrice = null;
  }

  function updatePreviousFuelDefaults() {
    if (!activeEntry || activeEntry.type !== "fuel") return;
    const { draft, id } = activeEntry;
    const candidates = [
      ...state.report.fuel.map((row) => ({ ...row, month: state.month })),
      ...state.fuelHistory
    ];
    const previous = window.ETTFuelUtils.findPreviousFuelEntry(candidates, {
      plate: draft.plate,
      driver: draft.driver,
      fillDate: draft.fillDate,
      excludeId: id,
      excludeMonth: state.month
    });
    const values = {
      previousFillDate: previous?.fillDate || "",
      previousKm: previous?.currentKm ?? null
    };
    for (const field of Object.keys(values)) {
      if (activeEntry.autoPrevious[field]) continue;
      draft[field] = values[field];
      const input = document.getElementById(`entry-${field}`);
      if (input) input.value = values[field] ?? "";
    }
    updateEntryProgress();
  }

  function saveEntryForm(event) {
    event.preventDefault();
    if (!activeEntry) return;
    const { type, id, draft } = activeEntry;
    const form = document.getElementById("entryForm");
    for (const [field, , kind] of entryFields(type)) {
      const input = form.elements.namedItem(field);
      draft[field] = kind === "money" || kind === "decimal"
        ? input.value === "" ? null : Number(input.value)
        : input.value;
    }
    const hasContent = entryFields(type).some(([field]) => {
      const value = draft[field];
      return value !== null && value !== undefined && String(value).trim() !== "";
    });
    if (!hasContent) {
      document.getElementById("entryFormError").textContent = "Isi setidaknya satu jawaban sebelum menyimpan.";
      form.querySelector("input, textarea")?.focus();
      return;
    }
    const collection = collectionFor(type);
    const record = { ...(id ? collection.find((row) => row.id === id) : {}), ...draft, id: id || newId() };
    if (id) {
      const index = collection.findIndex((row) => row.id === id);
      collection[index] = record;
    } else {
      collection.push(record);
    }
    state.tab = type;
    document.getElementById("entryDialog").close();
    render();
    scheduleSave();
    showToast(id ? "Perubahan data tersimpan." : "Data baru berhasil ditambahkan.");
  }

  function renderTrendChart() {
    const chart = document.getElementById("trendChart");
    const monthStart = `${state.month}-`;
    const daysInMonth = state.month
      ? new Date(Number(state.month.slice(0, 4)), Number(state.month.slice(5, 7)), 0).getDate()
      : 31;
    const daily = Array.from({ length: daysInMonth }, () => ({ bop: 0, fuel: 0 }));
    let hasDatedExpense = false;

    for (const row of state.report.bop) {
      const date = row.reportDate || row.date;
      if (!date?.startsWith(monthStart)) continue;
      const day = Number(date.slice(-2));
      if (day < 1 || day > daysInMonth) continue;
      daily[day - 1].bop += bopTotal(row);
      hasDatedExpense = true;
    }
    for (const row of state.report.fuel) {
      const date = row.reportDate || row.fillDate;
      if (!date?.startsWith(monthStart)) continue;
      const day = Number(date.slice(-2));
      if (day < 1 || day > daysInMonth) continue;
      daily[day - 1].fuel += Number(row.fuelCost) || 0;
      hasDatedExpense = true;
    }

    const width = 720;
    const height = 240;
    const pad = { top: 16, right: 16, bottom: 30, left: 78 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(0, ...daily.flatMap((day) => [day.bop, day.fuel]));
    const scaleMax = maxValue > 0 ? Math.ceil(maxValue / 5) * 5 : 100;
    const x = (index) => pad.left + index * (plotWidth / Math.max(daysInMonth - 1, 1));
    const y = (value) => pad.top + plotHeight - (value / scaleMax) * plotHeight;
    const ticks = Array.from({ length: 5 }, (_, index) => scaleMax * (4 - index) / 4);
    const grid = ticks.map((value) => {
      const position = y(value);
      return `<line x1="${pad.left}" y1="${position}" x2="${width - pad.right}" y2="${position}" class="chart-grid-line"></line><text x="${pad.left - 10}" y="${position + 4}" text-anchor="end" class="chart-axis-label">${escapeHtml(compactCurrency(value))}</text>`;
    }).join("");
    const dateTicks = [...new Set([1, 5, 10, 15, 20, 25, daysInMonth])]
      .filter((day) => day <= daysInMonth)
      .map((day) => {
        const position = x(day - 1);
        return `<line x1="${position}" y1="${pad.top}" x2="${position}" y2="${pad.top + plotHeight}" class="chart-grid-line chart-grid-vertical"></line><text x="${position}" y="${height - 8}" text-anchor="middle" class="chart-axis-label">${day}</text>`;
      }).join("");
    const series = [
      { key: "bop", color: "#507d70" },
      { key: "fuel", color: "#c19756" }
    ];
    const lines = series.map(({ key, color }) => {
      const points = daily.map((day, index) => `${x(index).toFixed(2)},${y(day[key]).toFixed(2)}`);
      return `<path d="${points.map((point, index) => `${index === 0 ? "M" : "L"}${point}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>`;
    }).join("");
    const values = daily.flatMap((day) => [day.bop, day.fuel]).filter((value) => value > 0);
    const dailyPeak = values.length ? Math.max(...values) : 0;
    const dailyTotal = daily.reduce((sum, day) => sum + day.bop + day.fuel, 0);
    chart.setAttribute("aria-label", `Grafik tren biaya harian BOP dan BBM untuk ${monthLabel(state.month)}.`);
    chart.innerHTML = `
      <title>Tren pengeluaran harian BOP dan BBM</title>
      <defs>
        <linearGradient id="chartBackdrop" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f8f8f2"></stop>
          <stop offset="100%" stop-color="#fffefa"></stop>
        </linearGradient>
      </defs>
      <rect x="${pad.left}" y="${pad.top}" width="${plotWidth}" height="${plotHeight}" rx="7" fill="url(#chartBackdrop)"></rect>
      ${grid}${dateTicks}${lines}
      ${!hasDatedExpense ? `<text x="${pad.left + plotWidth / 2}" y="${pad.top + plotHeight / 2}" text-anchor="middle" class="chart-empty-label">Belum ada pengeluaran bertanggal pada periode ini</text>` : ""}
    `;
    document.getElementById("trendCaption").textContent = `${daysInMonth} hari · ${monthLabel(state.month)}`;
    document.getElementById("trendSummary").textContent = hasDatedExpense
      ? `Akumulasi pengeluaran ${money.format(dailyTotal)} · Pengeluaran tertinggi dalam satu hari ${money.format(dailyPeak)}.`
      : "Isi tanggal laporan dan nominal pengeluaran untuk melihat tren harian.";
  }

  function compactCurrency(value) {
    if (value >= 1_000_000) return `Rp${number.format(value / 1_000_000)} jt`;
    if (value >= 1_000) return `Rp${number.format(value / 1_000)} rb`;
    return `Rp${number.format(value)}`;
  }

  function renderFleetBreakdown() {
    const types = new Map();
    for (const vehicle of state.master.vehicles) {
      const type = vehicle.type.trim() || "Tipe belum diisi";
      types.set(type, (types.get(type) || 0) + 1);
    }
    const breakdown = [...types.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "id"));
    const total = state.master.vehicles.length;
    const maxCount = Math.max(1, ...breakdown.map(([, count]) => count));
    document.getElementById("fleetTypeCount").textContent = `${breakdown.length} tipe`;
    document.getElementById("fleetBreakdown").innerHTML = breakdown.length
      ? breakdown.map(([type, count]) => `<div class="fleet-row">
          <div class="fleet-row-heading"><span>${escapeHtml(type)}</span><strong>${number.format(count)} <small>unit</small></strong></div>
          <div class="fleet-track" role="img" aria-label="${escapeHtml(type)}: ${number.format(count)} dari ${number.format(total)} armada">
            <span class="fleet-fill" style="--bar-width:${(count / maxCount) * 100}%"></span>
          </div>
        </div>`).join("")
      : `<p class="chart-empty-label fleet-empty">Belum ada data kendaraan.</p>`;
    document.getElementById("fleetSummary").textContent = `${number.format(total)} unit armada terdaftar dalam master data.`;
  }

  function renderExpenseBreakdown() {
    const totals = bopCategories
      .map(([key, label]) => ({
        label,
        amount: state.report.bop.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
      }))
      .sort((left, right) => right.amount - left.amount);
    const maximum = Math.max(0, ...totals.map((entry) => entry.amount));
    const total = totals.reduce((sum, entry) => sum + entry.amount, 0);
    const hasExpenses = maximum > 0;
    document.getElementById("expenseTotalLabel").textContent = `Total ${money.format(total)}`;
    document.getElementById("expenseBreakdown").innerHTML = hasExpenses
      ? totals.map((entry) => {
        const percentage = total > 0 ? (entry.amount / total) * 100 : 0;
        return `<div class="expense-row">
          <div class="expense-heading"><span>${escapeHtml(entry.label)}</span><strong>${money.format(entry.amount)}</strong></div>
          <div class="expense-track" role="img" aria-label="${escapeHtml(entry.label)}: ${money.format(entry.amount)}, ${number.format(percentage)} persen dari total BOP">
            <span class="expense-fill" style="--bar-width:${(entry.amount / maximum) * 100}%"></span>
          </div>
        </div>`;
      }).join("")
      : `<p class="chart-empty-label expense-empty">Belum ada pengeluaran BOP pada periode ini.</p>`;
    document.getElementById("expenseSummary").textContent = hasExpenses
      ? `${money.format(total)} dari ${number.format(state.report.bop.length)} catatan BOP pada ${monthLabel(state.month)}.`
      : "Rincian biaya berdasarkan kategori akan tampil setelah data BOP diisi.";
  }

  function renderArchiveMonths() {
    const archive = document.getElementById("archiveMonthList");
    const months = [...new Set([...state.availableMonths, state.month].filter(Boolean))].sort();
    archive.innerHTML = months.map((month) => `<button class="archive-month-button${month === state.month ? " is-active" : ""}" type="button" data-report-month="${escapeHtml(month)}" aria-pressed="${month === state.month}">${escapeHtml(monthLabel(month))}</button>`).join("");
  }

  function updateOverview() {
    const bopSum = state.report.bop.reduce((sum, row) => sum + bopTotal(row), 0);
    const fuelSum = state.report.fuel.reduce((sum, row) => sum + (Number(row.fuelCost) || 0), 0);
    const liters = state.report.fuel.reduce((sum, row) => sum + (fuelValues(row).liters || 0), 0);
    document.getElementById("periodHeading").textContent = monthLabel(state.month);
    document.getElementById("reportMonthChip").textContent = monthLabel(state.month);
    document.getElementById("bopTotal").textContent = money.format(bopSum);
    document.getElementById("bopCount").textContent = `${state.report.bop.length} catatan`;
    document.getElementById("fuelTotal").textContent = money.format(fuelSum);
    document.getElementById("fuelCount").textContent = `${state.report.fuel.length} catatan pengisian`;
    document.getElementById("literTotal").textContent = `${number.format(liters)} L`;
    const driverCount = new Set(state.master.vehicles.map((vehicle) => vehicle.driver.trim().toLocaleLowerCase("id-ID")).filter(Boolean)).size;
    document.getElementById("vehicleCount").textContent = number.format(state.master.vehicles.length);
    document.getElementById("vehicleCardCount").textContent = number.format(state.master.vehicles.length);
    document.getElementById("driverCount").textContent = `${number.format(driverCount)} driver terdata`;
    renderArchiveMonths();
    renderTrendChart();
    renderFleetBreakdown();
    renderExpenseBreakdown();
  }

  function render() {
    renderBopTable();
    renderFuelTable();
    renderMasterTables();
    updateOverview();
    document.getElementById("pageTitle").textContent = ({
      overview: "Ringkasan laporan",
      bop: "Rincian BOP",
      fuel: "BBM Cash",
      master: "Master Data"
    })[state.tab];
    document.getElementById("printPeriodHeading").textContent = monthLabel(state.month);
    document.getElementById("printReportHeading").textContent = ({
      overview: "Ringkasan Laporan Operasional",
      bop: "Rincian BOP",
      fuel: "Rincian BBM RFID / Cash",
      master: "Master Data Armada dan Uang Inap"
    })[state.tab];
    for (const button of document.querySelectorAll("[data-tab]")) {
      if (button.classList.contains("tab-button")) {
        button.classList.toggle("is-active", button.dataset.tab === state.tab);
      }
    }
    for (const [tab, panelId] of Object.entries({
      overview: "overviewPanel",
      bop: "bopPanel",
      fuel: "fuelPanel",
      master: "masterPanel"
    })) {
      document.getElementById(panelId).hidden = state.tab !== tab;
    }
    window.requestAnimationFrame(updateHorizontalScrollDock);
  }

  function activeTableScrollElement() {
    const panelId = ({ bop: "bopPanel", fuel: "fuelPanel", master: "masterPanel" })[state.tab];
    return panelId ? document.querySelector(`#${panelId} .table-scroll`) : null;
  }

  function updateHorizontalScrollDock() {
    const target = activeTableScrollElement();
    if (!target || window.innerWidth <= 700 || document.getElementById("entryDialog").open) {
      horizontalScrollDock.hidden = true;
      return;
    }
    const maxScroll = target.scrollWidth - target.clientWidth;
    if (maxScroll <= 1) {
      horizontalScrollDock.hidden = true;
      return;
    }
    horizontalScrollDock.hidden = false;
    horizontalScrollSpacer.style.width = `${horizontalScrollTrack.clientWidth + maxScroll}px`;
    horizontalScrollTrack.scrollLeft = target.scrollLeft;
    horizontalScrollTrack.setAttribute("aria-valuemin", "0");
    horizontalScrollTrack.setAttribute("aria-valuemax", String(Math.round(maxScroll)));
    horizontalScrollTrack.setAttribute("aria-valuenow", String(Math.round(target.scrollLeft)));
  }

  function syncHorizontalScroll(source) {
    const target = activeTableScrollElement();
    if (!target || horizontalScrollDock.hidden) return;
    const from = source === horizontalScrollTrack ? horizontalScrollTrack : target;
    const to = source === horizontalScrollTrack ? target : horizontalScrollTrack;
    if (Math.abs(to.scrollLeft - from.scrollLeft) > 1) to.scrollLeft = from.scrollLeft;
    horizontalScrollTrack.setAttribute("aria-valuenow", String(Math.round(horizontalScrollTrack.scrollLeft)));
  }

  function collectionFor(name) {
    if (name === "bop") return state.report.bop;
    if (name === "fuel") return state.report.fuel;
    if (name === "vehicles") return state.master.vehicles;
    if (name === "allowances") return state.master.allowances;
    return null;
  }

  function updateComputedRow(input) {
    const rowElement = input.closest("tr");
    const collection = input.dataset.collection;
    const row = collectionFor(collection)?.find((item) => item.id === input.dataset.id);
    if (!row || !rowElement) return;
    if (collection === "bop") {
      const cell = rowElement.querySelector('[data-calculated="total"]');
      if (cell) cell.textContent = money.format(bopTotal(row));
    }
    if (collection === "fuel") {
      const computed = fuelValues(row);
      for (const field of ["distance", "liters", "scale"]) {
        const cell = rowElement.querySelector(`[data-calculated="${field}"]`);
        if (cell) cell.textContent = computed[field] === null ? "—" : number.format(computed[field]);
      }
    }
  }

  function updateRowInput(input) {
    const collection = collectionFor(input.dataset.collection);
    const row = collection?.find((item) => item.id === input.dataset.id);
    if (!row) return;
    const value = input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
    row[input.dataset.field] = value;
    if (input.dataset.field === "driver" && (input.dataset.collection === "bop" || input.dataset.collection === "fuel")) {
      const vehicle = state.master.vehicles.find((item) => item.driver.trim().toLocaleLowerCase("id-ID") === input.value.trim().toLocaleLowerCase("id-ID"));
      if (vehicle) {
        row.plate = vehicle.plate;
        row.type = vehicle.type;
        for (const field of ["plate", "type"]) {
          const target = input.closest("tr").querySelector(`[data-collection="${input.dataset.collection}"][data-id="${CSS.escape(input.dataset.id)}"][data-field="${field}"]`);
          if (target) target.value = vehicle[field];
        }
      }
    }
    updateComputedRow(input);
    scheduleSave();
  }

  async function downloadWorkbook() {
    await persist();
    const response = await fetch(`/api/export?month=${encodeURIComponent(state.month)}`, { credentials: "same-origin" });
    if (response.status === 401) {
      setAuthenticated(false);
      throw new Error("Sesi berakhir. Silakan masuk kembali.");
    }
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Excel tidak berhasil dibuat.");
    }
    const file = await response.blob();
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `Laporan-Operasional-ETT-${state.month}.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("Excel berhasil diunduh.");
  }

  async function changeMonth(month) {
    if (!month || month === state.month) return;
    const previousMonth = state.month;
    try {
      await persist();
      await loadMonth(month);
      showToast(`Laporan ${monthLabel(month)} dibuka.`);
    } catch (error) {
      monthInput.value = previousMonth;
      showToast(`Tidak dapat membuka laporan: ${error.message}`, true);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const submit = loginForm.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await requestJson("/api/login", {
        method: "POST",
        body: JSON.stringify(authMode === "email"
          ? { email: emailInput.value, password: passwordInput.value }
          : { pin: pinInput.value })
      });
      setAuthenticated(true);
      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      await loadMonth(month);
    } catch (error) {
      loginError.textContent = error.message;
      (authMode === "email" ? passwordInput : pinInput).select();
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("mainTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    state.tab = button.dataset.tab;
    render();
  });

  document.getElementById("appView").addEventListener("click", async (event) => {
    if (event.target.closest("#mainTabs")) return;
    const monthButton = event.target.closest("[data-report-month]");
    if (monthButton) {
      await changeMonth(monthButton.dataset.reportMonth);
      return;
    }
    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
      state.tab = editButton.dataset.edit;
      openEntryForm(editButton.dataset.edit, editButton.dataset.id);
      return;
    }
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) {
      if (!window.confirm("Hapus baris ini?")) return;
      const collection = collectionFor(deleteButton.dataset.delete);
      const index = collection?.findIndex((row) => row.id === deleteButton.dataset.id);
      if (index >= 0) collection.splice(index, 1);
      render();
      scheduleSave();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action) {
      let openFormType = null;
      if (action === "add-bop") {
        openFormType = "bop";
        state.tab = "bop";
      } else if (action === "add-fuel") {
        openFormType = "fuel";
        state.tab = "fuel";
      } else if (action === "add-vehicle") {
        state.master.vehicles.push({ id: newId(), driver: "", plate: "", type: "" });
        state.tab = "master";
      } else if (action === "add-allowance") {
        state.master.allowances.push({ id: newId(), destination: "", role: "Driver", amount: null });
        state.tab = "master";
      }
      render();
      if (openFormType) openEntryForm(openFormType);
      if (!openFormType) scheduleSave();
      return;
    }

    const tabLink = event.target.closest("[data-tab]");
    if (tabLink) {
      state.tab = tabLink.dataset.tab;
      render();
    }
  });

  const entryDialog = document.getElementById("entryDialog");
  document.getElementById("entryForm").addEventListener("input", (event) => {
    const input = event.target.closest("[data-entry-field]");
    if (input) updateEntryDraft(input);
  });
  document.getElementById("entryForm").addEventListener("change", (event) => {
    const selector = event.target.closest("[data-entry-vehicle]");
    if (!selector || !activeEntry) return;
    const vehicle = state.master.vehicles.find((item) => item.id === selector.value);
    if (!vehicle) return;
    const values = window.ETTFuelUtils.vehicleFieldsForSelection(vehicle);
    Object.assign(activeEntry.draft, values);
    for (const [field, value] of Object.entries(values)) {
      const input = document.getElementById(`entry-${field}`);
      if (input) input.value = value;
    }
    if (activeEntry.type === "fuel") {
      activeEntry.autoPrevious = { previousFillDate: false, previousKm: false };
      applyFuelPrice(vehicle.type);
      updatePreviousFuelDefaults();
    }
    updateEntryProgress();
  });
  document.getElementById("entryForm").addEventListener("submit", saveEntryForm);
  document.getElementById("entryCancelButton").addEventListener("click", () => entryDialog.close());
  document.getElementById("entryCloseButton").addEventListener("click", () => entryDialog.close());
  entryDialog.addEventListener("click", (event) => {
    if (event.target === entryDialog) entryDialog.close();
  });
  entryDialog.addEventListener("close", () => { activeEntry = null; });
  entryDialog.addEventListener("close", () => window.requestAnimationFrame(updateHorizontalScrollDock));

  horizontalScrollTrack.addEventListener("scroll", () => syncHorizontalScroll(horizontalScrollTrack));
  document.getElementById("appView").addEventListener("scroll", (event) => {
    if (event.target.matches?.(".table-scroll")) syncHorizontalScroll(event.target);
  }, true);
  horizontalScrollDock.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scroll-step]");
    if (!button) return;
    const target = activeTableScrollElement();
    if (!target) return;
    const distance = Math.max(240, target.clientWidth * 0.75) * Number(button.dataset.scrollStep);
    target.scrollBy({ left: distance, behavior: "smooth" });
    horizontalScrollTrack.scrollBy({ left: distance, behavior: "smooth" });
  });
  window.addEventListener("resize", updateHorizontalScrollDock);

  document.getElementById("appView").addEventListener("input", (event) => {
    const input = event.target.closest("[data-collection]");
    if (input) updateRowInput(input);
  });

  document.getElementById("appView").addEventListener("change", (event) => {
    const input = event.target.closest('[data-collection][data-field="driver"]');
    if (input) updateRowInput(input);
  });

  monthInput.addEventListener("change", async () => {
    if (!monthInput.value || monthInput.value === state.month) return;
    await changeMonth(monthInput.value);
  });

  document.getElementById("exportButton").addEventListener("click", () => {
    downloadWorkbook().catch((error) => showToast(error.message, true));
  });

  document.getElementById("printButton").addEventListener("click", async () => {
    try {
      await persist();
      window.print();
    } catch (error) {
      showToast(`Tidak dapat mencetak laporan: ${error.message}`, true);
    }
  });

  document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
      await persist();
      await requestJson("/api/logout", { method: "POST", body: "{}" });
      state.report = { bop: [], fuel: [] };
      setAuthenticated(false);
    } catch (error) {
      showToast(`Tidak dapat keluar: ${error.message}`, true);
    }
  });

  async function initialize() {
    try {
      const session = await requestJson("/api/session");
      setAuthMode(session.authMode);
      setAuthenticated(session.authenticated);
      if (session.authenticated) {
        const today = new Date();
        await loadMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
      }
    } catch (error) {
      loginError.textContent = `Tidak dapat terhubung ke aplikasi: ${error.message}`;
      setAuthMode("pin");
      setAuthenticated(false);
    }
  }

  initialize();
})();
