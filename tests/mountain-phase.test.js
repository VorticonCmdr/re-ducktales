import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { originalGame } from "./helpers/original-game.js";
import { Mountain } from "../src/game/mountain.js";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { RETRACE_HZ } from "../src/game/timing.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { renderMountainPixels } from "../src/game/mountain-scene.js";
const { image, archives } = await originalGame();
const resources = {
  image,
  entries: archives.get("MT.ARC"),
  mainEntries: archives.get("MAIN.ARC"),
};
const initial = { variant: 0, difficulty: 0, day: 4, money: 0, seed: 11324 };
const T = 1000 / RETRACE_HZ;
const sha = (b) => createHash("sha256").update(b).digest("hex");
// Independent environment: launch at a declared absolute time;fixed display/
// driver providers and input schedule. No expected state selects an input.
function harness(launchAt = 7) {
  let m = null,
    clockProvider;
  const pages = [];
  const adapter = {
    setSimulationClock: (c) => {
      clockProvider = c;
    },
    nextSimulationWake: () =>
      m ? (m.wait?.clock === "graphics" ? m.wait.until : null) : launchAt,
    advanceSimulationWake: () => {
      if (m) {
        m.advanceGraphics();
        return;
      }
      m = new Mountain({ ...resources, ...initial, clock: clockProvider });
      let shown = 0;
      Object.defineProperty(m, "presentations", {
        get: () => shown,
        set: (value) => {
          assert.equal(value, shown + 1, "Skipped mountain page");
          assert.ok(
            clockProvider() > m.lastDrawingWork.until,
            "Publication preceded source graphics completion/retrace edge",
          );
          shown = value;
          pages.push({
            at: clockProvider(),
            state: m.snapshot(),
            pixels: sha(
              renderMountainPixels(
                m.current,
                m.entries,
                resources.mainEntries[42].data,
                m.memory,
              ),
            ),
          });
        },
      });
    },
    advanceTick: () => m?.advanceTick(),
    advanceRetrace: () => m?.advanceRetrace(),
    input: (event) => {
      assert.ok(m, "Input before declared launch");
      m.setControls(event);
    },
  };
  const clock = new Scheduler(adapter);
  return {
    clock,
    pages,
    get mountain() {
      return m;
    },
  };
}
test("mountain off-phase drawing waits for the first later display edge", () => {
  const zero = harness(0),
    offset = harness(7);
  zero.clock.advanceTo(80);
  offset.clock.advanceTo(80);
  assert.equal(zero.pages[0].at, T + T + T);
  assert.equal(offset.pages[0].at, T + T + T + T);
  assert.equal(offset.mountain.lastDrawingWork.startedAt, offset.pages[0].at);
  assert.equal(zero.pages[0].pixels, offset.pages[0].pixels);
  assert.equal(zero.mountain.inputs.length, 0);
  assert.equal(offset.mountain.inputs.length, 0);
});
test("mountain scheduler catch-up preserves input,state and rendered pages", () => {
  function run(chunked) {
    const c = harness(7);
    for (const [at, direction] of [
      [150, "right"],
      [350, "left"],
      [420, null],
    ])
      c.clock.enqueue({ fire: false, direction }, at);
    if (chunked) for (let at = 1; at <= 500; at++) c.clock.advanceTo(at);
    else c.clock.advanceTo(500);
    assert.ok(c.pages.length > 5);
    assert.ok(c.mountain.inputs.length > 3);
    assert.equal(c.clock.events.length, 0);
    assert.equal(c.clock.consumed.length, 3);
    return {
      pages: c.pages,
      state: c.mountain.snapshot(),
      memory: sha(c.mountain.memory.bytes),
      inputs: c.mountain.inputs,
      events: c.clock.consumed,
    };
  }
  assert.deepEqual(run(false), run(true));
});
test("mountain rejects an early drawing wake and waits out a coincident retrace", () => {
  let now = 0;
  const m = new Mountain({ ...resources, ...initial, clock: () => now });
  assert.equal(m.wait.clock, "graphics");
  const until = m.wait.until;
  now = until - 1;
  assert.throws(() => m.advanceGraphics(), /before deadline/);
  assert.equal(m.presentations, 0);
  now = until;
  m.advanceRetrace();
  assert.equal(m.wait.clock, "retrace");
  assert.equal(m.presentations, 0);
  assert.throws(() => m.advanceGraphics(), /outside drawing work/);
  now += T;
  m.advanceRetrace();
  assert.equal(m.presentations, 1);
  assert.ok(m.current);
});
test("mountain rejects backwards or rebased active clocks", () => {
  let now = 7;
  const m = new Mountain({ ...resources, ...initial, clock: () => now });
  const until = m.wait.until;
  m.setClock(() => now);
  assert.equal(m.wait.until, until);
  assert.throws(() => m.setClock(() => 0), /Cannot rebase/);
  assert.throws(() => m.setClock(null), /Invalid mountain clock/);
  now = 6;
  assert.throws(() => m.advanceTick(), /backwards/);
  assert.throws(
    () => new Mountain({ ...resources, ...initial, clock: () => NaN }),
    /Invalid or backwards/,
  );
});
test("application routes mountain drawing deadlines to its scheduler", () => {
  const g = new Game({
    locations: parseLocations(archives.get("LOC.ARC")),
    loot: parseLoot(archives.get("LOOT.ARC")),
    expeditionResources: { ...resources, mountainEntries: resources.entries },
  });
  const clock = new Scheduler(g);
  clock.advanceTo(7);
  g.seed = initial.seed;
  g.campaign.day = 4;
  g.campaign.location = 1;
  g.briefing = { activity: "mountain", variant: 0 };
  g.startExpedition();
  assert.equal(g.scene, "mountain");
  const until = g.mountain.wait.until;
  assert.equal(g.mountain.lastDrawingWork.startedAt, 7);
  assert.equal(g.nextSimulationWake(), until);
  g.systemOverlay = {};
  assert.equal(g.nextSimulationWake(), null);
  assert.throws(() => g.advanceSimulationWake(), /Unexpected simulation work/);
  g.systemOverlay = null;
  clock.advanceTo(until);
  assert.equal(g.mountain.wait.clock, "retrace");
  assert.equal(g.mountain.presentations, 0);
  clock.advanceTo(T + T + T + T);
  assert.equal(g.mountain.presentations, 1);
  assert.equal(g.nextSimulationWake(), g.mountain.wait.until);
});
test("phase checker rejects the previous rounded-retrace scheduling policy", () => {
  const original = Mountain.prototype.present;
  try {
    Mountain.prototype.present = function* (commands) {
      const iterator = original.call(this, commands);
      const work = iterator.next();
      assert.equal(work.value.clock, "graphics");
      yield { clock: "retrace", remaining: this.lastDrawingWork.retraces };
    };
    const c = harness(7);
    assert.throws(
      () => c.clock.advanceTo(80),
      /Publication preceded source graphics/,
    );
  } finally {
    Mountain.prototype.present = original;
  }
});
