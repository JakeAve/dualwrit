import { assertEquals } from "@std/assert";
import { parseDict, transcribe } from "./deseret.ts";

const dict = parseDict(
  await Deno.readTextFile(new URL("../data/cmudict.dict", import.meta.url)),
);
const m = (text: string) => transcribe(text, dict).out;
// The Deseret spelling of `word` inside `sentence`.
const said = (sentence: string, word: string) => {
  const i = sentence.toLowerCase().split(/[^a-z']+/).filter(Boolean).indexOf(
    word,
  );
  return m(sentence).toLowerCase().split(/[^\u{10400}-\u{1044F}]+/u).filter(
    Boolean,
  )[i];
};
// From the first vowel on, so "wind" can be compared with "kind".
const rime = (deseret: string) =>
  deseret.replace(/^[^\u{10428}-\u{10435}\u{1044E}\u{1044F}]+/u, "");
// Every sentence must give `word` the reading that rhymes with `rhyme`.
const check = (word: string, rhyme: string, sentences: string[]) => {
  for (const s of sentences) {
    assertEquals(rime(said(s, word)), rime(m(rhyme)), `${word} in "${s}"`);
  }
};

Deno.test("read: tense from helpers, subject and the rest of the sentence", () => {
  check("read", "red", [
    "I have read that book.",
    "She read it twice.",
    "It was widely read.",
    "Yesterday I read the letter.",
    "I read the note and laughed.",
    "He had never read it.",
    "Last night I read the whole report.",
  ]);
  check("read", "reed", [
    "I will read it tomorrow.",
    "They want to read more.",
    "Read the first chapter.",
    "I read every day.",
    "Did you read it?",
    "Will she read it?",
  ]);
});

Deno.test("lead: the metal only with a cue", () => {
  check("lead", "led", [
    "The pipes were made of lead.",
    "It was lead paint.",
    "The paint contained lead.",
  ]);
  check("lead", "bead", [
    "They lead the way.",
    "She took the lead.",
    "He will lead us.",
  ]);
});

Deno.test("noun/verb pairs follow their neighbours", () => {
  const noun = said("the record", "record"), verb = said("to record", "record");
  assertEquals(noun === verb, false);
  assertEquals(said("She broke the world record.", "record"), noun);
  assertEquals(said("Please record the show.", "record"), verb);
  assertEquals(
    said("I object to that.", "object") === said("a strange object", "object"),
    false,
  );
  assertEquals(
    said("They live in separate rooms.", "separate") ===
      said("We must separate them.", "separate"),
    false,
  );
});

Deno.test("other two-reading words", () => {
  check("wind", "kind", ["Wind the clock.", "You must wind it up."]);
  check("wind", "pinned", ["The wind blew hard."]);
  check("wound", "sound", [
    "He wound up the toy.",
    "She wound the string around her finger.",
  ]);
  check("wound", "tuned", ["The nurse cleaned the wound."]);
  check("tear", "bear", ["Do not tear the page.", "She will tear it up."]);
  check("tear", "fear", ["A tear ran down her cheek."]);
  check("live", "five", ["It was a live broadcast.", "We are live."]);
  check("live", "give", ["They live in Utah."]);
  check("close", "dose", ["We are close to home."]);
  check("close", "doze", ["Please close the door."]);
  check("use", "fuse", ["You can use mine."]);
});

Deno.test("usual pronunciation, not CMUdict's first", () => {
  assertEquals(m("caught"), m("cot").replace("𐐱", "𐐫"));
  assertEquals(m("and"), "𐐰𐑌𐐼");
  assertEquals(m("Deseret"), "𐐔𐐯𐑅𐐨𐑉𐐯𐐻");
});

Deno.test("tags overrule the rules and are reported", () => {
  const guess = transcribe("I read books.", dict);
  assertEquals(guess.choices.map((c) => [c.word, c.chosen, c.by, c.options]), [
    ["read", "present", "guess", ["present", "past"]],
  ]);

  const text = "I read{past} books.";
  const tagged = transcribe(text, dict);
  assertEquals(tagged.out, guess.out.replace(m("reed"), m("red")));
  const [c] = tagged.choices;
  assertEquals([c.chosen, c.by], ["past", "tag"]);
  assertEquals(text.slice(c.start, c.end), "read{past}");
  assertEquals(tagged.out.slice(c.outStart, c.outEnd), m("red"));

  // A tag beats even a rule that is sure.
  assertEquals(said("I will read{past} it.", "read"), m("red"));
  assertEquals(transcribe("I have read it.", dict).choices[0].by, "rule");
});

Deno.test("bad tags are dropped from the output and explained", () => {
  const wrong = transcribe("I read{future} books{past}.", dict);
  assertEquals(wrong.out, transcribe("I read books.", dict).out);
  assertEquals(wrong.warnings, [
    "read{future}: use {present} or {past}",
    'books{past}: "books" is only said one way, so the tag was ignored',
  ]);
});
