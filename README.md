# dualwrit

Writes English in other alphabets. The first one is the
[Deseret alphabet](https://en.wikipedia.org/wiki/Deseret_alphabet), a phonetic
alphabet for English made in Utah in the 1850s.

The site teaches the letters and has a side-by-side translator:
https://jakeave.github.io/dualwrit/

## How it works

Deseret is written by sound, so each word is looked up in the
[CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) (American
English) and its sounds are mapped to letters by a longest-match table.

Three spelling styles:

| Style         | What it does                                                                |
| ------------- | --------------------------------------------------------------------------- |
| `modern`      | One letter per sound as said today, using all 40 letters. The default.      |
| `abbreviated` | Modern, plus the single-letter words _the_, _thee_, _be_ and _ye_.          |
| `1869`        | Spelled the way the printed 1869 books did: abbreviations, an older accent. |

Words spelled one way and said two ways (_read_, _lead_, _record_) are chosen
from the words around them by fixed rules. To overrule a choice, tag the word:

```
I read{past} books.
```

Each such word has named readings (`read`: `present`, `past`; `lead`: `guide`,
`metal`; `record`: `noun`, `verb`). The command line lists any it had to guess,
and the site underlines them so you can press to switch.

## Use

Needs [Deno](https://deno.com) 2.4 or newer.

```bash
deno task deseret notes.txt                  # all three styles
deno task deseret --style=1869 notes.txt     # just one
deno task dev                                # the site, on http://localhost:8131
```

From code:

```ts
import { parseDict, transcribe } from "./src/deseret.ts";

const dict = parseDict(await Deno.readTextFile("data/cmudict.dict"));
const { out, misses, choices, warnings } = transcribe(
  "I read books.",
  dict,
  "modern",
);
```

## Layout

```
src/deseret.ts       letter tables, styles, suffix rules, transcribe()
src/heteronyms.ts    two-reading words: readings and context rules
src/*_test.ts        tests
cli.ts               command line
web/                 the site: index.html and app.ts (bundled for the browser)
data/cmudict.dict    pronouncing dictionary
scripts/score.ts     agreement with the 1869 text (needs corpus/, see below)
samples/             chapters of three public-domain books in Deseret
```

## Develop

```bash
deno task test     # unit tests
deno task check    # format, lint, type-check
deno task build    # writes the static site to dist/
```

Pushing to `main` runs the checks and tests, builds, and publishes `dist/` to
GitHub Pages (`.github/workflows/pages.yml`). The transcriber runs in the
browser, so the site is fully static.

## The 1869 score

The `1869` style was tuned against the Deseret Book of Mormon printed in 1869,
using the Unicode transcription published by the
[Illinois Deseret Consortium](http://go.illinois.edu/deseret). Their terms allow
educational and personal use but not publication, so that text and the word list
derived from it are **not in this repository**. They live in a git-ignored
`corpus/` folder, and `deno task score` only works where that folder exists. The
rules in `src/` were written from the comparison and contain none of the text.

## Data and credits

- `data/cmudict.dict`: the CMU Pronouncing Dictionary, © Carnegie Mellon
  University, under the licence in `data/LICENSE-cmudict`.
- Fonts on the site are loaded from Google Fonts: Noto Sans Deseret and Old
  Standard TT.
