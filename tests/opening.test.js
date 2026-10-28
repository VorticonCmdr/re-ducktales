import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Opening } from "../src/game/opening.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
const resources = {
  image: unpackImage(await readFile("game/DUCKTALE.EXE")),
  entries: parseArchive(await readFile("game/MAIN.ARC")),
  seed: 0,
};
function finish(o) {
  for (let i = 0; i < 5000 && !o.outcome; i++) {
    o.advanceTick();
    o.advanceRetrace();
  }
  assert.ok(o.outcome, "Unfinished opening");
}
test("opening initial controls reach the first original guard before music or presentation", () => {
  const o = new Opening({ ...resources, audioEnabled: true });
  assert.equal(o.inputs.length, 0);
  o.input({ type: "fire" });
  finish(o);
  assert.equal(o.inputs.length, 1);
  assert.equal(o.presentations, 0);
  assert.equal(o.rngCalls, 0);
  assert.deepEqual(o.drainEvents(), [{ type: "sound", id: 0 }]);
});
test("opening reveal latches Fire but still presents all eleven source rectangles", () => {
  let reads = 0;
  const o = new Opening({
    ...resources,
    readInput: () => (++reads === 5 ? 192 : 0),
  });
  finish(o);
  assert.equal(reads, 15);
  assert.deepEqual(
    o.boundaries.map((b) => b.inset),
    [80, 72, 64, 56, 48, 40, 32, 24, 16, 8, 0],
  );
  assert.equal(o.boundaries[1].skip, true);
  assert.equal(o.outcome.status, "skipped");
  assert.equal(o.seed, 0);
});
test("opening driver waits and retraces are separate and blocked clocks do not consume input", () => {
  const o = new Opening(resources);
  o.advanceTick();
  assert.equal(o.wait.clock, "retrace");
  for (let i = 0; i < 100; i++) o.advanceTick();
  assert.equal(o.presentations, 0);
  o.advanceRetrace();
  o.advanceRetrace();
  assert.equal(o.display.inset, 80);
  assert.equal(o.wait.remaining, 2);
  const reads = o.inputs.length;
  o.advanceBlockedTick();
  o.advanceBlockedRetrace();
  assert.equal(o.wait.remaining, 2);
  assert.equal(o.inputs.length, reads);
  o.advanceTick();
  assert.equal(o.boundaries.length, 0);
  o.advanceTick();
  assert.equal(o.boundaries[0].inset, 80);
});
test("opening rejects unsupported external values at their consumption boundary", () => {
  assert.throws(
    () => new Opening({ ...resources, seed: 65536 }),
    /initial seed/,
  );
  const invalid = new Opening({ ...resources, readInput: () => 256 });
  assert.throws(() => invalid.advanceTick(), /input byte/);
  const invalidPoll = new Opening({ ...resources, pollInput: () => undefined });
  assert.throws(() => invalidPoll.advanceTick(), /input-poll result/);
  assert.throws(
    () => new Opening(resources).input({ type: "invented" }),
    /Unsupported opening input/,
  );
});
