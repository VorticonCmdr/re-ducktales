// Conditional carried shortened route. Original source checks are separate;
// this is not an original-machine ending/time comparison.
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { Cave } from "../src/game/cave.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { runCaveRoute } from "./verify-cave-routes.js";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { image, archives } = await originalGame();
const resources = { image, entries: archives.get("EXP.ARC"), mapEntries: archives.get("CAVEMAPS.ARC"),
  maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")), mainEntries: archives.get("MAIN.ARC"), font: archives.get("MAIN.ARC")[42].data };
const scenario = { id: "treasure-order", start: { variant: 0, difficulty: 0, seed: 0, money: 0, currentDrive: 0 }, route: "goal", status: "treasure" };
function verify(TreasureClass) {
  const counts = { scenes: 0, wipes: 0, copies: 0, parties: 0, presentations: 0, retraces: 0, backgrounds: 0 };
  class Observed extends TreasureClass {
    *scene(...args) { if (this.phase === "treasure") counts.scenes++; return yield* super.scene(...args); }
    *loadWork(id) { if (this.phase === "treasure" && id === 0) counts.backgrounds++; yield* super.loadWork(id); }
    *copyBackground() { if (this.phase === "treasure") counts.copies++; return yield* super.copyBackground(); }
    *party(...args) { if (this.phase === "treasure") counts.parties++; return yield* super.party(...args); }
    *wipe() {
      if (this.phase === "treasure") counts.wipes++;
      for (const wait of super.wipe()) {
        if (this.phase === "treasure" && wait.clock === "retrace") counts.retraces += wait.remaining;
        yield wait;
      }
    }
    *present(...args) {
      if (this.phase === "treasure") counts.presentations++;
      for (const wait of super.present(...args)) {
        if (this.phase === "treasure" && wait.clock === "retrace") counts.retraces += wait.remaining;
        yield wait;
      }
    }
  }
  const result = runCaveRoute(resources, scenario, null, Observed);
  assert.equal(result.outcome.status, "treasure");
  assert.deepEqual(counts, { scenes: 2, wipes: 1, copies: 13, parties: 15, presentations: 15, retraces: 64, backgrounds: 1 }, "Original treasure call sequence");
  return result;
}
const actual = verify(Cave);
// Reuse only the earlier treasure method under the same current dependencies;
// its extra13 compositions/missing wipe,load and copies must be rejected.
const source = execFileSync("git", ["show", "9f3d165:src/game/cave-endings.js"], { encoding: "utf8" })
  .replace(/\bfrom\s+["'](\.[^"']+)["']/g, (all, spec) => all.replace(spec, pathToFileURL(resolve("src/game", spec)).href));
const { caveEndings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
class HistoricalTreasure extends Cave {
  constructor(options) { super(options); }
}
// Override the called module method temporarily;restore it even when the
// comparison throws. Each route starts fresh and uses its own carried state.
const current = await import("../src/game/cave-endings.js"), original = current.caveEndings.treasure;
try {
  current.caveEndings.treasure = caveEndings.treasure;
  assert.throws(() => verify(HistoricalTreasure), /Original treasure call sequence/);
} finally { current.caveEndings.treasure = original; }
assert.ok(actual.frames.length > 0);
console.log("Cave treasure:2 compositions,1 wipe/background load,13 caller copies,15 parties/presentations,64 requested retraces;all carried route frames render;historical method negative rejected. Conditional route evidence,not native ending timing.");
