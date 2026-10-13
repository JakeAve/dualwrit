// The shell every script's page shares. A page's main.ts hands `mount` its
// script and is bundled to dist/<script>/app.js by `deno task build`; the
// transcriber runs in the browser, so the site is fully static.
import { keyboard } from "./keyboard.ts";
import {
  align,
  choose,
  type Chunk,
  fresh,
  known,
  type Progress,
  unlock,
} from "./practice.ts";
import type { Choice, Pairs, Script } from "./script.ts";

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;
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

// Fill the page's two mount points and bring them, the chart and the reading
// words to life.
export async function mount<S extends string>(script: Script<S>) {
  const translator = $('[data-mount="translator"]');
  translator.setAttribute("aria-labelledby", "try");
  translator.innerHTML = `
<h2 id="try">Write something</h2>
<p class="lede">Type in either box and the other follows.${
    script.styles.length > 1 ? " Choose a spelling style on the right." : ""
  }</p>

<div class="boxes">
<div class="box">
<label for="in">English</label>
<textarea id="in"
spellcheck="true">To be or not to be, that is the question. Which of you knows the way to the people of the valley?</textarea>
</div>
<div class="box">
<div class="label">
<span id="out-label">${script.name}</span>
${
    script.styles.length > 1
      ? `<fieldset class="styles">
<legend class="sr-only">Spelling style</legend>
${
        script.styles.map(({ id, label }, i) =>
          `<label><input type="radio" name="style" value="${id}"${
            i ? "" : " checked"
          }><span>${label}</span></label>`
        ).join("\n")
      }
</fieldset>`
      : ""
  }
<button type="button" id="copy">Copy</button>
</div>
<div id="out" lang="${script.lang}" contenteditable="plaintext-only"
role="textbox" aria-multiline="true" aria-labelledby="out-label"
spellcheck="false"></div>
</div>
</div>
<p id="style-note" aria-live="polite"></p>
<p id="choice-note"
hidden>Underlined words can be said two ways. Press one to switch it.
Your choice is written into the English as a tag, like <code>read{past}</code>; a dotted underline is a guess.</p>
<p id="misses" aria-live="polite"></p>

<div id="keys">
<p>Use your keyboard to type ${script.name} letters, hold (Alt/Option) for
alternate letters</p>
<div id="keymap"></div>
</div>`;
  const practising = $('[data-mount="drill"]');
  practising.setAttribute("aria-labelledby", "practice");
  practising.innerHTML = `
<h2 id="practice">Practice</h2>
<p class="lede">Spell one word at a time. The boxes are the parts of
the word whose letters you have met: type the ${script.name} letter for each.
The rest of the word stays in Latin until its letters arrive, a new one each time you
have the hang of the last.</p>
<div id="drill">
<p id="d-note" aria-live="polite"></p>
<div id="d-word" tabindex="0" role="group"></div>
<p id="d-hint" aria-live="polite"></p>
<div id="d-keys"></div>
<p><button type="button" id="d-next" hidden>Next word</button></p>
<div id="d-progress">
<div id="d-strip" lang="${script.lang}" aria-label="Letters learned"></div>
<button type="button" id="d-skip">Skip ahead</button>
<button type="button" id="d-reset">Start over</button>
</div>
</div>`;

  const input = $<HTMLTextAreaElement>("#in");
  const out = $("#out");
  const missed = $("#misses");
  const style = () =>
    (document.querySelector<HTMLInputElement>("input[name=style]:checked")
      ?.value ?? script.styles[0].id) as S;
  // The letter as the drill and a plain key press write it.
  const small = script.lower ?? ((glyph: string) => glyph);
  const { keyGlyph, scriptKeys, keyboardMap } = keyboard(
    script.rows,
    script.lower,
  );

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

  // Build the chart and practice words from their data attributes.
  const tile = (spec: string) => {
    const [glyph, word, part, absentIn] = spec.split("|");
    return `<div class="letter" data-word="${word}" ${
      absentIn ? `data-absent="${absentIn}"` : ""
    }>
    <div class="glyph" lang="${script.lang}">${glyph}${
      script.lower ? `<small>${script.lower(glyph)}</small>` : ""
    }</div>
    <div class="word">${mark(word, part)}</div>
    <div class="spelled" lang="${script.lang}"></div>
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

  // In the script's box the keyboard types the script, and the map shows which key.
  scriptKeys(out);
  $("#keymap").append(keyboardMap(out, sound, script.lang));

  const practice = $(".practice");
  practice.innerHTML = practice.dataset.words!.split("|")
    .map((w) =>
      `<li><details><summary lang="${script.lang}" data-word="${w}">…</summary><p>${w} ${
        speaker(w)
      }</p></details></li>`
    ).join("");

  // Everything waits on the engine, which may have a dictionary to fetch.
  const engine = await script.load((message) => missed.textContent = message);

  // Every example on the page is spelled by the same code as the translator, in the chosen style.
  function spellExamples() {
    const cells = [...document.querySelectorAll<HTMLElement>("[data-word]")];
    const words = cells.map((c) => c.dataset.word).join("\n");
    engine.transcribe(words, style()).out.split("\n").forEach((spelling, i) => {
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

  // [english, script] for each word now in the boxes, so an edit to the script
  // only re-reads the words it touched.
  let pairs: Pairs = [];

  // Words with two readings become buttons. Pressing one writes the next
  // reading into the English as a tag (read{past}) and transcribes again.
  // An engine that cannot write the tag gets no buttons.
  function show(text: string, choices: Choice[] = []) {
    if (!engine.retag) choices = [];
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
        input.value = engine.retag!(input.value, c, next);
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
    const { out: text, misses, choices, warnings, pairs: now } = engine
      .transcribe(sent, style());
    pairs = now;
    show(text, choices);
    missed.textContent = [
      ...(warnings ?? []),
      ...(misses?.size
        ? [
          `Not in the dictionary, so left as written: ${
            [...misses.keys()].join(", ")
          }`,
        ]
        : []),
    ].join("\n");
  }

  // An edit to the script rewrites the English. The script's box is left alone
  // so the caret stays put.
  function updateBack() {
    const { out: english, misses, pairs: now } = engine.untranscribe(
      out.textContent ?? "",
      style(),
      pairs,
    );
    pairs = now;
    input.value = english;
    missed.textContent = misses?.size
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
  // fill with the script; the rest of the word stays in Latin until its letters
  // come into play.
  const drill = $("#drill"), wordRow = $("#d-word"), next = $("#d-next");
  let progress: Progress = fresh();
  try {
    progress = {
      ...progress,
      ...JSON.parse(localStorage.getItem(script.store)!),
    };
  } catch { /* nothing saved, or storage is off: start from the beginning */ }
  const save = () => {
    try {
      localStorage.setItem(script.store, JSON.stringify(progress));
    } catch { /* practice still works, it just isn't remembered */ }
  };
  // A drill letter as the chart writes it, which is how its sound is found.
  const charted = new Map(script.order.map((glyph) => [small(glyph), glyph]));
  const upper = (letter: string) => charted.get(letter)!;

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
      return `<span class="chunk"><span lang="${script.lang}" class="slot${
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
      ? `A new letter: <span lang="${script.lang}">${arrived}</span> is the ${
        sound(upper(arrived))
      }.`
      : "";
    $("#d-hint").innerHTML = done
      ? `${english} in full: <span lang="${script.lang}">${
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
      `<button type="button" lang="${script.lang}" data-letter="${l}"
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
    type(small(glyph));
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
      alphabet.filter((l) => l.absent === style()).map((l) => small(l.glyph)),
    );
    letters = script.order.map(small).filter((l) => !absent.has(l));
    pool = script.splits.map((s) =>
      align(s, engine.transcribe(s.replaceAll("|", ""), style()).out)
    ).filter((w) => w !== null);
    newWord();
  }

  function refresh() {
    $("#style-note").textContent = script.styles.find((s) => s.id === style())!
      .note;
    update();
    spellExamples();
    startPractice();
  }
  refresh();
}
