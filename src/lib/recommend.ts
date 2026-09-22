import type { BabyName, NameStyle, UserNameState } from "../types/name";
import { AVAILABILITY_REASONS } from "../types/name";

const CALIBRATION_THRESHOLD = 30;

const ALL_STYLES: NameStyle[] = [
  "classic",
  "vintage",
  "modern",
  "biblical",
  "literary",
  "nature",
  "international",
  "surname-style",
  "short-punchy",
  "strong",
  "soft",
  "rare",
  "invented",
];

interface Profile {
  styleWeight: Partial<Record<NameStyle, number>>;
  traitWeight: Record<string, number>;
  syllableWeight: Record<number, number>;
  popularityWeight: Partial<Record<BabyName["popularityTier"], number>>;
  hasSignal: boolean;
}

function emptyProfile(): Profile {
  return {
    styleWeight: {},
    traitWeight: {},
    syllableWeight: {},
    popularityWeight: {},
    hasSignal: false,
  };
}

function addWeighted(
  name: BabyName,
  profile: Profile,
  weight: number
): void {
  for (const style of name.styles) {
    profile.styleWeight[style] = (profile.styleWeight[style] ?? 0) + weight;
  }
  for (const trait of name.traits) {
    profile.traitWeight[trait] = (profile.traitWeight[trait] ?? 0) + weight;
  }
  profile.syllableWeight[name.syllables] =
    (profile.syllableWeight[name.syllables] ?? 0) + weight;
  profile.popularityWeight[name.popularityTier] =
    (profile.popularityWeight[name.popularityTier] ?? 0) + weight;
}

export function computeProfile(
  names: Map<string, BabyName>,
  decisions: Map<string, UserNameState>
): Profile {
  const profile = emptyProfile();

  for (const state of decisions.values()) {
    const name = names.get(state.nameId);
    if (!name) continue;

    // Positive taste signal: explicit like, or a Yes/Maybe disposition.
    if (state.liked) {
      addWeighted(name, profile, 2.5);
      profile.hasSignal = true;
    }
    if (state.disposition === "yes") {
      addWeighted(name, profile, 2);
      profile.hasSignal = true;
    } else if (state.disposition === "maybe") {
      addWeighted(name, profile, 1);
      profile.hasSignal = true;
    } else if (state.disposition === "no") {
      const isAvailabilityRejection =
        state.rejectionReason && AVAILABILITY_REASONS.includes(state.rejectionReason);
      // Availability rejections (family/friend/taken) are NOT taste signals —
      // keep showing this style. Only a taste rejection pushes away from it.
      if (!isAvailabilityRejection && !state.liked) {
        addWeighted(name, profile, -1.5);
        profile.hasSignal = true;
      }
    }
  }

  return profile;
}

function scoreName(name: BabyName, profile: Profile): number {
  let score = 0;
  for (const style of name.styles) {
    score += (profile.styleWeight[style] ?? 0) * 1.5;
  }
  for (const trait of name.traits) {
    score += profile.traitWeight[trait] ?? 0;
  }
  score += (profile.syllableWeight[name.syllables] ?? 0) * 0.5;
  score += (profile.popularityWeight[name.popularityTier] ?? 0) * 0.4;
  return score;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function primaryStyle(name: BabyName): NameStyle {
  return name.styles[0] ?? "classic";
}

/** Balanced round-robin spread across styles, for the first N calibration cards. */
function calibrationOrder(candidates: BabyName[]): string[] {
  const buckets = new Map<NameStyle, BabyName[]>();
  for (const style of ALL_STYLES) buckets.set(style, []);
  for (const name of candidates) {
    buckets.get(primaryStyle(name))?.push(name);
  }
  for (const [style, list] of buckets) {
    buckets.set(style, shuffle(list));
  }

  const order: string[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const style of shuffle(ALL_STYLES)) {
      const bucket = buckets.get(style);
      if (bucket && bucket.length > 0) {
        order.push(bucket.shift()!.id);
        remaining = true;
      }
    }
  }
  return order;
}

/** Scored recommendation order mixing high-confidence picks, adjacent exploration, and wildcards. */
function recommendationOrder(candidates: BabyName[], profile: Profile): string[] {
  const scored = candidates
    .map((name) => ({ name, score: scoreName(name, profile) }))
    .sort((a, b) => b.score - a.score);

  const total = scored.length;
  const highCount = Math.ceil(total * 0.7);
  const midCount = Math.ceil(total * 0.2);

  const poolA = shuffle(scored.slice(0, highCount).map((s) => s.name.id));
  const poolB = shuffle(scored.slice(highCount, highCount + midCount).map((s) => s.name.id));
  const poolC = shuffle(scored.slice(highCount + midCount).map((s) => s.name.id));

  const order: string[] = [];
  while (poolA.length || poolB.length || poolC.length) {
    const roll = Math.random();
    let picked: string | undefined;
    if (roll < 0.7 && poolA.length) picked = poolA.shift();
    else if (roll < 0.9 && poolB.length) picked = poolB.shift();
    else if (poolC.length) picked = poolC.shift();
    else picked = poolA.shift() ?? poolB.shift() ?? poolC.shift();
    if (picked) order.push(picked);
  }
  return order;
}

export function buildQueue(
  names: BabyName[],
  decisions: Map<string, UserNameState>
): string[] {
  const namesById = new Map(names.map((n) => [n.id, n]));
  const candidates = names.filter((n) => !decisions.has(n.id));

  if (decisions.size < CALIBRATION_THRESHOLD) {
    return calibrationOrder(candidates);
  }

  const profile = computeProfile(namesById, decisions);
  if (!profile.hasSignal) {
    return calibrationOrder(candidates);
  }
  return recommendationOrder(candidates, profile);
}

/** Pulls the top-K names most similar to a target, for "More like this" / detail sheet. */
export function moreLikeThis(
  target: BabyName,
  names: BabyName[],
  decisions: Map<string, UserNameState>,
  limit = 8
): string[] {
  const unseen = names.filter((n) => n.id !== target.id && !decisions.has(n.id));

  const direct = target.similarNameIds.filter((id) =>
    unseen.some((n) => n.id === id)
  );

  const remaining = unseen
    .filter((n) => !direct.includes(n.id))
    .map((n) => {
      const styleOverlap = n.styles.filter((s) => target.styles.includes(s)).length;
      const traitOverlap = n.traits.filter((t) => target.traits.includes(t)).length;
      return { id: n.id, score: styleOverlap * 2 + traitOverlap };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);

  return [...direct, ...remaining].slice(0, limit);
}
