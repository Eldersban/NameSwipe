import { useState } from "react";
import { motion } from "framer-motion";
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

export function NameDetailSheet({ babyName, onClose, hideDecisionButtons }: NameDetailSheetProps) {
  const isLiked = useAppStore((s) => s.isLiked);
  const toggleLike = useAppStore((s) => s.toggleLike);
  const decide = useAppStore((s) => s.decide);
  const decision = useAppStore((s) => s.decisions.get(babyName.id));
  const showMoreLikeThis = useAppStore((s) => s.showMoreLikeThis);
  const reviewNow = useAppStore((s) => s.reviewNow);
  const updateNote = useAppStore((s) => s.updateNote);
  const surname = useAppStore((s) => s.settings.surname);

  const [note, setNote] = useState(decision?.note ?? "");
  const liked = isLiked(babyName.id);

  const similarNames = babyName.similarNameIds
    .map((id) => getNameById(id))
    .filter((n): n is BabyName => Boolean(n))
    .slice(0, 5);

  function handleDecide(disposition: Disposition) {
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
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="absolute bottom-0 left-0 right-0 z-50 max-h-[85%] overflow-y-auto rounded-t-[28px] border-t px-6 pb-8 pt-3"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow-sheet)",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full" style={{ background: "var(--line)" }} />

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

        {decision && (
          <div className="mt-3 flex justify-center">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{
                color:
                  decision.disposition === "yes" ? "var(--yes)" : decision.disposition === "maybe" ? "var(--maybe)" : "var(--no)",
                background:
                  decision.disposition === "yes" ? "var(--yes-soft)" : decision.disposition === "maybe" ? "var(--maybe-soft)" : "var(--no-soft)",
              }}
            >
              Your status: {decision.disposition}
            </span>
          </div>
        )}

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
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => handleDecide("no")}
              className="grid h-[56px] w-[56px] place-items-center rounded-full border text-[19px] font-extrabold"
              style={{ borderColor: "var(--line)", color: "var(--no)" }}
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => handleDecide("maybe")}
              className="grid h-[62px] w-[62px] place-items-center rounded-full border text-[14px] font-extrabold"
              style={{ borderColor: "var(--line)", color: "var(--maybe)" }}
            >
              ?
            </button>
            <button
              type="button"
              onClick={() => handleDecide("yes")}
              className="grid h-[56px] w-[56px] place-items-center rounded-full border text-[19px] font-extrabold"
              style={{ borderColor: "var(--line)", color: "var(--yes)" }}
            >
              ♥
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
