// Spelling practice: a word starts in Latin, and the sounds whose letters have
// been learned become boxes to fill with the script. Nothing here touches the
// page; app.ts draws it.

export const START = 3; // letters in play on the first visit
export const CLEAN = 3; // first-try spellings before a letter counts as known

export type Chunk = { latin: string; letter: string };
// How many letters are in play, and each letter's first-try spellings.
export type Progress = { n: number; count: Record<string, number> };
export const fresh = (): Progress => ({ n: START, count: {} });

// Pair a split word with its spelling in the script, or null if they don't line up.
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
