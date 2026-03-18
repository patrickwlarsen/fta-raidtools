import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import * as path from "path";
import { loadConfig, saveConfig, AppConfig } from "./config";
import { fetchSheetData, writeSheetData } from "./googleSheets";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "..", "images", "fta-logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
}

function fetchRaidHelperEvent(eventId: string): Promise<unknown> {
  const https = require("https") as typeof import("https");
  const url = `https://raid-helper.dev/api/v2/events/${encodeURIComponent(eventId)}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Raid Helper returned HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from Raid Helper")); }
      });
    }).on("error", (err: Error) => reject(err));
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("config:load", () => loadConfig());
  ipcMain.handle("config:save", (_event, config: AppConfig) => saveConfig(config));
  ipcMain.handle("sheets:fetch", async (_event, sheetName: string) => {
    const config = loadConfig();
    return fetchSheetData(config, sheetName);
  });
  ipcMain.handle("sheets:write", async (_event, sheetName: string, values: string[][]) => {
    const config = loadConfig();
    await writeSheetData(config, sheetName, values);
  });
  ipcMain.handle("wowhead:tooltip", async (_event, itemId: number) => {
    const https = await import("https");
    const url = `https://nether.wowhead.com/tbc/tooltip/item/${itemId}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Wowhead returned HTTP ${res.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error("Invalid JSON from Wowhead")); }
        });
      }).on("error", (err: Error) => reject(err));
    });
  });
  ipcMain.handle("dialog:open-csv", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import CSV File",
      filters: [{ name: "CSV", extensions: ["csv"] }],
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const fs = await import("fs");
    return fs.readFileSync(result.filePaths[0], "utf-8");
  });
  ipcMain.handle("raidhelper:event", (_event, eventId: string) => fetchRaidHelperEvent(eventId));
  ipcMain.handle("dialog:select-service-account", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Service Account Key File",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

function checkForUpdates(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", async (info) => {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: `Version ${info.version} is available. Would you like to download and install it?`,
      buttons: ["Yes", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded. The application will restart to install it.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
  });

  autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  if (app.isPackaged) {
    checkForUpdates();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
