// Bounded conditional component exploration,not acceptance or native parity.
// Authored input bytes are independent of game outputs and game RNG.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { Jungle } from "../src/game/jungle.js";
import { Scheduler } from "../src/game/scheduler.js";
import {
  fresh,
  archiveSource,
  checkSource,
  sha,
} from "./lib/local-scenario-source.js";
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
const root = await fresh(output),
  source = await archiveSource(root);
const { image, archives } = await originalGame();
const resources = {
  image,
  entries: archives.get("JG.ARC"),
  mainEntries: archives.get("MAIN.ARC"),
  mountainEntries: archives.get("MT.ARC"),
};
function controls(profile) {
  let controllerSeed = 0x91a7;
  return Array.from({ length: 300 }, (_, i) => {
    if (profile === "right-jump") return 3 | (i % 11 < 3 ? 64 : 0);
    controllerSeed = (Math.imul(controllerSeed, 1664525) + 1013904223) >>> 0;
    const direction = [0, 1, 3, 5, 7][(controllerSeed >>> 16) % 5];
    return direction | (i % 17 < 4 ? 64 : 0);
  });
}
const cases = [];
for (const difficulty of [0, 1])
  for (const variant of [0, 1, 2])
    for (const profile of ["right-jump", "roam"]) {
      const inputs = controls(profile),
        initial = { difficulty, variant, seed: 2725, money: 44, day: 23 };
      let used = 0,
        jungle;
      const boundaries = [];
      try {
        jungle = new Jungle({
          ...resources,
          ...initial,
          readInput: () => {
            assert.ok(
              used < inputs.length,
              "Exploration read beyond authored sequence",
            );
            boundaries.push({
              read: used,
              x: jungle.memory.i(0x5f46),
              y: jungle.memory.i(0x6858),
              state: sha(jungle.memory.bytes),
            });
            return inputs[used++];
          },
        });
        const clock = new Scheduler({
          setSimulationClock: (p) => jungle.setClock(p),
          advanceTick: () => jungle.advanceTick(),
          advanceRetrace: () => jungle.advanceRetrace(),
        });
        while (!jungle.outcome && used < inputs.length && clock.now < 120000) {
          // One external millisecond observation;never a fitted original timer.
          clock.advanceTo(clock.now + 1);
        }
        assert.ok(used > 0, "Zero executed exploratory inputs");
        cases.push({
          initial,
          profile,
          inputs,
          used,
          remaining: inputs.length - used,
          reason: jungle.outcome
            ? "translated-outcome"
            : used === inputs.length
              ? "authored-bound"
              : "time-bound",
          outcome: jungle.outcome,
          boundaries,
          elapsed: clock.elapsed,
          presentations: jungle.presentations,
          diagnostic: null,
        });
      } catch (error) {
        cases.push({
          initial,
          profile,
          inputs,
          used,
          remaining: inputs.length - used,
          reason: "diagnostic",
          boundaries,
          diagnostic: { message: error.message, stack: error.stack },
          snapshot: jungle?.snapshot(),
        });
      }
      console.log(
        JSON.stringify({
          difficulty,
          variant,
          profile,
          used,
          reason: cases.at(-1).reason,
          diagnostic: cases.at(-1).diagnostic?.message,
        }),
      );
    }
assert.equal(cases.length, 12);
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") ||
    p.startsWith("scripts/") ||
    p.startsWith("tests/") ||
    p === "reference/build.json",
);
await writeFile(
  root + "/exploration.json",
  JSON.stringify(
    {
      completed: true,
      accepted: false,
      sourceCommit: source.commit,
      scope:
        "Conditional zero-phase fresh components,independent authored joystick-byte schedules;no DOM/native comparison. Early original outcomes and unconsumed tails are explicit. This is a search for unsupported paths,not an acceptance suite.",
      cases,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    accepted: false,
    cases: cases.length,
    diagnostics: cases.filter((c) => c.diagnostic).length,
    executed: cases.reduce((n, c) => n + c.used, 0),
  }),
);
