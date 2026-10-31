// Conditional player candidate,not browser acceptance or original-game replay.
// All state comes from startup inputs; no checkpoint, RNG or money injection.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
} from "./lib/local-scenario-source.js";
import { continueWinningCampaign } from "./lib/winning-browser-player.js";
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith("--" + name + "="))
    ?.slice(name.length + 3);
assert.ok(
  process.argv.includes("--diagnose") && arg("through") === "dialogue-127",
);
const root = await fresh(arg("output")),
  source = await archiveSource(root);
process.argv.splice(2, 0, arg("capture"));
let replay;
const log = console.log;
try {
  console.log = () => {};
  replay = await import("./replay-hard-campaign.js");
} finally {
  console.log = log;
}
const { game, replayAdvance: advance, replayEvent: event } = replay;
let now = replay.replayTime;
const events = [],
  points = [],
  state = async () => game.snapshot();
function emit(e) {
  const actual = { ...e, time: now };
  events.push(actual);
  event(actual);
}
const page = {
  keyboard: {
    down: async (key) => emit({ type: "keydown", key, target: "game" }),
    up: async (key) => emit({ type: "keyup", key, target: "game" }),
  },
  locator: (target) => ({
    click: async () => {
      for (const type of ["pointerdown", "pointerup"])
        emit({ type, key: null, target: target.slice(1) });
      advance((now += 100));
    },
  }),
};
async function until(predicate) {
  for (let n = 0; n < 30000; n++) {
    const s = await state();
    assert.equal(s.diagnostic, null);
    if (predicate(s)) return s;
    advance((now += 8));
  }
  throw Error("Unfinished Novay finish candidate:" + game.scene);
}
async function press(key) {
  await page.keyboard.down(key);
  await page.keyboard.up(key);
  advance((now += 100));
}
async function point(x, y) {
  for (const type of ["pointerdown", "pointerup"])
    emit({ type, target: "game", key: null, x: x + 0.5, y: y + 0.5 });
  advance((now += 100));
}
async function settle() {
  for (let n = 0; n < 16; n++) {
    const s = await state();
    if (
      ![
        "expedition-result",
        "rival-report",
        "rival-claim",
        "visit-notice",
      ].includes(s.scene)
    )
      return;
    if (s.expeditionResult?.presentation) {
      await until((v) => !v.expeditionResult?.presentation);
      continue;
    }
    await page.keyboard.down("Space");
    await until((v) => v.scene !== s.scene);
    await page.keyboard.up("Space");
  }
  throw Error("Unfinished Novay dialogue");
}
async function observe(name) {
  points.push({
    name,
    at: now,
    eventCount: events.length,
    state: await state(),
  });
  console.log(
    name,
    JSON.stringify({
      scene: game.scene,
      day: game.campaign.day,
      money: game.money,
      banked: game.campaign.banked,
      rivalBanked: game.campaign.rival.banked,
    }),
  );
}
let result = { completed: false, accepted: false, nativeComparison: false };
try {
  const final = await continueWinningCampaign({
    page,
    state,
    until,
    press,
    point,
    settle,
    observe,
    root,
    locations: game.campaign.locations,
    afterMountain: true,
    caveTargets: [],
    bonusNovay: true,
  });
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/"),
  );
  result = {
    completed: true,
    accepted: false,
    nativeComparison: false,
    sourceCommit: source.commit,
    scope:
      "Conditional extra Novay mountain after replayed startup through dialogue-127;actual browser and independent replay still required",
    inputs: events.length,
    checkpoints: points.length,
    ending: final.ending,
  };
} finally {
  for (const [file, value] of Object.entries({
    "result.json": result,
    "controls.json": events,
    "checkpoints.json": points,
  }))
    await writeFile(root + "/" + file, JSON.stringify(value, null, 2) + "\n");
}
console.log(JSON.stringify(result));
