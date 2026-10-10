import { assertEquals } from "@std/assert";
import { parseDict, transcribe } from "./deseret.ts";

const dict = parseDict(
  await Deno.readTextFile(new URL("../data/cmudict.dict", import.meta.url)),
);
const d = (text: string) => transcribe(text, dict, "1869").out;
const m = (text: string) => transcribe(text, dict).out;

Deno.test("modern style: one letter per sound, no abbreviations", () => {
  assertEquals(m("Though the cat, THE end."), "𐐜𐐬 𐑄𐐲 𐐿𐐰𐐻, 𐐜𐐊 𐐯𐑌𐐼.");
  assertEquals(m("music voice car"), "𐑋𐑏𐑆𐐮𐐿 𐑂𐑎𐑅 𐐿𐐪𐑉"); // Ew and Oi letters
  assertEquals(m("which upon be"), "𐐶𐐮𐐽 𐐲𐐹𐐱𐑌 𐐺𐐨");
  assertEquals(m("Nephi's returneth"), "𐐤𐐨𐑁𐐴𐑆 " + m("return") + "𐐲𐑃");
});

Deno.test("abbreviated style: modern plus the single-letter words", () => {
  const a = (text: string) => transcribe(text, dict, "abbreviated").out;
  assertEquals(a("The cat be of thee"), "𐐜 𐐿𐐰𐐻 𐐺 𐐲𐑂 𐑄");
  assertEquals(a("which upon"), m("which upon"));
});

Deno.test("1869: words, punctuation, capitals", () => {
  assertEquals(d("Though the cat, THE end."), "𐐜𐐬 𐑄 𐐿𐐰𐐻, 𐐜 𐐯𐑌𐐼.");
});

Deno.test("1869: multi-phoneme keys, word edges and stress", () => {
  assertEquals(d("car"), "𐐿𐐪𐑉"); // AA R
  assertEquals(d("many"), "𐑋𐐯𐑌𐐮"); // IY0 at word end
  assertEquals(d("spoken"), "𐑅𐐹𐐬𐐿𐑌"); // K AH0 N at word end
  assertEquals(d("among"), "𐐰𐑋𐐲𐑍"); // AH0 at word start vs stressed AH1
});

Deno.test("1869: spelling cues: wh-, u-, -ore", () => {
  assertEquals(d("which upon wherefore"), "𐐸𐐶𐐮𐐽 𐐲𐐹𐐱𐑌 𐐸𐐶𐐩𐑉𐑁𐐬𐑉");
});

Deno.test("1869: overrides, plural, possessive and -eth fallbacks", () => {
  assertEquals(d("Nephi's"), "𐐤𐐨𐑁𐐴𐑆");
  assertEquals(d("iniquities"), "𐐮𐑌𐐮𐐿𐐶𐐮𐐻𐐮𐑆");
  assertEquals(d("returneth"), d("return") + "𐐯𐑃");
  assertEquals(d("prophesieth"), d("prophesy") + "𐐯𐑃");
});

Deno.test("suffixes for words the dictionary lacks", () => {
  assertEquals(m("snobbishly"), m("snobbish") + "𐑊𐐨");
  assertEquals(m("wedging"), m("wedge") + "𐐮𐑍");
  assertEquals(m("unfitted"), "𐐲𐑌" + m("fit") + "𐐮𐐼");
  assertEquals(m("tottered"), m("totter") + "𐐼");
  assertEquals(
    m("‘merry’ grocers’"),
    "‘" + m("merry") + "’ " + m("grocers") + "’",
  );
});

Deno.test("unknown words pass through and are counted", () => {
  const { out, misses } = transcribe("zzyzx cat zzyzx", dict);
  assertEquals(out, "zzyzx 𐐿𐐰𐐻 zzyzx");
  assertEquals([...misses], [["zzyzx", 2]]);
});

Deno.test("a word that is also an Object property", () => {
  assertEquals(d("constructor"), "𐐿𐐲𐑌𐑅𐐻𐑉𐐲𐐿𐐻𐐯𐑉");
});

Deno.test("Deseret back to English", async (t) => {
  const { reverseIndex, untranscribe } = await import("./deseret.ts");
  const back = (text: string, style: "modern" | "1869" = "modern") =>
    untranscribe(text, reverseIndex(dict, style)).out;

  await t.step("common words, capitals and punctuation", () => {
    const text = "To be or not to be, THAT is the question. I see the way.";
    assertEquals(back(m(text)), text);
    assertEquals(back(d(text), "1869"), text);
  });
  await t.step("unknown Deseret passes through and is counted", () => {
    const { out, misses } = untranscribe(
      "𐐿𐐰𐐻 𐐿𐐿𐐿",
      reverseIndex(dict, "modern"),
    );
    assertEquals(out, "cat 𐐿𐐿𐐿");
    assertEquals([...misses], [["𐐿𐐿𐐿", 1]]);
  });
  await t.step("an edit keeps the English of untouched words", () => {
    const english = "I read{past} two books, too.";
    const { out, pairs } = transcribe(english, dict);
    assertEquals(untranscribe(out, new Map(), pairs).out, english);
    const edited = out.replace(m("books"), m("letters"));
    assertEquals(
      untranscribe(edited, reverseIndex(dict, "modern"), pairs).out,
      "I read{past} two letters, too.",
    );
  });
});
