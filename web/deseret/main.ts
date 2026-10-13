// The Deseret page's script. Bundled to dist/deseret/app.js by `deno task build`.
import { mount } from "../app.ts";
import { deseret } from "./script.ts";

await mount(deseret);
