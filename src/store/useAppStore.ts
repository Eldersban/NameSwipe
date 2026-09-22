import { create } from "zustand";
import { NAMES, NAMES_BY_ID, getNameById } from "../data/names";
import { buildQueue, moreLikeThis } from "../lib/recommend";
import {
  loadAllDecisions,
  saveDecision,
  deleteDecision,
  loadSettings,
  saveSettings as persistSettings,
  loadQueueState,
  saveQueueState,
  loadPinnedQueue,
  savePinnedQueue,
  loadPendingLikes,
  savePendingLikes,
  clearAllDecisions,
} from "../lib/db";
import type { BabyName, Disposition, RejectionReason, UserNameState } from "../types/name";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";

const UNDO_LIMIT = 20;
const REQUEUE_THRESHOLD = 5;

interface UndoEntry {
  nameId: string;
  previous: UserNameState | undefined;
  wasFromPinned: boolean;
}

interface AppState {
  ready: boolean;
  decisions: Map<string, UserNameState>;
  queue: string[];
  pinnedQueue: string[];
  pendingLikes: Set<string>;
  undoStack: UndoEntry[];
  settings: AppSettings;
  lastRejectionPromptNameId: string | null;
  celebrationName: string | null;

  init: () => Promise<void>;
  currentNameId: () => string | undefined;
  currentName: () => BabyName | undefined;
  upNextName: () => BabyName | undefined;

  decide: (nameId: string, disposition: Disposition, rejectionReason?: RejectionReason) => void;
  setRejectionReason: (nameId: string, reason: RejectionReason) => void;
  dismissRejectionPrompt: () => void;
  toggleLike: (nameId: string) => void;
  isLiked: (nameId: string) => boolean;
  undo: () => void;
  canUndo: () => boolean;

  reviewNow: (nameId: string) => void;
  showMoreLikeThis: (nameId: string) => void;

  updateNote: (nameId: string, note: string) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;

  resetAllData: () => Promise<void>;
  dismissCelebration: () => void;
}

function regenerateQueue(decisions: Map<string, UserNameState>): string[] {
  return buildQueue(NAMES, decisions);
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  decisions: new Map(),
  queue: [],
  pinnedQueue: [],
  pendingLikes: new Set(),
  undoStack: [],
  settings: DEFAULT_SETTINGS,
  lastRejectionPromptNameId: null,
  celebrationName: null,

  init: async () => {
    const [decisionsList, settings, queueOrder, pinnedQueue, pendingLikes] = await Promise.all([
      loadAllDecisions(),
      loadSettings(),
      loadQueueState(),
      loadPinnedQueue(),
      loadPendingLikes(),
    ]);

    const decisions = new Map(decisionsList.map((d) => [d.nameId, d]));

    let queue = (queueOrder ?? []).filter(
      (id) => NAMES_BY_ID.has(id) && !decisions.has(id)
    );
    if (queue.length < REQUEUE_THRESHOLD) {
      queue = regenerateQueue(decisions);
    }

    const validPinned = (pinnedQueue ?? []).filter((id) => NAMES_BY_ID.has(id));
    const validLikes = new Set((pendingLikes ?? []).filter((id) => NAMES_BY_ID.has(id)));

    set({
      ready: true,
      decisions,
      queue,
      pinnedQueue: validPinned,
      pendingLikes: validLikes,
      settings: settings ?? DEFAULT_SETTINGS,
    });
  },

  currentNameId: () => {
    const { pinnedQueue, queue } = get();
    return pinnedQueue[0] ?? queue[0];
  },

  currentName: () => {
    const id = get().currentNameId();
    return id ? getNameById(id) : undefined;
  },

  upNextName: () => {
    const { pinnedQueue, queue } = get();
    const id = pinnedQueue[1] ?? (pinnedQueue.length ? queue[0] : queue[1]);
    return id ? getNameById(id) : undefined;
  },

  decide: (nameId, disposition, rejectionReason) => {
    const state = get();
    const existing = state.decisions.get(nameId);
    const liked = state.pendingLikes.has(nameId) || existing?.liked || false;
    const now = new Date().toISOString();

    const newState: UserNameState = {
      nameId,
      disposition,
      liked,
      rejectionReason: disposition === "no" ? rejectionReason ?? existing?.rejectionReason : undefined,
      note: existing?.note,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const decisions = new Map(state.decisions);
    decisions.set(nameId, newState);

    const wasFromPinned = state.pinnedQueue[0] === nameId;
    const pinnedQueue = wasFromPinned ? state.pinnedQueue.slice(1) : state.pinnedQueue;
    const queue = wasFromPinned ? state.queue : state.queue.slice(1);

    const pendingLikes = new Set(state.pendingLikes);
    pendingLikes.delete(nameId);

    const undoStack = [...state.undoStack, { nameId, previous: existing, wasFromPinned }].slice(
      -UNDO_LIMIT
    );

    let nextQueue = queue;
    if (queue.length < REQUEUE_THRESHOLD) {
      nextQueue = regenerateQueue(decisions);
    }

    const name = getNameById(nameId);
    const isFirstYes =
      disposition === "yes" &&
      ![...state.decisions.values()].some((d) => d.disposition === "yes");

    set({
      decisions,
      pinnedQueue,
      queue: nextQueue,
      pendingLikes,
      undoStack,
      lastRejectionPromptNameId: disposition === "no" && !rejectionReason ? nameId : null,
      celebrationName: isFirstYes && name ? name.name : null,
    });

    void saveDecision(newState);
    void saveQueueState(nextQueue);
    void savePinnedQueue(pinnedQueue);
    void savePendingLikes([...pendingLikes]);
  },

  setRejectionReason: (nameId, reason) => {
    const state = get();
    const existing = state.decisions.get(nameId);
    if (!existing) return;
    const updated: UserNameState = { ...existing, rejectionReason: reason, updatedAt: new Date().toISOString() };
    const decisions = new Map(state.decisions);
    decisions.set(nameId, updated);
    set({ decisions, lastRejectionPromptNameId: null });
    void saveDecision(updated);
  },

  dismissRejectionPrompt: () => set({ lastRejectionPromptNameId: null }),

  toggleLike: (nameId) => {
    const state = get();
    const existing = state.decisions.get(nameId);
    if (existing) {
      const updated: UserNameState = { ...existing, liked: !existing.liked, updatedAt: new Date().toISOString() };
      const decisions = new Map(state.decisions);
      decisions.set(nameId, updated);
      set({ decisions });
      void saveDecision(updated);
    } else {
      const pendingLikes = new Set(state.pendingLikes);
      if (pendingLikes.has(nameId)) pendingLikes.delete(nameId);
      else pendingLikes.add(nameId);
      set({ pendingLikes });
      void savePendingLikes([...pendingLikes]);
    }
  },

  isLiked: (nameId) => {
    const state = get();
    return state.decisions.get(nameId)?.liked ?? state.pendingLikes.has(nameId);
  },

  canUndo: () => get().undoStack.length > 0,

  undo: () => {
    const state = get();
    const entry = state.undoStack[state.undoStack.length - 1];
    if (!entry) return;

    const decisions = new Map(state.decisions);
    if (entry.previous) {
      decisions.set(entry.nameId, entry.previous);
      void saveDecision(entry.previous);
    } else {
      decisions.delete(entry.nameId);
      void deleteDecision(entry.nameId);
    }

    const pinnedQueue = entry.wasFromPinned
      ? [entry.nameId, ...state.pinnedQueue]
      : state.pinnedQueue;
    const queue = entry.wasFromPinned ? state.queue : [entry.nameId, ...state.queue];

    set({
      decisions,
      pinnedQueue,
      queue,
      undoStack: state.undoStack.slice(0, -1),
      lastRejectionPromptNameId: null,
    });

    void saveQueueState(queue);
    void savePinnedQueue(pinnedQueue);
  },

  reviewNow: (nameId) => {
    const state = get();
    const decisions = new Map(state.decisions);
    decisions.delete(nameId);

    const pinnedQueue = [nameId, ...state.pinnedQueue.filter((id) => id !== nameId)];

    set({ decisions, pinnedQueue });
    void deleteDecision(nameId);
    void savePinnedQueue(pinnedQueue);
  },

  showMoreLikeThis: (nameId) => {
    const state = get();
    const target = getNameById(nameId);
    if (!target) return;
    const similar = moreLikeThis(target, NAMES, state.decisions, 8);
    const pinnedQueue = [...similar.filter((id) => !state.pinnedQueue.includes(id)), ...state.pinnedQueue];
    set({ pinnedQueue });
    void savePinnedQueue(pinnedQueue);
  },

  updateNote: (nameId, note) => {
    const state = get();
    const existing = state.decisions.get(nameId);
    if (!existing) return;
    const updated: UserNameState = { ...existing, note, updatedAt: new Date().toISOString() };
    const decisions = new Map(state.decisions);
    decisions.set(nameId, updated);
    set({ decisions });
    void saveDecision(updated);
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    set({ settings });
    void persistSettings(settings);
  },

  resetAllData: async () => {
    await clearAllDecisions();
    const queue = regenerateQueue(new Map());
    set({
      decisions: new Map(),
      queue,
      pinnedQueue: [],
      pendingLikes: new Set(),
      undoStack: [],
      lastRejectionPromptNameId: null,
    });
    void saveQueueState(queue);
    void savePinnedQueue([]);
    void savePendingLikes([]);
  },

  dismissCelebration: () => set({ celebrationName: null }),
}));
