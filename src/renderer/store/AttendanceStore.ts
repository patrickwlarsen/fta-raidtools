import { AttendanceEntry } from "../models/AttendanceEntry";

type Listener = () => void;

const STORAGE_KEY = "fta-attendance";

class AttendanceStore {
  private entries: AttendanceEntry[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.load();
  }

  getAll(): AttendanceEntry[] {
    return [...this.entries];
  }

  add(entry: AttendanceEntry): void {
    this.entries.push(entry);
    this.persist();
    this.notify();
  }

  replaceAll(entries: AttendanceEntry[]): void {
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

export const attendanceStore = new AttendanceStore();
