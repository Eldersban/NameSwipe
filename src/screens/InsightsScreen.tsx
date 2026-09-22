import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { getNameById } from "../data/names";
import type { BabyName, NameStyle } from "../types/name";

const STYLE_LABEL: Record<NameStyle, string> = {
  classic: "Classic",
  vintage: "Vintage",
  modern: "Modern",
  biblical: "Biblical",
  literary: "Literary",
  nature: "Nature-inspired",
  international: "International",
  "surname-style": "Surname-style",
  "short-punchy": "Short & punchy",
  strong: "Strong-sounding",
  soft: "Soft-sounding",
  rare: "Rare & unique",
  invented: "Modern-invented",
};

const MIN_REVIEWED = 12;

function topEntries(counter: Map<string, number>, n: number): string[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function InsightsScreen() {
  const decisions = useAppStore((s) => s.decisions);

  const stats = useMemo(() => {
    const entries = [...decisions.values()];
    const positive: BabyName[] = [];
    const negative: BabyName[] = [];
    let likedUnusable = 0;

    for (const state of entries) {
      const name = getNameById(state.nameId);
      if (!name) continue;
      if (state.liked || state.disposition === "yes") positive.push(name);
      if (state.disposition === "no" && !state.liked) negative.push(name);
      if (state.liked && state.disposition === "no") likedUnusable++;
    }

    const styleCounts = new Map<string, number>();
    const syllableCounts = new Map<string, number>();
    const endingCounts = new Map<string, number>();
    for (const n of positive) {
      for (const s of n.styles) increment(styleCounts, s);
      increment(syllableCounts, `${n.syllables}`);
      increment(endingCounts, n.lastLetter);
    }

    const negativeStyleCounts = new Map<string, number>();
    for (const n of negative) {
      for (const s of n.styles) increment(negativeStyleCounts, s);
    }

    const topStyles = topEntries(styleCounts, 4) as NameStyle[];
    const rareStyles = topEntries(negativeStyleCounts, 3) as NameStyle[];
    const topSyllables = topEntries(syllableCounts, 2);
    const topEndings = topEntries(endingCounts, 3);

    const familyMap = new Map<NameStyle, BabyName[]>();
    for (const n of positive) {
      const style = n.styles[0];
      if (!style) continue;
      if (!familyMap.has(style)) familyMap.set(style, []);
      familyMap.get(style)!.push(n);
    }
    const families = [...familyMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);

    return {
      reviewed: entries.length,
      positiveCount: positive.length,
      topStyles,
      rareStyles,
      topSyllables,
      topEndings,
      likedUnusable,
      families,
    };
  }, [decisions]);

  const ready = stats.reviewed >= MIN_REVIEWED;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        paddingTop: "calc(82px + env(safe-area-inset-top))",
        paddingLeft: 18,
        paddingRight: 18,
        paddingBottom: "calc(100px + env(safe-area-inset-bottom))",
      }}
    >
      <h1 className="font-serif" style={{ fontSize: 42, letterSpacing: "-0.04em", fontWeight: 500, margin: "4px 0 6px" }}>
        Insights
      </h1>
      <p className="m-0 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
        What your decisions reveal about your taste.
      </p>

      {!ready && (
        <div className="mt-10 rounded-[24px] border px-6 py-10 text-center" style={{ borderColor: "var(--line)" }}>
          <p className="text-[15px]" style={{ color: "var(--muted)" }}>
            Review at least {MIN_REVIEWED} names to unlock your taste profile.
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
            {stats.reviewed} of {MIN_REVIEWED} reviewed
          </p>
        </div>
      )}

      {ready && (
        <div className="mt-6 flex flex-col gap-4">
          {stats.topStyles.length > 0 && (
            <section className="rounded-[24px] border px-5 py-5" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                You tend to like
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topStyles.map((s) => (
                  <span key={s} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--yes-soft)", color: "var(--yes)" }}>
                    {STYLE_LABEL[s]}
                  </span>
                ))}
                {stats.topSyllables.map((s) => (
                  <span key={`syl-${s}`} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--yes-soft)", color: "var(--yes)" }}>
                    {s}-syllable names
                  </span>
                ))}
              </div>
              {stats.topEndings.length > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--muted)" }}>
                  Often ending in "{stats.topEndings.join('", "')}"
                </p>
              )}
            </section>
          )}

          {stats.rareStyles.length > 0 && (
            <section className="rounded-[24px] border px-5 py-5" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                You rarely shortlist
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.rareStyles.map((s) => (
                  <span key={s} className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--no-soft)", color: "var(--no)" }}>
                    {STYLE_LABEL[s]}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[24px] border px-5 py-5" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
            <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Names you like but can't use
            </h3>
            <p className="m-0 text-[28px] font-extrabold" style={{ letterSpacing: "-0.03em", color: "var(--like)" }}>
              {stats.likedUnusable}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              These still shape your recommendations — check the "Can't use" filter in My Names.
            </p>
          </section>

          {stats.families.length > 0 && (
            <section className="rounded-[24px] border px-5 py-5" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Strongest name families
              </h3>
              <div className="flex flex-col gap-3">
                {stats.families.map(([style, names]) => (
                  <div key={style}>
                    <p className="m-0 text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
                      {STYLE_LABEL[style]}
                    </p>
                    <p className="m-0 font-serif text-[18px]">{names.slice(0, 4).map((n) => n.name).join(" / ")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
