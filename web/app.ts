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
import { deseretKeys, keyboardMap } from "./keyboard.ts";

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

// Practice: one question at a time, on the letters of the chosen lesson.
// ponytail: questions are random and the score lasts until reload. Keep the
// score in localStorage, or ask missed letters more often, if this gets used.
const words =
  `cat sun ship moon bread honey light school thing mountain bed dog fish tree
book hand rain snow milk green red blue mouse road boat sheep cheese jump king
queen ring song think this that mother father sister brother water river bird
horse garden apple table chair window happy seven three five nine night day
sweet voice boy toy few music measure zoo yes wish`.split(/\s+/);
const lessonPick = $<HTMLSelectElement>("#lesson");
lessonPick.innerHTML = [...lessons.map((l) => l.name), "Everything"]
  .map((name, i) => `<option value="${i}">${name}</option>`).join("");
const pick = <T>(from: T[]) => from[Math.floor(Math.random() * from.length)];
const shuffle = <T>(xs: T[]) =>
  xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0])
    .map(([, x]) => x);
const spellOne = (word: string) =>
  transcribe(word.toLowerCase(), dict, style()).out;
let right = 0, asked = 0, last = "";

function ask() {
  const n = +lessonPick.value;
  const used = (l: Letter) => l.absent !== style();
  const mine = (lessons[n]?.letters ?? alphabet).filter(used);
  // Whole words wait until every letter in them has been taught.
  const taught = new Set(
    lessons.slice(0, n + 1).flatMap((l) => l.letters).map((l) =>
      lowercase(l.glyph)
    ),
  );
  const fresh = new Set(mine.map((l) => lowercase(l.glyph)));
  const ready = words.filter((w) => {
    const letters = [...spellOne(w)];
    return letters.every((c) => taught.has(c)) &&
      letters.some((c) => fresh.has(c));
  });

  let kind: string, letter: Letter, word: string, id: string;
  do {
    kind = pick([
      "letter",
      "sound",
      ...(ready.length > 3 ? ["write", "read"] : []),
    ]);
    letter = pick(mine);
    word = pick(ready);
    id = kind + (kind === "write" || kind === "read" ? word : letter.glyph);
  } while (id === last); // not the same question twice running
  last = id;
  const spelled = word && spellOne(word);

  const show = $("#q-show"), answer = $("#q-answer"), result = $("#q-result");
  const next = $<HTMLButtonElement>("#q-next");
  const inQuiz = $("#quiz").contains(document.activeElement);
  result.textContent = "";
  next.hidden = true;
  const done = (ok: boolean, correction: string) => {
    asked++;
    if (ok) right++;
    result.textContent = ok ? "Right." : `Not quite. ${correction}`;
    result.className = ok ? "right" : "wrong";
    $("#q-score").textContent = `${right} of ${asked} right`;
    next.hidden = false;
    next.focus();
  };

  if (kind === "letter" || kind === "sound") {
    const options = shuffle([
      letter,
      ...shuffle(mine.filter((l) => l !== letter)).slice(0, 3),
    ]);
    const marked = (l: Letter) => mark(l.word, l.part);
    const glyph = (l: Letter) => `<span lang="en-Dsrt">${l.glyph}</span>`;
    $("#q-prompt").textContent = kind === "letter"
      ? "Which letter makes the marked sound?"
      : "Which word has this letter's sound?";
    show.innerHTML = kind === "letter"
      ? `${marked(letter)} ${speaker(letter.word)}`
      : glyph(letter);
    answer.innerHTML = options.map((l) =>
      `<button type="button" class="opt">${
        kind === "letter" ? glyph(l) : marked(l)
      }</button>`
    ).join("");
    const buttons = [...answer.querySelectorAll("button")];
    buttons.forEach((button, i) =>
      button.addEventListener("click", () => {
        for (const b of buttons) b.disabled = true;
        buttons[options.indexOf(letter)].classList.add("right");
        if (options[i] !== letter) button.classList.add("wrong");
        done(
          options[i] === letter,
          `${letter.glyph} is the ${sound(letter.glyph)}.`,
        );
      })
    );
    if (inQuiz) buttons[0].focus();
    return;
  }

  // Whole words: write the Deseret for an English word, or read one back.
  const write = kind === "write";
  $("#q-prompt").textContent = write
    ? "Write this word in Deseret."
    : "What English word is this?";
  show.innerHTML = write
    ? `${word} ${speaker(word)}`
    : `<span lang="en-Dsrt">${spelled}</span>`;
  answer.innerHTML = `<div id="q-field" role="textbox" aria-label="Your answer"
      contenteditable="plaintext-only" spellcheck="false" ${
    write ? 'lang="en-Dsrt"' : 'autocapitalize="off"'
  }></div><button type="button">Check</button>`;
  const field = $("#q-field"), check = answer.querySelector("button")!;
  if (write) {
    deseretKeys(field);
    answer.append(keyboardMap(field, sound));
  }
  const submit = () => {
    const typed = field.textContent!.trim();
    if (!typed) return;
    field.contentEditable = "false";
    check.disabled = true;
    done(
      // Any word that sounds the same is right: "to" for "two".
      write ? typed.toLowerCase() === spelled : spellOne(typed) === spelled,
      write ? `${word} is ${spelled}.` : `It says "${word}".`,
    );
  };
  check.addEventListener("click", submit);
  field.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  });
  if (inQuiz) field.focus();
}
$("#q-next").addEventListener("click", ask);
lessonPick.addEventListener("change", ask);

function refresh() {
  $("#style-note").textContent = notes[style()];
  update();
  spellExamples();
  ask();
}
refresh();
