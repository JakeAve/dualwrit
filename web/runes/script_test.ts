import { assertEquals } from "@std/assert";
import { table } from "../../src/runes.ts";
import { align } from "../practice.ts";
import { engine, runes } from "./script.ts";

const { rows, order, splits } = runes;
const alphabet = [...new Set(Object.values(table).join(""))].sort();
const pool = splits.map((s) =>
  align(s, engine.transcribe(s.replaceAll("|", ""), "hobbit").out)
);

Deno.test("the keyboard types each of the 31 runes", () => {
  const typed = rows.flatMap((row) =>
    row.split(" ").flatMap((key) => [...key].slice(1))
  );
  assertEquals(alphabet.length, 31);
  assertEquals([...new Set(typed)].sort(), alphabet);
});

Deno.test("the teaching order is the 31 runes, once each", () => {
  assertEquals([...order].sort(), alphabet);
});

Deno.test("every word splits into one chunk per rune, and is listed once", () => {
  assertEquals(splits.filter((_, i) => !pool[i]), []);
  assertEquals(splits.length, new Set(splits).size);
});

Deno.test("every rune has a word to practise it on", () => {
  const used = new Set(pool.flatMap((w) => w ?? []).map((c) => c.letter));
  assertEquals(order.filter((l) => !used.has(l)), []);
});

Deno.test("reading a transcription back gives the original words", async () => {
  const made = await runes.load(() => {});
  const { out, pairs } = made.transcribe("the ship sat with them", "hobbit");
  assertEquals(
    made.untranscribe(out, "hobbit", []).out,
    "the ship sat with them",
  );
  assertEquals(
    made.untranscribe(out, "hobbit", pairs).out,
    "the ship sat with them",
  );
});
