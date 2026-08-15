import { extractJson, publicError, normalizeKey } from "./src/main.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeKey('  "gsk_abc"  ') === "gsk_abc", "strip quotes");
assert(normalizeKey("Bearer gsk_abc") === "gsk_abc", "strip Bearer");
assert(normalizeKey("") === "", "empty key");

assert(extractJson('{"grade":"correct","feedback":"ok"}').grade === "correct", "plain json");
assert(
  extractJson('```json\n{"grade":"incorrect","feedback":"no"}\n```').grade === "incorrect",
  "fenced json"
);
assert(
  extractJson('noise {"grade":"mostly_correct","feedback":"partial"} trailing').grade ===
    "mostly_correct",
  "embedded json"
);
assert(extractJson("not json") === null, "invalid json");

assert(
  publicError("Invalid API Key").includes("invalid Groq API key"),
  "maps invalid key"
);
assert(
  publicError("The model has been decommissioned").includes("retired"),
  "maps decommission"
);

console.log("grade-check parse tests passed");
