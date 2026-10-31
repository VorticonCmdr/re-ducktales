// Independent DOM replay. Expected snapshots never choose a player input.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  checkArtifacts,
  inventory,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
import { observeRecordedRoute } from "../tests/browser/helpers/entry-recording.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const m = await json(arg("manifest") ?? "reference/broker-input-browser.json");
assert.equal(m.kind, "broker-input-browser-regression");
assert.ok(m.cases.length > 0, "Zero broker cases");
assert.deepEqual(
  m.cases.map((c) => c.key),
  ["fire", "timeout"],
);
await originalGame();
for (const c of m.cases) {
  await checkArtifacts(c.artifacts);
  await validateProducerArchive(c.producer);
}
const root = await fresh(arg("output")),
  source = await archiveSource(root);
async function replay(c, omitPause = false) {
  const load = (name) => json(c.artifacts[name].path);
  const [events, checks, environment, timeline, capture] = await Promise.all(
    [
      "captured-events",
      "campaign-checkpoints",
      "environment",
      "timeline",
      "capture-status",
    ].map(load),
  );
  assert.ok(events.length > 0 && checks.length > 0, "Zero broker checkpoints");
  assert.equal(capture.completed, true);
  assert.equal(capture.accepted, false);
  assert.equal(capture.controls, true);
  assert.equal(capture.timeout, c.key === "timeout");
  assert.equal(checks.length, 13);
  assert.equal(checks.length, c.checkpoints);
  assert.equal(checks.length, capture.checkpoints);
  assert.equal(events.length, c.events);
  assert.equal(events.length, capture.events);
  assert.deepEqual(
    checks.map((p) => p.name),
    [
      "earned-coin",
      "bought-share",
      "entry",
      "after-p",
      "pause",
      "pause-waiting",
      "resumed",
      "quit",
      "quit-no",
      "neutral",
      "office",
      "reopened",
      "no-trade-office",
    ],
  );
  assert.equal(
    checks.at(-1).eventCount,
    events.length,
    "Unfinished required input",
  );
  assert.equal(environment.difficulty, 0);
  assert.equal(environment.physical, true);
  assert.equal(environment.clockOrigin, 1);
  assert.equal(environment.displayMilliseconds, 8);
  assert.equal(environment.capturePhase, "before-target-handler");
  assert.equal(timeline.endAt, checks.at(-1).at);
  assert.equal(timeline.clockOrigin, 1);
  assert.equal(timeline.displayMilliseconds, 8);
  assert.deepEqual(
    timeline.observations,
    checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
  );
  for (let i = 0; i < events.length; i++)
    assert.ok(
      Number.isFinite(events[i].time) &&
        events[i].time >= 1 &&
        events[i].time <= timeline.endAt &&
        (!i || events[i].time >= events[i - 1].time),
      "Unordered/unconsumable broker event",
    );
  return withCarlsbadBrowser(async ({ page, state, until }) => {
    let now = 1,
      consumed = 0,
      checked = 0,
      omitted = 0;
    const pause = events.findIndex(
      (e, i) =>
        i >= checks[0].eventCount && e.type === "keydown" && e.key === "p",
    );
    assert.ok(pause >= 0, "Missing first broker Pause make");
    const advance = async (at) => {
      assert.ok(at >= now);
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    };
    for (const expected of checks) {
      assert.ok(
        expected.eventCount >= consumed && expected.eventCount <= events.length,
      );
      while (consumed < expected.eventCount) {
        const e = events[consumed];
        await advance(e.time);
        if (omitPause && consumed === pause) omitted++;
        else await recordedDOMInput(page, e);
        consumed++;
      }
      await advance(expected.at);
      const actual = await observeRecordedRoute({
        page,
        state: await state(),
        name: expected.name,
      });
      assert.equal(actual.state.diagnostic, null);
      assert.equal(actual.at, expected.at);
      assert.equal(
        actual.stateSha256,
        expected.stateSha256,
        "Broker " + c.key + " state " + expected.name,
      );
      assert.equal(
        actual.pixelsSha256,
        expected.pixelsSha256,
        "Broker pixels " + expected.name,
      );
      assert.equal(actual.eventCount, expected.eventCount - omitted);
      checked++;
      console.log("Broker " + c.key + " checkpoint " + expected.name);
    }
    assert.equal(consumed, events.length);
    assert.equal(checked, 13);
    assert.equal(now, timeline.endAt);
    const final = await state();
    assert.equal(final.scene, "office");
    assert.equal(final.campaign.day, 1);
    assert.equal(final.money, 978);
    assert.equal(final.rareCoinTaken, true);
    assert.equal(final.investments.shares[10], 1);
    assert.equal(final.investments.phase, "portfolio");
    assert.equal(await page.locator("#audio").isChecked(), false);
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).investments, null);
    assert.equal((await state()).claim, undefined);
    return { key: c.key, checked, consumed, restart: true };
  });
}
let result = { completed: false, accepted: false };
try {
  const cases = [];
  for (const c of m.cases) {
    const positive = await replay(c);
    await assert.rejects(
      () => replay(c, true),
      new RegExp("Broker " + c.key + " state pause"),
    );
    cases.push({ ...positive, semanticNegatives: 1 });
  }
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/") ||
      [
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        "vite.campaign.config.js",
        "reference/build.json",
      ].includes(p),
  );
  for (const c of m.cases) await checkArtifacts(c.artifacts);
  result = {
    completed: true,
    accepted: true,
    nativeComparison: false,
    cases,
    sourceCommit: source.commit,
    artifacts: await inventory(root, ["source-revision.json", "sources.zip"]),
  };
} finally {
  await writeFile(
    root + "/acceptance-status.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
