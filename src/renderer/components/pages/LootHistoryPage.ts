import { createGrid, GridApi, GridOptions, ColDef, AllCommunityModule, ModuleRegistry, themeAlpine, colorSchemeDark, CellValueChangedEvent, CellMouseOverEvent, CellMouseOutEvent } from "ag-grid-community";
import { LootEntry } from "../../models/LootEntry";
import { lootStore } from "../../store/LootStore";
import { rosterStore } from "../../store/RosterStore";
import { settingsStore } from "../../store/SettingsStore";
import { raidSettingsStore } from "../../store/RaidSettingsStore";
import { RaidSettingsEntry } from "../../models/RaidSettingsEntry";
import { parseLootCsv } from "../../services/csvParser";

ModuleRegistry.registerModules([AllCommunityModule]);

const ROSTER_HEADERS = ["Name", "Raid-Helper name", "Rank", "Class", "MS", "OS", "Main", "Profession 1", "Profession 2", "Roll Modifier", "Notes"];

const tooltipCache = new Map<number, { name: string; quality: number; icon: string; tooltip: string }>();
let tooltipEl: HTMLDivElement | null = null;
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

function getTooltipEl(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "wowhead-tooltip";
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

async function showItemTooltip(itemId: number, x: number, y: number): Promise<void> {
  const el = getTooltipEl();

  let data = tooltipCache.get(itemId);
  if (!data) {
    el.innerHTML = `<div class="wowhead-tooltip__loading">Loading...</div>`;
    el.style.display = "block";
    positionTooltip(el, x, y);
    try {
      data = await window.api.fetchItemTooltip(itemId);
      tooltipCache.set(itemId, data);
    } catch {
      el.style.display = "none";
      return;
    }
  }

  const iconUrl = `https://wow.zamimg.com/images/wow/icons/large/${data.icon}.jpg`;
  el.innerHTML = `
    <div class="wowhead-tooltip__header">
      <img class="wowhead-tooltip__icon" src="${iconUrl}" alt="" />
      <span class="wowhead-tooltip__name" data-quality="${data.quality}">${data.name}</span>
    </div>
    <div class="wowhead-tooltip__body">${data.tooltip}</div>
  `;
  el.style.display = "block";
  positionTooltip(el, x, y);
}

function positionTooltip(el: HTMLElement, x: number, y: number): void {
  const pad = 12;
  el.style.left = `${x + pad}px`;
  el.style.top = `${y + pad}px`;

  // Adjust if overflowing viewport
  const rect = el.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    el.style.left = `${x - rect.width - pad}px`;
  }
  if (rect.bottom > window.innerHeight) {
    el.style.top = `${y - rect.height - pad}px`;
  }
}

function hideItemTooltip(): void {
  if (tooltipTimeout) { clearTimeout(tooltipTimeout); tooltipTimeout = null; }
  const el = getTooltipEl();
  el.style.display = "none";
}

const columnDefs: ColDef<LootEntry>[] = [
  { field: "date", headerName: "Date", width: 180 },
  { field: "player", headerName: "Player", width: 160 },
  { field: "item", headerName: "Item", flex: 1, minWidth: 200 },
  { field: "os", headerName: "OS?", width: 80 },
  { field: "deducted", headerName: "Deducted", width: 100 },
];

let gridApi: GridApi<LootEntry> | null = null;

function syncToStore(): void {
  const rows: LootEntry[] = [];
  gridApi?.forEachNode((node) => {
    if (node.data) rows.push(node.data);
  });
  lootStore.replaceAll(rows);
}

function parseSheetRows(rows: string[][]): LootEntry[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    date: row[0]?.trim() ?? "",
    player: row[1]?.trim() ?? "",
    item: row[2]?.trim() ?? "",
    itemId: row[3] ? parseInt(row[3].trim(), 10) || null : null,
    os: (row[4]?.trim() ?? "").toLowerCase() === "true",
    deducted: row[5]?.trim() ?? "",
  }));
}

let spinnerEl: HTMLElement | null = null;

function showSpinner(): void {
  if (spinnerEl) spinnerEl.style.display = "flex";
}

function hideSpinner(): void {
  if (spinnerEl) spinnerEl.style.display = "none";
}

async function loadFromSheet(silent = false): Promise<void> {
  const config = await window.api.loadConfig();
  if (!config.googleSheetUrl || !config.serviceAccountKeyPath) {
    if (!silent) alert("Configure Google Sheet URL and service account key in Settings.");
    return;
  }

  showSpinner();
  try {
    const rows = await window.api.fetchSheet("loothistory");
    const entries = parseSheetRows(rows);
    lootStore.replaceAll(entries);
    gridApi?.setGridOption("rowData", entries);
  } catch (err) {
    if (!silent) alert(`Failed to load sheet: ${err instanceof Error ? err.message : err}`);
  } finally {
    hideSpinner();
  }
}

function showCsvPasteModal(onSubmit: (csv: string, raidSettings: RaidSettingsEntry) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal import-modal";

  const title = document.createElement("h3");
  title.className = "modal__title";
  title.textContent = "Import data";
  modal.appendChild(title);

  /* ── Raid dropdown ── */
  const raidField = document.createElement("div");
  raidField.className = "modal__field";

  const raidLabel = document.createElement("label");
  raidLabel.className = "modal__label";
  raidLabel.textContent = "Raid";

  const raidSelect = document.createElement("select");
  raidSelect.className = "modal__input";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Choose raid";
  defaultOpt.disabled = true;
  defaultOpt.selected = true;
  raidSelect.appendChild(defaultOpt);

  const raids = raidSettingsStore.getAll();
  for (const raid of raids) {
    const opt = document.createElement("option");
    opt.value = raid.id;
    opt.textContent = raid.name;
    raidSelect.appendChild(opt);
  }

  const raidError = document.createElement("div");
  raidError.className = "modal__error";
  raidError.style.display = "none";
  raidError.textContent = "Please select a raid.";

  raidSelect.addEventListener("change", () => {
    raidError.style.display = "none";
  });

  raidField.appendChild(raidLabel);
  raidField.appendChild(raidSelect);
  raidField.appendChild(raidError);
  modal.appendChild(raidField);

  /* ── CSV textarea ── */
  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = "Paste CSV data below (including header row).";
  modal.appendChild(hint);

  const textarea = document.createElement("textarea");
  textarea.className = "csv-paste-input";
  textarea.placeholder = "Date,Player,Item,ItemID\n...";
  textarea.rows = 12;
  modal.appendChild(textarea);

  const actions = document.createElement("div");
  actions.className = "modal__actions modal__actions--right";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  const importBtn = document.createElement("button");
  importBtn.className = "btn btn--primary";
  importBtn.textContent = "Import";
  importBtn.addEventListener("click", () => {
    if (!raidSelect.value) {
      raidError.style.display = "block";
      raidSelect.focus();
      return;
    }
    const csv = textarea.value.trim();
    if (!csv) return;
    const selectedRaid = raids.find((r) => r.id === raidSelect.value);
    if (!selectedRaid) return;
    overlay.remove();
    onSubmit(csv, selectedRaid);
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(importBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  raidSelect.focus();
}

function showImportModal(entries: LootEntry[], raidSettings: RaidSettingsEntry): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal import-modal";

  const title = document.createElement("h3");
  title.className = "modal__title";
  title.textContent = "Verify Import";
  modal.appendChild(title);

  const list = document.createElement("div");
  list.className = "import-list";

  const listHeader = document.createElement("div");
  listHeader.className = "import-row import-row--header";
  listHeader.innerHTML =
    `<span class="import-col import-col--date">Date</span>` +
    `<span class="import-col import-col--player">Player</span>` +
    `<span class="import-col import-col--item">Item</span>` +
    `<span class="import-col import-col--os">OS?</span>`;
  list.appendChild(listHeader);

  const checkboxes: HTMLInputElement[] = [];

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "import-row";

    const dateCol = document.createElement("span");
    dateCol.className = "import-col import-col--date";
    dateCol.textContent = entry.date;

    const playerCol = document.createElement("span");
    playerCol.className = "import-col import-col--player";
    playerCol.textContent = entry.player;

    const itemCol = document.createElement("span");
    itemCol.className = "import-col import-col--item";
    itemCol.textContent = entry.item;

    const osCol = document.createElement("span");
    osCol.className = "import-col import-col--os";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "import-os-checkbox";
    checkboxes.push(checkbox);
    osCol.appendChild(checkbox);

    row.appendChild(dateCol);
    row.appendChild(playerCol);
    row.appendChild(itemCol);
    row.appendChild(osCol);
    list.appendChild(row);
  }

  modal.appendChild(list);

  const actions = document.createElement("div");
  actions.className = "modal__actions modal__actions--right";

  const verifyBtn = document.createElement("button");
  verifyBtn.className = "btn btn--primary";
  verifyBtn.textContent = "Verify and import";
  verifyBtn.addEventListener("click", async () => {
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Importing...";

    const deductionPerWin = parseFloat(raidSettings.itemWinDeduction) || 0;
    const deductionMax = parseFloat(raidSettings.itemsDeductionMax) || Infinity;

    // Deduct roll modifier for non-OS entries and populate os/deducted fields
    const roster = rosterStore.getAll();
    const rosterByName = new Map<string, typeof roster[0]>();
    for (const r of roster) {
      rosterByName.set(r.name.toLowerCase(), r);
    }

    // Track total deduction applied per player in this import
    const totalDeducted = new Map<string, number>();

    let rosterChanged = false;

    for (let i = 0; i < entries.length; i++) {
      const isOs = checkboxes[i].checked;
      entries[i].os = isOs;

      if (isOs) {
        entries[i].deducted = "";
        continue;
      }

      const playerName = entries[i].player.trim().toLowerCase();
      const rosterEntry = rosterByName.get(playerName);
      if (!rosterEntry) {
        entries[i].deducted = "";
        continue;
      }

      const alreadyDeducted = totalDeducted.get(playerName) ?? 0;
      const remaining = deductionMax - alreadyDeducted;
      const deduction = Math.min(deductionPerWin, Math.max(remaining, 0));

      if (deduction <= 0) {
        entries[i].deducted = "0";
        continue;
      }

      const current = parseFloat(rosterEntry.rollModifier) || 1;
      let newMod = parseFloat((current - deduction).toFixed(4));
      const minRollMod = parseFloat(settingsStore.get("Minimum rollModifier"));
      if (!isNaN(minRollMod) && newMod < minRollMod) {
        newMod = minRollMod;
      }
      rosterEntry.rollModifier = String(newMod);
      entries[i].deducted = String(deduction);
      totalDeducted.set(playerName, alreadyDeducted + deduction);
      rosterChanged = true;
    }

    // Import loot entries to store
    const existing = lootStore.getAll();
    const merged = [...existing, ...entries];
    lootStore.replaceAll(merged);
    gridApi?.setGridOption("rowData", merged);

    // Persist loot history to sheet
    try {
      const lootHeader = ["Date", "Player", "Item", "ItemID", "OS?", "Deducted"];
      const lootRows = merged.map((e) => [
        e.date, e.player, e.item, e.itemId != null ? String(e.itemId) : "", String(e.os), e.deducted,
      ]);
      await window.api.writeSheet("loothistory", [lootHeader, ...lootRows]);
    } catch (err) {
      alert(`Loot imported but failed to save loot history: ${err instanceof Error ? err.message : err}`);
    }

    if (rosterChanged) {
      rosterStore.replaceAll(roster);
      try {
        const rosterRows = roster.map((e) => [
          e.name, e.raidHelperName, e.rank, e.class, e.ms, e.os, e.main, e.profession1, e.profession2, e.rollModifier, e.notes,
        ]);
        await window.api.writeSheet("roster", [ROSTER_HEADERS, ...rosterRows]);
      } catch (err) {
        alert(`Loot imported but failed to save roster: ${err instanceof Error ? err.message : err}`);
      }
    }

    overlay.remove();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  actions.appendChild(cancelBtn);
  actions.appendChild(verifyBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

export function createLootHistoryPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page loot-history-page";

  const toolbar = document.createElement("div");
  toolbar.className = "loot-history-toolbar";

  const loadBtn = document.createElement("button");
  loadBtn.className = "btn btn--primary";
  loadBtn.textContent = "Load from Sheet";
  loadBtn.addEventListener("click", () => {
    loadBtn.disabled = true;
    loadBtn.textContent = "Loading...";
    loadFromSheet().finally(() => {
      loadBtn.disabled = false;
      loadBtn.textContent = "Load from Sheet";
    });
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn--primary";
  addBtn.textContent = "Add Row";
  addBtn.addEventListener("click", () => {
    const newEntry: LootEntry = { date: "", player: "", item: "", itemId: null, os: false, deducted: "" };
    gridApi?.applyTransaction({ add: [newEntry] });
    syncToStore();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn--danger";
  deleteBtn.textContent = "Delete Selected";
  deleteBtn.addEventListener("click", () => {
    const selected = gridApi?.getSelectedRows();
    if (selected && selected.length > 0) {
      gridApi?.applyTransaction({ remove: selected });
      syncToStore();
    }
  });

  const importBtn = document.createElement("button");
  importBtn.className = "btn btn--primary";
  importBtn.textContent = "Import data";
  importBtn.addEventListener("click", () => {
    showCsvPasteModal((csv, raidSettings) => {
      const imported = parseLootCsv(csv);
      if (imported.length === 0) return;

      const existing = lootStore.getAll();
      const existingKeys = new Set(
        existing.map((e) => `${e.date}|${e.player}|${e.item}|${e.itemId ?? ""}`),
      );
      const newEntries = imported.filter(
        (e) => !existingKeys.has(`${e.date}|${e.player}|${e.item}|${e.itemId ?? ""}`),
      );

      if (newEntries.length === 0) {
        alert("No new entries to import (all duplicates).");
        return;
      }

      showImportModal(newEntries, raidSettings);
    });
  });

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn--primary";
  saveBtn.textContent = "Save to Sheet";
  saveBtn.addEventListener("click", async () => {
    const config = await window.api.loadConfig();
    if (!config.googleSheetUrl || !config.serviceAccountKeyPath) {
      alert("Configure Google Sheet URL and service account key in Settings.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      const entries = lootStore.getAll();
      const header = ["Date", "Player", "Item", "ItemID", "OS?", "Deducted"];
      const rows = entries.map((e) => [
        e.date,
        e.player,
        e.item,
        e.itemId != null ? String(e.itemId) : "",
        String(e.os),
        e.deducted,
      ]);
      await window.api.writeSheet("loothistory", [header, ...rows]);
      saveBtn.textContent = "Saved!";
      setTimeout(() => { saveBtn.textContent = "Save to Sheet"; }, 2000);
    } catch (err) {
      alert(`Failed to save sheet: ${err instanceof Error ? err.message : err}`);
      saveBtn.textContent = "Save to Sheet";
    } finally {
      saveBtn.disabled = false;
    }
  });

  toolbar.appendChild(loadBtn);
  toolbar.appendChild(saveBtn);
  toolbar.appendChild(importBtn);
  toolbar.appendChild(addBtn);
  toolbar.appendChild(deleteBtn);
  page.appendChild(toolbar);

  const gridWrap = document.createElement("div");
  gridWrap.className = "grid-wrap";

  spinnerEl = document.createElement("div");
  spinnerEl.className = "grid-spinner";
  spinnerEl.style.display = "none";
  spinnerEl.innerHTML = '<div class="spinner"></div>';

  const gridContainer = document.createElement("div");
  gridContainer.className = "loot-history-grid";

  gridWrap.appendChild(spinnerEl);
  gridWrap.appendChild(gridContainer);
  page.appendChild(gridWrap);

  const gridOptions: GridOptions<LootEntry> = {
    theme: themeAlpine.withPart(colorSchemeDark),
    columnDefs,
    rowData: [],
    defaultColDef: {
      editable: true,
      sortable: true,
      filter: true,
      resizable: true,
    },
    rowSelection: { mode: "multiRow" },
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 20,
    onCellValueChanged: (_event: CellValueChangedEvent<LootEntry>) => {
      syncToStore();
    },
    onCellMouseOver: (event: CellMouseOverEvent<LootEntry>) => {
      if (event.colDef.field !== "item" || !event.data?.itemId) return;
      const itemId = event.data.itemId;
      const mouseEvent = event.event as MouseEvent;
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        showItemTooltip(itemId, mouseEvent.clientX, mouseEvent.clientY);
      }, 300);
    },
    onCellMouseOut: (event: CellMouseOutEvent<LootEntry>) => {
      if (event.colDef.field === "item") {
        hideItemTooltip();
      }
    },
  };

  gridApi = createGrid(gridContainer, gridOptions);

  // Load from store if available, and subscribe for updates (e.g. from preload)
  const cached = lootStore.getAll();
  if (cached.length > 0) {
    gridApi.setGridOption("rowData", cached);
  }

  lootStore.subscribe(() => {
    gridApi?.setGridOption("rowData", lootStore.getAll());
  });

  return page;
}
