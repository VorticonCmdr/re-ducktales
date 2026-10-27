import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations } from "../src/game/campaign.js";
import build from "../reference/build.json" with { type: "json" };
import evidence from "../reference/jungle-input.json" with { type: "json" };

async function supported(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    build.files[name].sha256,
  );
  return b;
}
const executable = await supported("DUCKTALE.EXE");
assert.equal(evidence.source.ranges.length, 4);
assert.equal(evidence.scenario.expectedUnitCases, 6);
for (const range of evidence.source.ranges) {
  const at = evidence.source.overlayBodyOffset + range.offset;
  assert.equal(
    createHash("sha256")
      .update(executable.subarray(at, at + range.length))
      .digest("hex"),
    range.sha256,
    range.purpose,
  );
}
const resources = {
  image: unpackImage(executable),
  jungleEntries: parseArchive(await supported("JG.ARC")),
  mainEntries: parseArchive(await supported("MAIN.ARC")),
  mountainEntries: parseArchive(await supported("MT.ARC")),
};
const locations = parseLocations(parseArchive(await supported("LOC.ARC")));
// Conditional application entry with independently supplied clocks. These are
// controller invariants, not captures of an original full campaign.
function fresh() {
  const g = new Game({ locations, expeditionResources: resources });
  g.seed = 11324;
  g.briefing = { activity: "jungle", variant: 0 };
  g.campaign.location = 1;
  g.startExpedition();
  return { g, j: g.jungle, clock: new Scheduler(g) };
}
function actors(j) {
  const s = j.snapshot();
  return Object.fromEntries(
    ["x", "y", "action", "frame", "seed", "frames", "presentations"].map(
      (k) => [k, s[k]],
    ),
  );
}
function entryCheck(mutate = () => {}) {
  const c = fresh();
  mutate(c);
  c.g.input({ type: "pause" });
  c.g.input({ type: "toggle-sound" });
  assert.equal(c.g.systemOverlay, null);
  c.clock.advanceTo(1200);
  assert.equal(c.g.systemOverlay, null);
  assert.equal(c.g.pendingJungleSystemKeys.size, 0);
  assert.equal(c.g.audioEnabled, false);
}
test("jungle entry discards global keys before its first poll", () =>
  entryCheck());
test("entry checker rejects a missing BIOS flush", () => {
  assert.throws(
    () =>
      entryCheck(({ j }) => {
        j.flushInput = () => {};
      }),
    assert.AssertionError,
  );
});
test("first-page reveal discards global keys without releasing the joystick provider", () => {
  const { g, j, clock } = fresh();
  clock.advanceTo(400);
  g.input({ type: "controls", direction: "right", fire: false });
  g.input({ type: "pause" });
  g.input({ type: "toggle-sound" });
  assert.equal(g.pendingJungleSystemKeys.size, 2);
  clock.advanceTo(1200);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingJungleSystemKeys.size, 0);
  assert.equal(g.audioEnabled, false);
  assert.equal(j.controls.direction, "right");
});
test("jungle pause suspends actors while driver and retrace clocks continue", () => {
  const { g, j, clock } = fresh();
  clock.advanceTo(1500);
  g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  clock.advanceTo(1700);
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(j.wait.clock, "input");
  g.input({ type: "toggle-sound" });
  const before = actors(j),
    tick = j.tick,
    retrace = j.retrace;
  clock.advanceTo(2400);
  assert.deepEqual(actors(j), before);
  assert.ok(j.tick > tick && j.retrace > retrace);
  assert.equal(g.audioEnabled, false);
  assert.equal(g.systemOverlay.phase, "waiting");
  g.input({ type: "controls", direction: "down", fire: true });
  g.input({ type: "pause" });
  clock.advanceTo(2550);
  assert.equal(g.systemOverlay, null);
  assert.deepEqual(j.controls, { direction: null, fire: false });
  assert.equal(g.pendingJungleSystemKeys.size, 0);
});
test("jungle global scan order selects quit before pause and cancellation flushes both", () => {
  const { g, j, clock } = fresh();
  clock.advanceTo(1500);
  g.input({ type: "pause" });
  g.input({ type: "quit" });
  clock.advanceTo(1700);
  assert.equal(g.systemOverlay.kind, "quit");
  assert.equal(j.wait.clock, "input");
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingJungleSystemKeys.size, 0);
  clock.advanceTo(1900);
  assert.equal(g.systemOverlay, null);
});
test("a logical segment flush consumes keys at its future driver boundary", () => {
  const { g, j } = fresh();
  j.driverWait(5);
  j.flushInput(false);
  g.input({ type: "pause" });
  for (let i = 0; i < 4; i++) j.advanceTick();
  assert.equal(g.pendingJungleSystemKeys.size, 1);
  j.advanceTick();
  assert.equal(g.pendingJungleSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
});
