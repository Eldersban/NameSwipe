import { motion } from "framer-motion";
import { REJECTION_REASONS, type RejectionReason } from "../types/name";

interface RejectionChipProps {
  onSelect: (reason: RejectionReason) => void;
  onDismiss: () => void;
}

export function RejectionChip({ onSelect, onDismiss }: RejectionChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className="absolute left-3 right-3 z-50 rounded-[22px] border p-4"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        background: "var(--surface-raised)",
        borderColor: "var(--line)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>
          Why not? (optional)
        </span>
        <button type="button" onClick={onDismiss} className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
          Skip
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {REJECTION_REASONS.map((reason) => (
          <button
            key={reason.value}
            type="button"
            onClick={() => onSelect(reason.value)}
            className="rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-transform active:scale-95"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          >
            {reason.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
