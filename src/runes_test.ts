import { assertEquals } from "@std/assert";
import { chunks, table, transcribe, untranscribe } from "./runes.ts";

const r = (text: string) => transcribe(text).out;

Deno.test("the spec's two check words", () => {
  assertEquals(r("smaug"), "ᛋᛗᚪᚢᚷ");
  assertEquals(r("wyrm"), "ᚹᚣᚱᛗ");
});

Deno.test("every table key transcribes to its value", () => {
  for (const [latin, rune] of Object.entries(table)) {
    assertEquals(r(latin), rune, latin);
  }
});

Deno.test("two letters win over one", () => {
  assertEquals(r("thing"), "ᚦᛁᛝ");
  assertEquals(r("street"), "ᛥᚱᛟᛏ");
  assertEquals(r("queen"), "ᚳᚹᛟᚾ"); // q is written cw
});

Deno.test("capitals fold, everything else passes through", () => {
  assertEquals(r("Stand by the grey stone!"), "ᛥᚪᚾᛞ ᛒᚣ ᚦᛖ ᚷᚱᛖᚣ ᛥᚩᚾᛖ!");
  assertEquals(r("‘Don't’ 13"), "‘ᛞᚩᚾ'ᛏ’ 13");
  assertEquals(transcribe("Don't go").pairs, [["Don't", "ᛞᚩᚾ'ᛏ"], [
    "go",
    "ᚷᚩ",
  ]]);
});

Deno.test("chunks: one Latin chunk per rune", () => {
  assertEquals(chunks("thing"), "th|i|ng");
  assertEquals(chunks("queen"), "q|u|ee|n");
});

Deno.test("runes back to English", async (t) => {
  await t.step("round trip, lower case", () => {
    const text = "the ship sat with them";
    assertEquals(untranscribe(r(text), []).out, text);
  });
  await t.step("shared runes read as i, u and qu", () => {
    assertEquals(
      untranscribe(r("Joy and Vex, queen!"), []).out,
      "ioy and uex, queen!",
    );
  });
  await t.step("an edit keeps the English of untouched words", () => {
    const english = "Joy and Vex";
    const { out, pairs } = transcribe(english);
    assertEquals(untranscribe(out, pairs).out, english);
    assertEquals(
      untranscribe(out.replace(r("and"), r("or")), pairs).out,
      "Joy or Vex",
    );
  });
});
