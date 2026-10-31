// Real browser observation from startup; no state restore or memory injection.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  json,
  checkSource,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const root = await fresh(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9),
);
const revision = await archiveSource(root);
const source = ".local/result-earned-browser-01";
await checkArtifacts((await json(source + "/capture-status.json")).artifacts);
await validateProducerArchive(source);
const checks = await json(source + "/campaign-checkpoints.json"),
  events = await json(source + "/captured-events.json");
const entry = checks.find((c) => c.name === "cave-entry");
assert.ok(entry);
const result = await withCarlsbadBrowser(async ({ page, state, until }) => {
  const points = [];
  const note = async (name) => {
    const p = await observeRecordedRoute({ page, state: await state(), name });
    points.push(p);
    console.log(
      name,
      JSON.stringify({
        scene: p.state.scene,
        result: p.state.expeditionResult,
        overlay: p.state.systemOverlay,
        day: p.state.campaign.day,
      }),
    );
  };
  let now = 1;
  for (const e of events.slice(0, entry.eventCount)) {
    if (e.time > now) await page.clock.runFor(e.time - now);
    now = e.time;
    await recordedDOMInput(page, e);
  }
  await page.clock.runFor(entry.at - now);
  assert.equal((await state()).scene, "cave");
  await note("entry");
  await until((s) => s.cave.phase === "exploring");
  const s = await state(),
    rooms = s.cave.rooms,
    queue = [[s.cave.room, []]],
    seen = new Set();
  let path;
  while (queue.length) {
    const [at, p] = queue.shift();
    if (rooms[at] & 64) {
      path = p;
      break;
    }
    if (seen.has(at)) continue;
    seen.add(at);
    for (const [key, bit, delta] of [
      ["ArrowLeft", 1, -1],
      ["ArrowRight", 2, 1],
      ["ArrowDown", 4, 8],
      ["ArrowUp", 8, -8],
    ]) {
      const n = at + delta;
      if (rooms[at] & bit && n >= 0 && n < 64 && !(rooms[n] & 32))
        queue.push([n, [...p, key]]);
    }
  }
  assert.ok(path?.length);
  for (const key of path) {
    await until((v) => v.scene !== "cave" || v.cave.phase === "exploring");
    assert.equal((await state()).scene, "cave");
    const old = (await state()).cave.room;
    await page.keyboard.down(key);
    await page.keyboard.down("Space");
    await until((v) => v.scene !== "cave" || v.cave.room !== old);
    await page.keyboard.up("Space");
    await page.keyboard.up(key);
  }
  await until((v) => v.scene === "expedition-result");
  assert.equal((await state()).expeditionResult.phase, "failure");
  await note("failure");
  await page.keyboard.press("p");
  await page.clock.runFor(16);
  await note("after-p");
  if (process.argv.includes("--controls")) {
    assert.equal((await state()).systemOverlay, null);
    await until((v) => v.systemOverlay?.kind === "pause");
    assert.equal((await state()).expeditionResult.remaining, 133);
    await note("pause");
    await until((v) => v.systemOverlay?.phase === "waiting");
    await note("pause-waiting");
    await page.keyboard.press("p");
    await until((v) => v.systemOverlay === null);
    await note("resumed");
    await page.keyboard.press("q");
    await page.keyboard.press("Space");
    await until((v) => v.systemOverlay?.kind === "quit");
    await note("quit");
    await page.keyboard.press("n");
    await until((v) => v.systemOverlay === null);
    await note("quit-no");
    await until((v) => v.expeditionResult.remaining <= 119);
    assert.equal((await state()).scene, "expedition-result");
    await note("neutral");
    const before = await state();
    await page.keyboard.press("Space");
    await until((v) => v.scene === "map");
    const returned = await state();
    assert.equal(returned.campaign.day, before.campaign.day + 1);
    assert.equal(returned.money, before.money);
    assert.equal(returned.campaign.atomicAvailable, false);
    assert.ok(
      !returned.campaign.playerCollected.includes(returned.campaign.location),
    );
    await note("map");
    await page.keyboard.press("Space");
    await until((v) => v.scene === "cave");
    assert.equal((await state()).flight, null);
    assert.equal((await state()).departure, null);
    await note("retry-cave");
  }
  await saveRecordedRoute({
    page,
    root,
    observations: points,
    difficulty: 0,
    physical: true,
    scope:
      "Exploratory cave pit/failure P input observation;not acceptance or native timing",
  });
  await page.locator("#restart").click();
  await until((v) => v.scene === "title");
  return {
    completed: true,
    accepted: false,
    checkpoints: points.length,
    events: points.at(-1).eventCount,
    restart: true,
    sourceCommit: revision.commit,
  };
});
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"),
);

await writeFile(
  root + "/capture-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
