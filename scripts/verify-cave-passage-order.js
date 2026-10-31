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
  mainEntries: archives.get("MAIN.ARC"),
  font: archives.get("MAIN.ARC")[42].data,
};
verifyFullPassages(resources);
// Run the old class under the same unchanged runtime dependencies. This
// negative must fail at the newly observed ordering boundary,not setup.
const baseline = "85bc2f3",
  sha = (b) => createHash("sha256").update(b).digest("hex");
const paths = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", baseline, "src"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
for (const p of paths) {
  if (p === "src/game/cave.js") continue;
  assert.equal(
    sha(await readFile(p)),
    sha(execFileSync("git", ["show", `${baseline}:${p}`])),
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
    all.replace(specifier, pathToFileURL(resolve("src/game", specifier)).href),
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
