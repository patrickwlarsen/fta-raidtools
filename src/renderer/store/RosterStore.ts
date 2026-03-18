import { RosterEntry } from "../models/RosterEntry";

type Listener = () => void;

const STORAGE_KEY = "fta-roster";

class RosterStore {
  private entries: RosterEntry[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.load();
  }

  getAll(): RosterEntry[] {
    return [...this.entries];
  }

  add(entry: RosterEntry): void {
    this.entries.push(entry);
    this.persist();
    this.notify();
  }

  remove(entries: RosterEntry[]): void {
    const toRemove = new Set(entries);
    this.entries = this.entries.filter((e) => !toRemove.has(e));
    this.persist();
    this.notify();
  }

  replaceAll(entries: RosterEntry[]): void {
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

export const rosterStore = new RosterStore();
