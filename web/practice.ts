// Spelling practice: a word starts in Latin, and the sounds whose letters have
// been learned become boxes to fill with Deseret. Nothing here touches the
// page; app.ts draws it.

// Each word split into sound chunks, one chunk per Deseret letter. A silent
// letter rides on its neighbour (fi|ve). A word whose chunks don't match its
// spelling in the chosen style is left out of that style.
// ponytail: split by hand. A sentence would be the same thing with spaces;
// an automatic splitter is the upgrade if the list has to cover any text.
export const splits = `c|a|t s|u|n sh|i|p m|oo|n b|r|ea|d h|o|n|ey l|igh|t
s|ch|oo|l th|i|ng m|ou|n|t|ai|n b|e|d d|o|g f|i|sh t|r|ee b|oo|k h|a|n|d r|ai|n
s|n|ow m|i|l|k g|r|ee|n r|e|d b|l|ue m|ou|se r|oa|d b|oa|t sh|ee|p ch|ee|se
j|u|m|p k|i|ng q|u|ee|n r|i|ng s|o|ng th|i|n|k th|i|s th|a|t m|o|th|e|r
f|a|th|e|r s|i|s|t|e|r b|r|o|th|e|r w|a|t|e|r r|i|v|e|r b|i|r|d h|o|r|se
g|a|r|d|e|n ch|ai|r w|i|n|d|ow h|a|pp|y s|e|v|e|n th|r|ee
f|i|ve n|i|ne n|igh|t d|ay s|w|ee|t v|oi|ce b|oy t|oy f|ew m|u|s|i|c
m|ea|s|u|re z|oo y|e|s w|i|sh s|i|t t|i|n m|a|n n|u|t m|a|p s|a|t m|i|n|t
s|t|a|m|p t|e|n n|e|t p|e|n b|a|t d|a|d f|a|n l|a|m|p r|a|t k|i|d g|a|s
h|o|t w|e|b v|a|n z|i|p j|a|m y|a|m l|aw s|aw c|a|r s|t|a|r f|oo|t g|oo|d
j|oy c|ow n|ow g|a|te n|a|me ea|t s|ea g|o h|o|me f|oo|d i|ce t|i|me
l|e|g l|o|ng ch|i|n sh|o|p b|a|th w|i|th th|e|m v|i|s|io|n`.split(/\s+/);

const lower = (g: string) => String.fromCodePoint(g.codePointAt(0)! + 0x28);

// The order letters are taught in, easiest first: consonants that match one
// Latin letter, then the two-letter ones, then short, long and gliding vowels.
export const order = [
  ..."𐐝𐐓𐐤𐐣𐐑𐐒𐐔𐐙𐐢𐐡𐐗𐐘𐐐𐐎𐐚𐐞𐐖𐐏𐐟𐐕𐐛𐐜𐐥𐐠𐐆𐐇𐐈𐐉𐐊𐐋𐐀𐐁𐐂𐐃𐐄𐐅𐐌𐐍𐐦𐐧",
].map(lower);

export const START = 3; // letters in play on the first visit
export const CLEAN = 3; // first-try spellings before a letter counts as known

export type Chunk = { latin: string; letter: string };
// How many letters are in play, and each letter's first-try spellings.
export type Progress = { n: number; count: Record<string, number> };
export const fresh = (): Progress => ({ n: START, count: {} });

// Pair a split word with its Deseret spelling, or null if they don't line up.
export function align(split: string, spelling: string): Chunk[] | null {
  const latin = split.split("|"), letters = [...spelling];
  return latin.length === letters.length
    ? latin.map((l, i) => ({ latin: l, letter: letters[i] }))
    : null;
}

export const known = (p: Progress, letter: string) =>
  (p.count[letter] ?? 0) >= CLEAN;

// Put the next of `letters` in play once every one in play is known.
export function unlock(p: Progress, letters: string[]): string | undefined {
  if (
    p.n >= letters.length || !letters.slice(0, p.n).every((l) => known(p, l))
  ) {
    return;
  }
  return letters[p.n++];
}

// The next word: one that uses the least-practised letter in play, and not
// the word just spelled.
export function choose(
  words: Chunk[][],
  p: Progress,
  letters: string[],
  last?: Chunk[],
  random = Math.random,
): Chunk[] {
  const play = new Set(letters.slice(0, p.n));
  const usable = words.filter((w) =>
    w !== last && w.some((c) => play.has(c.letter))
  );
  const uses = (l: string) =>
    usable.filter((w) => w.some((c) => c.letter === l));
  const weakest = [...play].filter((l) => uses(l).length)
    .sort((a, b) => (p.count[a] ?? 0) - (p.count[b] ?? 0))[0];
  const from = uses(weakest);
  return from[Math.floor(random() * from.length)];
}
