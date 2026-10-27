import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseArchive } from "../src/assets.js";
import { TandyGameStream } from "../src/tandy-game.js";
import { flightEngineArgument } from "../src/game/flight.js";
import inputs from "../reference/tandy-game-inputs.json" with { type: "json" };

const bytes = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
test("persistent Tandy completion is stamped at its IRQ and is independent of output blocks", () => {
  const whole = new TandyGameStream(bytes),
    split = new TandyGameStream(bytes);
  for (const s of [whole, split])
    s.request({ sequence: 1, argument: 36, token: "cue" });
  const expected = whole.renderFrames(4096),
    actual = new Float32Array(4096);
  let at = 0;
  for (const count of [1, 127, 555, 3, 1024, 2386]) {
    actual.set(split.renderFrames(count), at);
    at += count;
  }
  assert.equal(at, 4096);
  assert.deepEqual(actual, expected);
  const events = whole.drainEvents();
  assert.deepEqual(split.drainEvents(), events);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "ack");
  assert.equal(events[0].busy, true);
  assert.equal(events[1].type, "complete");
  // Cue036's six original ticks; normal divider12 first fires at IRQ index11,
  // and tick6 at index71. This is an explicit provider phase, not original
  // machine alignment. Completion is inside the output block, not its end.
  assert.equal(events[1].frame, Math.round(((71 * 1365) / 1193182) * 44100));
  assert.equal(events[1].busy, false);
  assert.equal(whole.playback.frame, 4096);
  assert.equal(whole.playback.ticks, 6);
  assert.equal(whole.waiters.size, 0);
  assert.equal(whole.playback.driver.active, false);
});

test("Tandy game input rejects unsupported words and missing, repeated or duplicate requests", () => {
  const s = new TandyGameStream(bytes);
  assert.throws(() => s.request({ sequence: 2, argument: 36 }), /Unordered/);
  assert.throws(
    () => s.request({ sequence: 1, argument: 0xab }),
    /Unsupported Tandy sound/,
  );
  assert.throws(
    () => s.request({ sequence: 1, argument: 36, token: 1 }),
    /token/,
  );
  assert.equal(s.sequence, 0);
  s.request({ sequence: 1, argument: 36, token: "pending" });
  assert.throws(() => s.request({ sequence: 1, argument: 36 }), /Unordered/);
  assert.throws(
    () => s.request({ sequence: 2, argument: 36, token: "pending" }),
    /Duplicate/,
  );
  assert.throws(() => s.renderFrames(0), /Invalid Tandy frame/);
  s.request({ sequence: 2, argument: 0 });
  const events = s.drainEvents();
  assert.deepEqual(
    events.map((e) => e.type),
    ["ack", "complete", "ack"],
  );
  assert.equal(events[1].token, "pending");
  assert.equal(events[1].busy, false);
  assert.equal(s.waiters.size, 0);
  assert.equal(
    s.playback.frame,
    0,
    "requests must not invent time advancement",
  );
});

test("flight engine words preserve truncation, AX wrapping and the original high-bit control", () => {
  assert.equal(inputs.flightConversions.length, 11);
  for (const c of inputs.flightConversions)
    assert.equal(flightEngineArgument(c.speed), c.argument);
  for (const speed of [NaN, Infinity, -Infinity, 2147483648, -2147483649])
    assert.throws(
      () => flightEngineArgument(speed),
      /Unsupported flight engine/,
    );
});
