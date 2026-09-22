import { useEffect } from "react";
import { motion } from "framer-motion";
import type { Achievement } from "../types/gamification";
import { AchievementIcon } from "./AchievementIcon";
import { fireHaptic } from "../lib/haptics";

interface AchievementToastProps {
  achievement: Achievement;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
  useEffect(() => {
    fireHaptic("success");
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={onDone}
      className="absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        top: "calc(90px + env(safe-area-inset-top))",
        background: "var(--surface-raised)",
        borderColor: "var(--line)",
        boxShadow: "var(--shadow-card)",
        maxWidth: "min(92%, 420px)",
      }}
    >
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--like-soft)", color: "var(--like)" }}
      >
        <AchievementIcon icon={achievement.icon} width={18} height={18} />
      </div>
      <div>
        <p className="m-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Achievement unlocked
        </p>
        <p className="m-0 text-[15px] font-bold">{achievement.title}</p>
      </div>
    </motion.div>
  );
}
