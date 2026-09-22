import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/useAppStore";
import { NAMES, NAMES_BY_ID } from "../data/names";
import { computeStats } from "../lib/gamification";
import { ACHIEVEMENTS, ACCENT_THEMES, type AchievementCategory } from "../types/gamification";
import { AchievementIcon } from "./AchievementIcon";
import { IconArrowLeft, IconFlame, IconCheck } from "./Icons";
import { fireHaptic } from "../lib/haptics";

interface AchievementsOverlayProps {
  onClose: () => void;
}

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  milestones: "Milestones",
  taste: "Taste",
  habits: "Habits",
  discovery: "Discovery",
};

const CATEGORY_ORDER: AchievementCategory[] = ["milestones", "taste", "habits", "discovery"];

export function AchievementsOverlay({ onClose }: AchievementsOverlayProps) {
  const decisions = useAppStore((s) => s.decisions);
  const gamification = useAppStore((s) => s.gamification);
  const setAccentTheme = useAppStore((s) => s.setAccentTheme);

  const stats = useMemo(
    () => computeStats(NAMES, NAMES_BY_ID, decisions, gamification),
    [decisions, gamification]
  );
  const unlockedMap = useMemo(() => new Map(gamification.unlocked), [gamification.unlocked]);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedMap.has(a.id)).length;

  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, typeof ACHIEVEMENTS>();
    for (const a of ACHIEVEMENTS) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return map;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 pb-3"
        style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", borderColor: "var(--line)" }}
      >
        <button type="button" onClick={onClose} aria-label="Close achievements" className="grid h-9 w-9 place-items-center">
          <IconArrowLeft width={20} height={20} />
        </button>
        <h1 className="m-0 text-[17px] font-bold">Achievements</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div
            className="rounded-[22px] border px-4 py-4"
            style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--maybe)" }}>
              <IconFlame width={18} height={18} />
              <span className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                {stats.currentStreak}
              </span>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
              day streak
            </p>
          </div>
          <div
            className="rounded-[22px] border px-4 py-4"
            style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}
          >
            <div className="flex items-center gap-2">
              <IconCheck width={18} height={18} style={{ color: "var(--yes)" }} />
              <span className="text-[22px] font-extrabold">
                {unlockedCount}
                <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 15 }}>/{ACHIEVEMENTS.length}</span>
              </span>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
              unlocked
            </p>
          </div>
        </div>

        <section className="mb-7">
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Themes
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {ACCENT_THEMES.map((theme) => {
              const unlocked = gamification.unlockedThemes.includes(theme.id);
              const active = gamification.activeTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    fireHaptic("light");
                    setAccentTheme(theme.id);
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 disabled:opacity-40"
                  style={{
                    borderColor: active ? theme.swatch : "var(--line)",
                    background: "var(--surface-solid)",
                  }}
                >
                  <span
                    className="h-8 w-8 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${theme.swatch}, ${theme.swatchDark})` }}
                  />
                  <span className="text-[11px] font-semibold">{unlocked ? theme.label : "Locked"}</span>
                </button>
              );
            })}
          </div>
        </section>

        {CATEGORY_ORDER.map((category) => {
          const items = byCategory.get(category) ?? [];
          return (
            <section key={category} className="mb-7">
              <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {CATEGORY_LABEL[category]}
              </h2>
              <div className="flex flex-col gap-2">
                {items.map((achievement) => {
                  const unlocked = unlockedMap.has(achievement.id);
                  const unlockedAt = unlockedMap.get(achievement.id);
                  return (
                    <div
                      key={achievement.id}
                      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: "var(--line)",
                        background: unlocked ? "var(--surface-solid)" : "transparent",
                        opacity: unlocked ? 1 : 0.55,
                      }}
                    >
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                        style={{
                          background: unlocked ? "var(--yes-soft)" : "var(--line)",
                          color: unlocked ? "var(--yes)" : "var(--muted)",
                        }}
                      >
                        <AchievementIcon icon={achievement.icon} width={17} height={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[14.5px] font-bold">{achievement.title}</p>
                        <p className="m-0 text-[12.5px]" style={{ color: "var(--muted)" }}>
                          {achievement.description}
                        </p>
                        {unlocked && unlockedAt && (
                          <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--yes)" }}>
                            Unlocked {new Date(unlockedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}
