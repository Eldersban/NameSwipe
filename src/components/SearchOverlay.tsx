import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NAMES } from "../data/names";
import { useAppStore } from "../store/useAppStore";
import { IconArrowLeft, IconSearch } from "./Icons";
import { NameDetailSheet } from "./NameDetailSheet";
import type { BabyName } from "../types/name";

interface SearchOverlayProps {
  onClose: () => void;
  onGoToDiscover: () => void;
}

const DISPOSITION_LABEL: Record<string, string> = {
  yes: "Shortlist",
  maybe: "Maybe",
  no: "No",
};

export function SearchOverlay({ onClose, onGoToDiscover }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const decisions = useAppStore((s) => s.decisions);
  const pendingLikes = useAppStore((s) => s.pendingLikes);
  const reviewNow = useAppStore((s) => s.reviewNow);
  const recordSearch = useAppStore((s) => s.recordSearch);
  const [detail, setDetail] = useState<BabyName | null>(null);
  const hasRecordedRef = useRef(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return NAMES.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 40);
  }, [query]);

  useEffect(() => {
    if (query.trim() && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      recordSearch();
    }
  }, [query, recordSearch]);

  function handleReviewNow(id: string) {
    reviewNow(id);
    onClose();
    onGoToDiscover();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 pb-3"
        style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", borderColor: "var(--line)" }}
      >
        <button type="button" onClick={onClose} aria-label="Close search" className="grid h-9 w-9 place-items-center">
          <IconArrowLeft width={20} height={20} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full border px-4 py-2.5" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
          <IconSearch width={17} height={17} style={{ color: "var(--muted)" }} />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names…"
            className="w-full bg-transparent text-[16px] outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {query.trim() === "" && (
          <p className="mt-10 text-center text-[14px]" style={{ color: "var(--muted)" }}>
            Search across all {NAMES.length} names to see if you've reviewed one already.
          </p>
        )}

        {query.trim() !== "" && results.length === 0 && (
          <p className="mt-10 text-center text-[14px]" style={{ color: "var(--muted)" }}>
            No names match "{query}"
          </p>
        )}

        <div className="flex flex-col gap-2">
          {results.map((n) => {
            const decision = decisions.get(n.id);
            const liked = decision?.liked ?? pendingLikes.has(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setDetail(n)}
                className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left"
                style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}
              >
                <div>
                  <p className="m-0 font-serif text-[20px]">{n.name}</p>
                  <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                    {decision ? (
                      <>
                        {DISPOSITION_LABEL[decision.disposition]}
                        {liked ? " · Liked" : ""}
                      </>
                    ) : (
                      "Not reviewed yet"
                    )}
                  </p>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReviewNow(n.id);
                  }}
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  Review now
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {detail && (
        <NameDetailSheet babyName={detail} onClose={() => setDetail(null)} hideDecisionButtons />
      )}
    </motion.div>
  );
}
