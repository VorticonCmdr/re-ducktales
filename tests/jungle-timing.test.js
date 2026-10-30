import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Jungle } from "../src/game/jungle.js";
import { Scheduler } from "../src/game/scheduler.js";
import { RETRACE_HZ } from "../src/game/timing.js";
const build = JSON.parse(read("reference/build.json"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function original(name) {
  const bytes = read(`game/${name}`);
  assert.equal(sha(bytes), build.files[name].sha256);
  return bytes;
}
const resources = {
  image: unpackImage(original("DUCKTALE.EXE")),
  entries: parseArchive(original("JG.ARC")),
  mainEntries: parseArchive(original("MAIN.ARC")),
  mountainEntries: parseArchive(original("MT.ARC")),
};
// Independent zero-phase environment: no native AFTER state supplies time.
function fresh() {
  const jungle = new Jungle({
    ...resources,
    variant: 0,
    difficulty: 0,
    seed: 2725,
    money: 44,
    day: 23,
  });
  const clock = new Scheduler({
    setSimulationClock: (provider) => jungle.setClock(provider),
    advanceTick: () => jungle.advanceTick(),
    advanceRetrace: () => jungle.advanceRetrace(),
  });
  return { jungle, clock };
}
function until(c, predicate, limit = 3000) {
  for (let at = c.clock.now + 1; at <= limit; at++) {
    c.clock.advanceTo(at);
    if (predicate(c.jungle)) return;
  }
  assert.fail("Unfinished jungle timing boundary");
}
function state(j) {
  return {
    state: j.snapshot(),
    memory: sha(j.memory.bytes),
    pixels: j.current ? sha(j.current) : null,
    inputs: j.inputs,
  };
}
test("jungle drawing holds publication until its work completes and uses the next retrace", () => {
  const c = fresh(),
    { jungle: j, clock } = c;
  until(c, (j) => j.wait.clock === "graphics");
  const first = j.lastDrawingWork;
  assert.equal(first.instructions - first.lineInstructions, 457285);
  assert.equal(first.lineInstructions, 5434);
  assert.equal(first.linePortWrites, 160);
  assert.equal(first.lines, 27);
  assert.equal(first.omittedLines, 0);
  assert.ok(
    Math.abs(first.milliseconds - (158.90033333333332 + 1.918)) < 1e-12,
  );
  const deadline = j.wait.until,
    before = state(j);
  clock.advanceTo(deadline - 0.001);
  assert.equal(j.wait.clock, "graphics");
  assert.equal(j.presentations, before.state.presentations);
  assert.equal(sha(j.current), before.pixels);
  until(c, (j) => j.frames === 2);
  assert.equal(j.tick, 89);
  assert.equal(j.retrace, 86);
  assert.equal(j.presentations, 15);
  const secondDeadline = j.wait.until;
  until(c, (j) => j.frames === 3);
  // The work ends before retrace98, which can finish this page. Independent
  // rounding from the previous driver event would add a spurious retrace.
  assert.equal(j.retrace, Math.ceil((secondDeadline * RETRACE_HZ) / 1000));
  assert.equal(j.retrace, 98);
  assert.equal(j.tick, 101);
});
test("jungle timing is invariant to browser catch-up batch size", () => {
  const fine = fresh(),
    coarse = fresh();
  for (let at = 8; at < 3200; at += 8) fine.clock.advanceTo(at);
  fine.clock.advanceTo(3200);
  coarse.clock.advanceTo(3200);
  assert.ok(fine.jungle.frames > 20);
  assert.deepEqual(state(coarse.jungle), state(fine.jungle));
});
test("hidden-page pause excludes elapsed time from an in-progress jungle draw", () => {
  const baseline = fresh(),
    paused = fresh();
  for (const c of [baseline, paused])
    until(c, (j) => j.wait.clock === "graphics");
  const elapsed = paused.clock.elapsed,
    work = state(paused.jungle);
  paused.clock.pauseDuration(10000);
  assert.equal(paused.clock.elapsed, elapsed);
  assert.deepEqual(state(paused.jungle), work);
  baseline.clock.advanceTo(2500);
  paused.clock.advanceTo(12500);
  assert.deepEqual(state(paused.jungle), state(baseline.jungle));
});
test("jungle timing checks reject a bypassed work deadline and invalid time", () => {
  const c = fresh();
  until(c, (j) => j.wait.clock === "graphics");
  c.jungle.wait.until = c.clock.elapsed; // isolated negative; production untouched
  until(c, (j) => j.frames === 2);
  assert.throws(
    () => assert.equal(c.jungle.retrace, 86),
    assert.AssertionError,
  );
  const invalid = fresh();
  until(invalid, (j) => j.wait.clock === "graphics");
  invalid.jungle.clock = () => NaN;
  assert.throws(
    () => invalid.clock.advanceTo(500),
    /Invalid or backwards jungle/,
  );
});
