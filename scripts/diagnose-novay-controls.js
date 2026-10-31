// Conditional route investigation only. Fresh original mountain memory and a
// declared zero-phase clock are NOT a restored campaign/machine checkpoint.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { Mountain } from "../src/game/mountain.js";
import { Scheduler } from "../src/game/scheduler.js";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  spec,
} from "./lib/local-scenario-source.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
assert.ok(
  process.argv.includes("--conditional"),
  "Explicit --conditional required",
);
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const recipePath = "reference/thunderclap-expedition-inputs.json";
const recipe = await json(recipePath),
  stream = recipe.mountain.flatMap((e) => Array(e.count).fill(e.byte));
assert.equal(stream.length, 494);
const initial = {
  variant: 1,
  difficulty: 1,
  day: 26,
  money: 23150,
  seed: 27138,
};
const { image, archives } = await originalGame();
let mountain, provider;
const adapter = {
  setSimulationClock: (c) => (provider = c),
  nextSimulationWake: () =>
    mountain?.wait?.clock === "graphics" ? mountain.wait.until : null,
  advanceSimulationWake: () => mountain.advanceGraphics(),
  advanceTick: () => mountain?.advanceTick(),
  advanceRetrace: () => mountain?.advanceRetrace(),
};
const clock = new Scheduler(adapter);
mountain = new Mountain({
  ...initial,
  image,
  entries: archives.get("MT.ARC"),
  mainEntries: archives.get("MAIN.ARC"),
  clock: provider,
});
let now = 0;
const points = [{ at: now, inputCount: 0, state: mountain.snapshot() }],
  losses = [];
for (const [i, byte] of stream.entries()) {
  assert.equal(mountain.outcome, null, "Unconsumed authored input tail");
  const before = mountain.snapshot();
  mountain.setControls({
    fire: !!(byte & 64),
    direction: { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
  });
  for (
    let wait = 0;
    wait < 3000 && mountain.frames === i && !mountain.outcome;
    wait++
  )
    clock.advanceTo((now += 8));
  assert.equal(mountain.frames, i + 1, "Skipped or unfinished action read");
  const after = mountain.snapshot();
  points.push({ at: now, inputCount: i + 1, byte, state: after });
  if (after.lives < before.lives)
    losses.push({ inputCount: i + 1, before, after });
}
mountain.setControls({ fire: false, direction: null });
for (let wait = 0; wait < 8000 && !mountain.outcome; wait++)
  clock.advanceTo((now += 8));
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"),
);
const result = {
  completed: true,
  accepted: false,
  nativeComparison: false,
  sourceCommit: source.commit,
  scope:
    "Conditional isolated original-resource mountain with fresh memory,declared zero-phase clock and direct consumed bytes. Not campaign/browser acceptance or native parity.",
  initial,
  initialDependency:
    "Initial constructor parameters read from the prior Novay candidate;no expected final state used. Fresh memory and zero phase differ from carried campaign state.",
  clockOrigin: 0,
  recipe: await spec(recipePath),
  requiredInputs: 494,
  executedInputs: mountain.inputs.length,
  authoredInputsConsumed: stream.length,
  losses,
  final: mountain.snapshot(),
};
await writeFile(
  root + "/observations.json",
  JSON.stringify(points, null, 2) + "\n",
);
await writeFile(root + "/result.json", JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    conditional: true,
    inputs: stream.length,
    losses: losses.map((l) => ({
      input: l.inputCount,
      row: l.before.row,
      action: l.before.action,
    })),
    outcome: mountain.outcome,
  }),
);
