// Source-anchored passage ordering; not native elapsed-time acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { verifyFullPassages } from "./verify-cave-routes.js";
execFileSync("python3", ["scripts/verify_cave_cadence.py"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  stdio: "inherit",
});
const { image, archives } = await originalGame();
const resources = {
  image,
  entries: archives.get("EXP.ARC"),
  maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")),
  mapEntries: archives.get("CAVEMAPS.ARC"),
  mainEntries: archives.get("MAIN.ARC"),
  font: archives.get("MAIN.ARC")[42].data,
};
verifyFullPassages(resources);
// Run the old class under the same unchanged runtime dependencies. This
// negative must fail at the newly observed ordering boundary,not setup.
const baseline = "85bc2f3",
  sha = (b) => createHash("sha256").update(b).digest("hex");
const historicalModules = new Map();
const paths = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", baseline, "src"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
for (const p of paths) {
  // Renderer is not imported by this component comparison. Its new incoming-
  // screen wipe compositing is exercised separately by the browser scenario.
  if (["src/game/cave.js", "src/game/renderer.js"].includes(p)) continue;
  let current = await readFile(p);
  const historical = execFileSync("git", ["show", `${baseline}:${p}`]);
  if (p === "src/game/cave-scene.js") {
    // The old class needs its synchronous initializer. Keep this dependency
    // byte-pinned to its baseline;current staged initialization is checked
    // separately against original source and carried/browser scenarios.
    const source = historical.toString().replace(/\bfrom\s+["'](\.[^"']+)["']/g,
      (all, specifier) => all.replace(specifier, pathToFileURL(resolve("src/game", specifier)).href));
    historicalModules.set("./cave-scene.js", `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    continue;
  }
  if (p === "src/game/browser.js") {
    current = Buffer.from(current.toString().replace('        mapEntries: resources.archives.get("CAVEMAPS.ARC"),\n', ""));
  }
  if (["src/game/cave-endings.js", "src/game/cave-transitions.js"].includes(p)) {
    // Keep the old synchronous load API with the old class. Admit only the
    // explicit generator delegation change in its current callers.
    current = Buffer.from(current.toString().replaceAll("yield* this.load(", "this.load("));
    assert.doesNotMatch(historical.toString(), /\bimport\b/);
    historicalModules.set("./" + p.split("/").at(-1),
      `data:text/javascript;base64,${historical.toString("base64")}`);
  }
  if (p === "src/assets.js") {
    // The decoder is unchanged;the parser additionally retains an independent
    // copy of the exact packed payload,verified for all47 EXP resources.
    current = Buffer.from(current.toString()
      .replace("    const packedData = Uint8Array.from(bytes.subarray(offset + 16, end));\n", "")
      .replace("decompressLzw(packedData, expectedSize)", "decompressLzw(bytes.subarray(offset + 16, end), expectedSize)")
      .replace("packedSize, packedData, type", "packedSize, type"));
  }
  assert.equal(
    sha(current),
    sha(historical),
    `Changed negative dependency ${p}`,
  );
}
const original = execFileSync("git", ["show", `${baseline}:src/game/cave.js`], {
  encoding: "utf8",
});
assert.doesNotMatch(original, /\bimport\s*\(/);
const source = original.replace(
  /\bfrom\s+["'](\.[^"']+)["']/g,
  (all, specifier) =>
    all.replace(specifier, historicalModules.get(specifier) ?? pathToFileURL(resolve("src/game", specifier)).href),
);
const { Cave: HistoricalCave } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
assert.throws(
  () => verifyFullPassages(resources, HistoricalCave),
  /torch advanced before exit animation finished/,
);
console.log(
  "Cave passage order:four directions/revisit preserve torch/cash until entry,commit room/flag before exit and retain busy phase;all images render;historical ordering negative rejected. Native timing divergence remains open.",
);
