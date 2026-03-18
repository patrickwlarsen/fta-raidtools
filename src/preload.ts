import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config: Record<string, unknown>) => ipcRenderer.invoke("config:save", config),
  fetchSheet: (sheetName: string) => ipcRenderer.invoke("sheets:fetch", sheetName),
  writeSheet: (sheetName: string, values: string[][]) => ipcRenderer.invoke("sheets:write", sheetName, values),
  openCsvFile: () => ipcRenderer.invoke("dialog:open-csv"),
  fetchItemTooltip: (itemId: number) => ipcRenderer.invoke("wowhead:tooltip", itemId),
  fetchRaidHelperEvent: (eventId: string) => ipcRenderer.invoke("raidhelper:event", eventId),
  selectServiceAccountKey: () => ipcRenderer.invoke("dialog:select-service-account"),
});
