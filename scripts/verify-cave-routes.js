import assert from "node:assert/strict";
import { Cave } from "../src/game/cave.js";
import { Game } from "../src/game/application.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { readFile } from "node:fs/promises";
import { renderFlightPixels } from "../src/game/flight-raster.js";
// Independent environment scenarios. The controller reads the initial map and
// current room, never the expected outcome, RNG, enemy position or final money.
const directions = [
  ["up", 8, -8],
  ["right", 2, 1],
  ["down", 4, 8],
  ["left", 1, -1],
];
function directionTo(cave, target) {
  const s = cave.snapshot(),
    q = [[s.room, []]],
    seen = new Set([s.room]);
  while (q.length) {
    const [room, path] = q.shift();
    if (target === "goal" ? room === s.goal : !!(s.rooms[room] & 64))
      return path[0] ?? null;
    for (const [d, bit, delta] of directions) {
      const next = room + delta;
      if (
        !(s.rooms[room] & bit) ||
        next < 0 ||
        next >= 64 ||
        seen.has(next) ||
        (target === "goal" && s.rooms[next] & 64)
      )
        continue;
      seen.add(next);
      q.push([next, [...path, d]]);
    }
  }
  throw Error(`No ${target} route`);
}
function run(resources, scenario, events = null) {
  const cave = new Cave({ ...resources, ...scenario.start });
  const terminalCounts = { presentations: 0, partyDraws: 0 };
  const present = cave.present,
    party = cave.party;
  cave.present = function* (commands) {
    if (this.phase === scenario.status) terminalCounts.presentations++;
    yield* present.call(this, commands);
  };
  cave.party = function (...args) {
    if (this.phase === scenario.status) terminalCounts.partyDraws++;
    return party.apply(this, args);
  };
  const stream = [],
    frames = [],
    checkpoints = [];
  let consumed = 0,
    lastPresentation = 0;
  for (let step = 0; step < 10000 && !cave.outcome; step++) {
    let input = null;
    if (events) {
      while (events[consumed]?.step === step) {
        input = events[consumed++].controls;
        cave.setControls(input);
      }
      assert.ok(
        !events[consumed] || events[consumed].step > step,
        "late required event",
      );
    } else if (
      scenario.route !== "idle" &&
      cave.phase === "exploring" &&
      cave.wait?.clock === "driver"
    ) {
      const direction = directionTo(cave, scenario.route);
      input = { direction, fire: direction !== null };
      cave.setControls(input);
      stream.push({ step, controls: input });
    }
    cave.advanceTick();
    cave.advanceRetrace();
    if (cave.presentations !== lastPresentation) {
      assert.equal(
        cave.presentations,
        lastPresentation + 1,
        "skipped presentation",
      );
      // Render every presentation, including intermediate animation poses.
      const pixels = renderFlightPixels(
        cave.current,
        resources.entries,
        resources.font,
        "EXP.ARC",
      );
      assert.equal(pixels.length, 256000);
      frames.push(cave.phase);
      lastPresentation = cave.presentations;
    }
    checkpoints.push(cave.snapshot());
  }
  assert.ok(cave.outcome, "unfinished cave input/animation");
  if (events)
    assert.equal(consumed, events.length, "unconsumed required events");
  return { outcome: cave.outcome, frames, stream, checkpoints, terminalCounts };
}
function check(actual, scenario) {
  assert.equal(actual.outcome.status, scenario.status);
  assert.equal(actual.outcome.code, scenario.status === "treasure" ? 1 : 0);
  assert.ok(
    actual.frames.includes(scenario.status),
    "terminal animation was skipped",
  );
  assert.ok(actual.checkpoints.length > 0);
  // Counts from original overlay6 terminal loops, including the unpresented
  // capture draw. These are static assertions, not original replay fixtures.
  const expected = {
    captured: [18, 3],
    pit: [35, 10],
    treasure: [15, 15],
    "torch-expired": [21, 4],
  }[scenario.status];
  assert.deepEqual(
    [actual.terminalCounts.presentations, actual.terminalCounts.partyDraws],
    expected,
    "terminal presentation/RNG-call count",
  );
}
function verifyFullPassages(resources) {
  const c = new Cave({
    ...resources,
    currentDrive: 2,
    variant: 0,
    difficulty: 0,
    seed: 0,
    money: 0,
  });
  let steps = 0,
    shown = 0;
  const advance = () => {
    assert.ok(++steps < 3000, "unfinished C-drive passage sequence");
    assert.equal(c.outcome, null, "unexpected C-drive terminal path");
    c.advanceTick();
    c.advanceRetrace();
    if (c.presentations !== shown) {
      assert.equal(c.presentations, shown + 1);
      renderFlightPixels(
        c.current,
        resources.entries,
        resources.font,
        "EXP.ARC",
      );
      shown = c.presentations;
    }
  };
  while (c.phase !== "exploring") advance();
  for (const [direction, target] of [
    ["right", 18],
    ["down", 26],
    ["left", 25],
    ["up", 17],
  ]) {
    const room = c.room;
    c.setControls({ fire: true, direction });
    while (c.room === room) advance();
    assert.equal(c.room, target, "wrong C-drive room transition");
    c.setControls({ fire: false, direction: null });
    while (c.phase !== "exploring") advance();
  }
  assert.equal(c.snapshot().money, 150, "new-room rewards or revisit latch");
  assert.equal(c.snapshot().torch, 5);
  assert.equal(c.memory.b(0x5d2b), 0);
  assert.ok(shown > 100, "C-drive passage animation skipped");
}
export async function verifyCaveRoutes(resources) {
  verifyFullPassages(resources);
  const scenarios = [
    {
      id: "capture",
      start: { variant: 0, difficulty: 0, seed: 0, money: 0, currentDrive: 0 },
      route: "idle",
      status: "captured",
    },
    {
      id: "pit",
      start: { variant: 0, difficulty: 0, seed: 0, money: 0, currentDrive: 0 },
      route: "pit",
      status: "pit",
    },
    {
      id: "treasure",
      start: { variant: 0, difficulty: 0, seed: 0, money: 0, currentDrive: 0 },
      route: "goal",
      status: "treasure",
    },
    {
      id: "expiry",
      start: { variant: 3, difficulty: 0, seed: 0, money: 0, currentDrive: 0 },
      route: "idle",
      status: "torch-expired",
    },
  ];
  assert.deepEqual(
    scenarios.map((s) => s.id),
    ["capture", "pit", "treasure", "expiry"],
    "required cave cases",
  );
  for (const scenario of scenarios) {
    const actual = run(resources, scenario);
    check(actual, scenario);
    // Replay only the independent input stream from the same initial state.
    const replay = run(resources, scenario, actual.stream);
    check(replay, scenario);
    assert.deepEqual(
      replay.checkpoints,
      actual.checkpoints,
      `${scenario.id} closed-loop divergence`,
    );
    assert.deepEqual(replay.frames, actual.frames);
    assert.throws(() =>
      check({ ...actual, outcome: { ...actual.outcome, code: 2 } }, scenario),
    );
    assert.throws(
      () =>
        check(
          {
            ...actual,
            terminalCounts: {
              ...actual.terminalCounts,
              presentations: actual.terminalCounts.presentations - 1,
            },
          },
          scenario,
        ),
      /terminal presentation/,
    );
    if (scenario.id === "capture")
      assert.throws(
        () =>
          check(
            {
              ...actual,
              terminalCounts: { ...actual.terminalCounts, partyDraws: 2 },
            },
            scenario,
          ),
        /terminal presentation/,
      );
    if (scenario.id === "treasure") {
      assert.ok(actual.stream.length > 0);
      const altered = actual.stream.map((e) => ({
        ...e,
        controls: { direction: null, fire: false },
      }));
      assert.throws(
        () => check(run(resources, scenario, altered), scenario),
        "omitted movement must fail",
      );
    }
    // Conditional application entry, followed by the real Cave and campaign
    // result code. It does not claim an office/flight/original campaign replay.
    if (["treasure", "pit"].includes(scenario.id)) {
      const locations = parseLocations(
        parseArchive(await readFile("game/LOC.ARC"), "LOC.ARC"),
      );
      const loot = parseLoot(
        parseArchive(await readFile("game/LOOT.ARC"), "LOOT.ARC"),
      );
      const g = new Game({
        locations,
        loot,
        expeditionResources: {
          ...resources,
          currentDrive: scenario.start.currentDrive,
        },
      });
      g.seed = scenario.start.seed;
      g.campaign.location = 1;
      g.briefing = { activity: "cave", variant: scenario.start.variant };
      g.startExpedition();
      let event = 0;
      for (let step = 0; step < 10000 && g.scene === "cave"; step++) {
        while (actual.stream[event]?.step === step)
          g.input({ type: "controls", ...actual.stream[event++].controls });
        g.advanceTick();
        g.advanceRetrace();
      }
      assert.equal(
        event,
        actual.stream.length,
        "unconsumed application controls",
      );
      assert.equal(g.scene, "expedition-result");
      const won = scenario.id === "treasure";
      const value = won ? loot[g.campaign.locations[1].treasure - 1].value : 0;
      assert.equal(g.money, actual.outcome.money + value);
      assert.equal(
        g.campaign.day,
        won ? 2 : 1,
        "failure spends its day after the report",
      );
      assert.equal(g.campaign.locations[1].playerCollected, false);
      const delay = won ? 280 : 140;
      for (let i = 0; i < delay - 1; i++) g.advanceTick();
      assert.equal(g.scene, "expedition-result", "report ended too soon");
      g.advanceTick();
      assert.equal(g.scene, "map");
      assert.equal(g.campaign.day, 2);
      assert.equal(g.campaign.locations[1].playerCollected, won);
      const money = g.money;
      for (let i = 0; i < 10; i++) g.advanceTick();
      assert.equal(g.money, money, "duplicate expedition reward");
    }
  }
  // A device event is required before an enabled sound-dependent outcome returns.
  const s = scenarios[0],
    c = new Cave({
      ...resources,
      ...s.start,
      audioEnabled: true,
      audioScope: "boundary",
    });
  let token;
  for (let i = 0; i < 1000; i++) {
    c.advanceTick();
    c.advanceRetrace();
    for (const e of c.drainEvents()) if (e.type === "sound") token = e.token;
  }
  assert.equal(c.phase, "captured");
  assert.equal(c.outcome, null);
  c.setAudioStatus("stale-token", false);
  c.advanceTick();
  assert.equal(c.outcome, null, "stale device event released wait");
  c.setAudioStatus(token, false);
  c.advanceTick();
  assert.equal(c.outcome.status, "captured");
  console.log(
    "Cave: four C-drive passage directions/revisit; 4 independent shortened-path outcomes; exact closed-loop input replays; all presentations rendered; outcome, omitted-movement and stale-audio negative controls. No original ending comparison claimed.",
  );
}
