// Earned transmitter,actual DOM controls and reconstructed AudioWorklets.
// Host20ms/Game16ms audio polling is conditional,not original CPU/PIT phase.
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
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const device = arg("device") ?? "tandy",
  mode = arg("mode") ?? "before",
  after = process.argv.includes("--after");
assert.ok(["speaker", "tandy"].includes(device));
assert.ok(["before", "during"].includes(mode));
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const m = await json("reference/atomic-earned-report.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.captureRoot);
const checks = await json(m.captureRoot + "/campaign-checkpoints.json"),
  events = await json(m.captureRoot + "/captured-events.json"),
  entry = checks.find((c) => c.name === "choice");
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
  assert.equal((await state()).scene, "map");
  assert.equal((await state()).campaign.choice, 2);
  await page.evaluate(() => {
    window.atomicAudio = [];
    document.addEventListener("gameaudio", (e) =>
      window.atomicAudio.push(e.detail),
    );
  });
  const read = () => page.evaluate(() => window.atomicAudio);
  async function hostUntil(predicate) {
    for (let i = 0; i < 800; i++) {
      const s = await state();
      if (s.diagnostic) throw Error(s.diagnostic);
      const e = await read();
      if (await predicate(s, e)) return s;
      await new Promise((r) => setTimeout(r, 20));
      await page.clock.runFor(16);
    }
    await writeFile(
      root + "/failure.json",
      JSON.stringify({ state: await state(), events: await read() }, null, 2) +
        "\n",
    );
    throw Error(
      "Unfinished actual atomic audio boundary;see local failure.json",
    );
  }
  async function toggle(enabled) {
    await page.keyboard.press("s");
    for (let i = 0; i < 2000; i++) {
      if ((await page.locator("#audio").isChecked()) === enabled) return;
      await page.clock.runFor(8);
    }
    throw Error("Unconsumed atomic setup S");
  }
  await toggle(true);
  await hostUntil((s, e) =>
    e.some((e) => e.type === "ack" && e.argument === 0),
  );
  if (mode === "before") {
    await toggle(false);
    await hostUntil((s, e) => e.filter((e) => e.type === "ack").length === 3);
  }
  // The map loop discards makes during its drawing/wait boundary. S and its
  // real device ACKs advanced that loop;confirm only at the next input reader.
  await until((s) => s.scene === "map" && s.campaign.destination?.ready);
  await page.keyboard.press("Space");
  let sounding = null,
    muted = null;
  if (mode === "during") {
    sounding = await hostUntil(
      (s, e) =>
        s.atomicTransport?.phase === "sound" &&
        e.some((e) => e.type === "ack" && e.argument === 0x45 && e.busy),
    );
    await page.keyboard.press("p");
    await page.keyboard.press("q");
    await page.keyboard.press("s");
    await page.locator("#audio").uncheck();
    await page.clock.runFor(16);
    muted = await state();
  }
  const report = await hostUntil(
    (s, e) =>
      s.scene === "atomic-transport" && s.atomicTransport.phase === "report",
  );
  assert.equal(report.systemOverlay, null);
  assert.equal(await page.locator("#audio").isChecked(), false);
  const observed = await read(),
    acks = observed.filter((e) => e.type === "ack");
  if (after) {
    assert.deepEqual(
      acks.map((e) => e.argument),
      mode === "before" ? [0, 0, 0x24, null] : [0, 0x24, 0, 0x45, 0],
    );
    const status = acks.find((e) => e.token?.startsWith("atomic:"));
    assert.ok(status);
    if (mode === "before") {
      assert.equal(status.query, true);
      assert.equal(status.argument, null);
    } else assert.equal(status.busy, true);
    if (status.busy)
      assert.ok(
        observed.some(
          (e) => e.type === "complete" && e.token === status.token && !e.busy,
        ),
        "Report entered without actual device completion",
      );
  }
  await page.keyboard.press("Space");
  await until((s) => s.scene === "expedition-briefing");
  await until((s) => s.scene === "jungle");
  const final = await state();
  assert.equal(final.campaign.location, 1);
  assert.equal(final.campaign.day, 6);
  assert.equal(final.money, 3400);
  const stats = await page
    .locator("#sound")
    .evaluate((e) => ({ ...e.dataset }));
  assert.equal(stats.contextState, "running");
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  return {
    completed: true,
    accepted: false,
    after,
    device,
    mode,
    sounding,
    muted,
    report,
    final,
    events: observed,
    stats,
    restart: true,
    sourceCommit: source.commit,
    scope:
      "Conditional actual-browser device status using earned transmitter;checkbox mute is explicit browser convenience. Not native whole-atomic timing or waveform parity.",
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
  root + "/atomic-audio-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    device,
    mode,
    after,
    words: result.events.filter((e) => e.type === "ack").map((e) => e.argument),
  }),
);
