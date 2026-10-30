// Bounded player-route research, not acceptance. Every invocation independently
// reconstructs startup->mountain from recorded DOM inputs; no machine/state restore.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  heldControlEvent,
  ordinaryMakeEvent,
  expeditionKeyEvent,
  mapKeyEvent,
} from "../src/game/keyboard-adapter.js";
const mode = process.argv[2] ?? "release-before-last";
assert.ok(["release-before-last", "legacy"].includes(mode));
const root =
  process.argv[3] ?? ".local/current-campaign-mountain-entry-replay-01";
const output = process.argv[4] ?? `.local/current-mountain-plans-01/${mode}`;
await mkdir(output, { recursive: false }).catch(async (e) => {
  if (e.code !== "ENOENT") throw e;
  await mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await mkdir(output);
});
const sha = (b) => createHash("sha256").update(b).digest("hex");
const sourceFiles = {};
for (const name of [
  "environment.json",
  "captured-events.json",
  "campaign-checkpoints.json",
  "timeline.json",
])
  sourceFiles[name] = sha(await readFile(`${root}/${name}`));
process.argv = [
  "node",
  "scripts/replay-hard-campaign.js",
  root,
  "--diagnose",
  "--through=mountain-entry",
];
const log = console.log;
let replay;
console.log = () => {};
try {
  replay = await import("./replay-hard-campaign.js");
} finally {
  console.log = log;
}
const { game, clock } = replay;
assert.equal(game.scene, "mountain");
assert.equal(game.mountain.frames, 0);
assert.equal(game.expeditionInput, "keyboard");
assert.equal(game.destinationInput, "keyboard");
const recipe = JSON.parse(await readFile("reference/mountain-ascent.json"));
const inputs = recipe.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
const keys = (byte) =>
  new Set([
    ...(byte & 64 ? ["Space"] : []),
    ...({
      1: ["ArrowUp"],
      3: ["ArrowRight"],
      5: ["ArrowDown"],
      7: ["ArrowLeft"],
    }[byte & 63] ?? []),
  ]);
let now = replay.replayTime,
  nextFrame = replay.replayFrameAt;
const physical = new Set(),
  held = new Set(),
  events = [],
  observations = [];
// Browser data-state is published after each8ms display callback, including
// driver/work progress between retraces. Observe at that same boundary.
const state = () => game.snapshot();
function controls() {
  clock.enqueue(heldControlEvent(held), now);
}
function key(key, pressed) {
  events.push({ time: now, key, pressed });
  if (pressed) held.add(key);
  else held.delete(key);
  controls();
  if (game.usesExpeditionKeyboard)
    clock.enqueue(expeditionKeyEvent(key, pressed), now);
  else if (game.scene === "map") clock.enqueue(mapKeyEvent(key, pressed), now);
  else if (pressed) clock.enqueue(ordinaryMakeEvent(key, held), now);
}
function step() {
  const at = now + 8;
  while (nextFrame <= at) {
    clock.advanceTo(nextFrame);
    for (const e of game.drainEffects())
      if (e.type === "flushControls") held.clear();
      else
        assert.ok(
          ["sound", "stopAudio"].includes(e.type),
          `Unsupported planning effect ${e.type}`,
        );
    nextFrame += 8;
  }
  now = at;
}
let used = 0;
for (let cursor = 0; cursor < inputs.length;) {
  const byte = inputs[cursor];
  if (state().scene !== "mountain") break;
  const next = keys(byte);
  for (const k of physical) if (!next.has(k)) key(k, false);
  for (const k of next) key(k, true);
  physical.clear();
  for (const k of next) physical.add(k);
  // Original mode0 consumes a release flag once, then clears it. Send the
  // external break before the last desired read, so the following read is neutral.
  if (mode === "release-before-last") {
    const following = keys(inputs[cursor + 1] ?? 0);
    for (const k of next)
      if (!following.has(k)) {
        key(k, false);
        physical.delete(k);
      }
  }
  const before = state().mountain.frames;
  for (
    let i = 0;
    i < 3000 &&
    state().scene === "mountain" &&
    state().mountain.frames === before;
    i++
  )
    step();
  if (state().scene !== "mountain" && state().mountain.frames === before) break;
  assert.equal(
    state().mountain.frames,
    before + 1,
    "Unfinished/skipped exploratory frame",
  );
  used++;
  if (used % 20 === 0 || state().scene !== "mountain" || used === inputs.length)
    observations.push({ used, requested: byte, at: now, state: state() });
  cursor++;
}
for (const k of physical) key(k, false);
for (let i = 0; i < 625 && state().scene === "mountain"; i++) step();
const result = {
  scope: "EXPLORATORY physical player route;not acceptance",
  replayRoot: root,
  replayArtifactHashes: sourceFiles,
  initialRecipe:
    "Fresh startup replay through mountain-entry;all preceding states compare exactly. No memory/actor/timer initialization from expected outputs.",
  mode,
  planned: inputs.length,
  used,
  events,
  observations,
  outcome: game.mountain.outcome,
  final: game.snapshot(),
  success:
    game.mountain.outcome?.code === 1 && game.scene === "expedition-result",
};
await writeFile(
  `${output}/result.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    mode,
    planned: inputs.length,
    used,
    scene: game.scene,
    outcome: game.mountain.outcome,
    success: result.success,
  }),
);
if (!result.success) process.exitCode = 2;
