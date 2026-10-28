import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Flight } from "../src/game/flight.js";
import { Game } from "../src/game/application.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import build from "../reference/build.json" with { type: "json" };
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/application.js";

async function supported(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    build.files[name].sha256,
  );
  assert.equal(b.length, build.files[name].bytes);
  return b;
}
const resources = {
  image: unpackImage(await supported("DUCKTALE.EXE")),
  entries: parseArchive(await supported("PLANE.ARC")),
};
function flightGame(options = {}) {
  const g = new Game();
  g.scene = "flight";
  g.flight = new Flight({
    ...resources,
    days: 1,
    day: 1,
    racing: false,
    difficulty: 0,
    seed: 1960,
    money: 0,
    ...options,
    pollInput: () => g.pollFlightSystemInput(),
    flushInput: () => g.flushFlightInput(),
  });
  return g;
}

test("a naturally generated lightning strike flushes pending global input before the flight reader", () => {
  // Normal first Easy departure's actual seed; no actor/object memory writes.
  // This authored controller encounters the generated tile17 strike at frame121.
  const g = flightGame({ seed: 54448 }),
    f = g.flight;
  let driver = 1000 / DRIVER_HZ,
    retrace = 1000 / RETRACE_HZ;
  let lastFrame = -1,
    queued = false,
    struck = false;
  for (let now = 0; now < 20000 && !struck; now += 8) {
    const s = f.snapshot();
    if (s.frames !== lastFrame) {
      const desired = s.y > 15 ? 2 : s.y < 0 ? 15 : 0;
      const delta = (desired - s.heading + 16) % 16;
      g.input({
        type: "controls",
        fire: true,
        direction: s.speed < 4 || !delta ? null : delta < 8 ? "down" : "up",
      });
      lastFrame = s.frames;
    }
    while (Math.min(driver, retrace) <= now) {
      if (driver <= retrace) {
        g.advanceTick();
        driver += 1000 / DRIVER_HZ;
      } else {
        g.advanceRetrace();
        retrace += 1000 / RETRACE_HZ;
      }
      if (!queued && f.frames === 121 && f.memory.i(0x0fbe) !== 43) {
        assert.equal(f.wait.clock, "retrace");
        g.input({ type: "pause" });
        assert.equal(g.pendingFlightSystemKeys.size, 1);
        queued = true;
      }
      if (f.memory.i(0x0fbe) === 43) {
        struck = true;
        break;
      }
    }
  }
  assert.ok(queued, "required pause event was not queued before the collision");
  assert.ok(struck, "required natural lightning collision was not reached");
  assert.equal(f.frames, 121);
  assert.equal(f.memory.i(0x0fbc), 17);
  assert.equal(
    g.systemOverlay,
    null,
    "lightning must discard P before the input reader",
  );
  assert.equal(g.pendingFlightSystemKeys.size, 0);
  assert.deepEqual(f.controls, { fire: false, direction: null });
  assert.equal(f.inputLog.at(-1).code, 0);
  assert.equal(f.memory.i(0x5466), 0);
  assert.equal(f.memory.i(0x8a9c), 0);
});

test("flight pauses only at its input reader and advances device clocks while actors stay frozen", () => {
  const g = flightGame(),
    f = g.flight;
  g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  g.advanceRetrace();
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(f.wait.clock, "input");
  const bytes = Uint8Array.from(f.memory.bytes),
    frames = f.frames,
    tick = f.tick,
    retrace = f.retrace;
  for (let i = 0; i < 1000; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.deepEqual(f.memory.bytes, bytes);
  assert.equal(f.frames, frames);
  assert.equal(f.tick, tick + 1000);
  assert.equal(f.retrace, retrace + 1000);
  g.input({ type: "controls", fire: true, direction: "down" });
  g.input({ type: "pause" });
  for (let i = 0; i < 6; i++) g.advanceTick();
  assert.equal(f.frames, frames);
  g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.deepEqual(f.controls, { fire: false, direction: null });
  assert.equal(f.inputLog.at(-1).code, 0);
  // Its independent six-tick deadline expired during the pause, so physics
  // runs immediately instead of adding a fresh six-tick wait after resume.
  assert.equal(f.frames, frames + 1);
  assert.equal(f.wait.clock, "retrace");
});

test("cancelled flight quit resumes its pending input and restart drops deferred keys", () => {
  const g = flightGame(),
    f = g.flight;
  g.input({ type: "quit" });
  g.advanceRetrace();
  assert.equal(g.systemOverlay.kind, "quit");
  for (let i = 0; i < 20; i++) g.advanceTick();
  const frames = f.frames;
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(f.frames, frames + 1);
  g.input({ type: "pause" });
  assert.equal(g.pendingFlightSystemKeys.size, 1);
  g.input({ type: "restart" });
  assert.equal(g.pendingFlightSystemKeys.size, 0);
  assert.equal(g.flight, null);
});

// Conditional routine boundary tests. These enter finish directly; they do
// not claim a natural flight, crash or original runtime replay.
function atReturnWait() {
  const g = flightGame(),
    f = g.flight;
  f.setControls({ fire: true, direction: "down" });
  g.input({ type: "pause" });
  g.input({ type: "quit" });
  f.iterator = f.finish("crashed");
  f.resume();
  f.advanceRetrace();
  f.advanceRetrace();
  assert.equal(f.phase, "return-wait");
  assert.equal(g.pendingFlightSystemKeys.size, 0);
  assert.deepEqual(f.controls, { fire: false, direction: null });
  return { g, f };
}
test("flight final wait flushes inputs and requires twenty seven-tick polls", () => {
  const { f } = atReturnWait(),
    presentations = f.presentations;
  for (let i = 0; i < 139; i++) {
    f.advanceTick();
    assert.equal(f.outcome, null);
  }
  f.advanceTick();
  assert.equal(f.phase, "complete");
  assert.equal(f.outcome.status, "crashed");
  assert.equal(f.presentations, presentations);
});

test("dialog input flushes discard a tapped Fire from the pending return poll", () => {
  for (const kind of ["pause", "quit"]) {
    const { g, f } = atReturnWait();
    g.input({ type: "fire" });
    g.input({ type: kind });
    for (let i = 0; i < 7; i++) g.advanceTick();
    assert.equal(g.systemOverlay.kind, kind);
    if (kind === "pause") {
      for (let i = 0; i < 35; i++) g.advanceTick();
      g.input({ type: "pause" });
      for (let i = 0; i < 7; i++) g.advanceTick();
    } else g.input({ type: "quit-no" });
    assert.equal(g.systemOverlay, null);
    assert.equal(f.outcome, null);
    assert.equal(f.returnFireRequested, false);
    assert.equal(f.wait.clock, "driver");
  }
});

test("new Fire skips flight return only at its next poll and special scenes flush deferred controls", () => {
  const { g, f } = atReturnWait();
  g.input({ type: "fire" });
  for (let i = 0; i < 6; i++) {
    f.advanceTick();
    assert.equal(f.outcome, null);
  }
  f.advanceTick();
  assert.equal(f.outcome.status, "crashed");
  const other = flightGame();
  other.input({ type: "pause" });
  other.input({ type: "toggle-sound" });
  other.flight.setControls({ fire: true, direction: "up" });
  other.flight.clearSpecialInput();
  assert.equal(other.pendingFlightSystemKeys.size, 0);
  assert.deepEqual(other.flight.controls, { fire: false, direction: null });
});
