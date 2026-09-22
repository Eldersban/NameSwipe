import { useAppStore } from "../store/useAppStore";

type HapticPattern = "light" | "medium" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 15,
  success: [10, 30, 10],
  warning: [20, 40],
};

export function fireHaptic(pattern: HapticPattern): void {
  const enabled = useAppStore.getState().settings.haptics;
  if (!enabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration API unsupported or blocked — silently ignore.
  }
}
