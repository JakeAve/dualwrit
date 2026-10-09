// deno task score [n]  -> how often --1869 style spells a word the way the 1869 Book of Mormon did,
// weighted by how often the word occurs, plus the n most costly disagreements.
// corpus/lexicon-1869.json is [word, 1869 spelling, occurrences]; see .gitignore for its terms.
import { parseDict, transcribe } from "../src/deseret.ts";

const dict = parseDict(
  await Deno.readTextFile(new URL("../data/cmudict.dict", import.meta.url)),
);
const lexicon: [string, string, number][] = JSON.parse(
  await Deno.readTextFile(
    new URL("../corpus/lexicon-1869.json", import.meta.url),
  ),
);

let total = 0, hit = 0;
const wrong: string[] = [];
for (const [word, theirs, n] of lexicon) {
  const ours = transcribe(word, dict, "1869").out;
  total += n;
  if (ours === theirs) hit += n;
  else wrong.push(`${n}\t${word}\t${ours}\t${theirs}`);
}
console.log(wrong.slice(0, Number(Deno.args[0] ?? 30)).join("\n"));
console.log(
  `\n${(100 * hit / total).toFixed(1)}% of ${total} words match 1869`,
);
