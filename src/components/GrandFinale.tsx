import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/useAppStore";
import { NAMES } from "../data/names";
import { ConfettiField } from "./Confetti";
import { FireworksField } from "./Fireworks";
import { IconTrophy } from "./Icons";
import { fireHaptic } from "../lib/haptics";

const TWINKLE_COUNT = 30;

function useTwinkles() {
  const [twinkles] = useState(() =>
    Array.from({ length: TWINKLE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 3,
      duration: 1.4 + Math.random() * 1.8,
    }))
  );
  return twinkles;
}

export function GrandFinale() {
  const decisions = useAppStore((s) => s.decisions);
  const setAccentTheme = useAppStore((s) => s.setAccentTheme);
  const dismissGrandFinale = useAppStore((s) => s.dismissGrandFinale);
  const twinkles = useTwinkles();

  useEffect(() => {
    fireHaptic("success");
    const t = setTimeout(() => fireHaptic("success"), 500);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo(() => {
    let yes = 0;
    let liked = 0;
    for (const d of decisions.values()) {
      if (d.disposition === "yes") yes++;
      if (d.liked) liked++;
    }
    return { yes, liked, total: NAMES.length };
  }, [decisions]);

  function handleContinue() {
    dismissGrandFinale();
  }

  function handleApplyGilded() {
    setAccentTheme("gilded");
    dismissGrandFinale();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 20%, rgba(240,207,106,0.35), transparent 55%), radial-gradient(circle at 15% 85%, rgba(123,197,168,0.25), transparent 50%), radial-gradient(circle at 85% 80%, rgba(227,123,154,0.22), transparent 50%), #0f0d0a",
      }}
    >
      {/* twinkling stars */}
      <div className="pointer-events-none absolute inset-0">
        {twinkles.map((t) => (
          <motion.div
            key={t.id}
            style={{
              position: "absolute",
              left: `${t.left}%`,
              top: `${t.top}%`,
              width: t.size,
              height: t.size,
              borderRadius: "50%",
              background: "#f0cf6a",
            }}
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{ duration: t.duration, delay: t.delay, repeat: Infinity }}
          />
        ))}
      </div>

      <FireworksField count={6} />
      <ConfettiField count={90} />

      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
        className="relative z-10 mx-6 flex max-w-[420px] flex-col items-center rounded-[32px] border px-8 py-10 text-center"
        style={{
          background: "rgba(24, 20, 14, 0.72)",
          borderColor: "rgba(240,207,106,0.35)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 80px rgba(240,207,106,0.15)",
        }}
      >
        <div className="relative mb-6 grid place-items-center">
          {[0, 1, 2].map((ring) => (
            <motion.span
              key={ring}
              className="absolute rounded-full"
              style={{
                width: 90,
                height: 90,
                border: "1.5px solid #f0cf6a",
              }}
              animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: ring * 0.7, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="relative grid h-[90px] w-[90px] place-items-center rounded-full"
            style={{
              background: "linear-gradient(160deg, #f0cf6a, #8a6b1f)",
              boxShadow: "0 0 40px rgba(240,207,106,0.55)",
            }}
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <IconTrophy width={42} height={42} style={{ color: "#1a1510" }} />
          </motion.div>
        </div>

        <p
          className="m-0 text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "#f0cf6a" }}
        >
          Achievement Unlocked
        </p>
        <h1
          className="font-serif"
          style={{
            fontSize: 44,
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            fontWeight: 500,
            margin: "10px 0 12px",
            background: "linear-gradient(120deg, #fff7dc, #f0cf6a 40%, #fff7dc 60%, #f0cf6a)",
            backgroundSize: "250% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "finale-shimmer 3.5s linear infinite",
          }}
        >
          The Completionist
        </h1>
        <p className="m-0 text-[15px] leading-relaxed" style={{ color: "rgba(244,239,229,0.82)" }}>
          You've reviewed every single name in the deck. That's dedication.
        </p>

        <div className="mt-7 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
            <div className="text-[24px] font-extrabold" style={{ color: "#7bc5a8" }}>
              {stats.yes}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "rgba(244,239,229,0.6)" }}>
              shortlisted
            </div>
          </div>
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
            <div className="text-[24px] font-extrabold" style={{ color: "#e37b9a" }}>
              {stats.liked}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "rgba(244,239,229,0.6)" }}>
              liked
            </div>
          </div>
        </div>

        <p className="mt-6 text-[13px]" style={{ color: "rgba(244,239,229,0.65)" }}>
          You've unlocked the <strong style={{ color: "#f0cf6a" }}>Gilded</strong> theme.
        </p>

        <button
          type="button"
          onClick={handleApplyGilded}
          className="mt-4 w-full rounded-full py-3.5 text-[15px] font-bold transition-transform active:scale-95"
          style={{
            background: "linear-gradient(120deg, #f0cf6a, #e1b965)",
            color: "#1a1510",
          }}
        >
          Apply Gilded theme
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="mt-3 text-[13px] font-semibold"
          style={{ color: "rgba(244,239,229,0.6)" }}
        >
          Keep current theme
        </button>
      </motion.div>

      <style>{`
        @keyframes finale-shimmer {
          to { background-position: -250% center; }
        }
      `}</style>
    </motion.div>
  );
}
