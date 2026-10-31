// Actual devices supply every status. Host20ms waits/Game16ms advances are a
// conditional browser environment,not recovered native CPU/PIT phase.
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
const device = arg("device") ?? "speaker",
  mode = arg("mode") ?? "during";
assert.ok(["speaker", "tandy"].includes(device));
assert.ok(["during", "before"].includes(mode));
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const m = await json("reference/standard-wages-full-route.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path),
  events = await json(m.artifacts["captured-events"].path);
const entry = checks.find((c) => c.name === "map-after-cave");
assert.ok(entry);
const result = await withCarlsbadBrowser(
  async ({ page, canvas, state, until }) => {
    await page.locator("#audio-device").selectOption(device);
    let now = 1;
    for (const e of events.slice(0, entry.eventCount)) {
      if (e.time > now) await page.clock.runFor(e.time - now);
      now = e.time;
      await recordedDOMInput(page, e);
    }
    await page.clock.runFor(entry.at - now);
    assert.equal((await state()).scene, "map");
    assert.deepEqual((await state()).campaign.rivalCollected, [1]);
    async function enterNotice() {
      const box = await canvas.boundingBox();
      await canvas.click({
        position: { x: (box.width * 64) / 320, y: (box.height * 73) / 200 },
      });
      await page.keyboard.press("Space");
      await until((s) => s.scene === "visit-notice");
    }
    await page.evaluate(() => {
      window.rivalMuteEvents = [];
      document.addEventListener("gameaudio", (e) =>
        window.rivalMuteEvents.push(e.detail),
      );
    });
    const read = () => page.evaluate(() => window.rivalMuteEvents);
    async function hostUntil(predicate) {
      for (let i = 0; i < 600; i++) {
        const s = await state();
        if (s.diagnostic) throw Error(s.diagnostic);
        const events = await read();
        if (await predicate(s, events)) return s;
        await new Promise((r) => setTimeout(r, 20));
        await page.clock.runFor(16);
      }
      throw Error("Unfinished actual visit mute scenario");
    }
    async function toggle(enabled) {
      await page.keyboard.press("s");
      for (let i = 0; i < 5000; i++) {
        if ((await page.locator("#audio").isChecked()) === enabled) return;
        await page.clock.runFor(8);
      }
      throw Error("Unconsumed visit mute key");
    }
    await toggle(true);
    await hostUntil((s, e) =>
      e.some((x) => x.type === "ack" && x.argument === 0),
    );
    if (mode === "before") {
      await toggle(false);
      await enterNotice();
    } else {
      await enterNotice();
      await hostUntil((s, e) =>
        e.some((x) => x.type === "ack" && x.argument === 0x6e && x.busy),
      );
      assert.equal((await state()).visitNotice.phase, "speech");
      await toggle(false);
    }
    const entered = await state(),
      phases = [];
    assert.equal(entered.scene, "visit-notice");
    await hostUntil((s, e) => {
      if (s.visitNotice && phases.at(-1) !== s.visitNotice.phase)
        phases.push(s.visitNotice.phase);
      return s.scene === "map";
    });
    const observed = await read(),
      acks = observed.filter((e) => e.type === "ack");
    const words = acks
      .filter((e) => e.argument !== null)
      .map((e) => e.argument);
    assert.deepEqual(
      words,
      mode === "during" ? [0, 0x6e, 0, 0x24] : [0, 0, 0x24],
    );
    const off = acks.filter((e) => e.argument !== null).slice(-2);
    assert.equal(off[0].frame, off[1].frame);
    if (device === "speaker") assert.equal(off[1].accepted, false);
    const status =
      mode === "before"
        ? acks.find((e) => e.query)
        : acks.find((e) => e.argument === 0x6e);
    assert.ok(
      status && status.token?.startsWith("visit:"),
      "Missing real initial status boundary",
    );
    if (mode === "before") {
      assert.equal(status.argument, null);
      assert.equal(acks.filter((e) => e.query).length, 1);
    } else assert.equal(status.busy, true);
    if (status.busy) {
      assert.ok(
        observed.some(
          (e) => e.type === "complete" && e.token === status.token && !e.busy,
        ),
        "Missing required real completion",
      );
      assert.equal(
        phases.includes("dialogue"),
        false,
        "Observed busy must bypass the fallback",
      );
    } else
      assert.ok(
        phases.includes("dialogue"),
        "Idle initial query must use fallback40",
      );
    const final = await state();
    assert.equal(final.campaign.location, entered.campaign.location);
    assert.equal(final.campaign.day, entered.campaign.day);
    assert.equal(final.money, entered.money);
    assert.equal(await page.locator("#audio").isChecked(), false);
    const stats = await page
      .locator("#sound")
      .evaluate((e) => ({ ...e.dataset }));
    assert.equal(stats.contextState, "running");
    if (mode === "before" && device === "speaker")
      assert.equal(
        Number(stats.signalSamples),
        0,
        "Rejected off-click must stay silent",
      );
    else assert.ok(Number(stats.signalSamples) > 0);
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    return {
      completed: true,
      accepted: false,
      device,
      mode,
      entered,
      final,
      phases,
      status,
      events: observed,
      stats,
      restart: true,
      sourceCommit: source.commit,
      scope:
        "Conditional actual-device visit mute/status query;not native timing or waveform parity",
    };
  },
);
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
  root + "/visit-audio-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    device,
    mode,
    phases: result.phases,
    requests: result.events
      .filter((e) => e.type === "ack")
      .map((e) => e.argument),
  }),
);
