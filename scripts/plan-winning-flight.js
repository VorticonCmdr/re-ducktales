// Conditional controller experiment, never browser acceptance. Replays real
// inputs from startup; expected checkpoints check state but never initialize it.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fresh, archiveSource, checkSource } from "./lib/local-scenario-source.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
const arg = (name) => process.argv.find((a) => a.startsWith("--" + name + "="))?.slice(name.length + 3);
assert.ok(arg("through") && process.argv.includes("--diagnose"));
const root = await fresh(arg("output")), source = await archiveSource(root);
// replay-hard-campaign takes its capture as argv[2]. Keep all named arguments.
process.argv.splice(2, 0, arg("capture"));
const log = console.log;
let replay;
try { console.log = () => {}; replay = await import("./replay-hard-campaign.js"); }
finally { console.log = log; }
const { game, replayAdvance: advance, replayEvent: event } = replay;
let now = replay.replayTime;
const events = [];
const state = async () => game.snapshot();
async function until(predicate) {
  for (let n = 0; n < 30000; n++) {
    const s = await state();
    assert.equal(s.diagnostic, null);
    if (predicate(s)) return s;
    advance(now += 8);
  }
  throw Error("Unfinished conditional flight experiment");
}
function input(type, key) {
  const e = { type, key, target: "game", time: now };
  events.push(e); event(e);
}
const page = { keyboard: { down: async (key) => input("keydown", key), up: async (key) => input("keyup", key) } };
const policy = { altitude: [25, 40], climbHeading: 3,
  minimumTurnSpeed: Number(arg("minimum-turn-speed") ?? 4) };
let result = { completed: false, accepted: false };
try {
  await until((s) => s.scene === "flight");
  const trace = await explorePhysicalFlight({ page, state, until, policy });
  await until((s) => s.scene !== "flight");
  await checkSource(root, (p) => p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"));
  await writeFile(root + "/controls.json", JSON.stringify(events, null, 2) + "\n");
  await writeFile(root + "/flight.json", JSON.stringify(trace) + "\n");
  result = { completed: true, accepted: false, nativeComparison: false,
    scope: "Conditional controller candidate after independently replayed startup inputs;real browser and independent replay still required",
    sourceCommit: source.commit, capture: arg("capture"), through: arg("through"), policy,
    events: events.length, outcome: (await state()).flight.outcome };
} finally { await writeFile(root + "/result.json", JSON.stringify(result, null, 2) + "\n"); }
console.log(JSON.stringify(result));
