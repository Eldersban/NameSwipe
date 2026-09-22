import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { UserNameState } from "../types/name";
import type { AppSettings } from "../types/settings";

interface NameSwipeDB extends DBSchema {
  decisions: {
    key: string;
    value: UserNameState;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "nameswipe";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NameSwipeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<NameSwipeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NameSwipeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("decisions")) {
          db.createObjectStore("decisions", { keyPath: "nameId" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllDecisions(): Promise<UserNameState[]> {
  const db = await getDB();
  return db.getAll("decisions");
}

export async function saveDecision(state: UserNameState): Promise<void> {
  const db = await getDB();
  await db.put("decisions", state);
}

export async function deleteDecision(nameId: string): Promise<void> {
  const db = await getDB();
  await db.delete("decisions", nameId);
}

export async function clearAllDecisions(): Promise<void> {
  const db = await getDB();
  await db.clear("decisions");
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const db = await getDB();
  return db.get("meta", "settings") as Promise<AppSettings | undefined>;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put("meta", settings, "settings");
}

export async function loadQueueState(): Promise<string[] | undefined> {
  const db = await getDB();
  return db.get("meta", "queueOrder") as Promise<string[] | undefined>;
}

export async function saveQueueState(order: string[]): Promise<void> {
  const db = await getDB();
  await db.put("meta", order, "queueOrder");
}

export async function loadPinnedQueue(): Promise<string[] | undefined> {
  const db = await getDB();
  return db.get("meta", "pinnedQueue") as Promise<string[] | undefined>;
}

export async function savePinnedQueue(order: string[]): Promise<void> {
  const db = await getDB();
  await db.put("meta", order, "pinnedQueue");
}

export async function loadPendingLikes(): Promise<string[] | undefined> {
  const db = await getDB();
  return db.get("meta", "pendingLikes") as Promise<string[] | undefined>;
}

export async function savePendingLikes(ids: string[]): Promise<void> {
  const db = await getDB();
  await db.put("meta", ids, "pendingLikes");
}

export interface GamificationState {
  unlocked: [string, string][];
  unlockedThemes: string[];
  activeTheme: string;
  streak: {
    lastActiveDate: string | null;
    currentStreak: number;
    longestStreak: number;
  };
  counters: {
    undoCount: number;
    moreLikeThisCount: number;
    searchCount: number;
  };
  flags: {
    nightOwl: boolean;
    earlyBird: boolean;
  };
}

export function defaultGamificationState(): GamificationState {
  return {
    unlocked: [],
    unlockedThemes: ["sage"],
    activeTheme: "sage",
    streak: { lastActiveDate: null, currentStreak: 0, longestStreak: 0 },
    counters: { undoCount: 0, moreLikeThisCount: 0, searchCount: 0 },
    flags: { nightOwl: false, earlyBird: false },
  };
}

export async function loadGamification(): Promise<GamificationState | undefined> {
  const db = await getDB();
  return db.get("meta", "gamification") as Promise<GamificationState | undefined>;
}

export async function saveGamification(state: GamificationState): Promise<void> {
  const db = await getDB();
  await db.put("meta", state, "gamification");
}

export async function exportBackup(): Promise<string> {
  const [decisions, settings, gamification] = await Promise.all([
    loadAllDecisions(),
    loadSettings(),
    loadGamification(),
  ]);
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      decisions,
      settings,
      gamification,
    },
    null,
    2
  );
}

interface BackupPayload {
  version: number;
  decisions: UserNameState[];
  settings?: AppSettings;
  gamification?: GamificationState;
}

export async function importBackup(json: string): Promise<BackupPayload> {
  const parsed = JSON.parse(json) as BackupPayload;
  const db = await getDB();
  const tx = db.transaction("decisions", "readwrite");
  await tx.store.clear();
  for (const decision of parsed.decisions) {
    await tx.store.put(decision);
  }
  await tx.done;
  if (parsed.settings) {
    await saveSettings(parsed.settings);
  }
  if (parsed.gamification) {
    await saveGamification(parsed.gamification);
  }
  return parsed;
}
