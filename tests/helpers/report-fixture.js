import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArchive } from "../../src/assets.js";
import { Scheduler } from "../../src/game/scheduler.js";
import { bankFixtureClocks } from "./bank-fixture.js";
import { destinationFixtureClocks } from "./destination-fixture.js";
import build from "../../reference/build.json" with { type: "json" };
const bytes = readFileSync("game/MAIN.ARC");
assert.equal(bytes.length, build.files["MAIN.ARC"].bytes);
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  build.files["MAIN.ARC"].sha256,
);
export const reportResources = { mainEntries: parseArchive(bytes) };
const clocks = new WeakMap();
// Conditional test clocks,not an original elapsed-time claim. Carry an existing
// bank fixture's provider instead of rebasing an active graphics deadline.
export function advanceReportUntil(game, done) {
  let clock =
    bankFixtureClocks.get(game) ??
    destinationFixtureClocks.get(game) ??
    clocks.get(game);
  if (!clock) {
    clock = new Scheduler(game);
    clocks.set(game, clock);
  }
  for (let n = 0; n < 20000; n++) {
    if (done()) return;
    const wake = game.nextSimulationWake();
    clock.advanceTo(
      Math.min(
        clock.tickAt,
        clock.retraceAt,
        wake === null
          ? Infinity
          : wake + clock.origin + clock.pausedMilliseconds,
      ),
    );
    assert.equal(game.diagnostic, null);
  }
  throw Error("Unfinished report fixture");
}
export function finishReport(game) {
  const p = game.reportPresentation;
  assert.ok(p);
  advanceReportUntil(game, () => game.reportPresentation !== p);
  assert.equal(p.consumedRetraces, 75);
}
