import { assert, assertEquals } from "@std/assert";
import { parseDict, type Style, styles, transcribe } from "../src/deseret.ts";
import {
  align,
  choose,
  type Chunk,
  CLEAN,
  fresh,
  order,
  splits,
  unlock,
} from "./practice.ts";

const dict = parseDict(
  await Deno.readTextFile(new URL("../data/cmudict.dict", import.meta.url)),
);
const pool = (style: Style) =>
  splits.map((s) =>
    align(s, transcribe(s.replaceAll("|", ""), dict, style).out)
  );

Deno.test("the teaching order is the 40 letters, once each", () => {
  assertEquals(
    [...order].sort(),
    Array.from({ length: 40 }, (_, i) => String.fromCodePoint(0x10428 + i)),
  );
});

Deno.test("every word splits into one chunk per modern letter", () => {
  const off = splits.filter((_, i) => !pool("modern")[i]);
  assertEquals(off, []);
});

Deno.test("every letter a style uses has a word to practise it on", () => {
  for (const style of Object.keys(styles) as Style[]) {
    const words = pool(style).filter((w) => w !== null);
    const used = new Set(words.flat().map((c) => c.letter));
    // 1869 has no Oi or Ew letter.
    const letters = style === "1869" ? order.slice(0, 38) : order;
    assertEquals(letters.filter((l) => !used.has(l)), [], style);
    console.log(`${style}: ${words.length} of ${splits.length} words`);
  }
});

Deno.test("letters unlock one at a time, once those in play are known", () => {
  const p = fresh();
  assertEquals(unlock(p, order), undefined);
  for (const l of order.slice(0, p.n)) p.count[l] = CLEAN;
  assertEquals(unlock(p, order), order[3]);
  assertEquals(unlock(p, order), undefined); // the new one isn't known yet
  assertEquals(p.n, 4);
});

Deno.test("the next word uses the least-practised letter, never the last word", () => {
  const words = pool("modern") as Chunk[][];
  const p = fresh();
  p.count = { [order[0]]: 5, [order[1]]: 5 };
  let last: Chunk[] | undefined;
  for (let i = 0; i < 50; i++) {
    const word = choose(words, p, order, last);
    assert(word !== last);
    assert(word.some((c) => c.letter === order[2]));
    last = word;
  }
});
