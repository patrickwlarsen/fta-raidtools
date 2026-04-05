import { createGrid, GridApi, GridOptions, ColDef, AllCommunityModule, ModuleRegistry, themeAlpine, colorSchemeDark } from "ag-grid-community";
import { rosterStore } from "../../store/RosterStore";
import { raidSettingsStore } from "../../store/RaidSettingsStore";
import { RaidSettingsEntry } from "../../models/RaidSettingsEntry";

ModuleRegistry.registerModules([AllCommunityModule]);

const SHEET_NAME = "raidsettings";
const HEADERS = ["ID", "name", "award-for-completion", "item-win-deduction", "items-deduction-max", "absence-unexcused", "did-not-sign-up"];

interface RaidMatchEntry {
  name: string;
  raidHelperName: string;
  rollModifier: string;
  eventName: string;
}

function extractEventId(input: string): string | null {
  const trimmed = input.trim();
  const apiMatch = trimmed.match(/raid-helper\.(?:dev|xyz)\/api\/v2\/events\/(\d+)/);
  if (apiMatch) return apiMatch[1];
  const eventMatch = trimmed.match(/raid-helper\.(?:dev|xyz)\/event\/(\d+)/);
  if (eventMatch) return eventMatch[1];
  return null;
}

function showUrlPrompt(onSubmit: (eventId: string) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const title = document.createElement("h3");
  title.className = "modal__title";
  title.textContent = "Load Raid Helper Event";
  modal.appendChild(title);

  const field = document.createElement("div");
  field.className = "modal__field";

  const label = document.createElement("label");
  label.className = "modal__label";
  label.textContent = "Raid Helper Event URL";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "modal__input";
  input.placeholder = "https://raid-helper.dev/event/...";

  const error = document.createElement("div");
  error.className = "attendance-url-error";
  error.style.display = "none";
  error.textContent = "Invalid URL. Use a raid-helper.dev event or API URL.";

  field.appendChild(label);
  field.appendChild(input);
  field.appendChild(error);
  modal.appendChild(field);

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.textContent = "Load Event";
  submitBtn.addEventListener("click", () => {
    const eventId = extractEventId(input.value);
    if (!eventId) {
      error.style.display = "block";
      input.focus();
      return;
    }
    overlay.remove();
    onSubmit(eventId);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitBtn.click();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  actions.appendChild(submitBtn);
  actions.appendChild(cancelBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  input.focus();
}

function buildResultForm(matches: RaidMatchEntry[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "raid-form";

  const list = document.createElement("div");
  list.className = "raid-list";

  const listHeader = document.createElement("div");
  listHeader.className = "raid-row raid-row--header";
  listHeader.innerHTML =
    `<span class="raid-col raid-col--name">Name</span>` +
    `<span class="raid-col raid-col--rh-name">Raid-Helper Name</span>` +
    `<span class="raid-col raid-col--modifier">Roll Modifier</span>` +
    `<span class="raid-col raid-col--event-name">Event Sign-Up Name</span>`;
  list.appendChild(listHeader);

  for (const entry of matches) {
    const row = document.createElement("div");
    row.className = "raid-row";
    if (!entry.name) row.classList.add("raid-row--unmatched");

    const nameCol = document.createElement("span");
    nameCol.className = "raid-col raid-col--name";
    nameCol.textContent = entry.name || "—";

    const rhNameCol = document.createElement("span");
    rhNameCol.className = "raid-col raid-col--rh-name";
    rhNameCol.textContent = entry.raidHelperName || "—";

    const modCol = document.createElement("span");
    modCol.className = "raid-col raid-col--modifier";
    modCol.textContent = entry.rollModifier || "—";

    const eventNameCol = document.createElement("span");
    eventNameCol.className = "raid-col raid-col--event-name";
    eventNameCol.textContent = entry.eventName;

    row.appendChild(nameCol);
    row.appendChild(rhNameCol);
    row.appendChild(modCol);
    row.appendChild(eventNameCol);
    list.appendChild(row);
  }

  container.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "raid-footer";

  const statusMsg = document.createElement("span");
  statusMsg.className = "raid-status";
  footer.appendChild(statusMsg);

  const exportBtn = document.createElement("button");
  exportBtn.className = "btn btn--primary";
  exportBtn.textContent = "Export to clipboard";
  exportBtn.addEventListener("click", async () => {
    const data = matches.map((m) => ({
      name: m.name,
      raidHelperName: m.raidHelperName,
      rollModifier: m.rollModifier,
      eventName: m.eventName,
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      statusMsg.textContent = "Copied to clipboard!";
      statusMsg.className = "raid-status raid-status--success";
      setTimeout(() => { statusMsg.textContent = ""; }, 3000);
    } catch {
      statusMsg.textContent = "Failed to copy to clipboard.";
      statusMsg.className = "raid-status raid-status--error";
    }
  });

  footer.appendChild(exportBtn);
  container.appendChild(footer);

  return container;
}

/* ── Add new Raid modal ── */

interface RaidSettingsFieldDef {
  key: keyof RaidSettingsEntry;
  label: string;
  placeholder: string;
}

const raidSettingsFormFields: RaidSettingsFieldDef[] = [
  { key: "id", label: "ID", placeholder: "e.g. 4" },
  { key: "name", label: "Name", placeholder: "e.g. Tempest Keep" },
  { key: "awardForCompletion", label: "Award for Completion", placeholder: "e.g. 0.2" },
  { key: "itemWinDeduction", label: "Item Win Deduction", placeholder: "e.g. 0.15" },
  { key: "itemsDeductionMax", label: "Items Deduction Max", placeholder: "e.g. 0.4" },
  { key: "absenceUnexcused", label: "Absence Unexcused", placeholder: "e.g. 0.25" },
  { key: "didNotSignUp", label: "Did Not Sign Up", placeholder: "e.g. 0.1" },
];

function showAddRaidModal(onAdd: (entry: RaidSettingsEntry) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const titleRow = document.createElement("div");
  titleRow.className = "modal__header";

  const title = document.createElement("h3");
  title.className = "modal__title";
  title.textContent = "Add new Raid";

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal__close";
  closeBtn.textContent = "\u00D7";
  closeBtn.addEventListener("click", () => overlay.remove());

  titleRow.appendChild(title);
  titleRow.appendChild(closeBtn);
  modal.appendChild(titleRow);

  const inputs: Record<string, HTMLInputElement> = {};

  raidSettingsFormFields.forEach((field) => {
    const group = document.createElement("div");
    group.className = "modal__field";

    const label = document.createElement("label");
    label.className = "modal__label";
    label.textContent = field.label;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "modal__input";
    input.placeholder = field.placeholder;
    inputs[field.key] = input;

    group.appendChild(label);
    group.appendChild(input);
    modal.appendChild(group);
  });

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn--primary";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    const entry: RaidSettingsEntry = {
      id: inputs.id.value.trim(),
      name: inputs.name.value.trim(),
      awardForCompletion: inputs.awardForCompletion.value.trim(),
      itemWinDeduction: inputs.itemWinDeduction.value.trim(),
      itemsDeductionMax: inputs.itemsDeductionMax.value.trim(),
      absenceUnexcused: inputs.absenceUnexcused.value.trim(),
      didNotSignUp: inputs.didNotSignUp.value.trim(),
    };
    if (!entry.name) {
      inputs.name.focus();
      return;
    }
    onAdd(entry);
    overlay.remove();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  actions.appendChild(addBtn);
  actions.appendChild(cancelBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  inputs.id.focus();
}

/* ── Raid Settings grid helpers ── */

const raidSettingsColumnDefs: ColDef<RaidSettingsEntry>[] = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "name", headerName: "Name", width: 180 },
  { field: "awardForCompletion", headerName: "Award for Completion", width: 170 },
  { field: "itemWinDeduction", headerName: "Item Win Deduction", width: 160 },
  { field: "itemsDeductionMax", headerName: "Items Deduction Max", width: 170 },
  { field: "absenceUnexcused", headerName: "Absence Unexcused", width: 160 },
  { field: "didNotSignUp", headerName: "Did Not Sign Up", flex: 1, minWidth: 140 },
];

let rsGridApi: GridApi<RaidSettingsEntry> | null = null;

function parseRaidSettingsSheetRows(rows: string[][]): RaidSettingsEntry[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    id: row[0]?.trim() ?? "",
    name: row[1]?.trim() ?? "",
    awardForCompletion: row[2]?.trim() ?? "",
    itemWinDeduction: row[3]?.trim() ?? "",
    itemsDeductionMax: row[4]?.trim() ?? "",
    absenceUnexcused: row[5]?.trim() ?? "",
    didNotSignUp: row[6]?.trim() ?? "",
  }));
}

function getAllRaidSettingsRows(): RaidSettingsEntry[] {
  const rows: RaidSettingsEntry[] = [];
  rsGridApi?.forEachNode((node) => {
    if (node.data) rows.push(node.data);
  });
  return rows;
}

function syncRaidSettingsToStore(): void {
  raidSettingsStore.replaceAll(getAllRaidSettingsRows());
}

let rsSpinnerEl: HTMLElement | null = null;

function showRsSpinner(): void {
  if (rsSpinnerEl) rsSpinnerEl.style.display = "flex";
}

function hideRsSpinner(): void {
  if (rsSpinnerEl) rsSpinnerEl.style.display = "none";
}

async function loadRaidSettingsFromSheet(silent = false): Promise<void> {
  const config = await window.api.loadConfig();
  if (!config.googleSheetUrl || !config.serviceAccountKeyPath) {
    if (!silent) alert("Configure Google Sheet URL and service account key in Settings.");
    return;
  }

  showRsSpinner();
  try {
    const rows = await window.api.fetchSheet(SHEET_NAME);
    const entries = parseRaidSettingsSheetRows(rows);
    raidSettingsStore.replaceAll(entries);
    rsGridApi?.setGridOption("rowData", entries);
  } catch (err) {
    if (!silent) alert(`Failed to load raid settings: ${err instanceof Error ? err.message : err}`);
  } finally {
    hideRsSpinner();
  }
}

async function saveRaidSettingsToSheet(): Promise<void> {
  const config = await window.api.loadConfig();
  if (!config.googleSheetUrl || !config.serviceAccountKeyPath) {
    alert("Configure Google Sheet URL and service account key in Settings.");
    return;
  }

  syncRaidSettingsToStore();
  const entries = raidSettingsStore.getAll();
  const dataRows = entries.map((e) => [
    e.id, e.name, e.awardForCompletion, e.itemWinDeduction, e.itemsDeductionMax, e.absenceUnexcused, e.didNotSignUp,
  ]);
  await window.api.writeSheet(SHEET_NAME, [HEADERS, ...dataRows]);
}

/* ── Page factory ── */

export function createRaidPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page raid-page";

  /* ── Export Roll Modifiers toolbar ── */
  const toolbar = document.createElement("div");
  toolbar.className = "loot-history-toolbar";

  const exportBtn = document.createElement("button");
  exportBtn.className = "btn btn--primary";
  exportBtn.textContent = "Export Roll Modifiers";

  toolbar.appendChild(exportBtn);
  page.appendChild(toolbar);

  const content = document.createElement("div");
  content.className = "raid-content";
  page.appendChild(content);

  exportBtn.addEventListener("click", () => {
    showUrlPrompt(async (eventId) => {
      content.innerHTML = "";

      const spinner = document.createElement("div");
      spinner.className = "attendance-loading";
      spinner.innerHTML = '<div class="spinner"></div><span>Loading event data...</span>';
      content.appendChild(spinner);

      try {
        const event = await window.api.fetchRaidHelperEvent(eventId);
        const roster = rosterStore.getAll();

        const signUps = event.signUps.filter((s) => s.className !== "Absence");

        const matches: RaidMatchEntry[] = signUps.map((signUp) => {
          const lower = signUp.name.toLowerCase();

          // Match by raidHelperName first, then by character name
          const rosterEntry =
            roster.find((r) => r.raidHelperName.toLowerCase() === lower) ??
            roster.find((r) => r.name.toLowerCase() === lower);

          return {
            name: rosterEntry?.name ?? "",
            raidHelperName: rosterEntry?.raidHelperName ?? "",
            rollModifier: rosterEntry?.rollModifier ?? "",
            eventName: signUp.name,
          };
        });

        content.innerHTML = "";
        content.appendChild(buildResultForm(matches));
      } catch (err) {
        content.innerHTML = "";
        const errEl = document.createElement("div");
        errEl.className = "attendance-error";
        errEl.textContent = `Failed to load event: ${err instanceof Error ? err.message : err}`;
        content.appendChild(errEl);
      }
    });
  });

  /* ── Raid Settings section ── */
  const sectionTitle = document.createElement("h2");
  sectionTitle.className = "section-title";
  sectionTitle.textContent = "Raid Settings";
  page.appendChild(sectionTitle);

  const rsToolbar = document.createElement("div");
  rsToolbar.className = "loot-history-toolbar";

  const rsLoadBtn = document.createElement("button");
  rsLoadBtn.className = "btn btn--primary";
  rsLoadBtn.textContent = "Load from Sheet";
  rsLoadBtn.addEventListener("click", () => {
    rsLoadBtn.disabled = true;
    rsLoadBtn.textContent = "Loading...";
    loadRaidSettingsFromSheet().finally(() => {
      rsLoadBtn.disabled = false;
      rsLoadBtn.textContent = "Load from Sheet";
    });
  });

  const rsSaveBtn = document.createElement("button");
  rsSaveBtn.className = "btn btn--primary";
  rsSaveBtn.textContent = "Save to Sheet";
  rsSaveBtn.addEventListener("click", async () => {
    rsSaveBtn.disabled = true;
    rsSaveBtn.textContent = "Saving...";
    try {
      await saveRaidSettingsToSheet();
      rsSaveBtn.textContent = "Saved!";
      setTimeout(() => { rsSaveBtn.textContent = "Save to Sheet"; }, 2000);
    } catch (err) {
      alert(`Failed to save raid settings: ${err instanceof Error ? err.message : err}`);
      rsSaveBtn.textContent = "Save to Sheet";
    } finally {
      rsSaveBtn.disabled = false;
    }
  });

  const rsAddBtn = document.createElement("button");
  rsAddBtn.className = "btn btn--primary";
  rsAddBtn.textContent = "Add new Raid";
  rsAddBtn.addEventListener("click", () => {
    showAddRaidModal(async (entry) => {
      rsGridApi?.applyTransaction({ add: [entry] });
      try {
        await saveRaidSettingsToSheet();
      } catch (err) {
        alert(`Raid added locally but failed to save: ${err instanceof Error ? err.message : err}`);
      }
    });
  });

  const rsDeleteBtn = document.createElement("button");
  rsDeleteBtn.className = "btn btn--danger";
  rsDeleteBtn.textContent = "Delete Selected";
  rsDeleteBtn.addEventListener("click", () => {
    const selected = rsGridApi?.getSelectedRows();
    if (selected && selected.length > 0) {
      rsGridApi?.applyTransaction({ remove: selected });
      syncRaidSettingsToStore();
    }
  });

  rsToolbar.appendChild(rsLoadBtn);
  rsToolbar.appendChild(rsSaveBtn);
  rsToolbar.appendChild(rsAddBtn);
  rsToolbar.appendChild(rsDeleteBtn);
  page.appendChild(rsToolbar);

  /* ── Raid Settings grid ── */
  const gridWrap = document.createElement("div");
  gridWrap.className = "grid-wrap";

  rsSpinnerEl = document.createElement("div");
  rsSpinnerEl.className = "grid-spinner";
  rsSpinnerEl.style.display = "none";
  rsSpinnerEl.innerHTML = '<div class="spinner"></div>';

  const gridContainer = document.createElement("div");
  gridContainer.className = "loot-history-grid";

  gridWrap.appendChild(rsSpinnerEl);
  gridWrap.appendChild(gridContainer);
  page.appendChild(gridWrap);

  const gridOptions: GridOptions<RaidSettingsEntry> = {
    theme: themeAlpine.withPart(colorSchemeDark),
    columnDefs: raidSettingsColumnDefs,
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
    onCellValueChanged: () => {
      syncRaidSettingsToStore();
    },
  };

  rsGridApi = createGrid(gridContainer, gridOptions);

  const cached = raidSettingsStore.getAll();
  if (cached.length > 0) {
    rsGridApi.setGridOption("rowData", cached);
  }

  raidSettingsStore.subscribe(() => {
    rsGridApi?.setGridOption("rowData", raidSettingsStore.getAll());
  });

  return page;
}
