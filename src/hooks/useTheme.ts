import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export function useTheme() {
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}
