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
  let cave,
    consumed = 0;
  const stream = [];
  cave = new Cave({
    ...resources,
    ...scenario.start,
    pollInput: () => {
      const ordinal = cave.inputs.length + 1;
      let controls;
      if (events) {
        const event = events[consumed++];
        assert.equal(event?.input, ordinal, "Unfinished cave source input");
        controls = event.controls;
      } else {
        const direction =
          ordinal === 1 || scenario.route === "idle"
            ? null
            : directionTo(cave, scenario.route);
        controls = { direction, fire: direction !== null };
        stream.push({ input: ordinal, controls });
      }
      cave.setControls(controls);
      return true;
    },
  });
  const terminalCounts = { presentations: 0, partyDraws: 0 };
  const present = cave.present,
    party = cave.party;
  cave.present = function* (commands, options) {
    if (this.phase === scenario.status) terminalCounts.presentations++;
    yield* present.call(this, commands, options);
    observe();
  };
  cave.party = function (...args) {
    if (this.phase === scenario.status) terminalCounts.partyDraws++;
    return party.apply(this, args);
  };
  const frames = [],
    checkpoints = [];
  let lastPresentation = 0;
  const observe = () => {
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
  };
  // Watchdog only; every publication is observed,including flip-to-wipe
  // transitions within the same callback. No input or clock is skipped.
  for (let step = 0; step < 15000 && !cave.outcome; step++) {
    cave.advanceTick();
    observe();
    cave.advanceRetrace();
    observe();
    checkpoints.push(cave.snapshot());
  }
  assert.ok(
    cave.outcome,
    "unfinished cave input/animation " +
      scenario.id +
      ": " +
      JSON.stringify(cave.snapshot()),
  );
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
export function verifyFullPassages(resources, CaveClass = Cave) {
  class ObservedCave extends CaveClass {
    *present(commands, options) {
      yield* super.present(commands, options);
      // The last exit flip and the first entry wipe can publish in the same
      // retrace callback. Observe the completed flip before its caller resumes.
      observe();
    }
  }
  const c = new ObservedCave({
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
    assert.ok(++steps < 6000, "unfinished C-drive passage sequence");
    assert.equal(c.outcome, null, "unexpected C-drive terminal path");
    c.advanceTick();
    observe();
    c.advanceRetrace();
    observe();
  };
  const observe = () => {
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
    const torch = c.snapshot().torch;
    const moneyBefore = c.snapshot().money;
    c.setControls({ fire: true, direction });
    while (c.room === room) advance();
    assert.equal(c.room, target, "wrong C-drive room transition");
    assert.equal(
      c.memory.i(0x8eb2),
      1,
      "passage entry flag must precede exit animation",
    );
    assert.equal(
      c.snapshot().torch,
      torch,
      "torch advanced before exit animation finished",
    );
    assert.equal(
      c.snapshot().money,
      moneyBefore,
      "room reward preceded entry animation",
    );
    assert.equal(
      c.phase,
      "entering",
      "passage must remain busy after room assignment",
    );
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
        /Unfinished cave source input/,
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
      const originalPoll = g.cave.pollInput;
      g.cave.pollInput = () => {
        if (!originalPoll()) return false;
        const input = actual.stream[event++];
        assert.equal(
          input?.input,
          g.cave.inputs.length + 1,
          "Unfinished application cave input",
        );
        g.input({ type: "controls", ...input.controls });
        return true;
      };
      for (let step = 0; step < 10000 && g.scene === "cave"; step++) {
        g.advanceTick();
        g.advanceRetrace();
      }
      assert.equal(
        event,
        actual.stream.length,
        "unconsumed application controls",
      );
      assert.equal(g.scene, "expedition-result");
      const presentation = g.resultPresentation;
      for (let step = 0; step < 10000 && g.resultPresentation; step++) {
        g.advanceTick();
        g.advanceRetrace();
      }
      assert.equal(g.resultPresentation, null, "unfinished award presentation");
      if (presentation) assert.equal(presentation.consumedRetraces, 75);
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
      if (g.scene === "rival-report") {
        assert.deepEqual(g.pendingCampaignAction, { type: "map" });
        // The real report now has stripe/retrace work before its280 driver
        // polls. Both external clocks must finish;this is a conditional
        // application check,not native elapsed-time or audio acceptance.
        for (let i = 0; i < 2000 && g.scene === "rival-report"; i++) {
          g.advanceTick();
          g.advanceRetrace();
        }
        assert.equal(g.rivalReport, null, "unfinished rival report");
      }
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
    for (const e of c.drainEvents())
      if (e.type === "audio-query") token = e.token;
  }
  assert.equal(c.phase, "captured");
  assert.equal(c.outcome, null);
  c.setAudioStatus("stale-token", false);
  c.advanceTick();
  assert.equal(c.outcome, null, "stale device event released wait");
  c.setAudioStatus(token, false);
  c.resumeAudioStatus();
  assert.equal(c.outcome.status, "captured");
  console.log(
    "Cave: four C-drive passage directions/revisit; 4 independent shortened-path outcomes; exact closed-loop input replays; all presentations rendered; outcome, omitted-movement and stale-audio negative controls. No original ending comparison claimed.",
  );
}
