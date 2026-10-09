// deno task deseret [--style=modern|abbreviated|1869] <file>
// Prints the transcription in every style (or just the one asked for); missed words go to stderr.
// A word with two readings can be tagged in the text: "I read{past} books".
//   modern       one letter per sound, as an American says it today
//   abbreviated  modern, plus the single-letter words: the, thee, be, ye
//   1869         spelled the way the printed 1869 books did
import { parseDict, type Style, styles, transcribe } from "./src/deseret.ts";

const dict = parseDict(
  await Deno.readTextFile(new URL("./data/cmudict.dict", import.meta.url)),
);
// Listed by hand: object key order would put "1869" first.
const order: Style[] = ["modern", "abbreviated", "1869"];
const file = Deno.args.find((a) => !a.startsWith("--"));
const only = Deno.args.find((a) => a.startsWith("--style="))?.slice(8);
if (!file || (only && !(only in styles))) {
  console.error(
    `usage: deno task deseret [--style=${order.join("|")}] <file>`,
  );
  Deno.exit(1);
}
const text = await Deno.readTextFile(file);

let misses = new Map<string, number>();
let notes: string[] = [];
for (const style of (only ? [only as Style] : order)) {
  const result = transcribe(text, dict, style);
  // Same dictionary and rules for every style, so the same notes.
  misses = result.misses;
  notes = [
    ...result.warnings,
    ...result.choices.filter((c) => c.by === "guess").map((c) =>
      `guessed "${c.word}" as ${c.chosen}; to change it write ${
        c.options.slice(1).map((o) => `${c.word}{${o}}`).join(" or ")
      }`
    ),
  ];
  if (!only) console.log(`--- ${style} ---`);
  console.log(result.out);
}
for (const note of notes) console.error(note);
if (misses.size) {
  console.error(`\n${misses.size} words not in dictionary:`);
  for (const [word, n] of [...misses].sort((a, b) => b[1] - a[1])) {
    console.error(`${n}\t${word}`);
  }
}
