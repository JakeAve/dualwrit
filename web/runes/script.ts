// The Hobbit's runes as the page sees them. Kept apart from main.ts so tests
// can import it without a DOM.
import { chunks, transcribe, untranscribe } from "../../src/runes.ts";
import type { Engine, Script } from "../script.ts";

// One spelling, so the style is ignored, and letter for letter, so there is
// nothing to miss or choose.
export const engine: Engine<"hobbit"> = {
  transcribe: (text) => transcribe(text),
  untranscribe: (text, _style, pairs) => untranscribe(text, pairs),
};

export const runes: Script<"hobbit"> = {
  name: "Runic",
  lang: "en-Runr",
  store: "dualwrit-practice-runes",
  styles: [{ id: "hobbit", label: "Hobbit", note: "" }],
  // Each key is its Latin letter, the rune it types, and the one it types
  // with Option/Alt held. A key types its own letter's rune (J and V share
  // I's and U's; Q has none, being written cw) and Option gives the two-letter
  // rune that starts with it. E and S each start two, so eo sits on Y and sh
  // on H.
  rows: [
    "q wᚹ eᛖᛟ rᚱ tᛏᚦ yᚣᛇ uᚢ iᛁ oᚩᛳ pᛈ",
    "aᚪᛠ sᛋᛥ dᛞ fᚠ gᚷ hᚻᛲ jᛁ kᛱ lᛚ",
    "zᛣ xᛉ cᚳ vᚢ bᛒ nᚾᛝ mᛗ",
  ],
  // The order runes are taught in, easiest first: the five that look like
  // their Latin letter, then the rest of the single letters, then the eight
  // that stand for two letters.
  order: [..."ᚱᛒᛁᛏᚻᛋᚾᛗᛚᚠᛈᛞᚪᛖᚩᚢᚳᚷᚹᛱᚣᛉᛣᚦᛝᛟᛠᛇᛥᛳᛲ"],
  // Each word split into one chunk per rune, by the same table that writes
  // it. No word has a q, a j or a v (those would teach a rune under another
  // letter's name), or a two-letter rune that falls across two syllables.
  splits: `cat sun moon bread tree fish book hand rain snow milk green red road
boat sheep ring song thing this that with them the bath three teeth king long
sing wing star stone stop fast best nest lost first rest east west step sea eat
read tea meat leaf bean seat year people food foot good room door wood cool
pool roof shop ship wish shut shoe dish she bush box fox six next wax zoo zip
lazy size maze key kid kind dark work lake yes you day boy yard happy dog bed
man map pen web hot cup leg gold big bug gift water mother father brother home
name time fire wind feet seed`.split(/\s+/).map(chunks),
  // Nothing to fetch: the table is the whole engine.
  load: () => Promise.resolve(engine),
};
