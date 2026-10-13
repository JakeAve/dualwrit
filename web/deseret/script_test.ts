import { assertEquals } from "@std/assert";
import { parseDict } from "../../src/deseret.ts";
import { align } from "../practice.ts";
import { deseret, engine } from "./script.ts";

const { rows, order, splits, styles } = deseret;
const lower = deseret.lower!;
const made = engine(parseDict(
  await Deno.readTextFile(new URL("../../data/cmudict.dict", import.meta.url)),
));
const alphabet = Array.from(
  { length: 40 },
  (_, i) => String.fromCodePoint(0x10400 + i),
);
const pool = (style: typeof styles[number]["id"]) =>
  splits.map((s) =>
    align(s, made.transcribe(s.replaceAll("|", ""), style).out)
  );

Deno.test("the keyboard types each of the 40 letters from exactly one key", () => {
  const typed = rows.flatMap((row) =>
    row.split(" ").flatMap((key) => [...key].slice(1))
  ).sort();
  assertEquals(typed, alphabet);
});

Deno.test("the teaching order is the 40 letters, once each", () => {
  assertEquals([...order].sort(), alphabet);
});

Deno.test("every word splits into one chunk per modern letter", () => {
  const off = splits.filter((_, i) => !pool("modern")[i]);
  assertEquals(off, []);
});

Deno.test("every letter a style uses has a word to practise it on", () => {
  for (const { id } of styles) {
    const words = pool(id).filter((w) => w !== null);
    const used = new Set(words.flat().map((c) => c.letter));
    // 1869 has no Oi or Ew letter.
    const letters = id === "1869" ? order.slice(0, 38) : order;
    assertEquals(letters.filter((l) => !used.has(lower(l))), [], id);
  }
});

Deno.test("retag tags the word a choice points at, if it is still there", () => {
  const [choice] = made.transcribe("I read books", "modern").choices!;
  assertEquals(
    made.retag!("I read books", choice, "past"),
    "I read{past} books",
  );
  assertEquals(made.retag!("I saw books", choice, "past"), "I saw books");
});

Deno.test("reading a transcription back gives the original words", () => {
  for (const { id } of styles) {
    const { out, pairs } = made.transcribe("the ship sat with them", id);
    assertEquals(made.untranscribe(out, id, []).out, "the ship sat with them");
    assertEquals(
      made.untranscribe(out, id, pairs).out,
      "the ship sat with them",
    );
  }
});
