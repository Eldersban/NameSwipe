import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "./store/useAppStore";
import { useTheme } from "./hooks/useTheme";
import { IconDiscover, IconList, IconInsights, IconSettings, IconSearch, IconTrophy } from "./components/Icons";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { MyNamesScreen } from "./screens/MyNamesScreen";
import { InsightsScreen } from "./screens/InsightsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SearchOverlay } from "./components/SearchOverlay";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { AchievementsOverlay } from "./components/AchievementsOverlay";
import { useAccentTheme } from "./hooks/useAccentTheme";

type Tab = "discover" | "names" | "insights" | "settings";

const TABS: { id: Tab; label: string; icon: typeof IconDiscover }[] = [
  { id: "discover", label: "Discover", icon: IconDiscover },
  { id: "names", label: "My Names", icon: IconList },
  { id: "insights", label: "Insights", icon: IconInsights },
  { id: "settings", label: "Settings", icon: IconSettings },
];

const ONBOARDING_KEY = "nameswipe.onboarded";

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const [tab, setTab] = useState<Tab>("discover");
  const [searchOpen, setSearchOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "1";
    } catch {
      return true;
    }
  });

  useTheme();
  useAccentTheme();

  useEffect(() => {
    void init();
  }, [init]);

  const finishOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // localStorage unavailable — proceed without persisting the flag.
    }
    setOnboarded(true);
  };

  if (!ready) {
    return (
      <div className="app-shell grid place-items-center">
        <div className="text-sm tracking-wide text-[color:var(--muted)]">Loading NameSwipe…</div>
      </div>
    );
  }

  if (!onboarded) {
    return <OnboardingFlow onDone={finishOnboarding} />;
  }

  return (
    <div className="app-shell">
      <header
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 pb-3 pointer-events-none"
        style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}
      >
        <span className="text-[16px] font-extrabold tracking-tight pointer-events-auto select-none">
          NameSwipe
        </span>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            aria-label="Achievements"
            onClick={() => setAchievementsOpen(true)}
            className="grid h-[42px] w-[42px] place-items-center rounded-full border"
            style={{
              borderColor: "var(--line)",
              background: "var(--surface)",
              backdropFilter: "blur(18px)",
            }}
          >
            <IconTrophy width={19} height={19} />
          </button>
          <button
            type="button"
            aria-label="Search names"
            onClick={() => setSearchOpen(true)}
            className="grid h-[42px] w-[42px] place-items-center rounded-full border"
            style={{
              borderColor: "var(--line)",
              background: "var(--surface)",
              backdropFilter: "blur(18px)",
            }}
          >
            <IconSearch width={19} height={19} />
          </button>
        </div>
      </header>

      <main className="relative h-full w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0"
          >
            {tab === "discover" && <DiscoverScreen />}
            {tab === "names" && <MyNamesScreen />}
            {tab === "insights" && <InsightsScreen />}
            {tab === "settings" && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav
        className="absolute left-3 right-3 z-40 grid grid-cols-4 rounded-[24px] border p-[7px]"
        style={{
          bottom: "calc(10px + env(safe-area-inset-bottom))",
          background: "var(--surface)",
          borderColor: "var(--line)",
          backdropFilter: "blur(25px)",
          boxShadow: "var(--shadow-nav)",
          height: 72,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex flex-col items-center justify-center gap-1 rounded-[18px] text-[11px] font-semibold transition-all"
              style={{
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "var(--surface-solid)" : "transparent",
                boxShadow: active ? "0 5px 15px rgba(30,25,20,0.08)" : "none",
              }}
            >
              <Icon width={19} height={19} />
              {label}
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onGoToDiscover={() => setTab("discover")} />}
      </AnimatePresence>

      <AnimatePresence>
        {achievementsOpen && <AchievementsOverlay onClose={() => setAchievementsOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
