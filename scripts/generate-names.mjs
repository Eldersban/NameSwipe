// Regenerates src/data/names.json from ONLY the hand-curated entries
// (scripts/curated-raw.mjs) — useful for previewing the curated tier in
// isolation. The shipped database also merges in the full global name list;
// use `npm run db:build` (scripts/build-full-database.mjs) for that.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { raw } from "./curated-raw.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function countSyllables(name) {
  const word = name.toLowerCase().replace(/[^a-z]/g, "");
  const matches = word.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  if (word.endsWith("e") && !word.endsWith("le") && count > 1) count -= 1;
  return Math.max(1, count);
}

const seenNames = new Set();
const dedupedRaw = raw.filter((r) => {
  const key = slugify(r.name);
  if (seenNames.has(key)) return false;
  seenNames.add(key);
  return true;
});

const entries = dedupedRaw.map((r) => {
  const id = slugify(r.name);
  return {
    id,
    name: r.name,
    gender: "boy",
    nicknames: r.nicknames.map((n) => ({ name: n })),
    origins: r.origins,
    meaning: r.meaning,
    syllables: countSyllables(r.name),
    firstLetter: r.name[0].toUpperCase(),
    lastLetter: r.name[r.name.length - 1].toLowerCase(),
    styles: r.styles,
    traits: r.traits,
    popularityTier: r.popularityTier,
    similarNameIds: [],
  };
});

// Compute similarity score between two entries based on shared styles/traits + syllable closeness.
function similarity(a, b) {
  if (a.id === b.id) return -Infinity;
  const styleOverlap = a.styles.filter((s) => b.styles.includes(s)).length;
  const traitOverlap = a.traits.filter((t) => b.traits.includes(t)).length;
  const syllableCloseness = a.syllables === b.syllables ? 1 : a.syllables === b.syllables + 1 || a.syllables === b.syllables - 1 ? 0.5 : 0;
  const letterBonus = a.firstLetter === b.firstLetter ? 0.25 : 0;
  return styleOverlap * 2 + traitOverlap * 1.5 + syllableCloseness + letterBonus;
}

for (const entry of entries) {
  const scored = entries
    .map((other) => ({ id: other.id, score: similarity(entry, other) }))
    .sort((x, y) => y.score - x.score)
    .filter((x) => x.score > 0)
    .slice(0, 5);
  entry.similarNameIds = scored.map((s) => s.id);
}

writeFileSync(
  join(__dirname, "..", "src", "data", "names.json"),
  JSON.stringify(entries, null, 2)
);

console.log(`Generated ${entries.length} names`);
