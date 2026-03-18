interface RaidHelperSignUp {
  name: string;
  className: string;
  specName?: string;
  roleName?: string;
  userId: string;
  status: string;
  position: number;
  id: number;
}

interface RaidHelperEvent {
  title: string;
  date: string;
  time: string;
  leaderName: string;
  signUps: RaidHelperSignUp[];
}

interface AppConfig {
  googleSheetUrl: string;
  serviceAccountKeyPath: string;
}

interface ElectronApi {
  loadConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<void>;
  fetchSheet(sheetName: string): Promise<string[][]>;
  writeSheet(sheetName: string, values: string[][]): Promise<void>;
  openCsvFile(): Promise<string | null>;
  fetchItemTooltip(itemId: number): Promise<{ name: string; quality: number; icon: string; tooltip: string }>;
  fetchRaidHelperEvent(eventId: string): Promise<RaidHelperEvent>;
  selectServiceAccountKey(): Promise<string | null>;
}

interface Window {
  api: ElectronApi;
}
