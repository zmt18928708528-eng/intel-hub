import { create } from "zustand";

const STORAGE_KEY = "intel-hub-watchlist";

interface WatchlistState {
  keys: string[];
  hydrated: boolean;
  hydrate: () => void;
  toggle: (key: string) => void;
}

function readKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export const useWatchlist = create<WatchlistState>((set, get) => ({
  keys: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ keys: readKeys(), hydrated: true });
  },
  toggle: (key) => {
    const keys = get().keys.includes(key)
      ? get().keys.filter((k) => k !== key)
      : [...get().keys, key];
    set({ keys, hydrated: true });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      /* ignore quota */
    }
  },
}));
