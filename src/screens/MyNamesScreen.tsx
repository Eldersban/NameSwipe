import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getNameById } from "../data/names";
import { REJECTION_REASONS, type BabyName, type UserNameState } from "../types/name";
import { NameDetailSheet } from "../components/NameDetailSheet";
import { IconHeart } from "../components/Icons";

type Filter = "shortlist" | "maybe" | "liked" | "no" | "all" | "liked-unusable";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "shortlist", label: "Shortlist" },
  { id: "maybe", label: "Maybe" },
  { id: "liked", label: "Liked" },
  { id: "liked-unusable", label: "Can't use" },
  { id: "no", label: "No" },
  { id: "all", label: "All" },
];

function reasonLabel(state: UserNameState): string | null {
  if (!state.rejectionReason) return null;
  return REJECTION_REASONS.find((r) => r.value === state.rejectionReason)?.label ?? null;
}

export function MyNamesScreen() {
  const decisions = useAppStore((s) => s.decisions);
  const [filter, setFilter] = useState<Filter>("shortlist");
  const [detail, setDetail] = useState<BabyName | null>(null);

  const entries = useMemo(() => [...decisions.values()], [decisions]);

  // Decisions on names that used to be in the deck but have since been removed
  // (e.g. the catalog was narrowed). Nothing was deleted from storage — these
  // still count toward stats/achievements — they just can't be browsed here
  // since the name itself is no longer in the current list.
  const hiddenLegacyCount = useMemo(
    () => entries.filter((e) => !getNameById(e.nameId)).length,
    [entries]
  );

  const counts = useMemo(() => {
    let yes = 0;
    let maybe = 0;
    let no = 0;
    for (const e of entries) {
      if (e.disposition === "yes") yes++;
      else if (e.disposition === "maybe") maybe++;
      else no++;
    }
    return { yes, maybe, no };
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filter === "shortlist") list = entries.filter((e) => e.disposition === "yes");
    else if (filter === "maybe") list = entries.filter((e) => e.disposition === "maybe");
    else if (filter === "liked") list = entries.filter((e) => e.liked);
    else if (filter === "no") list = entries.filter((e) => e.disposition === "no");
    else if (filter === "liked-unusable")
      list = entries.filter((e) => e.liked && e.disposition === "no");

    return list
      .map((e) => ({ state: e, name: getNameById(e.nameId) }))
      .filter((x): x is { state: UserNameState; name: BabyName } => Boolean(x.name))
      .sort((a, b) => b.state.updatedAt.localeCompare(a.state.updatedAt));
  }, [entries, filter]);

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
        My Names
      </h1>
      <p className="m-0 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
        Everything you've reviewed so far.
      </p>

      {hiddenLegacyCount > 0 && (
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {hiddenLegacyCount} earlier {hiddenLegacyCount === 1 ? "decision is" : "decisions are"} on{" "}
          {hiddenLegacyCount === 1 ? "a name that isn't" : "names that aren't"} in the current list
          anymore, so {hiddenLegacyCount === 1 ? "it isn't" : "they aren't"} shown below — nothing
          was deleted, they're just not browsable here.
        </p>
      )}

      <div className="my-6 grid grid-cols-3 gap-2.5">
        {[
          { label: "Yes", value: counts.yes, color: "var(--yes)" },
          { label: "Maybe", value: counts.maybe, color: "var(--maybe)" },
          { label: "No", value: counts.no, color: "var(--no)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[20px] border px-2.5 py-4 text-center"
            style={{ borderColor: "var(--line)", background: "var(--surface)", backdropFilter: "blur(16px)" }}
          >
            <div className="text-[23px] font-extrabold" style={{ letterSpacing: "-0.04em", color: s.color }}>
              {s.value}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors"
              style={{
                borderColor: active ? "transparent" : "var(--line)",
                background: active ? "var(--text)" : "transparent",
                color: active ? "var(--bg)" : "var(--muted)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filter === "liked-unusable" && filtered.length > 0 && (
        <p className="mb-4 text-[13px]" style={{ color: "var(--muted)" }}>
          Names you loved but ruled out for reasons unrelated to taste — we'll keep showing names
          like these.
        </p>
      )}

      {filtered.length === 0 && (
        <div className="mt-16 text-center">
          <p className="text-[15px]" style={{ color: "var(--muted)" }}>
            Nothing here yet.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(({ state, name }) => (
          <button
            key={name.id}
            type="button"
            onClick={() => setDetail(name)}
            className="rounded-[22px] border px-5 py-4 text-left transition-transform active:scale-[0.99]"
            style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-serif" style={{ fontSize: 24, letterSpacing: "-0.02em", margin: 0 }}>
                  {name.name}
                </p>
                {name.nicknames.length > 0 && (
                  <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                    {name.nicknames.map((n) => n.name).join(" · ")}
                  </p>
                )}
              </div>
              {state.liked && <IconHeart filled width={18} height={18} style={{ color: "var(--like)" }} />}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{
                  color: state.disposition === "yes" ? "var(--yes)" : state.disposition === "maybe" ? "var(--maybe)" : "var(--no)",
                  background: state.disposition === "yes" ? "var(--yes-soft)" : state.disposition === "maybe" ? "var(--maybe-soft)" : "var(--no-soft)",
                }}
              >
                {state.disposition}
              </span>
              {reasonLabel(state) && (
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  · {reasonLabel(state)}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {detail && <NameDetailSheet babyName={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
