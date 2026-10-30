import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { nextRandom } from "../src/game/integer.js";
import { Departure } from "../src/game/departure.js";
import { DepartureScene } from "../src/game/departure-scene.js";
const o = await originalGame();
function setup(present = () => {}, beforeTravel = () => {}) {
  const game = new Game({
    locations: o.game.locations,
    loot: o.game.loot,
    expeditionResources: o.game.expeditionResources,
    flightResources: o.game.flightResources,
  });
  const scheduler = new Scheduler(game, 0, { present });
  // Explicit conditional campaign boundary. Browser acceptance earns entry.
  game.scene = "map";
  game.campaign.point(37, 33);
  beforeTravel(game);
  game.travel(game.campaign.selected);
  const scene = game.departureScene,
    prepared = game.departure;
  const until = (fn) => {
    for (let i = 0; i < 3000; i++) {
      if (fn()) return;
      scheduler.advanceTo(scheduler.now + 1);
    }
    throw Error("Unfinished departure scene");
  };
  return { game, scheduler, scene, prepared, until };
}
test("departure automatically starts flight after both25-retrace transitions without Fire", () => {
  const seen = [];
  const a = setup((g) => {
    if (g.scene === "departure") seen.push(g.departureScene.snapshot());
  });
  assert.equal(a.game.scene, "departure");
  assert.equal(a.scene.rngDraws, 0);
  a.until(() => a.game.scene === "flight");
  assert.equal(a.scene.consumedRetraces, 50);
  assert.equal(a.scene.completedWork, 2);
  assert.equal(a.scene.rngDraws, 2);
  assert.deepEqual(a.scene.outcome, a.prepared.flightRequest);
  for (const kind of ["wipe", "reveal"])
    assert.deepEqual(
      [
        ...new Set(
          seen
            .filter((s) => s.transition?.kind === kind)
            .map((s) => s.transition.band),
        ),
      ],
      [0, 1, 2, 3, 4],
    );
  assert.equal(seen.at(-1).phase, "handoff");
  assert.equal(a.game.flight.startDay, 1);
  assert.equal(a.game.flight.days, a.prepared.days);
  assert.equal(a.game.campaign.location, 35);
});
test("Fire taps during departure never advance its source program or RNG early", () => {
  const run = (withFire) => {
    const a = setup();
    if (withFire)
      for (const at of [1, 12, 64, 149, 330, 400])
        a.scheduler.enqueue({ type: "fire" }, at);
    a.scheduler.advanceTo(1000);
    assert.equal(a.scheduler.events.length, 0);
    return {
      state: a.game.snapshot(),
      memory: a.game.flight.memory.bytes,
      source: a.scene.snapshot(),
    };
  };
  assert.deepEqual(run(true), run(false));
});
test("departure commits the first RNG draw after copy/flush and the second after reveal", () => {
  const a = setup(),
    commits = [],
    flushes = [];
  const flush = a.scene.flushInput,
    seed = a.scene.onSeed;
  a.scene.flushInput = () => {
    flushes.push({
      seed: a.game.seed,
      reads: a.scene.rngDraws,
      ret: a.scene.consumedRetraces,
    });
    flush();
  };
  a.scene.onSeed = (value) => {
    commits.push({ value, old: a.game.seed, ret: a.scene.consumedRetraces });
    seed(value);
  };
  a.until(() => a.game.scene === "flight");
  assert.deepEqual(flushes, [
    { seed: a.prepared.seedBefore, reads: 0, ret: 25 },
  ]);
  assert.deepEqual(commits, [
    {
      value: nextRandom(a.prepared.seedBefore),
      old: a.prepared.seedBefore,
      ret: 25,
    },
    { value: a.prepared.seed, old: nextRandom(a.prepared.seedBefore), ret: 50 },
  ]);
  assert.equal(a.scene.seed, a.prepared.seed);
});
test("departure flush drops early system keys; reveal keys wait for the first flight reader", () => {
  const a = setup();
  a.game.input({ type: "pause" });
  assert.equal(a.game.systemOverlay, null);
  a.until(() => a.scene.phase === "reveal");
  assert.equal(a.game.pendingFlightSystemKeys.size, 0);
  a.game.input({ type: "pause" });
  assert.equal(a.game.systemOverlay, null);
  a.until(() => !!a.game.systemOverlay);
  assert.equal(a.game.scene, "flight");
  assert.equal(a.game.systemOverlay.kind, "pause");
  assert.equal(a.game.flight.frames, 1);
  assert.equal(a.game.flight.inputLog.length, 0);
  assert.equal(a.scene.consumedRetraces, 50);
});
test("departure and flight handoff are invariant to clock catch-up batch size", () => {
  const small = setup(),
    large = setup();
  for (let at = 1; at <= 1000; at++) small.scheduler.advanceTo(at);
  large.scheduler.advanceTo(1000);
  assert.deepEqual(small.game.snapshot(), large.game.snapshot());
  assert.deepEqual(small.scene.snapshot(), large.scene.snapshot());
  assert.deepEqual(
    small.game.flight.memory.bytes,
    large.game.flight.memory.bytes,
  );
});
test("hidden-page pause preserves a pending departure work budget", () => {
  const a = setup(),
    b = setup();
  a.scheduler.advanceTo(1);
  b.scheduler.advanceTo(1);
  a.scheduler.pauseDuration(5000);
  a.scheduler.advanceTo(6000);
  b.scheduler.advanceTo(1000);
  assert.deepEqual(a.game.snapshot(), b.game.snapshot());
  assert.deepEqual(a.scene.snapshot(), b.scene.snapshot());
});
test("Restart at the final reveal publication cancels its same-time overlay continuation", () => {
  let a;
  a = setup((g) => {
    if (g.scene === "departure" && g.departureScene.phase === "handoff")
      a.scheduler.enqueue({ type: "restart" }, a.scheduler.elapsed);
  });
  a.scheduler.advanceTo(1000);
  assert.equal(a.game.scene, "title");
  assert.equal(a.game.flight, null);
  assert.equal(a.game.departureScene, null);
  assert.equal(a.scene.outcome, null);
  assert.equal(a.scheduler.events.length, 0);
  assert.equal(a.game.nextSimulationWake(), null);
});
test("departure requires original resources and rejects early continuations and invalid clocks", () => {
  const a = setup();
  assert.throws(
    () => a.game.startDepartureFlight(),
    /Unexpected departure continuation/,
  );
  assert.throws(
    () => a.scene.advanceGraphics(),
    /Unexpected departure work boundary/,
  );
  assert.throws(
    () => a.scene.setClock(null),
    /Invalid departure clock provider/,
  );
  a.scene.clock = () => NaN;
  assert.throws(() => a.scene.time(), /Invalid departure simulation clock/);
  const opts = {
    prepared: new Departure({
      from: 35,
      target: 25,
      days: 1,
      flags: 8,
      difficulty: 0,
      seed: 41725,
    }),
    entries: [],
    onSeed: () => {},
    flushInput: () => {},
    registerRace: () => {},
  };
  assert.throws(
    () => new DepartureScene(opts),
    /Missing original departure portrait/,
  );
  assert.throws(
    () => new DepartureScene({ ...opts, clock: 1 }),
    /Invalid departure clock provider/,
  );
});

test("a racing departure registers Glomgold's source route only after the reveal", () => {
  const a = setup(
    () => {},
    (game) => {
      game.seed = game.campaign.seed = 41725;
      game.campaign.rival.location = 0;
    },
  );
  assert.equal(a.prepared.racing, true);
  a.until(() => a.scene.phase === "reveal");
  assert.equal(a.game.campaign.rival.location, 0);
  assert.equal(a.scene.raceRoute, null);
  a.until(() => a.game.scene === "flight");
  assert.equal(a.game.campaign.rival.location, 35);
  assert.deepEqual(a.scene.raceRoute, { from: 35, target: a.prepared.target });
  assert.equal(a.game.campaign.rival.day, 1);
  assert.equal(a.game.campaign.rival.money, 0);
});
