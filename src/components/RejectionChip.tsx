import { useEffect } from "react";
import { motion } from "framer-motion";
import { REJECTION_REASONS, type RejectionReason } from "../types/name";

interface RejectionChipProps {
  onSelect: (reason: RejectionReason) => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;

export function RejectionChip({ onSelect, onDismiss }: RejectionChipProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className="absolute left-3 right-3 z-30 flex items-center gap-2 rounded-full border px-3 py-2"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        background: "var(--surface)",
        borderColor: "var(--line)",
        backdropFilter: "blur(18px)",
      }}
    >
      <span className="shrink-0 pl-1 text-[11px]" style={{ color: "var(--muted)" }}>
        Why not?
      </span>
      <div className="flex flex-1 gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {REJECTION_REASONS.map((reason) => (
          <button
            key={reason.value}
            type="button"
            onClick={() => onSelect(reason.value)}
            className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium transition-transform active:scale-95"
            style={{ borderColor: "var(--line)", background: "var(--surface-solid)", color: "var(--text)" }}
          >
            {reason.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[14px]"
        style={{ color: "var(--muted)" }}
      >
        ✕
      </button>
    </motion.div>
  );
}
