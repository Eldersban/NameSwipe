import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import type { BabyName, Disposition } from "../types/name";
import { useAppStore } from "../store/useAppStore";
import { getNameById } from "../data/names";
import { IconHeart, IconSparkle } from "./Icons";
import { fireHaptic } from "../lib/haptics";

interface NameDetailSheetProps {
  babyName: BabyName;
  onClose: () => void;
  hideDecisionButtons?: boolean;
}

const DISPOSITIONS: { value: Disposition; label: string; symbol: string }[] = [
  { value: "no", label: "No", symbol: "✕" },
  { value: "maybe", label: "Maybe", symbol: "?" },
  { value: "yes", label: "Yes", symbol: "♥" },
];

function dispositionColor(disposition: Disposition): string {
  if (disposition === "yes") return "var(--yes)";
  if (disposition === "maybe") return "var(--maybe)";
  return "var(--no)";
}

function dispositionSoft(disposition: Disposition): string {
  if (disposition === "yes") return "var(--yes-soft)";
  if (disposition === "maybe") return "var(--maybe-soft)";
  return "var(--no-soft)";
}

export function NameDetailSheet({ babyName, onClose, hideDecisionButtons }: NameDetailSheetProps) {
  const toggleLike = useAppStore((s) => s.toggleLike);
  const decide = useAppStore((s) => s.decide);
  const decision = useAppStore((s) => s.decisions.get(babyName.id));
  const liked = useAppStore((s) => s.decisions.get(babyName.id)?.liked ?? s.pendingLikes.has(babyName.id));
  const showMoreLikeThis = useAppStore((s) => s.showMoreLikeThis);
  const reviewNow = useAppStore((s) => s.reviewNow);
  const updateNote = useAppStore((s) => s.updateNote);
  const surname = useAppStore((s) => s.settings.surname);

  const [note, setNote] = useState(decision?.note ?? "");
  const dragControls = useDragControls();

  const similarNames = babyName.similarNameIds
    .map((id) => getNameById(id))
    .filter((n): n is BabyName => Boolean(n))
    .slice(0, 5);

  function handleDecide(disposition: Disposition) {
    if (decision && decision.disposition === disposition) return;
    fireHaptic("medium");
    decide(babyName.id, disposition);
    onClose();
  }

  function handleMoreLikeThis() {
    fireHaptic("light");
    showMoreLikeThis(babyName.id);
    onClose();
  }

  function handleSimilarTap(id: string) {
    reviewNow(id);
    onClose();
  }

  function saveNote() {
    if (decision) updateNote(babyName.id, note);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-40"
        style={{ background: "rgba(20,18,14,0.4)" }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="absolute bottom-0 left-0 right-0 z-50 flex max-h-[85%] flex-col overflow-hidden rounded-t-[28px] border-t"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow-sheet)",
        }}
      >
        <div
          className="flex shrink-0 cursor-grab justify-center pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="h-1.5 w-10 rounded-full" style={{ background: "var(--line)" }} />
        </div>

        <div
          className="overflow-y-auto px-6 pb-8"
          style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}
        >
          <div className="text-center">
            <h2 className="font-serif" style={{ fontSize: 44, letterSpacing: "-0.04em", fontWeight: 500, margin: 0 }}>
              {babyName.name}
            </h2>
            {surname && (
              <p className="mt-1 text-[15px]" style={{ color: "var(--muted)" }}>
                {babyName.name} {surname}
              </p>
            )}
          </div>

          {babyName.nicknames.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Nicknames
              </h3>
              <div className="flex flex-wrap gap-2">
                {babyName.nicknames.map((nick) => (
                  <span
                    key={nick.name}
                    className="rounded-full border px-3 py-1.5 text-[14px] font-medium"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {nick.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Meaning
            </h3>
            <p className="m-0 text-[15px]">{babyName.meaning}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {babyName.origins.join(", ")}
            </p>
          </section>

          {similarNames.length > 0 && (
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Similar names
                </h3>
                <button
                  type="button"
                  onClick={handleMoreLikeThis}
                  className="flex items-center gap-1 text-[13px] font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  <IconSparkle width={14} height={14} />
                  More like this
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {similarNames.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSimilarTap(n.id)}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors active:scale-[0.98]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="font-serif text-[18px]">{n.name}</span>
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                      Review →
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {decision && (
            <section className="mt-6">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Notes
              </h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
                placeholder="Love the nickname, not sure about the initials…"
                rows={2}
                className="w-full resize-none rounded-2xl border px-4 py-3 text-[14px] outline-none"
                style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--text)" }}
              />
            </section>
          )}

          <button
            type="button"
            onClick={() => {
              fireHaptic("light");
              toggleLike(babyName.id);
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border py-3 text-[15px] font-bold transition-colors"
            style={{
              borderColor: liked ? "rgba(176,68,98,0.22)" : "var(--line)",
              background: liked ? "var(--like-soft)" : "transparent",
              color: liked ? "var(--like)" : "var(--text)",
            }}
          >
            <IconHeart filled={liked} width={17} height={17} />
            {liked ? "You like this name" : "I like this name"}
          </button>

          {!hideDecisionButtons && (
            <section className="mt-6">
              <h3 className="mb-2 text-center text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {decision ? "Your status — tap to change" : "Your status"}
              </h3>
              <div className="flex items-center justify-center gap-3">
                {DISPOSITIONS.map(({ value, label, symbol }) => {
                  const active = decision?.disposition === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleDecide(value)}
                      className="flex h-[68px] w-[68px] flex-col items-center justify-center gap-0.5 rounded-full border-2 font-extrabold transition-transform active:scale-95"
                      style={{
                        borderColor: active ? dispositionColor(value) : "var(--line)",
                        background: active ? dispositionSoft(value) : "transparent",
                        color: dispositionColor(value),
                      }}
                    >
                      <span className="text-[19px]">{symbol}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: active ? dispositionColor(value) : "var(--muted)" }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </>
  );
}
