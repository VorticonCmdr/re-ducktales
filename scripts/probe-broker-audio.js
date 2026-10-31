// Conditional actual-device I/O,not native CPU/PIT phase or waveform parity.
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
const device = arg("device") ?? "speaker";
assert.ok(["speaker", "tandy"].includes(device));
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const m = await json("reference/broker-input-browser.json"),
  c = m.cases.find((c) => c.key === "fire");
assert.ok(c);
await checkArtifacts(c.artifacts);
await validateProducerArchive(c.producer);
const checks = await json(c.artifacts["campaign-checkpoints"].path),
  events = await json(c.artifacts["captured-events"].path);
const entry = checks.find((c) => c.name === "entry");
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
  const entered = await state();
  assert.equal(entered.scene, "investments");
  assert.equal(entered.investments.phase, "broker");
  await page.evaluate(() => {
    window.brokerAudio = [];
    document.addEventListener("gameaudio", (e) =>
      window.brokerAudio.push(e.detail),
    );
  });
  const read = () => page.evaluate(() => window.brokerAudio);
  async function hostUntil(predicate) {
    for (let i = 0; i < 600; i++) {
      const s = await state();
      if (s.diagnostic) throw Error(s.diagnostic);
      const e = await read();
      if (await predicate(s, e)) return s;
      await new Promise((r) => setTimeout(r, 20));
      await page.clock.runFor(16);
    }
    throw Error("Unfinished actual broker audio boundary");
  }
  await page.keyboard.press("s");
  await page.clock.runFor(16);
  assert.equal(
    await page.locator("#audio").isChecked(),
    false,
    "S was consumed before broker input poll",
  );
  for (let i = 0; i < 1000 && !(await page.locator("#audio").isChecked()); i++)
    await page.clock.runFor(8);
  assert.equal(await page.locator("#audio").isChecked(), true);
  await hostUntil((s, e) =>
    e.some((e) => e.type === "ack" && e.argument === 0),
  );
  assert.equal(
    (await state()).scene,
    "investments",
    "Device startup outlasted broker wait",
  );
  await page.keyboard.press("Space");
  await hostUntil(
    (s, e) =>
      s.scene === "office" &&
      s.officeMenu.ready &&
      e.filter((e) => e.type === "ack").length === 4,
  );
  const final = await state(),
    observed = await read(),
    acks = observed.filter((e) => e.type === "ack");
  assert.deepEqual(
    acks.map((e) => e.argument),
    [0, 0x24, 0, 6],
  ); // S-on,broker,office entry/composition
  assert.equal(final.money, 978);
  assert.equal(final.campaign.day, 1);
  assert.equal(final.rareCoinTaken, true);
  assert.equal(final.investments.shares[10], 1);
  assert.equal(final.investments.complete, true);
  const stats = await page
    .locator("#sound")
    .evaluate((e) => ({ ...e.dataset }));
  assert.equal(stats.contextState, "running");
  assert.ok(Number(stats.signalSamples) > 0);
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  return {
    completed: true,
    accepted: false,
    device,
    entered,
    final,
    events: observed,
    stats,
    restart: true,
    sourceCommit: source.commit,
    scope:
      "Conditional real browser audio ACKs and deferred S;host20ms/Game16ms audio polling. No native timing or isolated click audibility claim.",
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
  root + "/broker-audio-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    device,
    words: result.events.filter((e) => e.type === "ack").map((e) => e.argument),
  }),
);
