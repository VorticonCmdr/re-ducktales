// Bounded player-route planning from the independently verified complete Game
// entry. No state is restored or injected; every candidate replays from startup.
// A model success still requires actual browser and independent DOM replay.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const delay = Number(
  process.argv.find((a) => a.startsWith("--delay="))?.slice(8) ?? 0,
);
assert.ok(Number.isInteger(delay) && delay >= 0 && delay <= 90);
process.argv = [
  "node",
  "scripts/replay-hard-campaign.js",
  ".local/security-jungle-entry-accepted-02",
  "--manifest=reference/security-jungle-entry.json",
];
const logger = console.log;
console.log = () => {};
let g, clock;
try {
  ({ game: g, clock } = await import("./replay-hard-campaign.js"));
} finally {
  console.log = logger;
}
assert.equal(g.scene, "jungle");
assert.equal(g.jungle.frames, 0);
assert.equal(g.jungle.snapshot().seed, 14769);
const route = JSON.parse(
  await readFile("reference/campaign-startup-browser.json"),
);
const inputs = [
  ...Array(delay).fill(0),
  ...route.jungle.inputEvents.flatMap((e) => Array(e.count).fill(e.byte)),
];
const observations = [],
  initial = g.snapshot();
let held = new Set(),
  actualHeld = new Set(),
  used = 0;
function publish() {
  g.input({
    type: "controls",
    fire: actualHeld.has("Space"),
    direction:
      ["up", "down", "left", "right"].filter((k) => actualHeld.has(k)).at(-1) ??
      null,
  });
}
function step() {
  clock.advanceTo(clock.now + 8);
  for (const e of g.drainEffects())
    if (e.type === "flushControls") actualHeld.clear();
}
for (const byte of inputs) {
  if (g.scene !== "jungle") break;
  const next = new Set([
    ...(byte & 64 ? ["Space"] : []),
    ...({ 1: ["up"], 3: ["right"], 5: ["down"], 7: ["left"] }[byte & 63] ?? []),
  ]);
  for (const k of held)
    if (!next.has(k)) {
      actualHeld.delete(k);
      publish();
    }
  for (const k of next)
    if (!held.has(k)) {
      actualHeld.add(k);
      publish();
    }
  held = next;
  const before = g.jungle.frames;
  for (
    let n = 0;
    n < 2000 && g.scene === "jungle" && g.jungle.frames === before;
    n++
  )
    step();
  if (g.scene !== "jungle" && g.jungle.frames === before) break;
  assert.equal(
    g.jungle.frames,
    before + 1,
    "Unfinished or skipped planning input",
  );
  used++;
  if (used === 1 || used % 40 === 0 || g.scene !== "jungle")
    observations.push({ inputCount: used, state: g.jungle.snapshot() });
}
for (const k of held) {
  actualHeld.delete(k);
  publish();
}
for (let n = 0; n < 2000 && g.scene === "jungle"; n++) step();
const result = {
  scope:
    "Conditional carried port player planning; not browser or native acceptance",
  delay,
  initial,
  inputs: inputs.slice(0, used),
  used,
  observations,
  final: g.snapshot(),
};
await writeFile(
  `.local/security-easy-jungle-planning-delay-${delay}.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    delay,
    used,
    scene: g.scene,
    jungle: g.jungle.snapshot(),
    money: g.money,
    day: g.campaign.day,
  }),
);
