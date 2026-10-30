// Bounded player research from startup-replayed inputs,never a memory restore.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  heldControlEvent,
  ordinaryMakeEvent,
  mapKeyEvent,
  expeditionKeyEvent,
} from "../src/game/keyboard-adapter.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
const [root, boundary, output, lowText, highText, climbText] =
  process.argv.slice(2);
assert.ok(
  root && boundary && output,
  "SETUP: root,boundary,output,low,high,climb required",
);
const policy = {
  altitude: [Number(lowText), Number(highText)],
  climbHeading: Number(climbText),
};
assert.ok(
  policy.altitude.every(Number.isFinite) &&
    policy.altitude[0] >= 0 &&
    policy.altitude[1] >= policy.altitude[0] &&
    policy.altitude[1] <= 139,
);
assert.ok([1, 2, 3].includes(policy.climbHeading));
await mkdir(output, { recursive: false }).catch(async (e) => {
  if (e.code !== "ENOENT") throw e;
  await mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await mkdir(output);
});
const source = await readFile(new URL(import.meta.url));
await writeFile(`${output}/explorer-source.js`, source);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const prefixHashes = {};
for (const n of [
  "environment.json",
  "captured-events.json",
  "campaign-checkpoints.json",
  "timeline.json",
])
  prefixHashes[n] = sha(await readFile(`${root}/${n}`));
process.argv = [
  "node",
  "scripts/replay-hard-campaign.js",
  root,
  "--diagnose",
  `--through=${boundary}`,
];
const logger = console.log;
let replay;
const prefixLog = [];
console.log = (x) => prefixLog.push(x);
try {
  replay = await import("./replay-hard-campaign.js");
} finally {
  console.log = logger;
}
const { game, clock } = replay;
assert.equal(game.scene, "departure");
assert.equal(game.expeditionInput, "keyboard");
let now = replay.replayTime,
  nextFrame = replay.replayFrameAt;
const held = new Set(),
  events = [];
const state = async () => game.snapshot();
function step() {
  const at = now + 8;
  while (nextFrame <= at) {
    clock.advanceTo(nextFrame);
    for (const e of game.drainEffects())
      if (e.type === "flushControls") held.clear();
      else
        assert.ok(
          ["sound", "stopAudio"].includes(e.type),
          `Unsupported flight effect ${e.type}`,
        );
    nextFrame += 8;
  }
  now = at;
  assert.equal(game.diagnostic, null);
}
async function until(predicate) {
  for (let i = 0; i < 20000; i++) {
    const s = await state();
    if (predicate(s)) return s;
    step();
  }
  throw Error(`Unfinished flight experiment:${game.scene}`);
}
function key(key, pressed) {
  events.push({ time: now, key, pressed });
  if (pressed) held.add(key);
  else held.delete(key);
  clock.enqueue(heldControlEvent(held), now);
  if (game.usesExpeditionKeyboard)
    clock.enqueue(expeditionKeyEvent(key, pressed), now);
  else if (game.scene === "map") clock.enqueue(mapKeyEvent(key, pressed), now);
  else if (pressed) clock.enqueue(ordinaryMakeEvent(key, held), now);
}
const page = {
  keyboard: { down: async (k) => key(k, true), up: async (k) => key(k, false) },
};
let trace = [],
  failure = null;
try {
  await until((s) => s.scene === "flight");
  trace = await explorePhysicalFlight({ page, state, until, policy });
  await until(
    (s) =>
      !["departure", "flight", "crash-repairs", "expedition-briefing"].includes(
        s.scene,
      ),
  );
} catch (e) {
  failure = e.stack;
}
const result = {
  scope: "EXPLORATORY carried player flight;not browser or native acceptance",
  sourceSha256: sha(source),
  prefix: { root, boundary, hashes: prefixHashes, log: prefixLog },
  policy,
  events,
  trace,
  failure,
  endAt: now,
  final: game.snapshot(),
  success: !failure && game.scene === "photography",
};
await writeFile(
  `${output}/result.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    policy,
    scene: game.scene,
    outcome: game.flight?.outcome,
    success: result.success,
    failure,
  }),
);
if (!result.success) process.exitCode = 2;
