// Typing Deseret on a Latin keyboard. Each key is its Latin letter, the
// Deseret capital it types, and the one it types with Option/Alt held.
// 26 keys and 14 Option keys make the 40 letters; the key is the sound's
// usual Latin letter where there is one (Q is "ew", as the letter is named).
// ponytail: keys are matched by position (QWERTY), so the labels are wrong
// on Dvorak or AZERTY. Match on `e.key` if anyone asks.
export const rows = [
  "q𐐧 w𐐎𐐃 e𐐇𐐀 r𐐡 t𐐓𐐛 y𐐏𐐦 u𐐊𐐅 i𐐆𐐌 o𐐉𐐄 p𐐑",
  "a𐐈𐐁 s𐐝𐐟 d𐐔𐐜 f𐐙 g𐐘 h𐐐𐐂 j𐐖 k𐐗 l𐐢",
  "z𐐞𐐠 x𐐍 c𐐕 v𐐚 b𐐒𐐋 n𐐤𐐥 m𐐣",
].map((row) => row.split(" ").map((key) => [...key]));

const byCode = new Map(
  rows.flat().map((
    [latin, ...glyphs],
  ) => [`Key${latin.toUpperCase()}`, glyphs]),
);
const lower = (g: string) => String.fromCodePoint(g.codePointAt(0)! + 0x28);

// Edit `box` at its caret as if by typing. execCommand is deprecated, but it
// is the one edit that keeps undo and fires `input`.
function edit(box: HTMLElement, command: string, text?: string) {
  if (document.activeElement !== box) {
    box.focus();
    getSelection()!.selectAllChildren(box);
    getSelection()!.collapseToEnd();
  }
  document.execCommand(command, false, text);
}
const type = (box: HTMLElement, capital: string, shift: boolean) =>
  edit(box, "insertText", shift ? capital : lower(capital));

// While `box` has the caret, letter keys type Deseret. Shortcuts pass through.
// A phone's own keyboard has no Deseret, so it stays down (inputmode="none")
// and the map from `keyboardMap` docks to the bottom of the screen instead.
export function deseretKeys(box: HTMLElement) {
  box.inputMode = "none";
  // macOS makes Option+E, U, I and N "dead" keys: an accent (´ ¨ ˆ ˜) waits for
  // the next key, and preventDefault cannot stop it, because the system has
  // started the accent before the page hears the key. It only starts one in a
  // text field, so while Option is down the box stops being one. It keeps the
  // caret (tabIndex) and is editable again for the instant a letter goes in.
  box.tabIndex = 0;
  const editable = box.contentEditable;
  let held = false;
  const hold = (on: boolean) => {
    if (on === held) return;
    held = on;
    box.contentEditable = on ? "false" : editable;
  };
  let option = false; // is the Option key down
  const release = () => hold(option = false);
  box.addEventListener("keyup", (e) => e.key === "Alt" && release());
  box.addEventListener("blur", release);

  box.addEventListener("keydown", (e) => {
    if (e.key === "Alt") {
      return hold(option = box.isContentEditable);
    }
    hold(false); // so this key can edit: a letter, or Option+Arrow, Option+Delete
    setTimeout(() => hold(option));
    if (e.metaKey || (e.ctrlKey && !e.altKey)) return;
    const glyph = byCode.get(e.code)?.[e.altKey ? 1 : 0];
    if (!glyph) return;
    e.preventDefault();
    type(box, glyph, e.shiftKey !== e.getModifierState("CapsLock"));
  });
}

// A picture of the keyboard whose keys can be pressed to type into `box`.
// `sound` describes a letter ("sh in she") for the tooltip.
export function keyboardMap(
  box: HTMLElement,
  sound: (glyph: string) => string,
) {
  const map = document.createElement("div");
  map.className = "keys";
  const button = (glyph: string, alt: boolean, latin: string) =>
    `<button type="button" class="${alt ? "alt" : "main"}" data-glyph="${glyph}"
      title="${alt ? "Option+" : ""}${latin.toUpperCase()}: ${sound(glyph)}"
      aria-label="${sound(glyph)}">${
      alt ? "" : `<small>${latin}</small>`
    }<span lang="en-Dsrt">${glyph}</span></button>`;
  map.innerHTML =
    rows.map((row) =>
      `<div class="keyrow">${
        row.map(([latin, plain, alt]) =>
          `<div class="key">${
            alt ? button(alt, true, latin) : "<span></span>"
          }${button(plain, false, latin)}</div>`
        ).join("")
      }</div>`
    ).join("") +
    // What a phone's keyboard would have supplied. Shown on touch screens only.
    `<div class="keyrow touch">${
      [
        ["shift", "Capital", "⇧"],
        ["text", "Comma", ","],
        ["text", "Space", " "],
        ["text", "Full stop", "."],
        ["text", "Question mark", "?"],
        ["delete", "Delete", "⌫"],
        ["enter", "Return", "⏎"],
      ].map(([act, name, face]) =>
        `<div class="key"><button type="button" data-act="${act}"
          aria-label="${name}">${face}</button></div>`
      ).join("")
    }</div>`;
  // Keep the caret in the box when a key is pressed.
  map.addEventListener("mousedown", (e) => e.preventDefault());
  map.addEventListener("click", (e) => {
    const key = (e.target as Element).closest("button");
    if (!key) return;
    const { glyph, act } = key.dataset;
    if (glyph) type(box, glyph, e.shiftKey || map.classList.contains("shift"));
    if (act === "text") edit(box, "insertText", key.textContent!);
    if (act === "delete") edit(box, "delete");
    // Return goes to the box first, so a one-line box can take it as "done".
    if (
      act === "enter" &&
      box.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", cancelable: true }),
      )
    ) edit(box, "insertLineBreak");
    map.classList.toggle("shift", act === "shift" && !map.matches(".shift"));
  });
  // Dock while the box has the caret and the phone's keyboard is held down.
  box.addEventListener("focus", () => {
    if (box.inputMode !== "none") return;
    map.classList.add("docked");
    if (getComputedStyle(map).position === "fixed") {
      box.scrollIntoView({ block: "center" });
    }
  });
  box.addEventListener("blur", () => map.classList.remove("docked"));
  return map;
}
