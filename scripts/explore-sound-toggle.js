// Actual browser/audio exploration. Host20ms waits and injected game time are
// conditional device-I/O evidence,not recovered native IRQ phase/waveform parity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
} from "./lib/local-scenario-source.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const device = arg("device") ?? "speaker",
  after = process.argv.includes("--after");
assert.ok(["speaker", "tandy"].includes(device));
const root = await fresh(arg("output")),
  source = await archiveSource(root);
const result = await withCarlsbadBrowser(
  async ({ page, state, until, press }) => {
    await page.locator("#audio-device").selectOption(device);
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office" && s.officeMenu.ready);
    await page.evaluate(() => {
      window.toggleAudio = [];
      document.addEventListener("gameaudio", (e) =>
        window.toggleAudio.push(e.detail),
      );
    });
    await page.locator("#audio").check();
    await page.locator("#game").focus();
    async function checkbox(value) {
      for (let i = 0; i < 5000; i++) {
        if ((await page.locator("#audio").isChecked()) === value) return;
        await page.clock.runFor(8);
      }
      throw Error("Sound checkbox did not reflect the consumed key");
    }
    const before = await state();
    assert.equal(await page.locator("#audio").isChecked(), true);
    await page.keyboard.press("s");
    await checkbox(false);
    const off = await state();
    async function deviceIdle(required) {
      for (let i = 0; i < 500; i++) {
        const s = await state();
        if (s.diagnostic) throw Error(s.diagnostic);
        const events = await page.evaluate(() => window.toggleAudio);
        const stats = await page
          .locator("#sound")
          .evaluate((e) => ({ ...e.dataset }));
        if (
          events.filter((e) => e.type === "ack").length === required &&
          stats.playbackStatus === "0"
        )
          return { events, stats };
        await new Promise((r) => setTimeout(r, 20));
        await page.clock.runFor(16);
      }
      throw Error("Unfinished actual sound-toggle device boundary");
    }
    const stopped = await deviceIdle(after ? 2 : 1);
    assert.equal(await page.locator("#audio").isChecked(), false);
    await page.keyboard.press("s");
    await checkbox(true);
    const enabled = await deviceIdle(after ? 3 : 2);
    const acks = enabled.events.filter((e) => e.type === "ack");
    assert.deepEqual(
      acks.map((e) => e.argument),
      after ? [0, 0x24, 0] : [0, 0],
    );
    if (after) {
      assert.equal(
        acks[0].frame,
        acks[1].frame,
        "An adapter inserted an IRQ gap into native call batch",
      );
      if (device === "speaker")
        assert.equal(
          acks[1].accepted,
          false,
          "Original priority16 stop must reject priority0 click at the same phase",
        );
      else
        assert.ok(
          Number(stopped.stats.signalSamples) > 0,
          "Original Tandy off-click produced no output",
        );
    }
    assert.equal(enabled.stats.contextState, "running");
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    return {
      completed: true,
      accepted: false,
      device,
      after,
      before,
      off,
      stopped,
      enabled,
      restart: true,
      sourceCommit: source.commit,
      scope:
        "Conditional actual browser audio I/O;not native IRQ phase or waveform parity",
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
  root + "/toggle-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    device,
    after,
    requests: result.enabled.events
      .filter((e) => e.type === "ack")
      .map((e) => e.argument),
  }),
);
