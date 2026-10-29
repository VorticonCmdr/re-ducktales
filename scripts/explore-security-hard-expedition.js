// Bounded player planning from a complete independently replayed entry. Each
// invocation starts at application startup; no state restore or RNG injection.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const key = process.argv[2],
  delay = Number(process.argv[3] ?? 0);
assert.ok(Number.isInteger(delay) && delay >= 0 && delay <= 90);
const catalog = JSON.parse(
  await readFile("reference/security-hard-entries.json"),
);
const selected = catalog.cases.find((c) => c.key === key);
assert.ok(selected, "SETUP: unknown Hard expedition");
const manifest = JSON.parse(await readFile(selected.manifest));
process.argv = [
  "node",
  "scripts/replay-hard-campaign.js",
  manifest.artifactRoot,
  `--manifest=${selected.manifest}`,
];
let game, clock, now, nextFrame;
const log = console.log;
console.log = () => {};
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
const activity = selected.activity;
assert.equal(game.scene, activity);
assert.equal(game[activity].frames, 0);
const source = JSON.parse(await readFile(selected.legacyInputs));
const inputs = [
  ...Array(delay).fill(0),
  ...source[activity].flatMap((e) => Array(e.count).fill(e.byte)),
];
const physical = new Set(),
  actual = new Set(),
  initial = game.snapshot(),
  observations = [];
function publish() {
  clock.enqueue(
    {
      type: "controls",
      fire: actual.has("Space"),
      direction:
        ["up", "down", "left", "right"].filter((k) => actual.has(k)).at(-1) ??
        null,
    },
    now,
  );
}
function step() {
  const at = now + 8;
  while (nextFrame <= at) {
    clock.advanceTo(nextFrame);
    for (const e of game.drainEffects())
      if (e.type === "flushControls") actual.clear();
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
for (const byte of inputs) {
  if (game.scene !== activity) break;
  const next = new Set([
    ...(byte & 64 ? ["Space"] : []),
    ...({ 1: ["up"], 3: ["right"], 5: ["down"], 7: ["left"] }[byte & 63] ?? []),
  ]);
  for (const k of physical)
    if (!next.has(k)) {
      actual.delete(k);
      publish();
    }
  for (const k of next)
    if (!physical.has(k)) {
      actual.add(k);
      publish();
    }
  physical.clear();
  for (const k of next) physical.add(k);
  const before = game[activity].frames;
  for (
    let n = 0;
    n < 3000 && game.scene === activity && game[activity].frames === before;
    n++
  )
    step();
  if (game.scene !== activity && game[activity].frames === before) break;
  assert.equal(
    game[activity].frames,
    before + 1,
    "Unfinished/skipped player input",
  );
  used++;
  if (used % 20 === 0 || used === inputs.length || game.scene !== activity)
    observations.push({ inputCount: used, state: game.snapshot() });
}
for (const k of physical) {
  actual.delete(k);
  publish();
}
for (let n = 0; n < 3000 && game.scene === activity; n++) step();
const result = {
  scope:
    "Conditional carried port player planning;not browser or native acceptance",
  key,
  delay,
  sourceInputs: selected.legacyInputs,
  initial,
  inputs,
  used,
  observations,
  final: game.snapshot(),
};
await writeFile(
  `.local/security-hard-planning-${key}-delay-${delay}.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    key,
    delay,
    used,
    scene: game.scene,
    state: result.final[activity],
    award: result.final.expeditionResult,
    day: game.campaign.day,
    money: game.money,
  }),
);
