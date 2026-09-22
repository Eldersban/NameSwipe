import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import type { BabyName, Disposition } from "../types/name";
import { IconHeart } from "./Icons";
import { fireHaptic } from "../lib/haptics";

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 500;

interface SwipeCardProps {
  babyName: BabyName;
  isTop: boolean;
  liked: boolean;
  swipeRightMeansYes: boolean;
  reducedMotion: boolean;
  onDecide: (disposition: Disposition) => void;
  onToggleLike: () => void;
  onTapDetails: () => void;
}

export function SwipeCard({
  babyName,
  isTop,
  liked,
  swipeRightMeansYes,
  reducedMotion,
  onDecide,
  onToggleLike,
  onTapDetails,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const [dragging, setDragging] = useState(false);

  const yesOpacity = useTransform(x, (v) => {
    const target = swipeRightMeansYes ? v : -v;
    return Math.max(0, Math.min(1, target / SWIPE_THRESHOLD));
  });
  const noOpacity = useTransform(x, (v) => {
    const target = swipeRightMeansYes ? -v : v;
    return Math.max(0, Math.min(1, target / SWIPE_THRESHOLD));
  });
  const maybeOpacity = useTransform(y, (v) => Math.max(0, Math.min(1, -v / SWIPE_THRESHOLD)));

  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function completeSwipe(disposition: Disposition, exitX: number, exitY: number) {
    fireHaptic(disposition === "yes" ? "success" : disposition === "no" ? "warning" : "medium");
    if (reducedMotion) {
      onDecide(disposition);
      return;
    }
    animate(x, exitX, { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] });
    animate(y, exitY, {
      duration: 0.28,
      ease: [0.2, 0.8, 0.2, 1],
      onComplete: () => onDecide(disposition),
    });
  }

  function handleDragEnd(_event: PointerEvent, info: PanInfo) {
    setDragging(false);
    const { offset, velocity } = info;

    const horizontalWin =
      Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > VELOCITY_THRESHOLD;
    const verticalWin =
      offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD;

    if (verticalWin && Math.abs(offset.y) > Math.abs(offset.x)) {
      completeSwipe("maybe", 0, -500);
      return;
    }

    if (horizontalWin) {
      const wentRight = offset.x > 0;
      const disposition: Disposition = wentRight === swipeRightMeansYes ? "yes" : "no";
      completeSwipe(disposition, wentRight ? 500 : -500, offset.y);
      return;
    }

    animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 32 });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-card-interactive]")) {
      pointerStart.current = null;
      return;
    }
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx < 6 && dy < 6) {
      onTapDetails();
    }
  }

  const nicknamePreview = babyName.nicknames
    .slice(0, 3)
    .map((n) => n.name)
    .join(" · ");

  return (
    <motion.div
      className="name-card"
      style={{
        position: "absolute",
        width: "min(92%, 430px)",
        height: "min(64vh, 590px)",
        maxHeight: 590,
        padding: "30px 26px",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--line)",
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.32), transparent 45%), var(--surface-solid)",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        touchAction: "none",
        userSelect: "none",
        cursor: isTop ? (dragging ? "grabbing" : "grab") : "default",
        x,
        y,
        rotate,
        zIndex: isTop ? 2 : 1,
      }}
      drag={isTop}
      dragElastic={0.6}
      dragMomentum={false}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          {babyName.origins[0] ?? "Name"}
        </span>
        <button
          type="button"
          data-card-interactive
          aria-label={liked ? "Unlike this name" : "Like this name"}
          onClick={(e) => {
            e.stopPropagation();
            fireHaptic("light");
            onToggleLike();
          }}
          className="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
          style={{
            borderColor: liked ? "rgba(176,68,98,0.22)" : "var(--line)",
            background: liked ? "var(--like-soft)" : "transparent",
            color: liked ? "var(--like)" : "var(--muted)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <IconHeart filled={liked} width={15} height={15} />
            {liked ? "Liked" : "Like"}
          </span>
        </button>
      </div>

      <div className="-translate-y-1.5 text-center">
        <h1
          className="m-0 mb-4 font-serif"
          style={{
            fontSize: "clamp(52px, 14vw, 78px)",
            lineHeight: 0.98,
            letterSpacing: "-0.045em",
            fontWeight: 500,
          }}
        >
          {babyName.name}
        </h1>
        {nicknamePreview ? (
          <p className="mt-3 text-[15px]" style={{ color: "var(--muted)" }}>
            {nicknamePreview}
          </p>
        ) : (
          <p className="mt-3 text-[13px]" style={{ color: "var(--muted)" }}>
            Tap for details
          </p>
        )}
      </div>

      <div className="text-center">
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>
          Tap for meaning &amp; similar names
        </span>
      </div>

      {isTop && (
        <>
          <motion.span
            className="swipe-label"
            style={{
              opacity: noOpacity,
              position: "absolute",
              left: 23,
              top: 82,
              padding: "10px 14px",
              border: "2px solid var(--no)",
              borderRadius: 12,
              color: "var(--no)",
              fontWeight: 850,
              letterSpacing: "0.05em",
              transform: "rotate(-10deg)",
              pointerEvents: "none",
            }}
          >
            NO
          </motion.span>
          <motion.span
            className="swipe-label"
            style={{
              opacity: yesOpacity,
              position: "absolute",
              right: 23,
              top: 82,
              padding: "10px 14px",
              border: "2px solid var(--yes)",
              borderRadius: 12,
              color: "var(--yes)",
              fontWeight: 850,
              letterSpacing: "0.05em",
              transform: "rotate(10deg)",
              pointerEvents: "none",
            }}
          >
            YES
          </motion.span>
          <motion.span
            className="swipe-label"
            style={{
              opacity: maybeOpacity,
              position: "absolute",
              top: 30,
              left: "50%",
              translateX: "-50%",
              padding: "10px 14px",
              border: "2px solid var(--maybe)",
              borderRadius: 12,
              color: "var(--maybe)",
              fontWeight: 850,
              letterSpacing: "0.05em",
              pointerEvents: "none",
            }}
          >
            MAYBE
          </motion.span>
        </>
      )}
    </motion.div>
  );
}
