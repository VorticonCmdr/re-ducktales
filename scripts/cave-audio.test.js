// Conditional component boundaries, not original-machine or campaign replays.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { Cave } from "../src/game/cave.js";
import { caveEndings } from "../src/game/cave-endings.js";
const { game } = await originalGame();
function fixture(audioEnabled = false, used = false) {
  let now = 0;
  const c = new Cave({
    ...game.expeditionResources,
    variant: 0,
    difficulty: 0,
    seed: 0,
    money: 0,
    currentDrive: 0,
    audioEnabled,
    hasAudioDevice: () => used,
    clock: () => now,
  });
  const events = [];
  function step() {
    if (c.wait?.clock === "graphics") {
      now = c.wait.until;
      c.advanceGraphics();
    } else if (c.wait?.clock === "retrace") c.advanceRetrace();
    else if (c.wait?.clock === "driver") c.advanceTick();
    else throw Error("Unexpected component wait: " + c.wait?.clock);
    events.push(...c.drainEvents());
  }
  return { c, events, step };
}
function ready(f) {
  for (let i = 0; i < 1000 && f.c.phase !== "exploring"; i++) f.step();
  assert.ok(f.c.current);
  f.events.length = 0;
  return f;
}
for (const reason of ["treasure", "captured", "pit"])
  for (const enabled of [false, true])
    test(`${reason}: global audio wait, guarded reset, enabled=${enabled}`, () => {
      const { c, events, step } = ready(fixture(enabled, true));
      // Explicit conditional terminal entry; no claim about reaching it in play.
      c.iterator = caveEndings.finish.call(c, reason);
      c.resume();
      for (let i = 0; i < 1000 && c.wait?.clock !== "audio"; i++) step();
      assert.equal(c.wait.clock, "audio");
      assert.equal(c.audioBusy, null);
      assert.equal(c.outcome, null);
      const query = events.filter((e) => e.type === "audio-query");
      assert.equal(query.length, 1);
      assert.equal(
        events.some((e) => e.type === "sound"),
        enabled,
      );
      const token = query[0].token;
      c.setAudioStatus("stale", false);
      assert.equal(c.audioBusy, null);
      assert.throws(() => c.resumeAudioStatus(), /idle status/);
      c.setAudioStatus(token, true);
      c.setAudioEnabled(false);
      for (let i = 0; i < 20; i++) {
        c.advanceTick();
        c.advanceRetrace();
      }
      assert.equal(c.audioBusy, true, "mute cannot invent completion");
      assert.equal(
        c.outcome,
        null,
        "timers cannot release a driver-status spin",
      );
      c.setAudioStatus(token, false);
      const tick = c.tick;
      c.resumeAudioStatus();
      assert.equal(c.tick, tick, "status consumption adds no driver tick");
      assert.equal(c.outcome.status, reason);
      assert.deepEqual(
        c.drainEvents(),
        [],
        "muted common return must not reset",
      );
    });
test("known unused provider returns without a query; enabled common return requests zero", () => {
  for (const enabled of [false, true]) {
    const { c, events, step } = ready(fixture(enabled));
    c.iterator = caveEndings.finish.call(c, "captured");
    c.resume();
    for (let i = 0; i < 1000 && !c.outcome; i++) step();
    assert.equal(c.outcome.status, "captured");
    assert.equal(
      events.some((e) => e.type === "audio-query"),
      false,
    );
    assert.equal(events.at(-1)?.id === 0, enabled);
  }
});
test("room entry cues once, redraws silently; initial reset follows minimap work", () => {
  const { c, step, events } = fixture(true);
  assert.deepEqual(c.drainEvents(), []);
  step();
  assert.deepEqual(
    events.map((e) => e.id),
    [0],
  );
  for (let i = 0; i < 1000 && c.inputs.length < 3; i++) step();
  assert.ok(c.inputs.length >= 3);
  assert.equal(events.filter((e) => e.id >= 0x4d && e.id <= 0x51).length, 1);
});
test("room cue uses signed distance thresholds and accessible-pit priority", () => {
  for (const [distance, expected] of [
    [-1, 0x51],
    [0, 0x51],
    [1, 0x51],
    [2, 0x50],
    [3, 0x50],
    [4, 0x4f],
    [5, 0x4f],
    [6, 0x4e],
    [32767, 0x4e],
  ]) {
    for (const pit of [false, true]) {
      const { c, step, events } = fixture(true);
      c.memory.bytes.fill(0, 0x5a42, 0x5ac2);
      c.memory.i(0x4d32, 9);
      c.memory.i(0x4e08, distance);
      if (pit) {
        c.memory.b(0x5a42 + 18, 2);
        c.memory.b(0x5a42 + 20, 64);
      }
      c.iterator = c.scene(true);
      c.resume();
      step();
      assert.deepEqual(
        events.map((e) => e.id),
        [pit ? 0x4d : expected],
      );
      assert.equal(c.wait.clock, "graphics", "cue precedes final cache copy");
    }
  }
});
test("invalid device provider fails where the terminal consumes it", () => {
  const { c } = fixture();
  c.hasAudioDevice = () => 1;
  assert.throws(() => c.waitAudio().next(), /audio-device result/);
  assert.throws(() => c.setAudioStatus("x", 1), /audio status/);
});
