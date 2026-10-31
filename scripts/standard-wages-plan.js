// Conditional player planning from a fully replayed browser prefix. This never
// restores a checkpoint or supplies expected state to the game. Any successful
// plan still needs real browser exploration and an independent browser replay.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fresh, archiveSource, checkSource } from "./lib/local-scenario-source.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
import { readEasyJunglePlan, jungleCases } from "./lib/easy-jungle-browser.js";

const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
assert.ok(process.argv.includes("--diagnose"), "Planning requires explicit diagnostic mode");
const root = await fresh(output), source = await archiveSource(root);
const logger = console.log;
let replay;
console.log = () => {};
try { replay = await import("./replay-hard-campaign.js"); }
finally { console.log = logger; }
const { game, replayAdvance: advance, replayEvent: event } = replay;
let now = replay.replayTime;
const events = [], points = [];
const state = async () => game.snapshot();
function input(type, key) {
  const e = { type, key, target: "game", time: now };
  events.push(e); event(e);
}
const page = { keyboard: {
  down: async (key) => input("keydown", key),
  up: async (key) => input("keyup", key),
}};
function step() { now += 8; advance(now); }
async function until(predicate) {
  for (let i = 0; i < 20000; i++) {
    const s = game.snapshot();
    if (s.diagnostic) throw Error(s.diagnostic);
    if (predicate(s)) return s;
    step();
  }
  throw Error("Unfinished Standard planning sequence: " + game.scene);
}
async function press(key) {
  input("keydown", key); input("keyup", key);
  advance(now += 100);
}
function note(name) {
  const s = game.snapshot(); points.push({ name, at: now, eventCount: events.length, state: s });
  console.log(name, JSON.stringify({ scene: s.scene, day: s.campaign.day, money: s.money,
    banked: s.campaign.banked, briefing: s.briefing, jungle: s.jungle && {
      frames: s.jungle.frames, x: s.jungle.x, y: s.jungle.y, lives: s.jungle.lives, outcome: s.jungle.outcome },
    mountain: s.mountain && { frames: s.mountain.frames, lives: s.mountain.lives, outcome: s.mountain.outcome } }));
}
async function settle() {
  for (let i = 0; i < 16; i++) {
    const scene = game.scene;
    if (!["expedition-result", "rival-report", "rival-claim", "visit-notice", "crash-repairs"].includes(scene)) return;
    note("dialogue-" + points.length);
    await page.keyboard.down("Space");
    await until((s) => s.scene !== scene);
    await page.keyboard.up("Space");
  }
  throw Error("Unfinished Standard planning dialogue");
}
async function depart(x, y) {
  assert.equal(game.scene, "map");
  const point = { type: "pointerdown", target: "game", key: null, x: x + 0.5, y: y + 0.5, time: now };
  events.push(point); event(point);
  const up = { ...point, type: "pointerup" }; events.push(up); event(up);
  advance(now += 100);
  await press("Space");
  await settle();
  await until((s) => s.scene === "departure");
  note("departure-" + points.length);
  await until((s) => s.scene === "flight");
  const trace = await explorePhysicalFlight({ page, state, until, policy: { altitude: [25, 40], climbHeading: 3 } });
  await writeFile(root + "/flight-" + points.length + ".json", JSON.stringify(trace) + "\n");
  await until((s) => s.scene !== "flight");
  note("flight-return-" + points.length);
  await settle();
}
async function button(target) {
  for (const type of ["pointerdown", "pointerup"]) {
    const e = { type, target, key: null, time: now };
    events.push(e); event(e);
  }
  advance(now += 100);
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
    const e = { type, target: "game", key: null, x: 212.5, y: 131.5, time: now };
    events.push(e); event(e);
  }
  advance(now += 100);
  await press("Space");
  await settle();
  if (fromOffice && game.scene === "map") {
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowRight");
    await until((s) => s.campaign.destination?.ready && s.campaign.choice === 1);
    await press("Space");
    await until((s) => s.scene !== "map");
    await settle();
  }
  assert.ok(["bank", "ending"].includes(game.scene), "Unfinished real bank trip");
  await finishBank();
}
const keys = (byte) => new Set([...(byte & 64 ? ["Space"] : []),
  ...({ 1: ["ArrowUp"], 3: ["ArrowRight"], 5: ["ArrowDown"], 7: ["ArrowLeft"] }[byte & 63] ?? [])]);
async function play(activity, stream) {
  let held = new Set();
  for (let i = 0; i < stream.length; i++) {
    if (game.scene !== activity) break;
    const next = keys(stream[i]), following = keys(stream[i + 1] ?? 0);
    for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
    for (const key of next) await page.keyboard.down(key);
    held = next;
    for (const key of [...held]) if (!following.has(key)) {
      await page.keyboard.up(key); held.delete(key);
    }
    const before = game[activity].frames;
    await until((s) => s.scene !== activity || s[activity].frames > before);
    if ((i + 1) % 40 === 0) note(activity + "-" + (i + 1));
  }
  for (const key of held) await page.keyboard.up(key);
  note(activity + "-plan-end");
}
let completed = false;
try {
  assert.equal(game.scene, "map");
  assert.equal(game.difficulty, 1);
  note("prefix");
  await depart(264, 129); // Great Outback,original jungle layout2,unclaimed at prefix.
  await until((s) => s.scene === "jungle" || s.scene === "map");
  assert.equal(game.scene, "jungle", "Normal loss/claim prevented jungle entry;inspect evidence");
  note("jungle-entry");
  const recipe = await readEasyJunglePlan(jungleCases.find((c) => c.variant === 2));
  await play("jungle", recipe.stream);
  await until((s) => s.scene !== "jungle");
  note("jungle-return");
  assert.equal(game.jungle.outcome.code, 1, "Authored player failed;not proof of a port defect");
  await settle();
  await depart(158, 124); // Lost World,original mountain layout0.
  await until((s) => s.scene === "mountain" || s.scene === "map");
  assert.equal(game.scene, "mountain");
  note("mountain-entry");
  const candidate = process.argv.find((a) => a.startsWith("--mountain-controls="))?.slice(20) ?? "easy";
  assert.ok(["easy", "hard"].includes(candidate), "Unknown authored mountain controls");
  const mountain = candidate === "hard"
    ? JSON.parse(await readFile("reference/hard-campaign-inputs.json")).mountain
    : JSON.parse(await readFile("reference/mountain-ascent.json"));
  await play("mountain", mountain.inputEvents.flatMap((e) => Array(e.count).fill(e.byte)));
  await until((s) => s.scene !== "mountain");
  note("mountain-return");
  assert.equal(game.mountain.outcome.code, 1, "Authored player failed;not proof of a port defect");
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
    assert.equal(typeof game.snapshot().ending.won, "boolean");
  }
  completed = true;
} finally {
  await writeFile(root + "/planning.json", JSON.stringify({ completed, accepted: false,
    scope: "Conditional carried simulation player exploration;not browser or native acceptance",
    dependency: "Original DOM prefix replayed from startup plus diagnostic100ms tail;existing authored player controls used as candidates only",
    sourceCommit: source.commit, events, points, final: game.snapshot() }, null, 2) + "\n");
  await checkSource(root, (p) => p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/") ||
    ["reference/build.json", "reference/mountain-ascent.json", "reference/hard-campaign-inputs.json", "reference/security-hard-expedition-inputs.json"].includes(p));
}
