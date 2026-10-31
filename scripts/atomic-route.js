// Captures never certify themselves. Verification uses fresh browser controls,
// immutable expected snapshots/pixels, a separate consumer archive and a negative.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  captureAtomicRoute,
  replayAtomicRoute,
} from "./lib/atomic-route-browser.js";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  inventory,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const mode = process.argv[2],
  arg = (k) =>
    process.argv.find((s) => s.startsWith("--" + k + "="))?.slice(k.length + 3),
  write = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + "\n");
const loaded = (p) =>
  p.startsWith("src/") ||
  p.startsWith("scripts/") ||
  p.startsWith("tests/") ||
  [
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "vite.campaign.config.js",
    "reference/build.json",
  ].includes(p);
const report = process.argv.includes("--report");
const root = await fresh(arg("output"));
await archiveSource(root);
await originalGame();
if (mode === "capture") {
  const result = await captureAtomicRoute(root, { report });
  await checkSource(root, loaded);
  const artifacts = await inventory(root, [
    "source-revision.json",
    "sources.zip",
    "environment.json",
    "timeline.json",
    "captured-events.json",
    "campaign-checkpoints.json",
  ]);
  await write(root + "/capture-status.json", { ...result, artifacts });
  console.log(JSON.stringify(result));
} else {
  assert.equal(mode, "verify");
  const producer = arg("capture");
  assert.ok(producer, "SETUP: --capture required");
  const status = await json(producer + "/capture-status.json");
  assert.equal(status.completed, true);
  assert.equal(status.accepted, false);
  await checkArtifacts(status.artifacts);
  await validateProducerArchive(producer);
  const events = await json(producer + "/captured-events.json"),
    checks = await json(producer + "/campaign-checkpoints.json");
  assert.equal(events.length, status.events);
  assert.equal(checks.length, status.checkpoints);
  assert.equal(status.route ?? "success", report ? "report" : "success");
  const prefix = [
    "cave-entry",
    "room-10",
    "room-18",
    "room-26",
    "room-27",
    "room-19",
    "room-11",
    "room-12",
    "room-13",
    "room-14",
    "award",
    "unlock",
    "choice",
    "charge",
    "charge-keys-ignored",
  ];
  assert.deepEqual(
    checks.map((c) => c.name),
    [
      ...prefix,
      ...(report
        ? [
            "misdirection",
            "report-pause",
            "pause-waiting",
            "pause-resumed",
            "report-quit",
            "quit-no-resumed",
            "arrival",
            "second-entry",
          ]
        : ["arrival", "second-entry", "second-action"]),
    ],
  );
  let result;
  try {
    const positive = await replayAtomicRoute(events, checks, { report });
    await assert.rejects(
      () =>
        replayAtomicRoute(events, checks, { report, omitAtomicChoice: true }),
      (e) =>
        e.code === "ERR_ASSERTION" && e.message.includes("Atomic state choice"),
      "Omitted selection must diverge at choice",
    );
    if (report)
      await assert.rejects(
        () =>
          replayAtomicRoute(events, checks, { report, omitReportPause: true }),
        (e) =>
          e.code === "ERR_ASSERTION" &&
          e.message.includes("Atomic state report-pause"),
        "Omitted report Pause must diverge at its input checkpoint",
      );
    await checkArtifacts(status.artifacts);
    await checkSource(root, loaded);
    result = {
      completed: true,
      ...positive,
      negativeControls: report ? 2 : 1,
      report,
      producer,
    };
    console.log(JSON.stringify(result));
  } finally {
    await write(root + "/result.json", result ?? { completed: false });
  }
}
