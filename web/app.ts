// The page's script. Bundled to dist/app.js by `deno task build`; the
// transcriber runs in the browser, so the site is fully static.
import {
  type Heteronym,
  parseDict,
  type Style,
  transcribe,
} from "../src/deseret.ts";

const notes: Record<Style, string> = {
  modern:
    "One letter per sound, the way an American says the word today, using all 40 letters.",
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
const practice = $(".practice");
practice.innerHTML = practice.dataset.words!.split("|")
  .map((w) =>
    `<li><details><summary lang="en-Dsrt" data-word="${w}">…</summary><p>${w}</p></details></li>`
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

// Words with two readings become buttons. Pressing one writes the next
// reading into the English as a tag (read{past}) and transcribes again.
function show(sent: string, text: string, choices: Heteronym[]) {
  out.replaceChildren();
  let at = 0;
  for (const c of choices) {
    const next =
      c.options[(c.options.indexOf(c.chosen) + 1) % c.options.length];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice ${c.by}`;
    button.textContent = text.slice(c.outStart, c.outEnd);
    button.title = `"${c.word}" as ${c.chosen}${
      c.by === "guess" ? " (a guess)" : ""
    }. Press for ${next}.`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => {
      input.value = `${sent.slice(0, c.start)}${c.word}{${next}}${
        sent.slice(c.end)
      }`;
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
  const { out: text, misses, choices, warnings } = transcribe(
    sent,
    dict,
    style(),
  );
  show(sent, text, choices);
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

let timer: ReturnType<typeof setTimeout>;
input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(update, 150);
});
for (const radio of document.querySelectorAll("input[name=style]")) {
  radio.addEventListener("change", refresh);
}
$("#copy").addEventListener("click", async (e) => {
  const button = e.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText(out.textContent ?? "");
  button.textContent = "Copied";
  setTimeout(() => button.textContent = "Copy", 1500);
});

function refresh() {
  $("#style-note").textContent = notes[style()];
  update();
  spellExamples();
}
refresh();
