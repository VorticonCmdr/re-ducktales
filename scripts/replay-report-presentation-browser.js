// Independent DOM-only consumer. Expected states/images never initialize Game.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { installReportFrameRecording } from "./lib/report-frame-recording.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
import { observeRecordedRoute } from "../tests/browser/helpers/entry-recording.js";
import {
  fresh,
  archiveSource,
  checkSource,
  checkArtifacts,
  json,
  spec,
  inventory,
  sha,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const arg = (key) =>
  process.argv
    .find((a) => a.startsWith("--" + key + "="))
    ?.slice(key.length + 3);
const manifestPath = arg("manifest");
assert.ok(manifestPath, "Supply pinned report browser manifest");
const m = await json(manifestPath);
assert.equal(m.kind, "report-presentation-browser-candidate");
assert.ok(
  m.expectedCheckpointCount > 0 && m.requiredEventCount > 0,
  "Zero cases",
);
assert.equal(m.nativeComparison, false);
assert.equal(m.partialRestore, false);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.deepEqual(m.comparison.exclusions, []);
await originalGame();
await checkArtifacts(m.artifacts);
const capture = m.producer;
const producerSource = await validateProducerArchive(capture);
const files = [
  "result.json",
  "environment.json",
  "campaign-checkpoints.json",
  "captured-events.json",
  "timeline.json",
];
const protectedFiles = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, await spec(m.artifacts[f].path)]),
  ),
);
const load = (f) => json(m.artifacts[f].path),
  status = await load("result.json"),
  checks = await load("campaign-checkpoints.json"),
  events = await load("captured-events.json"),
  environment = await load("environment.json"),
  timeline = await load("timeline.json");
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.restart, true);
assert.equal(status.sourceCommit, producerSource.commit);
assert.equal(status.sourceCommit, m.captureToolRevision);
assert.equal(status.reason, m.reason);
assert.ok(checks.length > 0 && events.length > 0, "Zero report cases");
assert.equal(status.checkpoints, checks.length);
assert.equal(status.events, events.length);
assert.equal(
  checks.length,
  m.expectedCheckpointCount,
  "Wrong checkpoint count",
);
assert.equal(events.length, m.requiredEventCount, "Wrong required input count");
assert.deepEqual(
  checks.map((c) => c.name),
  m.checkpointNames,
);
assert.equal(checks.at(-1).name, "map");
assert.equal(
  checks.at(-1).eventCount,
  events.length,
  "Unconsumed required events",
);
assert.equal(environment.clockOrigin, 1);
assert.equal(environment.displayMilliseconds, 8);
assert.equal(environment.physical, true);
assert.equal(environment.difficulty, 1);
assert.equal(environment.capturePhase, "before-target-handler");
assert.equal(timeline.endAt, checks.at(-1).at);
assert.deepEqual(
  timeline.observations,
  checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
);
const ready = checks.find(
  (p) => p.name === (m.pauseBoundaryName ?? "notice-ready"),
);
const expectedFrames = m.compareReportFrames ? await json(m.artifacts["presentations.json"].path) : null;
const canonical = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
const pixels = (v) => PNG.sync.read(Buffer.from(v.png.split(",")[1], "base64")).data;
assert.ok(ready);
const omission = events.findIndex(
  (e, i) => i >= ready.eventCount && e.type === "keydown" && e.key === "p",
);
assert.ok(omission >= 0, "Missing required fresh Pause make");
const root = await fresh(arg("output")),
  source = await archiveSource(root);
let result = { completed: false, accepted: false };
async function replay(negative = false) {
  return withCarlsbadBrowser(async ({ page, state, until }) => {
    if (m.compareReportFrames && !negative) await installReportFrameRecording(page);
    let now = 1,
      consumed = 0,
      omitted = 0,
      checked = 0;
    const advance = async (at) => {
      assert.ok(Number.isFinite(at) && at >= now);
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    };
    for (const c of checks) {
      assert.ok(c.eventCount >= consumed && c.eventCount <= events.length);
      while (consumed < c.eventCount) {
        const e = events[consumed];
        await advance(e.time);
        if (negative && consumed === omission) omitted++;
        else await recordedDOMInput(page, e);
        consumed++;
      }
      await advance(c.at);
      const actual = await observeRecordedRoute({
        page,
        state: await state(),
        name: c.name,
      });
      assert.equal(actual.at, c.at, "Report checkpoint time " + c.name);
      assert.equal(actual.state.diagnostic, null);
      assert.equal(actual.stateSha256, c.stateSha256, "Report state " + c.name);
      assert.equal(
        actual.pixelsSha256,
        c.pixelsSha256,
        "Report pixels " + c.name,
      );
      assert.equal(actual.eventCount, c.eventCount - omitted);
      checked++;
      console.log("Report checkpoint", c.name);
    }
    assert.equal(consumed, events.length);
    assert.equal(checked, checks.length);
    assert.equal((await state()).scene, "map");
    let frameComparisons = 0;
    if (m.compareReportFrames && !negative) {
      const frames = await page.evaluate(() => window.reportFrames);
      assert.ok(expectedFrames.length > 0, "Zero report frames");
      assert.equal(frames.length, expectedFrames.length, "Skipped report frames");
      for (let i = 0; i < frames.length; i++) {
        assert.equal(frames[i].key, expectedFrames[i].key, "Report frame order");
        assert.equal(frames[i].at, expectedFrames[i].at, "Report frame time " + frames[i].key);
        assert.equal(sha(canonical(frames[i].state)), sha(canonical(expectedFrames[i].state)), "Report frame state " + frames[i].key);
        assert.equal(sha(pixels(frames[i])), sha(pixels(expectedFrames[i])), "Report frame pixels " + frames[i].key);
        frameComparisons++;
      }
      await writeFile(root + "/presentations.json", JSON.stringify(frames, null, 2) + "\n");
      await writeFile(root + "/incoming-pages.json", JSON.stringify(await page.evaluate(() => window.reportIncomingPages), null, 2) + "\n");
    }
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).campaign.banked, 0);
    return { checked, consumed, restart: true, frameComparisons };
  });
}
try {
  const positive = await replay();
  await assert.rejects(
    () => replay(true),
    /Report state pause/,
    "Missing fresh Pause must change the pause checkpoint",
  );
  for (const [f, before] of Object.entries(protectedFiles))
    assert.deepEqual(await spec(m.artifacts[f].path), before);
  await checkArtifacts(m.artifacts);
  await checkSource(
    root,
    (p) =>
      p === manifestPath ||
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/"),
  );
  result = {
    completed: true,
    accepted: true,
    nativeComparison: false,
    producer: capture,
    sourceCommit: source.commit,
    ...positive,
    semanticNegatives: 1,
    artifacts: await inventory(root, ["source-revision.json", "sources.zip"]),
  };
} finally {
  await writeFile(
    root + "/result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
