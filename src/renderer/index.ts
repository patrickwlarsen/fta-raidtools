import { createAppHeader } from "./components/organisms/AppHeader";
import { createLootHistoryPage } from "./components/pages/LootHistoryPage";
import { createRosterPage } from "./components/pages/RosterPage";
import { createAttendancePage } from "./components/pages/AttendancePage";
import { createSettingsPage } from "./components/pages/SettingsPage";
import { createRaidPage } from "./components/pages/RaidPage";
import { lootStore } from "./store/LootStore";
import { rosterStore } from "./store/RosterStore";
import { attendanceStore } from "./store/AttendanceStore";
import { settingsStore } from "./store/SettingsStore";
import { raidSettingsStore } from "./store/RaidSettingsStore";
import { LootEntry } from "./models/LootEntry";
import { RosterEntry } from "./models/RosterEntry";
import { AttendanceEntry } from "./models/AttendanceEntry";
import { SettingsEntry } from "./models/SettingsEntry";
import { RaidSettingsEntry } from "./models/RaidSettingsEntry";

type PageFactory = () => HTMLElement;

const pages: Record<string, PageFactory> = {
  "#loot-history": createLootHistoryPage,
  "#roster": createRosterPage,
  "#attendance": createAttendancePage,
  "#raid": createRaidPage,
  "#settings": createSettingsPage,
};

let main: HTMLElement;

function parseLootRows(rows: string[][]): LootEntry[] {
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

function parseRosterRows(rows: string[][]): RosterEntry[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    name: row[0]?.trim() ?? "",
    raidHelperName: row[1]?.trim() ?? "",
    rank: row[2]?.trim() ?? "",
    class: row[3]?.trim() ?? "",
    ms: row[4]?.trim() ?? "",
    os: row[5]?.trim() ?? "",
    main: row[6]?.trim() ?? "",
    profession1: row[7]?.trim() ?? "",
    profession2: row[8]?.trim() ?? "",
    rollModifier: row[9]?.trim() ?? "",
    notes: row[10]?.trim() ?? "",
  }));
}

function parseSettingsRows(rows: string[][]): SettingsEntry[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    key: row[0]?.trim() ?? "",
    value: row[1]?.trim() ?? "",
  }));
}

function parseRaidSettingsRows(rows: string[][]): RaidSettingsEntry[] {
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

function parseAttendanceRows(rows: string[][]): AttendanceEntry[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    date: row[0]?.trim() ?? "",
    eventName: row[1]?.trim() ?? "",
    link: row[2]?.trim() ?? "",
    roster: row[3] ?? "",
  }));
}

async function preloadSheetData(): Promise<void> {
  const config = await window.api.loadConfig();
  if (!config.googleSheetUrl || !config.serviceAccountKeyPath) return;

  const fetches: Promise<void>[] = [];

  if (lootStore.getAll().length === 0) {
    fetches.push(
      window.api.fetchSheet("loothistory").then((rows) => {
        lootStore.replaceAll(parseLootRows(rows));
      }).catch((err) => console.error("Preload loothistory failed:", err))
    );
  }

  if (rosterStore.getAll().length === 0) {
    fetches.push(
      window.api.fetchSheet("roster").then((rows) => {
        rosterStore.replaceAll(parseRosterRows(rows));
      }).catch((err) => console.error("Preload roster failed:", err))
    );
  }

  if (attendanceStore.getAll().length === 0) {
    fetches.push(
      window.api.fetchSheet("attendance").then((rows) => {
        attendanceStore.replaceAll(parseAttendanceRows(rows));
      }).catch((err) => console.error("Preload attendance failed:", err))
    );
  }

  if (settingsStore.getAll().length === 0) {
    fetches.push(
      window.api.fetchSheet("settings").then((rows) => {
        settingsStore.replaceAll(parseSettingsRows(rows));
      }).catch((err) => console.error("Preload settings failed:", err))
    );
  }

  if (raidSettingsStore.getAll().length === 0) {
    fetches.push(
      window.api.fetchSheet("raidsettings").then((rows) => {
        raidSettingsStore.replaceAll(parseRaidSettingsRows(rows));
      }).catch((err) => console.error("Preload raidsettings failed:", err))
    );
  }

  await Promise.all(fetches);
}

function navigateTo(hash: string): void {
  const factory = pages[hash] ?? pages["#loot-history"];
  main.innerHTML = "";
  main.appendChild(factory());
}

function init(): void {
  const body = document.body;
  body.innerHTML = "";

  const bannerWrap = document.createElement("div");
  bannerWrap.className = "app-banner-wrap";

  const banner = document.createElement("img");
  banner.className = "app-banner";
  banner.src = "images/app-header-wide.png";
  banner.alt = "From the Ashes";

  const version = document.createElement("span");
  version.className = "app-version";
  version.textContent = "v1.3.0";

  bannerWrap.appendChild(banner);
  bannerWrap.appendChild(version);
  body.appendChild(bannerWrap);

  const header = createAppHeader((href) => navigateTo(href));
  body.appendChild(header);

  main = document.createElement("main");
  main.id = "app";
  body.appendChild(main);

  navigateTo("#loot-history");

  // Preload sheet data in background; pages subscribe to store changes
  preloadSheetData();
}

document.addEventListener("DOMContentLoaded", init);
