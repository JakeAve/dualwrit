// Deseret as the page sees it. Kept apart from main.ts so tests can import
// it without a DOM.
import {
  type Dict,
  parseDict,
  type Reverse,
  reverseIndex,
  type Style,
  styles,
  transcribe,
  untranscribe,
  WORD,
} from "../../src/deseret.ts";
import type { Engine, Script } from "../script.ts";

export function engine(dict: Dict): Engine<Style> {
  // The chosen style's spellings first, then any the other styles add, so
  // pasted text reads whichever style it was written in.
  const indexes: Partial<Record<Style, Reverse>> = {};
  function readingIndex(chosen: Style): Reverse {
    const index = reverseIndex(dict, chosen);
    for (const other of Object.keys(styles) as Style[]) {
      if (other === chosen) continue;
      for (const [deseret, word] of reverseIndex(dict, other)) {
        if (!index.has(deseret)) index.set(deseret, word);
      }
    }
    return index;
  }
  return {
    transcribe: (text, style) => transcribe(text, dict, style),
    untranscribe: (text, style, pairs) =>
      untranscribe(text, indexes[style] ??= readingIndex(style), pairs),
    // Find the word by its number: the English may have been rewritten by
    // Deseret edits since the choice was offered.
    retag(text, choice, reading) {
      const m = [...text.matchAll(WORD)][choice.n];
      if (m?.[1].toLowerCase() !== choice.word.toLowerCase()) return text;
      return `${text.slice(0, m.index)}${m[1]}{${reading}}${
        text.slice(m.index + m[0].length)
      }`;
    },
  };
}

export const deseret: Script<Style> = {
  name: "Deseret",
  lang: "en-Dsrt",
  store: "dualwrit-practice",
  styles: [
    { id: "modern", label: "Modern", note: "" },
    {
      id: "abbreviated",
      label: "Abbreviated",
      note:
        "Modern, plus four words written as a single letter because the letter's name sounds like the word: the, thee, be and ye.",
    },
    {
      id: "1869",
      label: "1869",
      note:
        "Spelled the way the printed books of 1869 did: the single-letter words, an older accent, and 38 letters.",
    },
  ],
  // Each key is its Latin letter, the Deseret capital it types, and the one
  // it types with Option/Alt held. 26 keys and 14 Option keys make the 40
  // letters; the key is the sound's usual Latin letter where there is one
  // (Q is "ew", as the letter is named).
  rows: [
    "q𐐧 w𐐎𐐃 e𐐇𐐀 r𐐡 t𐐓𐐛 y𐐏𐐦 u𐐊𐐅 i𐐆𐐌 o𐐉𐐄 p𐐑",
    "a𐐈𐐁 s𐐝𐐟 d𐐔𐐜 f𐐙 g𐐘 h𐐐𐐂 j𐐖 k𐐗 l𐐢",
    "z𐐞𐐠 x𐐍 c𐐕 v𐐚 b𐐒𐐋 n𐐤𐐥 m𐐣",
  ],
  // The order letters are taught in, easiest first: consonants that match one
  // Latin letter, then the two-letter ones, then short, long and gliding vowels.
  order: [..."𐐝𐐓𐐤𐐣𐐑𐐒𐐔𐐙𐐢𐐡𐐗𐐘𐐐𐐎𐐚𐐞𐐖𐐏𐐟𐐕𐐛𐐜𐐥𐐠𐐆𐐇𐐈𐐉𐐊𐐋𐐀𐐁𐐂𐐃𐐄𐐅𐐌𐐍𐐦𐐧"],
  // Each word split into sound chunks, one chunk per Deseret letter. A silent
  // letter rides on its neighbour (fi|ve). A word whose chunks don't match its
  // spelling in the chosen style is left out of that style.
  // ponytail: split by hand. A sentence would be the same thing with spaces;
  // an automatic splitter is the upgrade if the list has to cover any text.
  splits: `c|a|t s|u|n sh|i|p m|oo|n b|r|ea|d h|o|n|ey l|igh|t
s|ch|oo|l th|i|ng m|ou|n|t|ai|n b|e|d d|o|g f|i|sh t|r|ee b|oo|k h|a|n|d r|ai|n
s|n|ow m|i|l|k g|r|ee|n r|e|d b|l|ue m|ou|se r|oa|d b|oa|t sh|ee|p ch|ee|se
j|u|m|p k|i|ng q|u|ee|n r|i|ng s|o|ng th|i|n|k th|i|s th|a|t m|o|th|e|r
f|a|th|e|r s|i|s|t|e|r b|r|o|th|e|r w|a|t|e|r r|i|v|e|r b|i|r|d h|o|r|se
g|a|r|d|e|n ch|ai|r w|i|n|d|ow h|a|pp|y s|e|v|e|n th|r|ee
f|i|ve n|i|ne n|igh|t d|ay s|w|ee|t v|oi|ce b|oy t|oy f|ew m|u|s|i|c
m|ea|s|u|re z|oo y|e|s w|i|sh s|i|t t|i|n m|a|n n|u|t m|a|p s|a|t m|i|n|t
s|t|a|m|p t|e|n n|e|t p|e|n b|a|t d|a|d f|a|n l|a|m|p r|a|t k|i|d g|a|s
h|o|t w|e|b v|a|n z|i|p j|a|m y|a|m l|aw s|aw c|a|r s|t|a|r f|oo|t g|oo|d
j|oy c|ow n|ow g|a|te n|a|me ea|t s|ea g|o h|o|me f|oo|d i|ce t|i|me
l|e|g l|o|ng ch|i|n sh|o|p b|a|th w|i|th th|e|m v|i|s|io|n`.split(/\s+/),
  // Small letters sit 0x28 above their capitals.
  lower: (capital) => String.fromCodePoint(capital.codePointAt(0)! + 0x28),
  // The dictionary is one 3.6 MB text file; everything waits on it.
  async load(status) {
    status("Loading the pronouncing dictionary…");
    const response = await fetch("../cmudict.dict");
    if (!response.ok) {
      status(
        `Could not load the pronouncing dictionary (${response.status}). Reload to try again.`,
      );
      throw new Error("dictionary failed to load");
    }
    const made = engine(parseDict(await response.text()));
    status("");
    return made;
  },
};
