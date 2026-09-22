// Merges the user-supplied global name database (Numbers export, filtered to
// male/unisex rows — see scripts/sources/namedb-male-raw.json) with our
// hand-curated entries and real SSA popularity data, producing the final
// src/data/names.json.
//
// scripts/sources/namedb-male-raw.json: extracted from the user's
//   namedb-all.numbers spreadsheet (name, family/origin, meaning), filtered
//   to gender === "Male" | "Male/Female".
// scripts/sources/ssa-male-ranks.json: name -> popularity rank, built from
//   the U.S. Social Security Administration's public baby name data
//   (2007-2016 aggregate, male), via the `us-baby-names` npm package.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { raw as curatedRaw } from "./curated-raw.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(__dirname, "sources");
const namedb = JSON.parse(readFileSync(join(SOURCES, "namedb-male-raw.json"), "utf8"));
const ssaRanks = JSON.parse(readFileSync(join(SOURCES, "ssa-male-ranks.json"), "utf8"));

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

function tierFromRank(rank) {
  if (rank === undefined) return undefined;
  if (rank <= 40) return "very-common";
  if (rank <= 150) return "common";
  if (rank <= 500) return "uncommon";
  return "rare";
}

const CLASSIC_FAMILIES = new Set([
  "Old English", "English", "Middle English", "Old German", "German",
  "Greek", "Latin", "Old French", "French", "Welsh", "Celtic",
  "Irish Gaelic", "Scots Gaelic",
]);
const BIBLICAL_FAMILIES = new Set(["Hebrew", "Aramaic", "Yiddish"]);

function styleFromFamily(family) {
  if (CLASSIC_FAMILIES.has(family)) return "classic";
  if (BIBLICAL_FAMILIES.has(family)) return "biblical";
  return "international";
}

// ---- 1. Build a lookup of curated (hand-authored) entries by lowercase name.
const curatedByName = new Map();
for (const r of curatedRaw) {
  curatedByName.set(r.name.toLowerCase(), r);
}

// ---- 2. Dedupe the namedb rows (first occurrence wins), skip ones with no name.
const namedbByName = new Map();
for (const row of namedb) {
  const key = row.name.toLowerCase();
  if (!namedbByName.has(key)) namedbByName.set(key, row);
}

// ---- 3. Union of all names: curated ∪ namedb.
const allKeys = new Set([...curatedByName.keys(), ...namedbByName.keys()]);

const entries = [];
for (const key of allKeys) {
  const curated = curatedByName.get(key);
  const fromDb = namedbByName.get(key);
  const displayName = curated ? curated.name : fromDb.name;

  let nicknames, origins, meaning, styles, traits;

  if (curated) {
    nicknames = curated.nicknames;
    origins = curated.origins;
    meaning = curated.meaning || (fromDb ? fromDb.meaning : "") || "";
    styles = curated.styles;
    traits = curated.traits;
  } else {
    nicknames = [];
    origins = fromDb.family ? [fromDb.family] : ["Unknown"];
    meaning = fromDb.meaning || "";
    const baseStyle = styleFromFamily(fromDb.family);
    styles = [baseStyle];
    if (displayName.replace(/[^a-zA-Z]/g, "").length <= 4) styles.push("short-punchy");
    const lastChar = displayName[displayName.length - 1]?.toLowerCase();
    const isVowelEnding = "aeiouy".includes(lastChar);
    traits = [isVowelEnding ? "soft" : "strong", "unusual"];
  }

  const rank = ssaRanks[displayName];
  const popularityTier = tierFromRank(rank) ?? curated?.popularityTier ?? "rare";

  const id = slugify(displayName);
  entries.push({
    id,
    name: displayName,
    gender: "boy",
    nicknames: nicknames.map((n) => (typeof n === "string" ? { name: n } : n)),
    origins,
    meaning,
    syllables: countSyllables(displayName),
    firstLetter: displayName[0].toUpperCase(),
    lastLetter: displayName[displayName.length - 1].toLowerCase(),
    styles,
    traits,
    popularityTier,
    _ssaRank: rank ?? Infinity,
    similarNameIds: [],
  });
}

console.log(`Merged ${entries.length} unique names (${curatedByName.size} curated, ${namedbByName.size} from database)`);

// ---- 4. Similar-name computation, bucketed by primary style to stay fast at this scale.
const byStyle = new Map();
for (const e of entries) {
  for (const s of e.styles) {
    if (!byStyle.has(s)) byStyle.set(s, []);
    byStyle.get(s).push(e);
  }
}

function similarity(a, b) {
  if (a.id === b.id) return -Infinity;
  const styleOverlap = a.styles.filter((s) => b.styles.includes(s)).length;
  const traitOverlap = a.traits.filter((t) => b.traits.includes(t)).length;
  const syllableCloseness = a.syllables === b.syllables ? 1 : Math.abs(a.syllables - b.syllables) === 1 ? 0.5 : 0;
  const letterBonus = a.firstLetter === b.firstLetter ? 0.25 : 0;
  return styleOverlap * 2 + traitOverlap * 1.5 + syllableCloseness + letterBonus;
}

for (const entry of entries) {
  const candidateSet = new Map();
  for (const s of entry.styles) {
    for (const cand of byStyle.get(s) ?? []) {
      if (cand.id !== entry.id) candidateSet.set(cand.id, cand);
    }
  }
  const scored = [...candidateSet.values()]
    .map((other) => ({ id: other.id, score: similarity(entry, other) }))
    .sort((x, y) => y.score - x.score)
    .filter((x) => x.score > 0)
    .slice(0, 5);
  entry.similarNameIds = scored.map((s) => s.id);
}

for (const e of entries) delete e._ssaRank;

writeFileSync(join(__dirname, "..", "src", "data", "names.json"), JSON.stringify(entries, null, 2));
console.log(`Wrote ${entries.length} entries to src/data/names.json`);
