// Observer for the port replay only, not the original executable or emulator.
// Run as a Node --import preload against the pinned baseline. No inputs, time,
// memory or returned values are changed; only completed input logs are copied.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const root = process.env.DUCKTALES_OBSERVER_BASELINE_ROOT;
const output = process.env.DUCKTALES_OBSERVER_OUTPUT;
assert.ok(root && output, "SETUP: supply observer baseline root and output");
assert.equal(
  execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  "57beb92d1250452ee5e8ed22ec8e04b48321fe08",
);
const { Flight } = await import(
  pathToFileURL(resolve(root, "src/game/flight.js"))
);
const resume = Flight.prototype.resume,
  ids = new WeakMap(),
  profiles = [];
let count = 0;
Flight.prototype.resume = function (...args) {
  if (!ids.has(this)) ids.set(this, count++);
  const value = resume.apply(this, args);
  if (this.outcome && !profiles[ids.get(this)]) {
    profiles[ids.get(this)] = this.inputLog.map((event) => event.code);
    writeFileSync(output, JSON.stringify(profiles, null, 2) + "\n");
  }
  return value;
};
