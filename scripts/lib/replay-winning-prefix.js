import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, sha, checkArtifacts } from "./local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./consumer-provenance.js";
import { recordedDOMInput } from "../../tests/browser/helpers/recorded-dom-input.js";
import { observeRecordedRoute } from "../../tests/browser/helpers/entry-recording.js";

// Fresh title replay,not a checkpoint restore. The declared valid prefix ends
// at the manifest's declared valid route boundary;its failed tail is not used.
export async function replayWinningPrefix({
  page,
  state,
  points,
  manifest,
  omitDifficulty = false,
}) {
  const m = await json(manifest);
  assert.equal(m.kind, "current-winning-valid-prefix");
  await checkArtifacts(m.artifacts);
  const source = await validateProducerArchive(m.producer);
  for (const [p, h] of Object.entries(source.files))
    if (acceptedRuntimeSource(p))
      assert.equal(sha(await readFile(p)), h, "Changed prefix runtime " + p);
  const all = await json(m.artifacts.checkpoints.path),
    events = await json(m.artifacts.events.path),
    checks = all.slice(0, m.expectedCheckpointCount);
  assert.ok(checks.length > 0 && m.requiredEventCount > 0);
  assert.equal(checks.length, m.expectedCheckpointCount);
  assert.ok(
    ["jungle-map", "mountain-map", "bank-25", "cave-21-award-ready"].includes(
      m.lastCheckpoint,
    ),
  );
  assert.equal(checks.at(-1).name, m.lastCheckpoint);
  assert.equal(checks.at(-1).at, m.lastAt);
  assert.equal(checks.at(-1).eventCount, m.requiredEventCount);
  let now = 1,
    consumed = 0,
    omitted = 0;
  const choice = events.findIndex(
    (e) => e.type === "keydown" && e.key === "ArrowDown",
  );
  assert.ok(choice >= 0 && choice < checks[0].eventCount);
  for (const expected of checks) {
    while (consumed < expected.eventCount) {
      const e = events[consumed++];
      assert.ok(e.time >= now);
      if (e.time > now) await page.clock.runFor(e.time - now);
      now = e.time;
      if (omitDifficulty && consumed - 1 === choice) omitted++;
      else await recordedDOMInput(page, e);
    }
    assert.ok(expected.at >= now);
    if (expected.at > now) await page.clock.runFor(expected.at - now);
    now = expected.at;
    const actual = await observeRecordedRoute({
      page,
      state: await state(),
      name: expected.name,
    });
    assert.equal(
      actual.stateSha256,
      expected.stateSha256,
      "Prefix state " + expected.name,
    );
    assert.equal(
      actual.pixelsSha256,
      expected.pixelsSha256,
      "Prefix pixels " + expected.name,
    );
    assert.equal(actual.eventCount, expected.eventCount - omitted);
    points.push(actual);
    console.log("Exact prefix", expected.name);
  }
  assert.equal(consumed, m.requiredEventCount);
  assert.equal(
    (await state()).scene,
    m.lastCheckpoint === "bank-25"
      ? "bank"
      : m.lastCheckpoint === "cave-21-award-ready"
        ? "expedition-result"
        : "map",
  );
  assert.equal((await state()).difficulty, 1);
  if (m.lastCheckpoint === "cave-21-award-ready") {
    const s = await state();
    assert.equal(s.campaign.location, 21);
    assert.equal(s.cave.outcome.code, 1);
    assert.equal(s.expeditionResult.presentation, undefined);
  }
}
