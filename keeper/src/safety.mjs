// Rules that live outside the playbook: the learning loop cannot change them, and nothing
// the playbook says can override them.

// Unambiguous terms: also matched inside a word once every separator is removed.
const HARD = ["nazi", "porn", "nude", "suicide", "murder", "terror", "racist", "slur", "rape", "gore", "airdrop", "giveaway", "guaranteed", "hitler", "isis"];
// Terms that would cause false hits inside other words: matched as whole words (plus suffixes).
const WORD = ["death", "dead", "died", "dies", "kill", "killed", "shooting", "shooter", "attack", "war", "bomb", "disaster", "earthquake", "flood", "crash", "child", "children", "kid", "kids", "minor", "minors", "teen", "student", "sex", "sexy", "official"];
const SUFFIXES = ["", "s", "es", "ed", "ing", "er", "ers"];
// Hard terms whose compact match would hit innocent words, with the words that excuse them.
const COMPACT_EXCUSES = { rape: ["grape", "drape", "scrape", "trapez"], gore: ["gorep"], isis: [], slur: ["slurp"] };

// Latin lookalikes from Cyrillic and Greek, and common digit/symbol swaps.
const CONFUSABLE = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "к": "k", "м": "m", "н": "h", "т": "t", "в": "b", "ԁ": "d", "ӏ": "l",
  "α": "a", "ε": "e", "ο": "o", "ι": "i", "κ": "k", "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "β": "b", "η": "n", "μ": "u",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "l",
};
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯︀-️﻿]/g;

/** Lowercase, invisible characters removed, accents and lookalikes folded to plain Latin. */
export function fold(text) {
  return String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(INVISIBLE, "")
    .toLowerCase()
    .split("")
    .map((ch) => CONFUSABLE[ch] ?? ch)
    .join("");
}

/** Words of a text, with runs of single letters ("n a z i", "n.a.z.i") joined back into one word. */
function words(folded) {
  const raw = folded.split(/[^a-z0-9]+/).filter(Boolean);
  const out = [];
  let run = "";
  for (const w of raw) {
    if (w.length === 1) run += w;
    else {
      if (run) out.push(run);
      run = "";
      out.push(w);
    }
  }
  if (run) out.push(run);
  return out;
}

/** First filter on a topic, a name or a story. Returns the offending term or null. */
export function blockedTerm(text) {
  const f = fold(text);
  const ws = words(f);
  const compact = f.replace(/[^a-z0-9]+/g, "");
  for (const w of ws) {
    for (const t of [...HARD, ...WORD]) if (SUFFIXES.some((s) => w === t + s)) return t;
  }
  for (const t of HARD) {
    let i = compact.indexOf(t);
    while (i !== -1) {
      const around = compact.slice(Math.max(0, i - 2), i + t.length + 2);
      const excused = (COMPACT_EXCUSES[t] ?? []).some((e) => around.includes(e));
      if (!excused) return t;
      i = compact.indexOf(t, i + 1);
    }
  }
  return null;
}

const PRINTABLE = /^[\x20-\x7E]*$/;

/** Name, ticker and story rules. Returns a list of broken rules (empty = ok). */
export function nameProblems({ name, symbol, description }, { used = new Set(), own = ["connex"] } = {}) {
  const out = [];
  for (const [k, v] of Object.entries({ name, symbol, description })) {
    if (typeof v !== "string" || !PRINTABLE.test(v)) out.push(`${k} must be plain printable ASCII`);
  }
  if (out.length) return out;
  if (name.trim().length < 2 || name.length > 32) out.push("name must be 2 to 32 characters");
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) out.push("ticker must be 2 to 10 capital letters or digits");
  if (description.length > 280) out.push("story must be under 280 characters");
  if (/https?:|www\.|\.(com|io|xyz|fun|cash|app)\b/i.test(`${name} ${description}`)) out.push("no links");
  if (/\b(moon|pump|price|profit|returns?|guarantee|x100|100x)\b/i.test(description)) out.push("no price promises");
  const compact = fold(`${name}${symbol}`).replace(/[^a-z]/g, "");
  if (own.some((o) => compact.includes(o))) out.push("never use the project's own name");
  if (used.has(symbol.toUpperCase()) || used.has(name.toLowerCase())) out.push("name or ticker already used");
  const term = blockedTerm(`${name} ${symbol} ${description}`);
  if (term) out.push(`blocked term: ${term}`);
  return out;
}

const X_STATUS = /^https:\/\/x\.com\/(i\/web\/status|[A-Za-z0-9_]{1,15}\/status)\/\d{1,25}$/;
const IPFS = /^ipfs:\/\/(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,100})$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

/**
 * Every field of a launch transaction checked before it is built. Model output never
 * reaches the chain unchecked: the pair comes from a fixed map, links from fixed patterns.
 */
export function launchParamProblems(p, { allowedPairs, siteUrl }) {
  const out = nameProblems({ name: p.name, symbol: p.symbol, description: p.description });
  if (!(p.logo === "" || IPFS.test(p.logo))) out.push("logo must be empty or an ipfs:// CID we pinned");
  if (!(p.twitter === "" || X_STATUS.test(p.twitter))) out.push("source link must be an x.com status URL");
  if (p.website !== siteUrl) out.push("website must be the site URL");
  if (!ADDR.test(p.pairToken) || !allowedPairs.includes(p.pairToken.toLowerCase())) out.push("pair must be ETH or an approved stock token");
  if (!Number.isInteger(p.round) || p.round < 0 || p.round > 2 ** 32 - 1) out.push("round out of range");
  for (const h of ["sourceHash", "playbookHash"]) if (!/^0x[0-9a-f]{64}$/.test(p[h])) out.push(`${h} must be 32 bytes`);
  return out;
}

export const isXStatusUrl = (u) => X_STATUS.test(String(u));
