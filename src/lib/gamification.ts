import type { UserNameState } from "../types/name";
import type { BabyName } from "../types/name";
import type { GamificationState } from "./db";
import type { AchievementStats } from "../types/gamification";

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const dateA = new Date(`${a}T00:00:00`);
  const dateB = new Date(`${b}T00:00:00`);
  return Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
}

/** Advances the streak for "today" if it hasn't already been counted. Pure — returns a new streak object. */
export function bumpStreak(streak: GamificationState["streak"]): GamificationState["streak"] {
  const today = todayKey();
  if (streak.lastActiveDate === today) return streak;

  let currentStreak = 1;
  if (streak.lastActiveDate) {
    const gap = daysBetween(streak.lastActiveDate, today);
    if (gap === 1) currentStreak = streak.currentStreak + 1;
  }
  return {
    lastActiveDate: today,
    currentStreak,
    longestStreak: Math.max(streak.longestStreak, currentStreak),
  };
}

export function computeStats(
  names: BabyName[],
  namesById: Map<string, BabyName>,
  decisions: Map<string, UserNameState>,
  gamification: GamificationState
): AchievementStats {
  let reviewedCount = 0;
  let yesCount = 0;
  let likedCount = 0;
  let likedButNoCount = 0;
  let familyLikedNoCount = 0;
  let hasRareReview = false;

  for (const state of decisions.values()) {
    // Only count decisions on names still in the current catalog — a name
    // can be removed when the deck is re-scoped, and that decision stays in
    // storage (nothing is deleted) but shouldn't count toward "reviewed all
    // of the current list" milestones like Calibrated or Completionist.
    const name = namesById.get(state.nameId);
    if (!name) continue;

    reviewedCount++;
    if (state.disposition === "yes") yesCount++;
    if (state.liked) likedCount++;
    if (state.liked && state.disposition === "no") {
      likedButNoCount++;
      if (state.rejectionReason === "family") familyLikedNoCount++;
    }
    if (!hasRareReview && name.popularityTier === "rare") hasRareReview = true;
  }

  return {
    reviewedCount,
    totalNames: names.length,
    yesCount,
    likedCount,
    likedButNoCount,
    familyLikedNoCount,
    undoCount: gamification.counters.undoCount,
    moreLikeThisCount: gamification.counters.moreLikeThisCount,
    searchCount: gamification.counters.searchCount,
    currentStreak: gamification.streak.currentStreak,
    longestStreak: gamification.streak.longestStreak,
    hasNightOwlSwipe: gamification.flags.nightOwl,
    hasEarlyBirdSwipe: gamification.flags.earlyBird,
    hasRareReview,
  };
}

export function currentHourFlags(): { isNightOwl: boolean; isEarlyBird: boolean } {
  const hour = new Date().getHours();
  return {
    isNightOwl: hour >= 0 && hour < 4,
    isEarlyBird: hour >= 4 && hour < 7,
  };
}
