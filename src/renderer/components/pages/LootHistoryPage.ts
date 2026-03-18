import { createGrid, GridApi, GridOptions, ColDef, AllCommunityModule, ModuleRegistry, themeAlpine, colorSchemeDark, CellValueChangedEvent, CellMouseOverEvent, CellMouseOutEvent } from "ag-grid-community";
import { LootEntry } from "../../models/LootEntry";
import { lootStore } from "../../store/LootStore";
import { parseLootCsv } from "../../services/csvParser";

ModuleRegistry.registerModules([AllCommunityModule]);

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
    const newEntry: LootEntry = { date: "", player: "", item: "", itemId: null };
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
  importBtn.textContent = "Import CSV";
  importBtn.addEventListener("click", async () => {
    const csv = await window.api.openCsvFile();
    if (!csv) return;
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

    const merged = [...existing, ...newEntries];
    lootStore.replaceAll(merged);
    gridApi?.setGridOption("rowData", merged);
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
      const header = ["Date", "Player", "Item", "ItemID"];
      const rows = entries.map((e) => [
        e.date,
        e.player,
        e.item,
        e.itemId != null ? String(e.itemId) : "",
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
