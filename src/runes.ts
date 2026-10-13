// English -> the runes of The Hobbit, letter for letter. Tolkien's spelling
// conventions, not Old English sound values: no dictionary, nothing is missed.
//
// A key is one or two Latin letters; two letters win over one. Where two keys
// share a rune, the first listed is the one read back (i before j, u before
// v, c before q).
export const table: Record<string, string> = {
  a: "ᚪ",
  b: "ᛒ",
  c: "ᚳ",
  d: "ᛞ",
  e: "ᛖ",
  f: "ᚠ",
  g: "ᚷ",
  h: "ᚻ",
  i: "ᛁ",
  j: "ᛁ",
  k: "ᛱ",
  l: "ᛚ",
  m: "ᛗ",
  n: "ᚾ",
  o: "ᚩ",
  p: "ᛈ",
  r: "ᚱ",
  s: "ᛋ",
  t: "ᛏ",
  u: "ᚢ",
  v: "ᚢ",
  w: "ᚹ",
  x: "ᛉ",
  y: "ᚣ",
  z: "ᛣ",

  // ponytail: spelling only, so a digraph that straddles two syllables still
  // gets its rune: "pothole" gets ᚦ, "ungrateful" gets ᛝ. A dictionary of
  // exception words is the upgrade if that ever matters.
  th: "ᚦ",
  ng: "ᛝ",
  ee: "ᛟ",
  ea: "ᛠ",
  eo: "ᛇ",
  st: "ᛥ",
  oo: "ᛳ",
  sh: "ᛲ",

  // q is written cw: two letters, two runes.
  q: "ᚳ",
  qu: "ᚳᚹ",
};

const reverse: Record<string, string> = {};
for (const [latin, rune] of Object.entries(table)) reverse[rune] ??= latin;

// Each word as [latin as written, its runes], in order.
export type Pairs = [string, string][];

// A word in either script, or a mix. Apostrophes count only inside a word, so
// quote marks stay punctuation. The class is the runic letters, without the
// ᛫ ᛬ ᛭ punctuation and the three numerals that follow it.
const WORD = /[A-Za-zᚠ-ᛪᛱ-ᛸ]+(?:['’][A-Za-zᚠ-ᛪᛱ-ᛸ]+)*/g;

// Split a word into [key, value] steps, the longest key first. Anything the
// table lacks is a step that maps to itself.
function match(word: string, by: Record<string, string>): [string, string][] {
  const steps: [string, string][] = [];
  for (let i = 0; i < word.length;) {
    const two = word.slice(i, i + 2);
    const key = two.length === 2 && Object.hasOwn(by, two) ? two : word[i];
    steps.push([key, Object.hasOwn(by, key) ? by[key] : key]);
    i += key.length;
  }
  return steps;
}

const spell = (word: string, by: Record<string, string>) =>
  match(word, by).map(([, to]) => to).join("");

// Capitals fold, since runes have no case. Spaces, digits and punctuation
// pass through unchanged.
export function transcribe(text: string): { out: string; pairs: Pairs } {
  const pairs: Pairs = [];
  const out = text.replace(WORD, (word) => {
    const runes = spell(word.toLowerCase(), table);
    pairs.push([word, runes]);
    return runes;
  });
  return { out, pairs };
}

// Runes -> English, lower case. `kept` is the `pairs` of the text as it stood
// before this edit: unchanged words at either end keep their English, so
// capitals, j and v survive in every word that was not edited.
export function untranscribe(
  text: string,
  kept: Pairs,
): { out: string; pairs: Pairs } {
  const tokens = text.match(WORD) ?? [];
  const most = Math.min(tokens.length, kept.length);
  let head = 0, tail = 0;
  while (head < most && tokens[head] === kept[head][1]) head++;
  while (
    head + tail < most && tokens.at(-1 - tail) === kept.at(-1 - tail)![1]
  ) tail++;

  const pairs: Pairs = [];
  let i = 0;
  const out = text.replace(WORD, (runes) => {
    const fromEnd = tokens.length - i;
    const english = i < head
      ? kept[i][0]
      : fromEnd <= tail
      ? kept[kept.length - fromEnd][0]
      : spell(runes, reverse);
    i++;
    pairs.push([english, runes]);
    return english;
  });
  return { out, pairs };
}

// A word's Latin split into one chunk per rune: "th|i|ng". `qu` is two runes,
// so it splits into its letters: "q|u|ee|n".
export function chunks(word: string): string {
  return match(word.toLowerCase(), table)
    .flatMap(([latin, runes]) => runes.length > 1 ? [...latin] : [latin])
    .join("|");
}
