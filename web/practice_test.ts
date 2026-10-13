import { assert, assertEquals } from "@std/assert";
import { align, choose, type Chunk, CLEAN, fresh, unlock } from "./practice.ts";

const order = [..."abcde"];

Deno.test("letters unlock one at a time, once those in play are known", () => {
  const p = fresh();
  assertEquals(unlock(p, order), undefined);
  for (const l of order.slice(0, p.n)) p.count[l] = CLEAN;
  assertEquals(unlock(p, order), order[3]);
  assertEquals(unlock(p, order), undefined); // the new one isn't known yet
  assertEquals(p.n, 4);
});

Deno.test("the next word uses the least-practised letter, never the last word", () => {
  const words = ["a|b", "b|c", "c|a", "c|d", "a|c|e"].map((s) =>
    align(s, s.replaceAll("|", ""))
  ) as Chunk[][];
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
