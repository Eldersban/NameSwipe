export type AccentTheme = "sage" | "blush" | "midnight" | "golden" | "botanical" | "gilded";

export interface AccentThemeInfo {
  id: AccentTheme;
  label: string;
  swatch: string;
  swatchDark: string;
}

export const ACCENT_THEMES: AccentThemeInfo[] = [
  { id: "sage", label: "Sage", swatch: "#2a5847", swatchDark: "#7bc5a8" },
  { id: "blush", label: "Blush", swatch: "#b04462", swatchDark: "#e37b9a" },
  { id: "midnight", label: "Midnight", swatch: "#3454a8", swatchDark: "#8fa8e8" },
  { id: "golden", label: "Golden Hour", swatch: "#a5782e", swatchDark: "#e1b965" },
  { id: "botanical", label: "Botanical", swatch: "#3f7a3a", swatchDark: "#9bcf8a" },
  { id: "gilded", label: "Gilded", swatch: "#8a6b1f", swatchDark: "#f0cf6a" },
];

export type AchievementCategory = "milestones" | "taste" | "habits" | "discovery";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: "sparkle" | "insights" | "list" | "check" | "heart" | "heartOutline" | "undo" | "search" | "moon" | "sun" | "flame" | "trophy";
  themeUnlock?: AccentTheme;
}

export interface AchievementStats {
  reviewedCount: number;
  totalNames: number;
  yesCount: number;
  likedCount: number;
  likedButNoCount: number;
  familyLikedNoCount: number;
  undoCount: number;
  moreLikeThisCount: number;
  searchCount: number;
  currentStreak: number;
  longestStreak: number;
  hasNightOwlSwipe: boolean;
  hasEarlyBirdSwipe: boolean;
  hasRareReview: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Milestones
  {
    id: "first-swipe",
    title: "Hello, World",
    description: "Review your first name",
    category: "milestones",
    icon: "sparkle",
  },
  {
    id: "calibrated",
    title: "Calibrated",
    description: "Review 30 names and unlock personalized recommendations",
    category: "milestones",
    icon: "insights",
  },
  {
    id: "half-century",
    title: "Half Century",
    description: "Review 50 names",
    category: "milestones",
    icon: "list",
  },
  {
    id: "century-club",
    title: "Century Club",
    description: "Review 100 names",
    category: "milestones",
    icon: "trophy",
    themeUnlock: "botanical",
  },
  {
    id: "completionist",
    title: "The Completionist",
    description: "Review every single name in the database",
    category: "milestones",
    icon: "check",
    themeUnlock: "gilded",
  },
  // Taste
  {
    id: "first-yes",
    title: "Love at First Swipe",
    description: "Add your first name to the shortlist",
    category: "taste",
    icon: "heart",
  },
  {
    id: "the-shortlist",
    title: "The Shortlist",
    description: "Get 10 names into your Yes column",
    category: "taste",
    icon: "heart",
  },
  {
    id: "big-heart",
    title: "Big Heart",
    description: "Like 10 names, whether or not you can use them",
    category: "taste",
    icon: "heart",
    themeUnlock: "blush",
  },
  {
    id: "bittersweet",
    title: "Bittersweet",
    description: "5 names you love but can't use",
    category: "taste",
    icon: "heartOutline",
  },
  {
    id: "family-ties",
    title: "Family Ties",
    description: "Rule out 5 names for family reasons while still loving them",
    category: "taste",
    icon: "heartOutline",
  },
  // Habits
  {
    id: "second-thoughts",
    title: "Second Thoughts",
    description: "Use Undo 10 times",
    category: "habits",
    icon: "undo",
  },
  {
    id: "matchmaker",
    title: "Matchmaker",
    description: "Use “More like this” 5 times",
    category: "habits",
    icon: "sparkle",
  },
  {
    id: "name-detective",
    title: "Name Detective",
    description: "Search for a name 10 times",
    category: "habits",
    icon: "search",
  },
  {
    id: "on-a-roll",
    title: "On a Roll",
    description: "Come back 7 days in a row",
    category: "habits",
    icon: "flame",
    themeUnlock: "golden",
  },
  {
    id: "dedicated",
    title: "Dedicated",
    description: "Maintain a 30-day streak",
    category: "habits",
    icon: "flame",
  },
  // Discovery / easter eggs
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Review a name between midnight and 4am",
    category: "discovery",
    icon: "moon",
    themeUnlock: "midnight",
  },
  {
    id: "early-bird",
    title: "Early Bird",
    description: "Review a name before 7am",
    category: "discovery",
    icon: "sun",
  },
  {
    id: "deep-cut",
    title: "Deep Cut",
    description: "Review a name from our rarest tier",
    category: "discovery",
    icon: "sparkle",
  },
];

export function evaluateStats(stats: AchievementStats): Record<string, boolean> {
  return {
    "first-swipe": stats.reviewedCount >= 1,
    calibrated: stats.reviewedCount >= 30,
    "half-century": stats.reviewedCount >= 50,
    "century-club": stats.reviewedCount >= 100,
    completionist: stats.totalNames > 0 && stats.reviewedCount >= stats.totalNames,
    "first-yes": stats.yesCount >= 1,
    "the-shortlist": stats.yesCount >= 10,
    "big-heart": stats.likedCount >= 10,
    bittersweet: stats.likedButNoCount >= 5,
    "family-ties": stats.familyLikedNoCount >= 5,
    "second-thoughts": stats.undoCount >= 10,
    matchmaker: stats.moreLikeThisCount >= 5,
    "name-detective": stats.searchCount >= 10,
    "on-a-roll": stats.currentStreak >= 7,
    dedicated: stats.longestStreak >= 30,
    "night-owl": stats.hasNightOwlSwipe,
    "early-bird": stats.hasEarlyBirdSwipe,
    "deep-cut": stats.hasRareReview,
  };
}
