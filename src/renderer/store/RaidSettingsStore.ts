import { RaidSettingsEntry } from "../models/RaidSettingsEntry";

type Listener = () => void;

const STORAGE_KEY = "fta-raidsettings";

class RaidSettingsStore {
  private entries: RaidSettingsEntry[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.load();
  }

  getAll(): RaidSettingsEntry[] {
    return [...this.entries];
  }

  getById(id: string): RaidSettingsEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  replaceAll(entries: RaidSettingsEntry[]): void {
    this.entries = entries;
    this.persist();
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // storage full or unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }
}

export const raidSettingsStore = new RaidSettingsStore();
