import { useEffect } from "react";
import { motion } from "framer-motion";

interface CelebrationToastProps {
  name: string;
  onDone: () => void;
}

export function CelebrationToast({ name, onDone }: CelebrationToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="absolute left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-3 text-[14px] font-semibold"
      style={{
        top: "calc(90px + env(safe-area-inset-top))",
        background: "var(--yes-soft)",
        borderColor: "rgba(51,120,97,0.25)",
        color: "var(--yes)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      ✦ {name} is your first Yes — welcome to the shortlist
    </motion.div>
  );
}
