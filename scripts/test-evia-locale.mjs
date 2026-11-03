import assert from "node:assert/strict";
import { loadLocale, availableLocales } from "../dist/server/i18n.js";

// EVIA ships a partial Spanish locale. Missing strings must fall back to English.
const en = loadLocale("en");
const es = loadLocale("es");

assert.equal(es.code, "es", "Spanish locale is discoverable");
assert.ok(availableLocales().some((locale) => locale.code === "es"), "Spanish appears in language settings");
assert.equal(es.data.ui.brand, "EVIA OFFICE");
assert.equal(es.data.ui.hireButton, "+ Nuevo agente");
assert.equal(es.data.ui.board.status.review, "En revisión");
assert.equal(es.data.status.waiting, "esperando aprobación");
assert.equal(es.data.server.agentSync.marker, en.data.server.agentSync.marker, "untranslated strings fall back to English");

// Detect accidental misspelled keys in our overrides before they silently disappear.
function checkKeys(base, override, prefix = "") {
  for (const [key, value] of Object.entries(override)) {
    const name = prefix ? `${prefix}.${key}` : key;
    assert.ok(Object.hasOwn(base, key), `Unknown translation key: ${name}`);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assert.ok(base[key] && typeof base[key] === "object", `Invalid translation branch: ${name}`);
      checkKeys(base[key], value, name);
    } else {
      assert.equal(typeof value, "string", `Translation must be a string: ${name}`);
    }
  }
}

const fs = await import("node:fs/promises");
const esOverrides = JSON.parse(await fs.readFile(new URL("../locales/es.json", import.meta.url), "utf8"));
checkKeys(en.data, esOverrides);

console.log("EVIA Spanish locale: discovery, overrides, fallbacks and schema OK");
