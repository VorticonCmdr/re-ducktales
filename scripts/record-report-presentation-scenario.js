// Metadata only:never changes proprietary captured inputs,states,frames or status.
import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { json, spec } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const root = process.argv[2],
  status = await json(root + "/result.json"),
  source = await validateProducerArchive(root),
  points = await json(root + "/campaign-checkpoints.json");
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.sourceCommit, source.commit);
const reason = status.reason;
assert.ok(["player", "rival"].includes(reason));
const stem = "reference/report-" + reason;
const m = {
  kind: "report-presentation-browser-candidate",
  producer: root,
  reason,
  captureToolRevision: source.commit,
  nativeComparison: false,
  build: await spec("reference/build.json"),
  expectedCheckpointCount: status.checkpoints,
  requiredEventCount: status.events,
  checkpointNames: points.map((p) => p.name),
  startingRecipe:
    "Fresh Standard startup,509 independent inputs/16 exact unchanged checkpoints through first cave award,then actual ordinary report,collected notice,early P/Q/S/Fire,Pause/resume,fresh Fire,map and Restart. Capture alone is not acceptance.",
  environment: {
    biosSeed: 0,
    clockOrigin: 1,
    displayMilliseconds: 8,
    timezone: "UTC",
    audioEnabled: false,
    difficulty: 1,
  },
  injections: [],
  fittedInputs: [],
  partialRestore: false,
  comparison: {
    state: "exact complete public snapshot",
    pixels: "exact decoded RGBA",
    exclusions: [],
  },
  artifacts: {},
  verify: `node scripts/replay-report-presentation-browser.js --manifest=${stem}-browser.json --output=.local/report-${reason}-replay-FRESH`,
};
for (const f of await readdir(root, { withFileTypes: true }))
  if (f.isFile()) m.artifacts[f.name] = await spec(root + "/" + f.name);
const old = ".local/current-winning-browser-03",
  notice = ".local/notice-" + reason + "-controls-02",
  targetId = reason === "player" ? 24 : 1,
  rows = {
    kind: "report-presentation-row-candidate",
    producer: root,
    nativeComparison: false,
    scope:
      "Actual ordinary/collected-notice/cleanup report stripes,including prior exit's exact black page. Independent retained completed port targets;not original native transition screenshots or timing parity.",
    comparison: {
      exclusions: [],
      bandClock:
        "Five-retrace held bands at offsets0/25/50;strict browser replay compares exact captured clock values",
    },
    expectedRowGroups: 45,
    targetProducers: [old, notice],
    artifacts: {
      presentations: await spec(root + "/presentations.json"),
      originalSource: await spec("reference/report-presentation-source.json"),
      oldPoints: await spec(old + "/campaign-checkpoints.json"),
      oldNoticePoints: await spec(notice + "/campaign-checkpoints.json"),
      normal1: await spec(old + "/dialogue-18.png"),
      normal3: await spec(old + "/dialogue-21.png"),
      notice: await spec(notice + "/entry.png"),
      beforeNormal: await spec(root + "/before-normal.png"),
    },
    cases: [
      {
        key: "rival-report:1:rival",
        targetId: 1,
        variant: 1,
        target: "normal1",
        targetCheckpoints: "oldPoints",
        targetCheckpoint: "dialogue-18",
        incoming: { kind: "checkpoint", artifact: "beforeNormal" },
      },
      {
        key: `visit-notice:${targetId}:${reason}`,
        targetId,
        target: "notice",
        targetCheckpoints: "oldNoticePoints",
        targetCheckpoint: "entry",
        incoming: { kind: "clearing-page" },
      },
      {
        key: "rival-report:3:rival",
        targetId: 3,
        variant: 0,
        target: "normal3",
        targetCheckpoints: "oldPoints",
        targetCheckpoint: "dialogue-21",
        incoming: {
          kind: "previous-exit",
          key: `visit-notice:${targetId}:${reason}:publishing-exit:none`,
        },
      },
    ],
    verify: `node scripts/verify-report-presentation-rows.js --manifest=${stem}-rows.json`,
  };
await writeFile(stem + "-browser.json", JSON.stringify(m, null, 2) + "\n", {
  flag: "wx",
});
await writeFile(stem + "-rows.json", JSON.stringify(rows, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    candidateOnly: true,
    reason,
    checkpoints: status.checkpoints,
    events: status.events,
  }),
);
