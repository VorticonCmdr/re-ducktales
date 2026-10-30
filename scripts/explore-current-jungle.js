// Bounded player-route research, not acceptance. Every invocation independently
// reconstructs startup->jungle from recorded DOM inputs; no machine/state restore.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  heldControlEvent,
  ordinaryMakeEvent,
  expeditionKeyEvent,
  mapKeyEvent,
} from "../src/game/keyboard-adapter.js";
import { jungleVinePoint } from "../src/game/jungle-motion.js";
const delay = Number(process.argv[2] ?? 0);
assert.ok(Number.isInteger(delay) && delay >= 0 && delay <= 200);
const root = process.argv[3] ?? ".local/current-campaign-entry-replay-01";
const output =
  process.argv[4] ?? `.local/current-jungle-plans-02/delay-${delay}`;
const mode = process.argv[5] ?? "recipe";
assert.ok(
  [
    "recipe",
    "waypoint",
    "hard",
    "hard-no-prefix",
    "hard-fire",
    "hard-wait",
    "hard-bird",
    "hard-cross",
    "hard-vine",
  ].includes(mode),
);
const hard = mode.startsWith("hard");
const waypoint = mode === "waypoint";
await mkdir(output, { recursive: false }).catch(async (e) => {
  if (e.code !== "ENOENT") throw e;
  await mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await mkdir(output);
});
const toolSource = await readFile(new URL(import.meta.url));
await writeFile(`${output}/explorer-source.js`, toolSource);
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
  "--through=arrival",
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
assert.equal(game.scene, "jungle");
assert.equal(game.jungle.frames, 0);
assert.equal(game.expeditionInput, "keyboard");
assert.equal(game.destinationInput, "keyboard");
const recipe = JSON.parse(
  await readFile(
    hard
      ? "reference/security-campaign-inputs.json"
      : "reference/security-easy-campaign-inputs.json",
  ),
);
const original = recipe.jungle.flatMap((e) => Array(e.count).fill(e.byte));
assert.equal(game.difficulty, hard ? 2 : 0);
assert.ok(original.slice(0, hard ? 3 : 60).every((b) => b === 0));
const inputs = [
  ...Array(delay).fill(0),
  ...(hard
    ? mode === "hard-no-prefix"
      ? original.slice(3)
      : original
    : original.slice(60)),
];
if (mode === "hard-fire") inputs.splice(delay + 254, 20, ...Array(20).fill(64));
if (mode === "hard-wait") inputs.splice(delay + 254, 20, ...Array(40).fill(0));
const birdWaitStart = delay + 254,
  birdWaitEnd = birdWaitStart + 160;
if (mode === "hard-bird")
  inputs.splice(birdWaitStart, 20, ...Array(160).fill(0));
let sawPerchedBird = false;
const crossStart = delay + 254,
  crossEnd = crossStart + 400;
let sawMiddlePerch = false;
const crossing = mode === "hard-cross" || mode === "hard-vine";
if (crossing) inputs.splice(crossStart, 62, ...Array(400).fill(0));
const vineStart = crossEnd,
  vineEnd = vineStart + 400;
let lastVineDistance = Infinity,
  grabbedVine = false;
if (mode === "hard-vine") inputs.splice(vineStart, 34, ...Array(400).fill(0));
const finalRunEnd = vineEnd + 120,
  finalWaitEnd = finalRunEnd + 40;
if (mode === "hard-vine")
  inputs.splice(
    vineEnd,
    inputs.length - vineEnd,
    ...Array(120).fill(3),
    ...Array(40).fill(0),
    ...Array(40).fill(1),
  );
// Player waypoint at the left edge of the final platform: column21 on the
// original53-pixel grid. This observes this run's pose, not a golden checkpoint.
const downStart = delay + 109,
  downEnd = downStart + (waypoint ? 1200 : 722);
if (waypoint) inputs.splice(downStart, 722, ...Array(1200).fill(5));
if (waypoint)
  inputs.splice(
    downEnd,
    inputs.length - downEnd,
    ...Array(40).fill(1),
    ...Array(40).fill(3),
  );
let now = replay.replayTime,
  nextFrame = replay.replayFrameAt;
const physical = new Set(),
  held = new Set(),
  events = [],
  observations = [],
  inputTrace = [];
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
  let byte = inputs[cursor];
  if (crossing && cursor >= crossStart && cursor < crossEnd) {
    const actor = state().jungle,
      bird = game.jungle.memory.i(0x397e + 38 + 20);
    if (actor.x < 703) byte = bird === 14 ? 3 : 0;
    else if (actor.x < 738) {
      if (bird === 18) sawMiddlePerch = true;
      byte = sawMiddlePerch && bird === 14 ? 3 : 1;
    } else byte = 3;
  }
  if (mode === "hard-vine" && cursor >= vineStart && cursor < vineEnd) {
    const actor = state().jungle;
    if (actor.action === 8) {
      grabbedVine = true;
      byte = actor.x >= 896 && actor.y <= 48 ? 3 : 0;
    } else if (!grabbedVine && actor.action === 5) {
      const point = jungleVinePoint(game.jungle.memory, 2);
      const d = (actor.x + 15 - point.x) ** 2 + (actor.y + 24 - point.y) ** 2;
      byte = d < 260 && d < lastVineDistance ? 1 : 0;
      lastVineDistance = d;
    } else byte = 0;
  }
  if (state().scene !== "jungle") break;
  const next = new Set([
    ...(byte & 64 ? ["Space"] : []),
    ...({
      1: ["ArrowUp"],
      3: ["ArrowRight"],
      5: ["ArrowDown"],
      7: ["ArrowLeft"],
    }[byte & 63] ?? []),
  ]);
  for (const k of physical) if (!next.has(k)) key(k, false);
  for (const k of next) key(k, true); // Explicit external repeat makes.
  physical.clear();
  for (const k of next) physical.add(k);
  const before = state().jungle.frames;
  for (
    let i = 0;
    i < 3000 && state().scene === "jungle" && state().jungle.frames === before;
    i++
  )
    step();
  if (state().scene !== "jungle" && state().jungle.frames === before) break;
  assert.equal(
    state().jungle.frames,
    before + 1,
    "Unfinished/skipped exploratory frame",
  );
  used++;
  if (hard)
    inputTrace.push({
      used,
      requested: byte,
      consumed: game.jungle.inputs.at(-1)?.input,
      actor: game.jungle.snapshot(),
      birdAction: game.jungle.memory.i(0x397e + 38 + 20),
      support: {
        mounted: game.jungle.memory.i(0x8924),
        id: game.jungle.memory.i(0x882a),
        slope: game.jungle.memory.i(0x3a46),
        dx: game.jungle.memory.i(0x3a44),
      },
    });
  if (used % 20 === 0 || state().scene !== "jungle" || used === inputs.length)
    observations.push({ used, requested: byte, at: now, state: state() });
  if (
    waypoint &&
    cursor >= downStart &&
    cursor < downEnd &&
    state().jungle.x >= 1108
  )
    cursor = downEnd;
  else if (
    waypoint &&
    cursor >= downEnd &&
    cursor < downEnd + 40 &&
    state().jungle.y <= 96 &&
    state().jungle.action === 5
  )
    cursor = downEnd + 40;
  else if (
    mode === "hard-bird" &&
    cursor >= birdWaitStart &&
    cursor < birdWaitEnd
  ) {
    // Exploratory white-box observation of the currently rendered bird state,
    // not expected data or an environment timer/RNG provider. No memory writes.
    const bird = game.jungle.memory.i(0x397e + 38 + 20);
    if (bird === 18) sawPerchedBird = true;
    if (sawPerchedBird && bird !== 18) cursor = birdWaitEnd;
    else cursor++;
  } else if (
    crossing &&
    cursor >= crossStart &&
    cursor < crossEnd &&
    state().jungle.x >= 783 &&
    state().jungle.action === 5
  )
    cursor = crossEnd;
  else if (
    mode === "hard-vine" &&
    cursor >= vineStart &&
    cursor < vineEnd &&
    grabbedVine &&
    state().jungle.action === 5 &&
    state().jungle.x >= 895
  )
    cursor = vineEnd;
  else if (
    mode === "hard-vine" &&
    cursor >= vineEnd &&
    cursor < finalRunEnd &&
    state().jungle.x >= 1100 &&
    state().jungle.action === 5
  )
    cursor = finalRunEnd;
  else if (
    mode === "hard-vine" &&
    cursor >= finalRunEnd &&
    cursor < finalWaitEnd &&
    state().jungle.y <= 80 &&
    state().jungle.action === 5
  )
    cursor = finalWaitEnd;
  else cursor++;
}
for (const k of physical) key(k, false);
for (let i = 0; i < 625 && state().scene === "jungle"; i++) step();
const result = {
  scope: "EXPLORATORY physical player route;not acceptance",
  toolSourceSha256: sha(toolSource),
  replayRoot: root,
  replayArtifactHashes: sourceFiles,
  initialRecipe:
    "Fresh startup replay through first arrival;three preceding states compare exactly. No memory/actor/timer initialization from expected outputs.",
  delay,
  mode,
  controllerObservations:
    mode === "hard-bird" || mode === "hard-cross" || mode === "hard-vine"
      ? "Exploratory white-box player:current port bird/vine state selects controls. Not native input evidence;no expected values or memory writes."
      : "Own current scene/frame/pose observations;no expected values choose inputs.",
  waypoint,
  planned: inputs.length,
  used,
  events,
  observations,
  inputTrace,
  outcome: game.jungle.outcome,
  final: game.snapshot(),
  success:
    game.jungle.outcome?.code === 1 && game.scene === "expedition-result",
};
await writeFile(
  `${output}/result.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    delay,
    planned: inputs.length,
    used,
    scene: game.scene,
    outcome: game.jungle.outcome,
    success: result.success,
  }),
);
if (!result.success) process.exitCode = 2;
