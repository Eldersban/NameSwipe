import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/useAppStore";
import { SwipeCard } from "../components/SwipeCard";
import { RejectionChip } from "../components/RejectionChip";
import { NameDetailSheet } from "../components/NameDetailSheet";
import { AchievementToast } from "../components/AchievementToast";
import { IconUndo } from "../components/Icons";
import { fireHaptic } from "../lib/haptics";
import { NAMES } from "../data/names";
import type { Disposition } from "../types/name";

export function DiscoverScreen() {
  const decisions = useAppStore((s) => s.decisions);
  const currentName = useAppStore((s) => s.currentName());
  const upNextName = useAppStore((s) => s.upNextName());
  const decide = useAppStore((s) => s.decide);
  const toggleLike = useAppStore((s) => s.toggleLike);
  const currentLiked = useAppStore((s) => {
    const id = s.pinnedQueue[0] ?? s.queue[0];
    if (!id) return false;
    return s.decisions.get(id)?.liked ?? s.pendingLikes.has(id);
  });
  const undo = useAppStore((s) => s.undo);
  const canUndo = useAppStore((s) => s.canUndo());
  const lastRejectionPromptNameId = useAppStore((s) => s.lastRejectionPromptNameId);
  const dismissRejectionPrompt = useAppStore((s) => s.dismissRejectionPrompt);
  const setRejectionReason = useAppStore((s) => s.setRejectionReason);
  const settings = useAppStore((s) => s.settings);
  const achievementToast = useAppStore((s) => s.achievementToastQueue[0]);
  const dismissAchievementToast = useAppStore((s) => s.dismissAchievementToast);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const swipeRightMeansYes = settings.swipeDirection === "right-yes";
  const reviewedCount = decisions.size;
  const totalCount = NAMES.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!currentName || detailsOpen) return;
      if (e.key === "ArrowLeft") decide(currentName.id, swipeRightMeansYes ? "no" : "yes");
      if (e.key === "ArrowRight") decide(currentName.id, swipeRightMeansYes ? "yes" : "no");
      if (e.key === "ArrowUp") decide(currentName.id, "maybe");
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentName, detailsOpen, decide, swipeRightMeansYes, undo]);

  const handleDecide = (disposition: Disposition) => {
    if (!currentName) return;
    decide(currentName.id, disposition);
  };

  const noun = useMemo(() => {
    if (reviewedCount === 0) return "Let's find a name";
    return `${reviewedCount} of ${totalCount} reviewed`;
  }, [reviewedCount, totalCount]);

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: "calc(82px + env(safe-area-inset-top))", paddingLeft: 18, paddingRight: 18, paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
      <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
        {noun}
      </p>

      <div className="relative flex-1" style={{ minHeight: 410, display: "grid", placeItems: "center", perspective: 1400 }}>
        {!currentName && (
          <div className="text-center px-6">
            <p className="font-serif text-3xl mb-2">All caught up</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              You've reviewed every name in the deck. Check My Names to revisit your shortlist,
              or reset from Settings to start fresh.
            </p>
          </div>
        )}

        {upNextName && (
          <div
            style={{
              position: "absolute",
              width: "min(92%, 430px)",
              height: "min(64vh, 590px)",
              maxHeight: 590,
              borderRadius: "var(--radius-card)",
              background: "var(--surface-solid)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-card)",
              transform: "scale(0.955) translateY(13px)",
              opacity: 0.5,
            }}
          />
        )}

        <AnimatePresence>
          {currentName && (
            <SwipeCard
              key={currentName.id}
              babyName={currentName}
              isTop
              liked={currentLiked}
              swipeRightMeansYes={swipeRightMeansYes}
              reducedMotion={settings.reducedMotion}
              onDecide={handleDecide}
              onToggleLike={() => toggleLike(currentName.id)}
              onTapDetails={() => setDetailsOpen(true)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          type="button"
          aria-label="Undo last decision"
          disabled={!canUndo}
          onClick={() => {
            fireHaptic("light");
            undo();
          }}
          className="grid h-[50px] w-[50px] place-items-center rounded-full border transition-transform active:scale-90 disabled:opacity-30"
          style={{ borderColor: "var(--line)", background: "var(--surface-solid)", color: "var(--muted)" }}
        >
          <IconUndo width={18} height={18} />
        </button>

        <button
          type="button"
          aria-label="No"
          disabled={!currentName}
          onClick={() => handleDecide("no")}
          className="grid h-[62px] w-[62px] place-items-center rounded-full border text-[21px] font-extrabold transition-transform active:scale-90 disabled:opacity-30"
          style={{ borderColor: "var(--line)", background: "var(--surface-solid)", color: "var(--no)", boxShadow: "0 10px 30px rgba(44,38,30,0.07)" }}
        >
          ✕
        </button>
        <button
          type="button"
          aria-label="Maybe"
          disabled={!currentName}
          onClick={() => handleDecide("maybe")}
          className="grid h-[70px] w-[70px] place-items-center rounded-full border text-[15px] font-extrabold transition-transform active:scale-90 disabled:opacity-30"
          style={{ borderColor: "var(--line)", background: "var(--surface-solid)", color: "var(--maybe)", boxShadow: "0 10px 30px rgba(44,38,30,0.07)" }}
        >
          ?
        </button>
        <button
          type="button"
          aria-label="Yes"
          disabled={!currentName}
          onClick={() => handleDecide("yes")}
          className="grid h-[62px] w-[62px] place-items-center rounded-full border text-[21px] font-extrabold transition-transform active:scale-90 disabled:opacity-30"
          style={{ borderColor: "var(--line)", background: "var(--surface-solid)", color: "var(--yes)", boxShadow: "0 10px 30px rgba(44,38,30,0.07)" }}
        >
          ♥
        </button>

        <div style={{ width: 50 }} />
      </div>

      <AnimatePresence>
        {lastRejectionPromptNameId && (
          <RejectionChip
            key={lastRejectionPromptNameId}
            onSelect={(reason) => setRejectionReason(lastRejectionPromptNameId, reason)}
            onDismiss={dismissRejectionPrompt}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailsOpen && currentName && (
          <NameDetailSheet babyName={currentName} onClose={() => setDetailsOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {achievementToast && (
          <AchievementToast key={achievementToast.id} achievement={achievementToast} onDone={dismissAchievementToast} />
        )}
      </AnimatePresence>
    </div>
  );
}
