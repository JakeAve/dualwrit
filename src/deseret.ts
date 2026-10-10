import { choose, type Context } from "./heteronyms.ts";

// CMUdict phonemes -> Deseret capitals. Lowercase is capital + 0x28, so only
// capitals are listed.
//
// A key is 1-4 phonemes; the longest match wins. `^` and `#` are the start and
// end of the word. A phoneme with a stress digit (AH0) matches that stress only;
// without one (AH) it matches any stress.
type Table = Record<string, string>;

const letters: Table = {
  "^": "",
  "#": "",

  IY: "𐐀",
  EY: "𐐁",
  // ponytail: CMUdict merges father/hot into AA. Only AA before R gets Long Ah.
  "AA R": "𐐂𐐡",
  AA: "𐐉",
  AO: "𐐃",
  OW: "𐐄",
  UW: "𐐅",
  IH: "𐐆",
  EH: "𐐇",
  AE: "𐐈",
  AH: "𐐊",
  UH: "𐐋",
  AY: "𐐌",
  AW: "𐐍",
  ER: "𐐊𐐡",

  W: "𐐎",
  Y: "𐐏",
  HH: "𐐐",
  P: "𐐑",
  B: "𐐒",
  T: "𐐓",
  D: "𐐔",
  CH: "𐐕",
  JH: "𐐖",
  K: "𐐗",
  G: "𐐘",
  F: "𐐙",
  V: "𐐚",
  TH: "𐐛",
  DH: "𐐜",
  S: "𐐝",
  Z: "𐐞",
  SH: "𐐟",
  ZH: "𐐠",
  R: "𐐡",
  L: "𐐢",
  M: "𐐣",
  N: "𐐤",
  NG: "𐐥",
};

// Modern: one letter per sound as an American says it today, using the full
// 40-letter alphabet. No abbreviations, nothing borrowed from Latin spelling.
const modern: Table = {
  ...letters,
  OY: "𐐦",
  "Y UW": "𐐧",
};

// 1869: how the printed Book of Mormon spelled things, tuned with `deno task score`.
const print1869: Table = {
  ...letters,
  // The printed books dropped the Oi and Ew letters and spelled them out.
  OY: "𐐉𐐆",

  // Vowels before R.
  "EH R": "𐐁𐐡",
  ER0: "𐐇𐐡",
  "AW ER0": "𐐍𐐡",
  "AY ER0": "𐐌𐐡",
  // "year", "fear", "feared" but not "spirit".
  "IH1 R #": "𐐀𐐡",
  "IH1 R Z": "𐐀𐐡𐐞",
  "IH1 R D": "𐐀𐐡𐐔",

  // ponytail: CMUdict is American, 1869 had the British "bath" vowel and kept
  // father/hot apart. These three patterns catch pass/cast/after/father but
  // also flip words like "gas" and "bother". Needs a word list to do properly.
  "AE1 S": "𐐂𐐝",
  "AE1 F": "𐐂𐐙",
  "AA1 DH ER": "𐐂𐐜𐐇𐐡",

  // "new", "Jew": written i + oo. ponytail: also hits "noon", "June".
  "N UW": "𐐤𐐆𐐅",
  "JH UW": "𐐖𐐆𐐅",

  // Unstressed vowels. 1869 wrote these by the word's spelling, which phonemes
  // alone can't see, so these are the majority choice per position.
  "^ AH0": "𐐈",
  "AH0 #": "𐐈",
  "AH0 D #": "𐐇𐐔",
  "IH0 D #": "𐐇𐐔",
  "AH0 Z #": "𐐇𐐞",
  "IH0 Z #": "𐐇𐐞",
  "^ IH0 N": "𐐆𐐤",
  "^ IH0 K S": "𐐇𐐗𐐝",
  "IH0 N #": "𐐤",
  // -en / -le: no vowel after these consonants (spoken, given, people, little).
  "K AH0 N #": "𐐗𐐤",
  "V AH0 N #": "𐐚𐐤",
  "T AH0 N #": "𐐓𐐤",
  "Z AH0 N #": "𐐞𐐤",
  "D AH0 N #": "𐐔𐐤",
  "L AH0 N #": "𐐢𐐤",
  "R AH0 N #": "𐐡𐐇𐐤",
  "P AH0 L #": "𐐑𐐢",
  "B AH0 L #": "𐐒𐐢",
  "T AH0 L #": "𐐓𐐢",
  "D AH0 L #": "𐐔𐐢",
  "K AH0 L #": "𐐗𐐢",
  "G AH0 L #": "𐐘𐐢",
  "V AH0 L #": "𐐚𐐢",
  "Z AH0 L #": "𐐞𐐢",
  "F AH0 L #": "𐐙𐐋𐐢",
  "AH0 T #": "𐐆𐐓",
  "AH0 TH #": "𐐇𐐛",
  "IH0 TH #": "𐐇𐐛",
  "N AH0 S #": "𐐤𐐇𐐝",
  "L AH0 S #": "𐐢𐐇𐐝",
  "M AH0 N T": "𐐣𐐇𐐤𐐓",
  "IY0 #": "𐐆",
  "IY0 Z #": "𐐆𐐞",
  // be-, de-, re- prefixes keep a long e.
  "^ B IH0": "𐐒𐐀",
  "^ D IH0": "𐐔𐐀",
  "^ R IH0": "𐐡𐐀",
};

// The 1869 printers let a letter stand for the word its name sounds like:
// the letter Thee for "the"/"thee", Bee for "be", Yee for "ye".
const abbreviations: Table = {
  the: "𐐜",
  thee: "𐐜",
  be: "𐐒",
  ye: "𐐏",
};

// Whole words where 1869 followed the Latin spelling.
const spellings1869: Table = {
  a: "𐐂",
  of: "𐐉𐐚",
  from: "𐐙𐐡𐐉𐐣",
  what: "𐐐𐐎𐐉𐐓",
  your: "𐐏𐐅𐐡",
  forth: "𐐙𐐄𐐡𐐛",
  was: "𐐎𐐉𐐞",
};

// A style is a letter table, whole-word spellings, and whether to apply `respell`.
export const styles = {
  modern: { table: modern, words: {} as Table, respell: false },
  abbreviated: { table: modern, words: abbreviations, respell: false },
  "1869": {
    table: print1869,
    words: { ...abbreviations, ...spellings1869 },
    respell: true,
  },
};
export type Style = keyof typeof styles;

// Pronunciations CMUdict lacks. ponytail: hand-kept list, grow it from the CLI's miss report.
const overrides: Record<string, string> = {
  nephi: "N IY1 F AY2",
  lehi: "L IY1 HH AY2",
  sariah: "S EY0 R AY1 AA2",
  lemuel: "L EH1 M Y UW0 EH0 L",
  prophesy: "P R AA1 F AH0 S AY2",
  // CMUdict's first entry is the weak or rarer form.
  and: "AE1 N D",
  was: "W AH1 Z",
  houses: "HH AW1 Z IH0 Z",
  dr: "D AA1 K T ER0",
  deseret: "D EH2 S IY0 R EH1 T",
  lamanite: "L EY1 M AH0 N AY2 T",
  nephite: "N IY1 F AY2 T",
  zarahemla: "Z EH2 R AH0 HH EH1 M L AH0",
  moroni: "M AO0 R OW1 N AY2",
  mosiah: "M OW0 S AY1 AH0",
  helaman: "HH IY1 L AH0 M AH0 N",
  saith: "S EH1 TH",
  insomuch: "IH2 N S OW0 M AH1 CH",
  verily: "V EH1 R AH0 L IY0",
  hearken: "HH AA1 R K AH0 N",
};

// Table lookup that ignores what every object inherits ("constructor").
const own = (table: Table, w: string): string | undefined =>
  Object.hasOwn(table, w) ? table[w] : undefined;

const shift = (s: string, by: number) =>
  [...s].map((c) => String.fromCodePoint(c.codePointAt(0)! + by)).join("");
const lower = (s: string) => shift(s, 0x28);
const upper = (s: string) => shift(s, -0x28);
const capitalize = (s: string) => {
  const [first, ...rest] = [...s];
  return upper(first) + rest.join("");
};

// Every pronunciation CMUdict lists for a word, in file order.
export type Dict = Map<string, string[][]>;

// Lines look like: `read R EH1 D` / `read(2) R IY1 D` / `word W ER1 D # comment`.
export function parseDict(text: string): Dict {
  const dict: Dict = new Map();
  for (const line of text.split("\n")) {
    const [word, ...phones] = line.split("#")[0].trim().split(" ");
    if (!word) continue;
    const base = word.replace(/\(\d+\)$/, "");
    dict.set(base, [...(dict.get(base) ?? []), phones]);
  }
  return dict;
}

// A table's keys split into phonemes, most specific first: longer keys, then
// keys that name more stresses. Grouped by the first phoneme without its stress.
type Rule = { key: string[]; glyphs: string };
const compiled = new Map<Table, Map<string, Rule[]>>();
const bare = (phone: string) => phone.replace(/\d/, "");

function compile(table: Table): Map<string, Rule[]> {
  const stresses = (key: string[]) => key.filter((k) => /\d/.test(k)).length;
  const rules = Object.entries(table)
    .map(([key, glyphs]) => ({ key: key.split(" "), glyphs: lower(glyphs) }))
    .sort((a, b) =>
      b.key.length - a.key.length || stresses(b.key) - stresses(a.key)
    );
  const byFirst = new Map<string, Rule[]>();
  for (const rule of rules) {
    const first = bare(rule.key[0]);
    byFirst.set(first, [...(byFirst.get(first) ?? []), rule]);
  }
  compiled.set(table, byFirst);
  return byFirst;
}

function phonesToDeseret(phones: string[], table: Table): string {
  const rules = compiled.get(table) ?? compile(table);
  const tokens = ["^", ...phones, "#"];
  const plain = tokens.map(bare);
  let out = "";
  for (let i = 0; i < tokens.length;) {
    // A key phoneme with a stress digit matches that stress only.
    const rule = rules.get(plain[i])?.find(({ key }) =>
      key.every((k, j) => k === tokens[i + j] || k === plain[i + j])
    );
    if (!rule) throw new Error(`no Deseret letter for phoneme ${tokens[i]}`);
    out += rule.glyphs;
    i += rule.key.length;
  }
  return out;
}

// 1869 style only: the few places where it followed the Latin spelling and the
// first letters or a letter group are enough to tell.
function respell(w: string, phones: string[]): string[] {
  // "which", "when" kept their h; CMUdict's first pronunciation drops it.
  if (w.startsWith("wh") && phones[0] === "W") phones = ["HH", ...phones];
  // "upon", "until": unstressed u- stays Short O, unlike a- ("among").
  if (w[0] === "u" && phones[0] === "AH0") phones = ["AH", ...phones.slice(1)];
  // "more", "four", "course" had Long O; "lord", "for" did not.
  if (/ore|our|oar|oor/.test(w)) {
    phones = phones.map((p, i) =>
      p.startsWith("AO") && phones[i + 1] === "R" ? "OW" : p
    );
  }
  return phones;
}

// CMUdict lists variants alphabetically, so the first is not the commonest.
// Among variants that differ by one vowel, take "caught" over "cot" and short i
// over schwa ("spirit"); both agree better with the 1869 text (`deno task score`).
function usual(variants: string[][] | undefined): string[] | undefined {
  if (!variants) return;
  const PREFER = [["AA1", "AO1"], ["AH0", "IH0"], ["IY0", "IH0"]];
  let best = variants[0];
  for (const v of variants.slice(1)) {
    if (v.length !== best.length) continue;
    const diff = v.flatMap((p, i) => p === best[i] ? [] : [[best[i], p]]);
    if (
      diff.length === 1 &&
      PREFER.some(([from, to]) => diff[0][0] === from && diff[0][1] === to)
    ) best = v;
  }
  return best;
}

const SIBILANT = ["S", "Z", "SH", "ZH", "CH", "JH"];
const VOICELESS = ["P", "T", "K", "F", "TH", "S", "SH", "CH"];

// Suffix, phonemes it adds given the stem's last phoneme. Sound changes are
// the regular English ones: cats/dogs/churches, walked/played/wanted.
const suffixes: [RegExp, (last: string) => string[]][] = [
  [
    /'?s$/,
    (l) =>
      SIBILANT.includes(l) ? ["IH0", "Z"] : [VOICELESS.includes(l) ? "S" : "Z"],
  ],
  [/eth$/, () => ["AH0", "TH"]],
  [/ly$/, () => ["L", "IY0"]],
  [/ing$/, () => ["IH0", "NG"]],
  [
    /ed$/,
    (l) =>
      l === "T" || l === "D"
        ? ["IH0", "D"]
        : [VOICELESS.includes(l) ? "T" : "D"],
  ],
];

// Dictionary first, then stem + suffix for words it lacks (taketh, snobbishly,
// iniquities, unfitted). ponytail: regular affixes only, no stress shifts;
// British spellings (vigour, solemnised) still miss.
function lookup(w: string, dict: Dict): string[] | undefined {
  const hit = own(overrides, w)?.split(" ") ?? usual(dict.get(w));
  if (hit) return hit;
  for (const [suffix, added] of suffixes) {
    if (!suffix.test(w)) continue;
    const base = w.replace(suffix, "");
    if (base.length < 3) continue;
    // take -> taketh, wed(d) -> wedding, prophes(y) -> prophesieth, iniquit(y) -> iniquities
    const spellings = [
      base,
      base + "e",
      base.replace(/(.)\1$/, "$1"),
      base.replace(/ie?$/, "y"),
    ];
    for (const spelling of spellings) {
      const stem = lookup(spelling, dict);
      if (stem) return [...stem, ...added(stem.at(-1)!)];
    }
  }
  if (w.startsWith("un") && w.length > 4) {
    const stem = lookup(w.slice(2), dict);
    if (stem) return ["AH0", "N", ...stem];
  }
}

// An English word and its optional {tag}. Apostrophes count only inside a
// word, so quote marks stay punctuation.
export const WORD = /([A-Za-z]+(?:['’][A-Za-z]+)*)(?:\{([a-z]*)\})?/g;

// One lowercase word with known phonemes, spelled in a style.
function spell(w: string, phones: string[], style: Style): string {
  const { table, words, respell: old } = styles[style];
  const whole = own(words, w);
  return whole
    ? lower(whole)
    : phonesToDeseret(old ? respell(w, phones) : phones, table);
}

// One word in the text that can be said more than one way, and what was done.
export type Heteronym = {
  word: string;
  n: number; // which word of the text it is, counting from 0
  options: string[]; // labels, usual reading first; write word{label} to pick one
  chosen: string;
  by: "tag" | "rule" | "guess";
  start: number; // where the word (and its tag) sits in the input
  end: number;
  outStart: number; // where its spelling sits in the output
  outEnd: number;
};

// Words missing from the dictionary pass through unchanged and are counted in
// `misses`. A word that can be said two ways is listed in `choices`; tag it in
// the text to overrule the choice: "I read{past} books".
export function transcribe(text: string, dict: Dict, style: Style = "modern") {
  // Split into sentences and clauses first so a word can see its neighbours.
  const found = [...text.matchAll(WORD)].map((m, i, all) => {
    const gap = i
      ? text.slice(all[i - 1].index + all[i - 1][0].length, m.index)
      : "";
    return {
      word: m[1].toLowerCase().replaceAll("’", "'"),
      newSentence: /[.!?\n]/.test(gap),
      newClause: /[^\s'’-]/.test(gap),
    };
  });
  const context = (i: number): Context => {
    let start = i, end = i, from = i, to = i;
    while (start > 0 && !found[start].newSentence) start--;
    while (end + 1 < found.length && !found[end + 1].newSentence) end++;
    while (from > start && !found[from].newClause) from--;
    while (to < end && !found[to + 1].newClause) to++;
    const words = (a: number, b: number) =>
      found.slice(a, b).map((f) => f.word);
    return {
      before: words(from, i),
      after: words(i + 1, to + 1),
      sentence: words(start, end + 1),
    };
  };

  const { words } = styles[style];
  // [english as written, deseret] for every word, so an edit to the Deseret
  // can keep the English of the words it did not touch (`untranscribe`).
  const pairs: [string, string][] = [];
  const misses = new Map<string, number>();
  const choices: Heteronym[] = [];
  const warnings: string[] = [];
  let out = "", last = 0, n = -1;
  for (const m of text.matchAll(WORD)) {
    const [all, word, tag] = m;
    const w = found[++n].word;
    out += text.slice(last, m.index);
    last = m.index + all.length;

    const choice = choose(w, context(n), dict.get(w), tag);
    if (tag !== undefined && choice?.by !== "tag") {
      warnings.push(
        choice
          ? `${all}: use ${choice.options.map((o) => `{${o}}`).join(" or ")}`
          : `${all}: "${word}" is only said one way, so the tag was ignored`,
      );
    }
    const phones = choice?.phones ?? lookup(w, dict);
    let spelled = word;
    if (own(words, w) || phones) {
      const deseret = spell(w, phones ?? [], style);
      spelled = /^[A-Z'’]{2,}$/.test(word)
        ? upper(deseret)
        : /^[A-Z]/.test(word)
        ? capitalize(deseret)
        : deseret;
    } else {
      misses.set(word, (misses.get(word) ?? 0) + 1);
    }
    if (choice) {
      choices.push({
        word,
        n,
        options: choice.options,
        chosen: choice.chosen,
        by: choice.by,
        start: m.index,
        end: last,
        outStart: out.length,
        outEnd: out.length + spelled.length,
      });
    }
    out += spelled;
    pairs.push([all, spelled]);
  }
  out += text.slice(last);
  return { out, misses, choices, warnings, pairs };
}

// Common words, commonest first. Many English words share one Deseret
// spelling (to/too/two), and CMUdict is full of surnames (lite, nite, kat);
// reading Deseret back picks the earliest word listed here.
// ponytail: hand-kept list; words outside it fall back to the shortest
// spelling, which is often wrong ("bred" for bread). Swap in a real word
// frequency file when reading back fresh Deseret matters.
const common =
  `the of and to a in is it you that he was for on are with as i his they be at
one have this from or had by not but what all were we when your can said there
use an each which she do how their if will up other about out many then them
these so some her would make like him into time has look two more write go see
number no way could people my than first water been call who oil its now find
long down day did get come made may part over new sound take only little work
know place year live me back give most very after thing our just name good
sentence man think say great where help through much before line right too mean
old any same tell boy follow came want show also around form three small set
put end does another well large must big even such because turn here why ask
went men read need land different home us move try kind hand picture again
change off play spell air away animal house point page letter mother answer
found study still learn should world high every near add food between own below
country plant last school father keep tree never start city earth eye light
thought head under story saw left few while along might close something seem
next hard open example begin life always those both paper together got group
often run important until children side feet car mile night walk white sea began
grow took river four carry state once book hear stop without second late miss
idea enough eat face watch far real almost let above girl sometimes mountain cut
young talk soon list song being leave family body music color stand sun question
fish area mark dog horse bird problem complete room knew since ever piece told
usually friend easy heard order red door sure become top ship across today
during short better best however low hour black whole king whether bread son
war peace heart word lord god holy son week whose buy bear wear there's
sweet meet flower wood won would rain made plain sale tale wait weight way
piece road rode seen scene whole their there hear here`.split(/\s+/);
const rank = new Map<string, number>();
common.forEach((w, i) => rank.has(w) || rank.set(w, i));

// Lowercase Deseret spelling -> the likeliest English word, for one style.
export type Reverse = Map<string, string>;

export function reverseIndex(dict: Dict, style: Style): Reverse {
  const index: Reverse = new Map();
  const cost = new Map<string, number>();
  const add = (w: string, phones: string[], primary: boolean) => {
    const d = spell(w, phones, style);
    // A word's usual reading beats another word's rare one: "thee", not "the".
    const c = (primary ? 0 : 1e9) + (rank.get(w) ?? 1e6) * 100 + w.length;
    if (c < (cost.get(d) ?? Infinity)) {
      index.set(d, w);
      cost.set(d, c);
    }
  };
  for (const [w, variants] of dict) {
    if (!/^[a-z]+('[a-z]+)*$/.test(w)) continue;
    const first = own(overrides, w)?.split(" ") ?? usual(variants)!;
    add(w, first, true);
    for (const v of variants) if (v !== first) add(w, v, false);
  }
  for (const w in overrides) {
    if (!dict.has(w)) add(w, overrides[w].split(" "), true);
  }
  return index;
}

// A word as it appears in Deseret text: Deseret letters, or a Latin word
// the transcriber left as written.
const DESERET_WORD = /[\u{10400}-\u{1044F}]+|[A-Za-z]+(?:['’][A-Za-z]+)*/gu;
const isCapital = (c: string) => c.codePointAt(0)! < 0x10428;

// Deseret -> English, word by word. `kept` is the `pairs` of the text as it
// stood before this edit: unchanged words at either end keep their English, so
// only the words actually edited are looked up. Deseret words with no English
// match pass through unchanged and are counted in `misses`.
export function untranscribe(
  text: string,
  index: Reverse,
  kept: [string, string][] = [],
) {
  const tokens = [...text.matchAll(DESERET_WORD)];
  const most = Math.min(tokens.length, kept.length);
  let head = 0, tail = 0;
  while (head < most && tokens[head][0] === kept[head][1]) head++;
  while (
    head + tail < most && tokens.at(-1 - tail)![0] === kept.at(-1 - tail)![1]
  ) tail++;

  const misses = new Map<string, number>();
  const pairs: [string, string][] = [];
  let out = "", last = 0;
  tokens.forEach((m, i) => {
    const d = m[0];
    let english = d;
    if (i < head) english = kept[i][0];
    else if (i >= tokens.length - tail) {
      english = kept[kept.length - (tokens.length - i)][0];
    } else if (d.codePointAt(0)! >= 0x10400) {
      const letters = [...d];
      const w = index.get(
        letters.map((c) => isCapital(c) ? lower(c) : c).join(""),
      );
      if (!w) misses.set(d, (misses.get(d) ?? 0) + 1);
      else if (letters.length > 1 && letters.every(isCapital)) {
        english = w.toUpperCase();
      } else if (isCapital(letters[0]) || w === "i" || w.startsWith("i'")) {
        english = w[0].toUpperCase() + w.slice(1);
      } else english = w;
    }
    out += text.slice(last, m.index) + english;
    last = m.index + d.length;
    pairs.push([english, d]);
  });
  out += text.slice(last);
  return { out, misses, pairs };
}
