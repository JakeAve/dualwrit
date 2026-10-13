// The rune page's script. Bundled to dist/runes/app.js by `deno task build`.
import { mount } from "../app.ts";
import { runes } from "./script.ts";

await mount(runes);
