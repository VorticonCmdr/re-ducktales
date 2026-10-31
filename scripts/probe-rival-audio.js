// Conditional real device I/O:host20ms waits while advancing injected game time
// by16ms. No audio status is injected;this is not native clock/waveform parity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const device = arg("device") ?? "speaker";
assert.ok(["speaker", "tandy"].includes(device));
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const m = await json("reference/standard-wages-full-route.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path),
  events = await json(m.artifacts["captured-events"].path);
const entry = checks.find((c) => c.state.expeditionResult?.phase === "atomic");
assert.ok(entry);
const result = await withCarlsbadBrowser(async ({ page, state, until }) => {
  await page.locator("#audio-device").selectOption(device);
  let now = 1;
  for (const e of events.slice(0, entry.eventCount)) {
    if (e.time > now) await page.clock.runFor(e.time - now);
    now = e.time;
    await recordedDOMInput(page, e);
  }
  await page.clock.runFor(entry.at - now);
  assert.equal((await state()).expeditionResult.phase, "atomic");
  await page.evaluate(() => {
    window.rivalAudio = [];
    document.addEventListener("gameaudio", (e) =>
      window.rivalAudio.push(e.detail),
    );
  });
  await page.keyboard.press("s");
  for (let i = 0; i < 5000 && !(await page.locator("#audio").isChecked()); i++)
    await page.clock.runFor(8);
  assert.equal(await page.locator("#audio").isChecked(), true);
  await page.keyboard.press("Space");
  await until((s) => s.scene !== "expedition-result");
  assert.equal((await state()).scene, "rival-report");
  const entered = await state();
  let observed, stats;
  for (let i = 0; i < 500; i++) {
    const s = await state();
    if (s.diagnostic) throw Error(s.diagnostic);
    observed = await page.evaluate(() => window.rivalAudio);
    stats = await page.locator("#sound").evaluate((e) => ({ ...e.dataset }));
    if (
      s.scene === "map" &&
      observed.some((e) => e.type === "ack" && e.argument === 0x21) &&
      Number(stats.signalSamples) > 0
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await page.clock.runFor(16);
    if (i === 499) throw Error("Unfinished real rival audio boundary");
  }
  const requests = observed.filter((e) => e.type === "ack"),
    click = requests.findIndex((e) => e.argument === 0x24);
  assert.ok(click >= 0);
  assert.deepEqual(
    requests.slice(click, click + 3).map((e) => e.argument),
    [0x24, 0x6e, 0x21],
  );
  assert.equal(stats.device, device);
  assert.equal(stats.contextState, "running");
  assert.ok(Number(stats.signalSamples) > 0);
  const report = requests[click + 1];
  assert.ok(
    typeof report.token === "string" && report.token.startsWith("rival:"),
  );
  if (report.busy)
    assert.ok(
      observed.some(
        (e) => e.type === "complete" && e.token === report.token && !e.busy,
      ),
    );
  assert.equal(
    (await state()).campaign.rival.location,
    entered.rivalReport.target,
  );
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  return {
    completed: true,
    accepted: false,
    scope:
      "Conditional actual browser audio I/O,not strict/native timing or waveform parity",
    device,
    entered,
    events: observed,
    stats,
    restart: true,
    sourceCommit: source.commit,
  };
});
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
await writeFile(
  root + "/audio-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    device,
    acknowledgements: result.events
      .filter((e) => e.type === "ack")
      .map((e) => e.argument),
    signalSamples: result.stats.signalSamples,
  }),
);
