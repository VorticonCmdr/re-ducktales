// Player-route planning only. Every candidate replays the complete verified
// departure; no game state, memory, random seeds or device clocks are injected.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tileObjects } from "../src/game/flight-objects.js";
const candidate = process.argv.find((a) => a.startsWith("--policy="))?.slice(9);
const band = candidate?.split(",").map(Number);
if (band)
  assert.ok(
    band.length === 3 &&
      band.every(Number.isFinite) &&
      band[0] >= 0 &&
      band[1] >= band[0] &&
      band[1] <= 139 &&
      [1, 2, 3].includes(band[2]),
  );
const entryManifest = JSON.parse(
  await readFile("reference/security-lightning-entry.json"),
);
process.argv = [
  "node",
  "scripts/replay-hard-campaign.js",
  entryManifest.artifactRoot,
  "--manifest=reference/security-lightning-entry.json",
];
const log = console.log;
console.log = () => {};
let game, clock, now, nextFrame;
try {
  ({
    game,
    clock,
    replayTime: now,
    replayFrameAt: nextFrame,
  } = await import("./replay-hard-campaign.js"));
} finally {
  console.log = log;
}
assert.equal(game.scene, "departure");
const initial = game.snapshot();
const profile = JSON.parse(
  await readFile("reference/lightning-flight-inputs.json"),
);
const codes = profile.events.flatMap(({ byte, count }) =>
  Array(count).fill(byte),
);
const physical = new Set(),
  actual = new Set(),
  flushes = [],
  observations = [];
function publish() {
  clock.enqueue(
    {
      type: "controls",
      fire: actual.has("Space"),
      direction: actual.has("ArrowDown")
        ? "down"
        : actual.has("ArrowUp")
          ? "up"
          : null,
    },
    now,
  );
}
function up(key) {
  physical.delete(key);
  actual.delete(key);
  publish();
}
function down(key) {
  physical.add(key);
  actual.add(key);
  publish();
  clock.enqueue(
    { type: key === "Space" ? "fire" : key.slice(5).toLowerCase() },
    now,
  );
}
function keys(code) {
  for (const k of [...physical]) up(k);
  if (code & 192) down("Space");
  if ((code & 63) === 1) down("ArrowUp");
  if ((code & 63) === 5) down("ArrowDown");
}
function step() {
  const at = now + 8;
  while (nextFrame <= at) {
    clock.advanceTo(nextFrame);
    for (const e of game.drainEffects())
      if (e.type === "flushControls") {
        if (game.scene === "flight" && game.flight.frames > 0)
          flushes.push({
            at: nextFrame,
            state: game.snapshot(),
            physical: [...physical],
            lastCollisionType: game.flight.memory.i(0x0fbe),
          });
        actual.clear();
      }
    nextFrame += 8;
  }
  now = at;
}
function until(predicate) {
  for (let n = 0; n < 20000; n++) {
    if (predicate()) return;
    step();
  }
  throw Error("Unfinished planning wait");
}
keys(codes[0]);
until(() => game.scene === "flight");
const stormObjects = [];
for (let tile = 0; tile < game.flight.memory.i(0x5ce6); tile++)
  for (const at of tileObjects(game.flight.memory, tile))
    if ([40, 42, 43].includes(game.flight.memory.b(at + 12)))
      stormObjects.push({
        tile,
        type: game.flight.memory.b(at + 12),
        x: game.flight.memory.i(at + 2),
        y: game.flight.memory.i(at + 4),
        width: game.flight.memory.i(at + 8),
        height: game.flight.memory.i(at + 10),
        phase: game.flight.memory.b(at + 13),
      });

const submitted = [];
for (let i = 0; i < (band ? 1500 : codes.length); i++) {
  const f = game.snapshot().flight;
  const desired = band
    ? f.tile > f.tiles - 5
      ? f.y < 135
        ? 15
        : 0
      : f.y > band[1]
        ? band[2]
        : f.y < band[0]
          ? 15
          : 0
    : 0;
  const delta = (desired - f.heading + 16) % 16;
  const code = band
    ? 192 | (f.speed < 4 || !delta ? 0 : delta < 8 ? 5 : 1)
    : codes[i];
  const before = game.flight.inputLog.length;
  keys(code);
  submitted.push(code);
  until(() => game.scene !== "flight" || game.flight.inputLog.length > before);
  observations.push({
    requested: code,
    at: now,
    flight: game.snapshot().flight,
    lastInput: game.flight.inputLog.at(-1),
  });
  if (
    game.scene !== "flight" ||
    ["landing", "crash", "return", "return-wait", "complete"].includes(
      game.flight.phase,
    ) ||
    flushes.some((f) => [42, 43].includes(f.lastCollisionType))
  )
    break;
}
if (!band) {
  const before = game.flight.inputLog.length;
  until(() => game.scene !== "flight" || game.flight.inputLog.length > before);
}
const result = {
  scope:
    "Conditional carried port player planning;not browser or native acceptance",
  initial,
  policy: band ?? null,
  submitted,
  stormObjects,
  observations,
  flushes,
  final: game.snapshot(),
  lastInput: game.flight.inputLog.at(-1),
};
await writeFile(
  `.local/security-lightning-planning-bank${entryManifest.bankTrips ?? 2}-${candidate ?? "legacy-111"}.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    used: observations.length,
    flushes: flushes.map((f) => ({
      at: f.at,
      type: f.lastCollisionType,
      frames: f.state.flight.frames,
      physical: f.physical,
    })),
    final: result.final.flight,
    lastInput: result.lastInput,
  }),
);
