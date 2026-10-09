// Words spelled one way and said two ways ("I read it yesterday" / "I will read
// it"). `choose` picks a reading from the words around it with fixed rules, so
// the same sentence always gives the same answer.
//
// ponytail: neighbouring-word rules, not a real grammar. They get the common
// patterns and fall back to the usual reading otherwise; "I read books" is
// ambiguous to a person too. If this needs to be smarter, a part-of-speech
// tagger (e.g. npm:compromise) slots in at `partOfSpeech`.

export type Context = {
  before: string[]; // earlier words in the same clause (no punctuation between)
  after: string[]; // later words in the same clause
  sentence: string[]; // every word in the sentence
};

const set = (words: string) => new Set(words.split(" "));
const DETERMINER = set(
  "the a an this that these those my your his her its our their no some any each every another one two three many few several much such what which whose",
);
const PREPOSITION = set(
  "of in on for with by at from as into under over about after before between through without during against",
);
const SUBJECT = set(
  "i you we they he she it who everyone everybody someone somebody nobody anyone",
);
const THIRD_PERSON = set(
  "he she it who everyone everybody someone somebody nobody anyone one",
);
// A bare verb follows these: "to read", "will lead", "don't object".
const BEFORE_BARE_VERB = set(
  "to will would can could shall should may might must do does did don't doesn't didn't won't can't cannot couldn't wouldn't shouldn't let let's please i'll you'll we'll they'll he'll she'll it'll",
);
const BE = set(
  "is are was were am be been being isn't aren't wasn't weren't seem seems seemed feel feels felt remain remains stay become became",
);
// A past participle follows these: "has read", "was read", "got read".
const BEFORE_PARTICIPLE = set(
  "have has had having haven't hasn't hadn't i've you've we've they've been be being is are was were am isn't aren't wasn't weren't get gets got getting",
);
const OBJECT_NEXT = set(
  "the a an it them him her us me this that these those my your his our their you",
);
const NOUN_NEXT = set("of is was are were has had will would");
const ADVERB = set(
  "not never always already just ever also only really often still now then so very too",
);
const PAST = set(
  "yesterday ago last was were had said went came saw took got made knew thought told found gave felt left wrote heard sat stood began ran",
);
const PRESENT = set(
  "now tomorrow every always usually often daily is are am do does don't doesn't will can",
);
const NOT_PAST_ED = set("bed red hundred sacred naked wicked shed");

// Nearest earlier word in the clause, looking past adverbs ("has never read").
function previous({ before }: Context): string | undefined {
  for (let i = before.length - 1; i >= 0; i--) {
    if (!ADVERB.has(before[i]) && !before[i].endsWith("ly")) return before[i];
  }
}

function partOfSpeech(ctx: Context): "noun" | "verb" | undefined {
  const prev = previous(ctx), next = ctx.after[0];
  if (prev) {
    if (BEFORE_BARE_VERB.has(prev) || SUBJECT.has(prev)) return "verb";
    if (
      DETERMINER.has(prev) || PREPOSITION.has(prev) || BE.has(prev) ||
      prev.endsWith("'s")
    ) return "noun"; // or adjective: same reading for every word here
  }
  if (next) {
    if (OBJECT_NEXT.has(next)) return "verb";
    if (NOUN_NEXT.has(next)) return "noun";
  }
}

// Do the other verbs in the sentence put it in the past or the present?
function tense({ sentence }: Context): "past" | "present" | undefined {
  const past = sentence.some((w) =>
    PAST.has(w) || (/[^e]ed$/.test(w) && w.length > 3 && !NOT_PAST_ED.has(w))
  );
  const present = sentence.some((w) => PRESENT.has(w));
  if (past !== present) return past ? "past" : "present";
}

const has = (words: string[], cues: string) =>
  words.some((w) => set(cues).has(w));

// --- Words with their own rules. ---
//
// `readings` maps a label to its phonemes; the first is the usual reading,
// used when no rule fires. `rule` returns a label when the context settles it.

type Entry = {
  readings: Record<string, string>;
  rule: (ctx: Context) => string | undefined;
};

const RIP_NEXT = "up apart down off out open into through away";

const special: Record<string, Entry> = {
  read: {
    readings: { present: "R IY1 D", past: "R EH1 D" },
    rule(ctx) {
      const prev = previous(ctx);
      if (has(ctx.before.slice(-1), "well widely much")) return "past";
      if (prev && BEFORE_PARTICIPLE.has(prev)) return "past";
      if (prev && (BEFORE_BARE_VERB.has(prev) || DETERMINER.has(prev))) {
        return "present";
      }
      // "did you read", "will she read": the helper sits before the subject.
      if (
        prev && SUBJECT.has(prev) &&
        BEFORE_BARE_VERB.has(ctx.before.at(-2) ?? "")
      ) return "present";
      // "she read" must be past: the present would be "she reads".
      if (prev && THIRD_PERSON.has(prev)) return "past";
      return tense(ctx);
    },
  },
  lead: {
    readings: { guide: "L IY1 D", metal: "L EH1 D" },
    rule(ctx) {
      const metal = has(
        ctx.after.slice(0, 1),
        "pipe pipes paint poisoning bullet bullets weight weights pencil pencils shot acid free crystal glass ore mine mines",
      ) ||
        (has(
          ctx.before.slice(-1),
          "of as molten solid heavy contains containing",
        ) &&
          !has(ctx.after.slice(0, 1), "singer singers role roles time times"));
      if (metal) return "metal";
      if (partOfSpeech(ctx) === "verb") return "guide";
      // No verb reading fits, and the sentence is about materials.
      if (
        has(
          ctx.sentence,
          "paint pipe pipes poisoning toxic metal metals mercury zinc copper tin solder contained contains",
        )
      ) return "metal";
    },
  },
  live: {
    readings: { verb: "L IH1 V", adjective: "L AY1 V" },
    rule(ctx) {
      const prev = previous(ctx);
      const adjective = (prev && (DETERMINER.has(prev) || BE.has(prev))) ||
        has(ctx.before.slice(-1), "go goes going went gone") ||
        has(
          ctx.after.slice(0, 1),
          "music show shows broadcast wire wires performance concert audience animals ammunition feed stream coverage tv television action band",
        );
      if (adjective) return "adjective";
      if (prev && (SUBJECT.has(prev) || BEFORE_BARE_VERB.has(prev))) {
        return "verb";
      }
    },
  },
  lives: {
    readings: { verb: "L IH1 V Z", noun: "L AY1 V Z" },
    rule(ctx) {
      const prev = previous(ctx);
      const noun = (prev && (DETERMINER.has(prev) || PREPOSITION.has(prev) ||
        prev.endsWith("'s"))) ||
        has(
          ctx.before.slice(-1),
          "save saved saves saving lose lost cost costs risk risked take took claimed",
        ) ||
        ctx.after[0] === "of";
      if (noun) return "noun";
      if (prev && THIRD_PERSON.has(prev)) return "verb";
    },
  },
  wind: {
    readings: { noun: "W IH1 N D", verb: "W AY1 N D" },
    rule(ctx) {
      if (has(ctx.after.slice(0, 1), "up down")) return "verb";
      return partOfSpeech(ctx);
    },
  },
  winds: {
    readings: { noun: "W IH1 N D Z", verb: "W AY1 N D Z" },
    rule(ctx) {
      const prev = previous(ctx);
      if (
        (prev && THIRD_PERSON.has(prev)) ||
        has(ctx.after.slice(0, 1), "up down around through")
      ) return "verb";
      if (prev && DETERMINER.has(prev)) return "noun";
    },
  },
  wound: {
    readings: { injury: "W UW1 N D", wrapped: "W AW1 N D" },
    rule(ctx) {
      const prev = previous(ctx);
      if (
        has(ctx.after.slice(0, 1), "up around down back through") ||
        has(ctx.after.slice(1, 4), "way clock watch around round") ||
        has(ctx.before.slice(-1), "clock watch") ||
        // "she wound it": to injure would be "wounds" or "wounded".
        (prev && THIRD_PERSON.has(prev))
      ) return "wrapped";
      if (prev && DETERMINER.has(prev)) return "injury";
    },
  },
  tear: {
    readings: { cry: "T IH1 R", rip: "T EH1 R" },
    rule(ctx) {
      if (
        partOfSpeech(ctx) === "verb" || has(ctx.before, "wear") ||
        has(ctx.after.slice(0, 1), RIP_NEXT)
      ) return "rip";
    },
  },
  tears: {
    readings: { cry: "T IH1 R Z", rip: "T EH1 R Z" },
    rule(ctx) {
      const prev = previous(ctx);
      if (
        (prev && THIRD_PERSON.has(prev)) ||
        has(ctx.after.slice(0, 1), RIP_NEXT)
      ) return "rip";
    },
  },
  bow: {
    readings: { knot: "B OW1", bend: "B AW1" },
    rule(ctx) {
      if (has(ctx.after.slice(0, 1), "tie ties and")) return "knot";
      if (
        partOfSpeech(ctx) === "verb" ||
        has(ctx.before, "take takes took taking") ||
        has(ctx.after.slice(0, 1), "down before") ||
        has(ctx.after, "ship boat vessel")
      ) return "bend";
    },
  },
  bows: {
    readings: { knot: "B OW1 Z", bend: "B AW1 Z" },
    rule(ctx) {
      const prev = previous(ctx);
      if (prev && THIRD_PERSON.has(prev)) return "bend";
    },
  },
  bass: {
    readings: { music: "B EY1 S", fish: "B AE1 S" },
    rule(ctx) {
      if (
        has(
          ctx.sentence,
          "fish fishing fished lake river sea pond caught catch largemouth striped angler",
        )
      ) return "fish";
      if (has(ctx.sentence, "guitar player drum drums music band sing voice")) {
        return "music";
      }
    },
  },
  dove: {
    readings: { bird: "D AH1 V", dived: "D OW1 V" },
    rule(ctx) {
      const prev = previous(ctx);
      if (prev && DETERMINER.has(prev)) return "bird";
      if (
        has(
          ctx.after.slice(0, 1),
          "into in under off down for through headfirst deep deeper back right straight",
        )
      ) return "dived";
    },
  },
  sow: {
    readings: { plant: "S OW1", pig: "S AW1" },
    rule(ctx) {
      const prev = previous(ctx);
      if (prev && DETERMINER.has(prev)) return "pig";
      if (prev && BEFORE_BARE_VERB.has(prev)) return "plant";
    },
  },
  minute: {
    readings: { time: "M IH1 N AH0 T", tiny: "M AY0 N UW1 T" },
    rule(ctx) {
      if (
        has(
          ctx.after.slice(0, 1),
          "detail details amount amounts quantity quantities particle particles difference differences trace traces",
        )
      ) return "tiny";
      if (has(ctx.before.slice(-1), "a one per every each last wait")) {
        return "time";
      }
    },
  },
  close: {
    readings: { near: "K L OW1 S", shut: "K L OW1 Z" },
    rule(ctx) {
      const pos = partOfSpeech(ctx);
      if (
        ctx.after[0] === "to" || pos === "noun" ||
        has(ctx.before.slice(-1), "very so too come came comes stay stayed") ||
        has(
          ctx.after.slice(0, 1),
          "friend friends attention eye range call quarters by enough together behind",
        )
      ) return "near";
      if (pos === "verb") return "shut";
    },
  },
  use: {
    readings: { verb: "Y UW1 Z", noun: "Y UW1 S" },
    rule: partOfSpeech,
  },
  uses: {
    readings: { verb: "Y UW1 Z IH0 Z", noun: "Y UW1 S IH0 Z" },
    rule(ctx) {
      const prev = previous(ctx);
      if (prev && (DETERMINER.has(prev) || PREPOSITION.has(prev))) {
        return "noun";
      }
      if (prev && THIRD_PERSON.has(prev)) return "verb";
    },
  },
  abuse: {
    readings: { noun: "AH0 B Y UW1 S", verb: "AH0 B Y UW1 Z" },
    rule: partOfSpeech,
  },
  excuse: {
    readings: { noun: "IH0 K S K Y UW1 S", verb: "IH0 K S K Y UW1 Z" },
    rule: partOfSpeech,
  },
  house: {
    readings: { noun: "HH AW1 S", verb: "HH AW1 Z" },
    rule(ctx) {
      const prev = previous(ctx);
      if (prev && BEFORE_BARE_VERB.has(prev)) return "verb";
      if (prev && DETERMINER.has(prev)) return "noun";
    },
  },
};

// --- Families that follow one pattern; the readings come from CMUdict. ---

// Noun or adjective stresses the first syllable, verb a later one:
// "a REcord" / "to reCORD". A trailing :v means the verb is the usual reading.
const STRESS_PAIRS = "record object present conduct:v permit:v rebel subject " +
  "project produce:v refuse:v contract conflict content desert convert:v " +
  "convict insult increase decrease import protest progress suspect:v perfect " +
  "contest combine:v address transport survey digest escort extract incline " +
  "console compound compress contrast defect discount exploit impact insert:v " +
  "reject:v research segment upset recall:v refund rewrite:v update resume:v " +
  "abstract construct:v records objects presents permits rebels subjects " +
  "projects contracts conflicts";

// Noun or adjective ends "-it", verb ends "-ate": "a SEParate room" / "to sepaRATE".
const ATE_PAIRS = "separate estimate:v graduate moderate duplicate alternate " +
  "appropriate approximate deliberate delegate advocate associate intimate " +
  "elaborate articulate:v coordinate:v subordinate animate:v aggregate " +
  "syndicate predicate:v degenerate affiliate";

const isVowel = (p: string) => /\d$/.test(p);
const firstStressed = (v: string[]) => v.find(isVowel)?.endsWith("1");
const endsInAte = (v: string[]) => v.findLast(isVowel)?.startsWith("EY");

type Family = { verbDefault: boolean; isVerb: (v: string[]) => boolean };
const families = new Map<string, Family>();
for (
  const [list, isVerb] of [
    [STRESS_PAIRS, (v: string[]) => !firstStressed(v)],
    [ATE_PAIRS, (v: string[]) => !!endsInAte(v)],
  ] as const
) {
  for (const entry of list.split(" ")) {
    const [word, flag] = entry.split(":");
    families.set(word, { verbDefault: flag === "v", isVerb });
  }
}

function entryFor(
  word: string,
  variants: string[][] | undefined,
): Entry | undefined {
  if (Object.hasOwn(special, word)) return special[word];
  const family = families.get(word);
  const noun = variants?.find((v) => !family?.isVerb(v))?.join(" ");
  const verb = variants?.find((v) => family?.isVerb(v))?.join(" ");
  if (!family || !noun || !verb) return;
  return {
    readings: family.verbDefault ? { verb, noun } : { noun, verb },
    rule: partOfSpeech,
  };
}

export type Choice = {
  options: string[]; // every label, usual reading first
  chosen: string;
  // tag: the writer said so. rule: the context settled it. guess: nothing did.
  by: "tag" | "rule" | "guess";
  phones: string[];
};

// How to say `word` here, or undefined if it only has one reading.
// `tag` is the writer's own choice of label, as in "read{past}".
export function choose(
  word: string,
  ctx: Context,
  variants: string[][] | undefined,
  tag?: string,
): Choice | undefined {
  const entry = entryFor(word, variants);
  if (!entry) return;
  const options = Object.keys(entry.readings);
  const ruled = entry.rule(ctx);
  const [chosen, by] = tag && options.includes(tag)
    ? [tag, "tag"] as const
    : ruled
    ? [ruled, "rule"] as const
    : [options[0], "guess"] as const;
  return { options, chosen, by, phones: entry.readings[chosen].split(" ") };
}
