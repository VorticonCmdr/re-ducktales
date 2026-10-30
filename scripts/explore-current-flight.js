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
import { tileObjects } from "../src/game/flight-objects.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
const [
  root,
  boundary,
  output,
  lowText,
  highText,
  climbText,
  minimumSpeedText,
  steeringMode,
] = process.argv.slice(2);
assert.ok(
  root && boundary && output,
  "SETUP: root,boundary,output,low,high,climb required",
);
const policy = {
  altitude: [Number(lowText), Number(highText)],
  climbHeading: Number(climbText),
  minimumTurnSpeed:
    minimumSpeedText === undefined ? 4 : Number(minimumSpeedText),
};
assert.ok(
  policy.altitude.every(Number.isFinite) &&
    policy.altitude[0] >= 0 &&
    policy.altitude[1] >= policy.altitude[0] &&
    policy.altitude[1] <= 139,
);
assert.ok([1, 2, 3].includes(policy.climbHeading));
assert.ok([0, 4].includes(policy.minimumTurnSpeed));
assert.ok(
  steeringMode === undefined ||
    ["hazards", "predictive"].includes(steeringMode),
);
policy.steeringMode = steeringMode ?? "fixed";
await mkdir(output, { recursive: false }).catch(async (e) => {
  if (e.code !== "ENOENT") throw e;
  await mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await mkdir(output);
});
const source = await readFile(new URL(import.meta.url));
await writeFile(`${output}/explorer-source.js`, source);
const controllerSource = await readFile(
  new URL("../tests/browser/helpers/flight-policy.js", import.meta.url),
);
await writeFile(`${output}/controller-source.js`, controllerSource);
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
const objectObservations = [];
let observedRead = -1;
const state = async () => {
  const s = game.snapshot();
  if (s.scene === "flight" && s.flight.inputReads !== observedRead) {
    observedRead = s.flight.inputReads;
    const m = game.flight.memory,
      objects = [];
    for (
      let t = Math.max(0, s.flight.tile - 1);
      t <= Math.min(129, s.flight.tile + 2);
      t++
    )
      for (const at of tileObjects(m, t))
        objects.push({
          tile: t,
          type: m.b(at + 12),
          x: m.i(at + 2),
          y: m.i(at + 4),
          width: m.i(at + 8),
          height: m.i(at + 10),
          state: m.b(at + 13),
        });
    objectObservations.push({
      at: now,
      read: observedRead,
      plane: s.flight,
      objects,
      rememberedCollision: { tile: m.i(0x0fbc), type: m.i(0x0fbe) },
    });
  }
  return s;
};
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
  const playerPolicy = { ...policy };
  if (steeringMode === "predictive") {
    let previousY;
    playerPolicy.altitudeForState = (s) => {
      const y = s.flight.y;
      const dy = previousY === undefined ? 0 : y - previousY;
      previousY = y;
      // Brake the climb before crossing the desired lane. This is a player
      // estimate from its own last two poses, not a simulation prediction.
      return policy.altitude.map((limit) => limit - dy * 2);
    };
  }
  if (steeringMode === "hazards")
    playerPolicy.altitudeForState = (s) => {
      const f = s.flight;
      const objects = objectObservations.at(-1)?.objects ?? [];
      // White-box player research: choose a visible gap, not a recorded outcome.
      // Only read original object descriptors; never advance or mutate the game.
      let best = null;
      for (let y = 8; y <= 128; y += 4) {
        let cost = Math.abs(y - f.y) * 0.15;
        for (const o of objects) {
          if ([0x1a, 0x3a].includes(o.type)) continue;
          if ([0x2a, 0x2b, 0x1f].includes(o.type) && o.state === 0) continue;
          let left = o.x,
            right = o.x + o.width;
          let top = o.y,
            bottom = o.y + o.height;
          if (o.type === 0x11) {
            top += 10;
            left += 4;
          }
          if ([0x21, 0x22].includes(o.type)) {
            left += 20;
            right -= 20;
            top += 9;
            bottom += 3;
          }
          if (o.type === 0x31) {
            left += 6;
            right = o.x + 80;
            top += 16;
            bottom = top + 20;
          }
          if (right < f.x - 24 || left > f.x + 200) continue;
          const distance = Math.max(0, left - f.x - 28);
          const overlap = Math.min(y + 12, bottom) - Math.max(y - 8, top);
          if (overlap > 0) cost += (100 + overlap * 5) / (1 + distance / 40);
        }
        if (!best || cost < best.cost) best = { y, cost };
      }
      return [best.y - 4, best.y + 4];
    };
  trace = await explorePhysicalFlight({
    page,
    state,
    until,
    policy: playerPolicy,
  });
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
  controllerSha256: sha(controllerSource),
  prefix: { root, boundary, hashes: prefixHashes, log: prefixLog },
  policy,
  events,
  trace,
  objectObservations,
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
