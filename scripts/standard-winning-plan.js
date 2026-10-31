// Conditional player planning from a fully replayed browser prefix. This never
// restores a checkpoint or supplies expected state to the game. Any successful
// plan still needs real browser exploration and an independent browser replay.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
} from "./lib/local-scenario-source.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
import { planCaveVariant } from "./lib/easy-cave-variants.js";

const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
assert.ok(
  process.argv.includes("--diagnose"),
  "Planning requires explicit diagnostic mode",
);
const root = await fresh(output),
  source = await archiveSource(root);
const logger = console.log;
let replay;
console.log = () => {};
try {
  replay = await import("./replay-hard-campaign.js");
} finally {
  console.log = logger;
}
const { game, replayAdvance: advance, replayEvent: event } = replay;
let now = replay.replayTime;
const events = [],
  points = [];
const state = async () => game.snapshot();
function input(type, key) {
  const e = { type, key, target: "game", time: now };
  events.push(e);
  event(e);
}
const page = {
  keyboard: {
    down: async (key) => input("keydown", key),
    up: async (key) => input("keyup", key),
  },
};
function step() {
  now += 8;
  advance(now);
}
async function until(predicate) {
  for (let i = 0; i < 20000; i++) {
    const s = game.snapshot();
    if (s.diagnostic) throw Error(s.diagnostic);
    if (predicate(s)) return s;
    step();
  }
  throw Error("Unfinished Standard winning planning sequence: " + game.scene);
}
async function press(key) {
  input("keydown", key);
  input("keyup", key);
  advance((now += 100));
}
function note(name) {
  const s = game.snapshot();
  points.push({ name, at: now, eventCount: events.length, state: s });
  console.log(
    name,
    JSON.stringify({
      scene: s.scene,
      day: s.campaign.day,
      money: s.money,
      banked: s.campaign.banked,
      briefing: s.briefing,
      jungle: s.jungle && {
        frames: s.jungle.frames,
        x: s.jungle.x,
        y: s.jungle.y,
        lives: s.jungle.lives,
        outcome: s.jungle.outcome,
      },
      mountain: s.mountain && {
        frames: s.mountain.frames,
        lives: s.mountain.lives,
        outcome: s.mountain.outcome,
      },
    }),
  );
}
async function settle() {
  for (let i = 0; i < 16; i++) {
    const scene = game.scene;
    if (
      ![
        "expedition-result",
        "rival-report",
        "rival-claim",
        "visit-notice",
        "crash-repairs",
      ].includes(scene)
    )
      return;
    note("dialogue-" + points.length);
    await page.keyboard.down("Space");
    await until((s) => s.scene !== scene);
    await page.keyboard.up("Space");
  }
  throw Error("Unfinished Standard winning planning dialogue");
}
async function depart(x, y) {
  assert.equal(game.scene, "map");
  const point = {
    type: "pointerdown",
    target: "game",
    key: null,
    x: x + 0.5,
    y: y + 0.5,
    time: now,
  };
  events.push(point);
  event(point);
  const up = { ...point, type: "pointerup" };
  events.push(up);
  event(up);
  advance((now += 100));
  await press("Space");
  await settle();
  await until((s) => s.scene === "departure");
  note("departure-" + points.length);
  await until((s) => s.scene === "flight");
  const trace = await explorePhysicalFlight({
    page,
    state,
    until,
    policy: { altitude: [25, 40], climbHeading: 3 },
  });
  await writeFile(
    root + "/flight-" + points.length + ".json",
    JSON.stringify(trace) + "\n",
  );
  await until((s) => s.scene !== "flight");
  note("flight-return-" + points.length);
  await settle();
}
async function button(target) {
  for (const type of ["pointerdown", "pointerup"]) {
    const e = { type, target, key: null, time: now };
    events.push(e);
    event(e);
  }
  advance((now += 100));
}
async function finishBank() {
  if (game.scene !== "bank") return;
  note("bank-" + points.length);
  await page.keyboard.down("Space");
  await until((s) => s.scene !== "bank");
  await page.keyboard.up("Space");
  await settle();
}
async function bankTrip() {
  assert.equal(game.scene, "map");
  const fromOffice = game.campaign.location === 35;
  for (const type of ["pointerdown", "pointerup"]) {
    const e = {
      type,
      target: "game",
      key: null,
      x: 212.5,
      y: 131.5,
      time: now,
    };
    events.push(e);
    event(e);
  }
  advance((now += 100));
  await press("Space");
  await settle();
  if (fromOffice && game.scene === "map") {
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowRight");
    await until(
      (s) => s.campaign.destination?.ready && s.campaign.choice === 1,
    );
    await press("Space");
    await until((s) => s.scene !== "map");
    await settle();
  }
  assert.ok(
    ["bank", "ending"].includes(game.scene),
    "Unfinished real bank trip",
  );
  await finishBank();
}
let completed = false;
try {
  assert.ok(["map", "expedition-result"].includes(game.scene));
  assert.equal(game.difficulty, 1);
  note("prefix");
  await settle();
  const targets = (
    process.argv.find((a) => a.startsWith("--targets="))?.slice(10) ?? "9,30,21"
  )
    .split(",")
    .map(Number);
  for (const target of targets) {
    const location = game.campaign.locations[target];
    assert.ok(
      location && location.flags & 8,
      "Requested target is not an original cave",
    );
    assert.equal(location.playerCollected, false);
    assert.equal(location.rivalCollected, false);
    console.log(
      "Target",
      JSON.stringify({
        target,
        name: location.name,
        value: game.loot[location.treasure - 1].value,
        day: game.campaign.day,
        rival: game.campaign.rival,
      }),
    );
    await depart(location.x, location.y);
    await until(
      (s) => s.scene === "cave" || s.scene === "map" || s.scene === "ending",
    );
    assert.equal(
      game.scene,
      "cave",
      "Natural claim/loss/deadline prevented planned cave;not proof of a port defect",
    );
    note("cave-entry-" + target);
    for (let move = 0; move < 48 && game.scene === "cave"; move++) {
      await until((s) => s.scene !== "cave" || s.cave.phase === "exploring");
      if (game.scene !== "cave") break;
      const live = game.cave.snapshot();
      const map = live.rooms.map((cell) => cell & ~16);
      map[live.room] |= 16;
      // Player navigation only:avoid the currently observed enemy and its
      // adjacent rooms. This never changes the simulation's map or enemy.
      for (const room of [
        live.enemy,
        live.enemy - 8,
        live.enemy + 8,
        ...((live.enemy & 7) > 0 ? [live.enemy - 1] : []),
        ...((live.enemy & 7) < 7 ? [live.enemy + 1] : []),
      ])
        if (room >= 0 && room < 64) map[room] |= 64;
      assert.ok(
        !(map[live.goal] & 64),
        "Player cannot safely approach the observed enemy at goal",
      );
      const plan = planCaveVariant(map, game.briefing.variant),
        e = plan.events[1];
      const old = live.room,
        key = {
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
        }[e.controls.direction];
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "cave" || s.cave.room !== old);
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
      note("cave-room-" + target + "-" + game.cave.room);
      if (move === 47 && game.scene === "cave")
        throw Error("Player route exceeded48 moves");
    }
    await until((s) => s.scene !== "cave");
    note("cave-return-" + target);
    assert.equal(
      game.cave.outcome.code,
      1,
      "Authored cave route failed;not proof of a port defect",
    );
    await settle();
  }
  if (process.argv.includes("--finish")) {
    await settle();
    await bankTrip();
    for (let trip = 0; trip < 8 && game.scene !== "ending"; trip++) {
      await button("back");
      await settle();
      await finishBank();
      if (game.scene === "ending") break;
      await until((s) => s.scene === "office");
      note("office-" + points.length);
      await button("map");
      await until((s) => s.scene !== "office");
      await until((s) => s.scene !== "office-departure");
      await settle();
      assert.equal(game.scene, "map");
      await bankTrip();
    }
    await until((s) => s.scene === "ending" && s.ending.ready);
    note("ending");
    assert.equal(
      game.snapshot().ending.won,
      true,
      "Player strategy did not beat the rival",
    );
  }
  completed = true;
} finally {
  await writeFile(
    root + "/planning.json",
    JSON.stringify(
      {
        completed,
        accepted: false,
        scope:
          "Conditional Standard winning player exploration;not browser or native acceptance",
        dependency:
          "Original DOM prefix replayed from startup plus diagnostic100ms tail;existing authored player controls used as candidates only",
        sourceCommit: source.commit,
        events,
        points,
        final: game.snapshot(),
      },
      null,
      2,
    ) + "\n",
  );
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/") ||
      [
        "reference/build.json",
        "reference/mountain-ascent.json",
        "reference/hard-campaign-inputs.json",
        "reference/security-hard-expedition-inputs.json",
      ].includes(p),
  );
}
