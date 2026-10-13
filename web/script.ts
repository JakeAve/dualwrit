// What a script is to the page: its letters, keyboard and practice words,
// and an engine that writes it. The shell knows nothing else about a script.

// One word that can be said more than one way, and what was done.
export type Choice = {
  word: string;
  n: number; // which word of the text it is, counting from 0
  options: string[]; // labels, usual reading first
  chosen: string;
  by: "tag" | "rule" | "guess";
  outStart: number; // where its spelling sits in the output
  outEnd: number;
};

// Each word as [latin, script], kept so an edit to one side leaves the rest.
export type Pairs = [string, string][];

export type Result = {
  out: string;
  pairs: Pairs;
  misses?: Map<string, number>;
  choices?: Choice[];
  warnings?: string[];
};

export type Engine<S extends string> = {
  transcribe(text: string, style: S): Result;
  untranscribe(text: string, style: S, pairs: Pairs): Result;
  // The Latin text with that word tagged as `reading`. Only engines that
  // return `choices` need it.
  retag?(text: string, choice: Choice, reading: string): string;
};

export type Script<S extends string> = {
  name: string; // used in labels and aria text
  lang: string; // set on every element that shows the script
  store: string; // localStorage key for practice progress
  styles: { id: S; label: string; note: string }[];
  rows: string[]; // keyboard rows: "q𐐧 w𐐎𐐃 ..."
  order: string[]; // letters in teaching order, as the chart writes them
  splits: string[]; // drill words split into chunks: sh|i|p
  // The small form of a letter. Omitted for caseless scripts.
  lower?(capital: string): string;
  load(status: (message: string) => void): Promise<Engine<S>>;
};
