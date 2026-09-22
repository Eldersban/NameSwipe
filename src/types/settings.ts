export type SwipeDirectionMode = "right-yes" | "right-no";

export type ThemeMode = "system" | "light" | "dark";

export interface AppSettings {
  swipeDirection: SwipeDirectionMode;
  theme: ThemeMode;
  reducedMotion: boolean;
  haptics: boolean;
  surname: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  swipeDirection: "right-yes",
  theme: "system",
  reducedMotion: false,
  haptics: true,
  surname: "",
};
