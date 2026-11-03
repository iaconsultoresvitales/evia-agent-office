// Validates locale keys. EVIA's Spanish translation is intentionally partial;
// the runtime deep-merges it with en.json (see src/server/i18n.ts).
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "..", "locales");
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === "object" && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]
);
const en = new Set(flat(JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"))));
const partialLocales = new Set(["es.json"]);
let bad = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const keys = new Set(flat(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))));
  if (!partialLocales.has(file)) {
    for (const key of en) if (!keys.has(key)) { console.error(`${file}: missing ${key}`); bad++; }
  }
  for (const key of keys) if (!en.has(key)) { console.error(`${file}: extra ${key}`); bad++; }
}
if (bad) process.exit(1);
console.log("locales ok (Spanish is a partial locale with English fallback)");
