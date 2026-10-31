// Reproducible current Safari admission. Real browser audio is explicitly
// conditional;no original whole-level cadence or waveform claim is made.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
  spec,
} from "./lib/local-scenario-source.js";
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
const root = await fresh(output),
  source = await archiveSource(root),
  steps = [];
async function run(name, executable, args, patterns = [], env = {}) {
  console.log("Safari check:" + name);
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 300000,
    env: { ...process.env, ...env },
  });
  const log = (result.stdout ?? "") + (result.stderr ?? "");
  const path = root + "/" + name + ".log";
  await writeFile(path, log);
  assert.ifError(result.error);
  assert.equal(result.status, 0, name + " failed;see " + path);
  for (const pattern of patterns) assert.match(log, pattern);
  steps.push({
    name,
    executable,
    args,
    exitCode: result.status,
    log: await spec(path),
  });
}
let completed = false;
try {
  await run("original", process.execPath, ["scripts/verify-photography.js"]);
  await run(
    "source",
    process.execPath,
    ["scripts/verify-photography-hud-work.js"],
    [
      /Safari HUD:28 source-defined call plans,16 exact production\/native formatter traces/,
    ],
  );
  await run(
    "runtime",
    process.execPath,
    ["scripts/verify-photography-runtime.js"],
    [
      /22 cases,899 full source-boundary DS comparisons/,
      /2234 ordered image\/mode\/wipe comparisons/,
    ],
  );
  await run(
    "units",
    "npm",
    ["test"],
    [/tests 218\b/, /pass 218\b/, /fail 0\b/, /skipped 0\b/, /cancelled 0\b/],
  );
  await run(
    "browser",
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/photography-input.spec.js",
      "tests/browser/photography.spec.js",
      "--config",
      "playwright.campaign.config.js",
      "--output=" + root + "/browser",
    ],
    [/2 passed/, /Safari|photography/],
  );
  for (const hud of [false, true])
    await run(
      hud ? "hud-negative" : "work-negative",
      process.execPath,
      [
        "scripts/verify-photography-timing-browser-negative.js",
        ...(hud ? ["--hud-only"] : []),
      ],
      [/omitted source work rejected/],
      {
        DUCKTALES_PHOTOGRAPHY_TIMING_VERIFICATION_ROOT:
          root + (hud ? "/hud-negative" : "/work-negative"),
      },
    );
  await run("build", "npm", ["run", "build"], [/built in/]);
  assert.equal(steps.length, 8);
  await checkSource(root, (p) => !p.startsWith("docs/"));
  completed = true;
} finally {
  await writeFile(
    root + "/result.json",
    JSON.stringify(
      {
        completed,
        accepted: completed,
        sourceCommit: source.commit,
        scope:
          "Current Safari source work,closed-loop component regression and adaptive browser input/audio. Conditional host20ms/Game16ms speech;not native elapsed-time/waveform parity or full-campaign acceptance.",
        steps,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  "Safari HUD acceptance:8 required checks,28 source plans,22 carried scenarios,899 boundaries,2234 images,218 units,2 browser cases,two browser negatives and build.",
);
