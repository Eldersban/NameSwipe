import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export function useAccentTheme() {
  const activeTheme = useAppStore((s) => s.gamification.activeTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", activeTheme);
  }, [activeTheme]);
}
