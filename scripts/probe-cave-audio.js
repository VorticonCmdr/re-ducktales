// Actual browser/AudioWorklet I/O. Host20ms/Game16ms polling is conditional.
// Startup and flight use independent recorded DOM inputs; cave movement uses
// the initially observed map. No memory writes, state restore or fitted timer.
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
const device = arg("device") ?? "speaker",
  mode = arg("mode") ?? "enabled";
assert.ok(["speaker", "tandy"].includes(device));
assert.ok(["enabled", "muted"].includes(mode));
const root = await fresh(arg("output")),
  revision = await archiveSource(root);
const producer = ".local/result-earned-browser-01";
await checkArtifacts((await json(producer + "/capture-status.json")).artifacts);
await validateProducerArchive(producer);
const checks = await json(producer + "/campaign-checkpoints.json"),
  inputs = await json(producer + "/captured-events.json"),
  entry = checks.find((c) => c.name === "cave-entry");
assert.ok(entry?.eventCount > 0);
let result = { completed: false, accepted: false, device, mode };
try {
  result = await withCarlsbadBrowser(async ({ page, state, until }) => {
    await page.locator("#audio-device").selectOption(device);
    let now = 1;
    for (const e of inputs.slice(0, entry.eventCount)) {
      if (e.time > now) await page.clock.runFor(e.time - now);
      now = e.time;
      await recordedDOMInput(page, e);
    }
    await page.clock.runFor(entry.at - now);
    assert.equal((await state()).scene, "cave");
    assert.equal((await state()).cave.phase, "entering");
    await page.evaluate(() => {
      window.caveAudio = [];
      document.addEventListener("gameaudio", (e) =>
        window.caveAudio.push(e.detail),
      );
    });
    const read = () => page.evaluate(() => window.caveAudio);
    const observations = [];
    async function hostUntil(predicate, label) {
      for (let i = 0; i < 2000; i++) {
        const s = await state(),
          e = await read();
        if (s.diagnostic) throw Error(s.diagnostic);
        if (predicate(s, e)) {
          observations.push({ name: label, state: s, audioEvents: e.length });
          console.log(device, mode, label);
          return s;
        }
        await new Promise((r) => setTimeout(r, 20));
        await page.clock.runFor(16);
      }
      await writeFile(
        root + "/failure.json",
        JSON.stringify(
          {
            label,
            state: await state(),
            events: await read(),
            observations,
          },
          null,
          2,
        ) + "\n",
      );
      throw Error("Unfinished cave audio boundary: " + label);
    }
    await page.locator("#audio").check();
    await page.locator("#game").focus();
    const initial = await hostUntil(
      (s) => s.cave?.phase === "exploring",
      "first-room",
    );
    const queue = [[initial.cave.room, []]],
      seen = new Set();
    let path;
    while (queue.length) {
      const [at, p] = queue.shift();
      if (initial.cave.rooms[at] & 64) {
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
        if (
          initial.cave.rooms[at] & bit &&
          n >= 0 &&
          n < 64 &&
          !(initial.cave.rooms[n] & 32)
        )
          queue.push([n, [...p, key]]);
      }
    }
    assert.ok(path?.length);
    console.log(device, mode, "path", JSON.stringify(path));
    for (const key of path) {
      const old = (
        await hostUntil((s) => s.cave?.phase === "exploring", "input-reader")
      ).cave.room;
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      const changed = await hostUntil(
        (s) => s.scene !== "cave" || s.cave.room !== old,
        "room-change",
      );
      assert.equal(
        changed.scene,
        "cave",
        "Cave exited before movement completed",
      );
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
    }
    await hostUntil(
      (s, e) =>
        s.cave?.phase === "pit" &&
        e.some((v) => v.type === "ack" && v.argument === 0x48),
      "pit-sound",
    );
    if (mode === "muted") await page.locator("#audio").uncheck();
    const final = await hostUntil(
      (s) => s.scene === "expedition-result",
      "failure-result",
    );
    const events = await read(),
      acks = events.filter((e) => e.type === "ack"),
      queries = acks.filter((e) => e.query);
    assert.equal(final.expeditionResult.phase, "failure");
    assert.equal(
      queries.length,
      1,
      "Missing or duplicate terminal global-status query",
    );
    assert.equal(queries[0].argument, null);
    if (queries[0].busy)
      assert.ok(
        events.some(
          (e) =>
            e.type === "complete" && e.token === queries[0].token && !e.busy,
        ),
        "Result before actual completion",
      );
    assert.equal(
      acks.filter((e) => e.argument >= 0x4d && e.argument <= 0x51).length,
      path.length + 1,
      "Room entry must cue once, silent redraws must not cue",
    );
    assert.ok(acks.some((e) => e.argument === 0x48 && e.busy));
    if (mode === "enabled") {
      await hostUntil(
        (s, e) =>
          e.some(
            (v) =>
              v.type === "ack" &&
              v.argument === 0 &&
              v.sequence > queries[0].sequence,
          ),
        "guarded-return-reset",
      );
    } else
      assert.equal(
        acks.some((e) => e.sequence > queries[0].sequence && e.argument === 0),
        false,
      );
    await writeFile(
      root + "/observation.json",
      JSON.stringify(
        { initial, path, final, observations, events: await read() },
        null,
        2,
      ) + "\n",
    );
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).campaign.day, 1);
    return {
      completed: true,
      accepted: true,
      device,
      mode,
      restart: true,
      sourceCommit: revision.commit,
      producer,
      prefixEvents: entry.eventCount,
      roomEntries: path.length + 1,
      queries: queries.length,
      scope:
        "Actual browser pit route, real device global-status query and guarded reset. Conditional host20ms/Game16ms polling, not native timing or waveform acceptance.",
    };
  });
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/"),
  );
} catch (e) {
  result = { ...result, completed: false, accepted: false, error: e.message };
  throw e;
} finally {
  await writeFile(
    root + "/result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
