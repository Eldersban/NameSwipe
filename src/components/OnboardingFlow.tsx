import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingFlowProps {
  onDone: () => void;
}

const STEPS = [
  {
    title: "Find the name.",
    body: "Swipe through boys' names. You'll never see the same name twice unless you choose to.",
  },
  {
    title: "No · Maybe · Yes",
    body: "Swipe left for no, up for maybe, right for yes. Or use the buttons below the card — whatever feels natural.",
  },
  {
    title: "Love it but can't use it?",
    body: "Tap ♥ before you swipe. We'll remember you liked the style, even on names you rule out.",
  },
];

export function OnboardingFlow({ onDone }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  return (
    <div className="app-shell flex flex-col items-center justify-center px-8 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <h1 className="font-serif" style={{ fontSize: 38, letterSpacing: "-0.03em", fontWeight: 500, marginBottom: 16 }}>
            {STEPS[step].title}
          </h1>
          <p className="text-[16px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {STEPS[step].body}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex gap-2">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 20 : 6,
              background: i === step ? "var(--accent)" : "var(--line)",
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
        className="mt-10 w-full max-w-[280px] rounded-full py-4 text-[16px] font-bold text-white transition-transform active:scale-95"
        style={{ background: "var(--accent)" }}
      >
        {isLast ? "Start swiping" : "Next"}
      </button>

      {!isLast && (
        <button type="button" onClick={onDone} className="mt-4 text-[14px] font-semibold" style={{ color: "var(--muted)" }}>
          Skip
        </button>
      )}
    </div>
  );
}
