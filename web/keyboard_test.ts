import { assertEquals } from "@std/assert";
import { rows } from "./keyboard.ts";

Deno.test("the keyboard types each of the 40 letters from exactly one key", () => {
  const typed = rows.flat().flatMap(([, ...glyphs]) => glyphs).sort();
  const alphabet = Array.from(
    { length: 40 },
    (_, i) => String.fromCodePoint(0x10400 + i),
  );
  assertEquals(typed, alphabet);
});
