// The page's script. Bundled to dist/app.js by `deno task build`; the
// transcriber runs in the browser, so the site is fully static.
import {
  type Heteronym,
  parseDict,
  type Reverse,
  reverseIndex,
  type Style,
  transcribe,
  untranscribe,
  WORD,
} from "../src/deseret.ts";
import { deseretKeys, keyboardMap, keyGlyph } from "./keyboard.ts";
import {
  align,
  choose,
  type Chunk,
  fresh,
  known,
  order,
  type Progress,
  splits,
  unlock,
} from "./practice.ts";

const notes: Record<Style, string> = {
  modern: "",
  abbreviated:
    "Modern, plus four words written as a single letter because the letter's name sounds like the word: the, thee, be and ye.",
  1869:
    "Spelled the way the printed books of 1869 did: the single-letter words, an older accent, and 38 letters.",
};

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;
const input = $<HTMLTextAreaElement>("#in");
const out = $("#out");
const missed = $("#misses");
const style = () =>
  $<HTMLInputElement>("input[name=style]:checked").value as Style;

// Build the chart and practice words from their data attributes.
const lowercase = (g: string) => String.fromCodePoint(g.codePointAt(0)! + 0x28);
const mark = (word: string, part: string) => {
  const i = word.indexOf(part);
  return `${word.slice(0, i)}<b>${part}</b>${word.slice(i + part.length)}`;
};
// A speaker button that reads `word` aloud with the browser's own voice.
// ponytail: it says the example word, not the bare sound; speech synthesis
// can't be trusted to pronounce a lone vowel.
const speaker = (word: string) =>
  `<button type="button" class="say" data-say="${word}" aria-label="Hear the word ${word}">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>
    </svg>
  </button>`;
if ("speechSynthesis" in globalThis) {
  document.addEventListener("click", (e) => {
    const word = (e.target as Element).closest<HTMLElement>(".say")?.dataset
      .say;
    if (!word) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    speechSynthesis.cancel(); // don't queue behind an earlier press
    speechSynthesis.speak(utterance);
  });
} else {
  document.documentElement.classList.add("no-speech");
}

const tile = (spec: string) => {
  const [glyph, word, part, absentIn] = spec.split("|");
  return `<div class="letter" data-word="${word}" ${
    absentIn ? `data-absent="${absentIn}"` : ""
  }>
    <div class="glyph" lang="en-Dsrt">${glyph}<small>${
    lowercase(glyph)
  }</small></div>
    <div class="word">${mark(word, part)}</div>
    <div class="spelled" lang="en-Dsrt"></div>
    <div class="absent">not used in ${absentIn}</div>
    ${speaker(word)}
  </div>`;
};
for (const el of document.querySelectorAll<HTMLElement>("[data-letters]")) {
  el.innerHTML = el.dataset.letters!.split(" ").map(tile).join("");
}
for (const el of document.querySelectorAll<HTMLElement>("[data-pairs]")) {
  const tiles = el.dataset.pairs!.split(" ").map(tile);
  el.innerHTML = tiles.flatMap((t, i) =>
    i % 2 ? [] : `<div class="pair">${t}${tiles[i + 1]}</div>`
  ).join("");
}

// The chart is also the lesson plan: one lesson per group of letters.
type Letter = { glyph: string; word: string; part: string; absent?: string };
const lessons = [
  ...document.querySelectorAll<HTMLElement>("[data-letters], [data-pairs]"),
].map((el) => {
  let heading = el.previousElementSibling!;
  while (heading.tagName !== "H3") heading = heading.previousElementSibling!;
  return {
    name: heading.textContent!,
    letters: (el.dataset.letters ?? el.dataset.pairs!).split(" ").map(
      (spec): Letter => {
        const [glyph, word, part, absent] = spec.split("|");
        return { glyph, word, part, absent };
      },
    ),
  };
});
const alphabet = lessons.flatMap((l) => l.letters);
const sound = (glyph: string) => {
  const { word, part } = alphabet.find((l) => l.glyph === glyph)!;
  return `${part} in ${word}`;
};

// In the Deseret box the keyboard types Deseret, and the map shows which key.
deseretKeys(out);
$("#keymap").append(keyboardMap(out, sound));

const practice = $(".practice");
practice.innerHTML = practice.dataset.words!.split("|")
  .map((w) =>
    `<li><details><summary lang="en-Dsrt" data-word="${w}">…</summary><p>${w} ${
      speaker(w)
    }</p></details></li>`
  ).join("");

// The dictionary is one 3.6 MB text file; everything waits on it.
missed.textContent = "Loading the pronouncing dictionary…";
const response = await fetch("cmudict.dict");
if (!response.ok) {
  missed.textContent =
    `Could not load the pronouncing dictionary (${response.status}). Reload to try again.`;
  throw new Error("dictionary failed to load");
}
const dict = parseDict(await response.text());

// Every example on the page is spelled by the same code as the translator, in the chosen style.
function spellExamples() {
  const cells = [...document.querySelectorAll<HTMLElement>("[data-word]")];
  const words = cells.map((c) => c.dataset.word).join("\n");
  transcribe(words, dict, style()).out.split("\n").forEach((spelling, i) => {
    const cell = cells[i];
    const target = cell.tagName === "SUMMARY"
      ? cell
      : cell.querySelector(".spelled")!;
    target.textContent = spelling;
    if (cell.dataset.absent) {
      cell.classList.toggle("unused", cell.dataset.absent === style());
    }
  });
}

// [english, deseret] for each word now in the boxes, so an edit to the Deseret
// only re-reads the words it touched.
let pairs: [string, string][] = [];
const indexes: Partial<Record<Style, Reverse>> = {};

// Words with two readings become buttons. Pressing one writes the next
// reading into the English as a tag (read{past}) and transcribes again.
function show(text: string, choices: Heteronym[]) {
  out.replaceChildren();
  let at = 0;
  for (const c of choices) {
    const next =
      c.options[(c.options.indexOf(c.chosen) + 1) % c.options.length];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice ${c.by}`;
    button.contentEditable = "false"; // pressable, not typed into
    button.textContent = text.slice(c.outStart, c.outEnd);
    button.title = `"${c.word}" as ${c.chosen}${
      c.by === "guess" ? " (a guess)" : ""
    }. Press for ${next}.`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => {
      // Find the word by its number: the English may have been rewritten by
      // Deseret edits since this button was drawn.
      const sent = input.value;
      const m = [...sent.matchAll(WORD)][c.n];
      if (m?.[1].toLowerCase() === c.word.toLowerCase()) {
        input.value = `${sent.slice(0, m.index)}${m[1]}{${next}}${
          sent.slice(m.index + m[0].length)
        }`;
      }
      update();
    });
    out.append(text.slice(at, c.outStart), button);
    at = c.outEnd;
  }
  out.append(text.slice(at));
  $("#choice-note").hidden = !choices.length;
}

function update() {
  const sent = input.value;
  const { out: text, misses, choices, warnings, pairs: now } = transcribe(
    sent,
    dict,
    style(),
  );
  pairs = now;
  show(text, choices);
  missed.textContent = [
    ...warnings,
    ...(misses.size
      ? [
        `Not in the dictionary, so left as written: ${
          [...misses.keys()].join(", ")
        }`,
      ]
      : []),
  ].join("\n");
}

// The chosen style's spellings first, then any the other styles add, so
// pasted text reads whichever style it was written in.
function readingIndex(chosen: Style): Reverse {
  const index = reverseIndex(dict, chosen);
  for (const other of Object.keys(notes) as Style[]) {
    if (other === chosen) continue;
    for (const [deseret, word] of reverseIndex(dict, other)) {
      if (!index.has(deseret)) index.set(deseret, word);
    }
  }
  return index;
}

// An edit to the Deseret rewrites the English. The Deseret box is left alone
// so the caret stays put.
function updateBack() {
  const index = indexes[style()] ??= readingIndex(style());
  const { out: english, misses, pairs: now } = untranscribe(
    out.textContent ?? "",
    index,
    pairs,
  );
  pairs = now;
  input.value = english;
  missed.textContent = misses.size
    ? `No English word is spelled this way, so left as written: ${
      [...misses.keys()].join(", ")
    }`
    : "";
}

let timer: ReturnType<typeof setTimeout>;
for (const [box, run] of [[input, update], [out, updateBack]] as const) {
  box.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 150);
  });
}
for (const radio of document.querySelectorAll("input[name=style]")) {
  radio.addEventListener("change", refresh);
}
$("#copy").addEventListener("click", async (e) => {
  const button = e.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText(out.textContent ?? "");
  button.textContent = "Copied";
  setTimeout(() => button.textContent = "Copy", 1500);
});

// Practice: spell one word at a time. The sounds learned so far are boxes to
// fill with Deseret; the rest of the word stays in Latin until its letters
// come into play.
const drill = $("#drill"), wordRow = $("#d-word"), next = $("#d-next");
const STORE = "dualwrit-practice";
let progress: Progress = fresh();
try {
  progress = { ...progress, ...JSON.parse(localStorage.getItem(STORE)!) };
} catch { /* nothing saved, or storage is off: start from the beginning */ }
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(progress));
  } catch { /* practice still works, it just isn't remembered */ }
};
const upper = (g: string) => String.fromCodePoint(g.codePointAt(0)! - 0x28);

let letters: string[] = []; // the chosen style's letters, in teaching order
let pool: Chunk[][] = []; // the words that line up in the chosen style
let word: Chunk[] = [];
let at = 0; // the chunk being spelled, or -1 once the word is done
let misses = 0;
let arrived: string | undefined; // a letter that has just come into play

const inPlay = (letter: string) => letters.indexOf(letter) < progress.n;
const nextBox = (from: number) =>
  word.findIndex((c, i) => i >= from && inPlay(c.letter));

function draw() {
  const done = at < 0;
  const english = word.map((c) => c.latin).join("");
  wordRow.innerHTML = word.map((c, i) => {
    if (!inPlay(c.letter)) return `<span class="chunk">${c.latin}</span>`;
    const here = i === at, shown = done || i < at || (here && misses > 1);
    return `<span class="chunk"><span lang="en-Dsrt" class="slot${
      here ? " here" : ""
    }${here && misses === 1 ? " miss" : ""}${
      here && misses > 1 ? " told" : ""
    }">${shown ? c.letter : ""}</span><small>${c.latin}</small></span>`;
  }).join("") + speaker(english);
  wordRow.setAttribute(
    "aria-label",
    done
      ? `${english}, spelled`
      : `Spell ${english}. Now the ${word[at].latin}.`,
  );
  $("#d-note").innerHTML = arrived
    ? `A new letter: <span lang="en-Dsrt">${arrived}</span> is the ${
      sound(upper(arrived))
    }.`
    : "";
  $("#d-hint").innerHTML = done
    ? `${english} in full: <span lang="en-Dsrt">${
      word.map((c) => c.letter).join("")
    }</span>`
    : misses > 1
    ? `It is the ${sound(upper(word[at].letter))}.`
    : misses
    ? "Not that one. Try another."
    : "";
  next.hidden = !done;
  const playing = letters.slice(0, progress.n);
  $("#d-keys").innerHTML = playing.map((l) =>
    `<button type="button" lang="en-Dsrt" data-letter="${l}"
      aria-label="${sound(upper(l))}">${l}</button>`
  ).join("");
  $("#d-strip").innerHTML = letters.map((l, i) =>
    `<span class="${
      known(progress, l) ? "known" : i < progress.n ? "play" : ""
    }" title="${sound(upper(l))}">${l}</span>`
  ).join("");
  $<HTMLButtonElement>("#d-skip").disabled = progress.n >= letters.length;
}

function type(letter: string) {
  if (at < 0) return;
  const want = word[at].letter;
  if (letter !== want) {
    misses++;
    return draw();
  }
  // Only a first-try spelling counts toward knowing the letter.
  if (!misses) progress.count[want] = (progress.count[want] ?? 0) + 1;
  misses = 0;
  at = nextBox(at + 1);
  if (at < 0) arrived = unlock(progress, letters);
  save();
  draw();
  if (at < 0) next.focus();
}

function newWord() {
  const here = drill.contains(document.activeElement);
  word = choose(pool, progress, letters, word);
  at = nextBox(0);
  misses = 0;
  draw();
  if (here) wordRow.focus();
}

wordRow.addEventListener("keydown", (e) => {
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return;
  const glyph = keyGlyph(e);
  if (!glyph) return;
  e.preventDefault();
  type(lowercase(glyph));
});
// Keep the caret on the word when a key is pressed with the mouse.
$("#d-keys").addEventListener("mousedown", (e) => e.preventDefault());
$("#d-keys").addEventListener("click", (e) => {
  const letter = (e.target as Element).closest<HTMLElement>("button")?.dataset
    .letter;
  if (letter) type(letter);
});
next.addEventListener("click", () => {
  arrived = undefined;
  newWord();
});
$("#d-skip").addEventListener("click", () => {
  arrived = letters[progress.n++];
  save();
  newWord();
});
$("#d-reset").addEventListener("click", () => {
  if (!confirm("Forget the letters you have learned and start over?")) return;
  progress = fresh();
  arrived = undefined;
  save();
  newWord();
});

// The chosen style decides which letters exist and how each word is spelled.
function startPractice() {
  const absent = new Set(
    alphabet.filter((l) => l.absent === style()).map((l) => lowercase(l.glyph)),
  );
  letters = order.filter((l) => !absent.has(l));
  pool = splits.map((s) =>
    align(s, transcribe(s.replaceAll("|", ""), dict, style()).out)
  ).filter((w) => w !== null);
  newWord();
}

function refresh() {
  $("#style-note").textContent = notes[style()];
  update();
  spellExamples();
  startPractice();
}
refresh();
