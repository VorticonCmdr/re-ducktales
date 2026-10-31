// Earned award-entry presentation. Muted capture/replay is separate from real
// AudioWorklet observations with conditional host20ms/Game16ms polling.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import {
  awardPixels as pixels,
  compareAwardGroups,
} from "./lib/award-presentation-check.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
  digest,
} from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const root = await fresh(arg("output")),
  revision = await archiveSource(root);
const protectedSource = (p) =>
  p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/");
if (process.argv.includes("--verify")) {
  const producer = arg("capture"),
    capture = await json(producer + "/result.json");
  assert.equal(capture.completed, true);
  assert.equal(capture.accepted, false);
  assert.equal(capture.device, "muted");
  assert.equal(capture.verifiedBrowserSpec, true);
  await validateProducerArchive(producer);
  const inputs = await json(producer + "/captured-events.json"),
    points = await json(producer + "/campaign-checkpoints.json");
  assert.equal(points.length, 8);
  assert.ok(inputs.length > 460);
  assert.equal(inputs.length, points.at(-1).eventCount);
  async function replay(omitFire = false) {
    return withCarlsbadBrowser(async ({ page, state }) => {
      let now = 1,
        consumed = 0,
        checked = 0,
        omitted = 0;
      const ready = points.find((p) => p.name === "award-ready"),
        fire = inputs.findIndex(
          (e, i) =>
            i >= ready.eventCount && e.type === "keydown" && e.key === " ",
        );
      assert.ok(fire >= 0);
      for (const p of points) {
        while (consumed < p.eventCount) {
          const e = inputs[consumed];
          assert.ok(e.time >= now);
          if (e.time > now) await page.clock.runFor(e.time - now);
          now = e.time;
          if (omitFire && consumed === fire) omitted++;
          else if (e.target === "restart") {
            assert.ok(["pointerdown", "pointerup"].includes(e.type));
            const button = page.locator("#restart");
            if (e.type === "pointerdown") await button.scrollIntoViewIfNeeded();
            const bounds = await button.boundingBox();
            assert.ok(bounds);
            await page.mouse.move(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            if (e.type === "pointerdown") await page.mouse.down();
            else await page.mouse.up();
          } else await recordedDOMInput(page, e);
          consumed++;
        }
        assert.ok(p.at >= now);
        if (p.at > now) await page.clock.runFor(p.at - now);
        now = p.at;
        const actual = await observeRecordedRoute({
          page,
          state: await state(),
          name: p.name,
        });
        assert.equal(
          actual.stateSha256,
          p.stateSha256,
          "Award replay state " + p.name,
        );
        assert.equal(
          actual.pixelsSha256,
          p.pixelsSha256,
          "Award replay pixels " + p.name,
        );
        assert.equal(
          actual.eventCount,
          p.eventCount - omitted,
          "Unconsumed award DOM inputs",
        );
        checked++;
      }
      assert.equal(consumed, inputs.length);
      assert.equal(checked, 8);
      assert.equal((await state()).scene, "title");
      return { checked, consumed, restart: true };
    });
  }
  let result = { completed: false, accepted: false };
  try {
    const positive = await replay();
    await assert.rejects(() => replay(true), /Award replay state atomic/);
    await checkSource(root, protectedSource);
    result = {
      completed: true,
      accepted: true,
      ...positive,
      semanticNegatives: 1,
      sourceCommit: revision.commit,
      producer,
    };
  } finally {
    await writeFile(
      root + "/result.json",
      JSON.stringify(result, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(result));
} else {
  const device = arg("device") ?? "muted";
  assert.ok(["muted", "speaker", "tandy"].includes(device));
  const producer = ".local/result-earned-browser-01";
  await checkArtifacts(
    (await json(producer + "/capture-status.json")).artifacts,
  );
  await validateProducerArchive(producer);
  const inputs = await json(producer + "/captured-events.json"),
    old = await json(producer + "/campaign-checkpoints.json"),
    entry = old.find((p) => p.name === "cave-entry"),
    award = old.find((p) => p.name === "award"),
    target = PNG.sync.read(await readFile(producer + "/award.png")).data;
  assert.equal(digest(target), award.pixelsSha256);
  let result = { completed: false, accepted: false, device };
  try {
    result = await withCarlsbadBrowser(async ({ page, state, until }) => {
      if (device !== "muted")
        await page.locator("#audio-device").selectOption(device);
      await page.evaluate(() => {
        window.awardVideo = [];
        window.awardAudio = [];
        const seen = new Set();
        document.addEventListener("gameaudio", (e) =>
          window.awardAudio.push({
            ...e.detail,
            consumedAt: performance.now(),
          }),
        );
        document.getElementById("game").addEventListener("gamepresent", (e) => {
          const p = e.detail.expeditionResult?.presentation;
          if (!p) return;
          const key = p.phase + ":" + (p.transition?.band ?? "none");
          if (seen.has(key)) return;
          seen.add(key);
          window.awardVideo.push({
            key,
            state: e.detail,
            at: performance.now(),
            png: document.getElementById("game").toDataURL(),
          });
        });
      });
      let now = 1;
      for (let i = 0; i < award.eventCount; i++) {
        if (i === entry.eventCount && device !== "muted") {
          if (entry.at > now) await page.clock.runFor(entry.at - now);
          now = entry.at;
          await page.locator("#audio").check();
          await page.locator("#game").focus();
        }
        const e = inputs[i];
        assert.ok(e.time >= now);
        if (e.time > now) await page.clock.runFor(e.time - now);
        now = e.time;
        await recordedDOMInput(page, e);
      }
      const observations = [];
      const audio = () => page.evaluate(() => window.awardAudio);
      async function wait(predicate, label) {
        for (let i = 0; i < 12000; i++) {
          const s = await state();
          if (s.diagnostic) throw Error(s.diagnostic);
          if (predicate(s, await audio())) return s;
          if (device !== "muted") await new Promise((r) => setTimeout(r, 20));
          await page.clock.runFor(device === "muted" ? 8 : 16);
        }
        await writeFile(
          root + "/failure.json",
          JSON.stringify(
            { label, state: await state(), audio: await audio() },
            null,
            2,
          ) + "\n",
        );
        throw Error("Unfinished earned award: " + label);
      }
      const note = async (name) => {
        observations.push(
          await observeRecordedRoute({ page, state: await state(), name }),
        );
        console.log(device, name);
      };
      await wait(
        (s) => s.scene === "cave" && s.cave.phase === "treasure",
        "treasure animation",
      );
      for (const key of ["p", "q", "s"]) await page.keyboard.press(key);
      await wait(
        (s) => s.expeditionResult?.presentation?.phase === "initial-wipe",
        "initial-wipe",
      );
      assert.equal((await state()).money, 400);
      await note("award-entry");
      assert.equal(await page.locator("#fire").isDisabled(), true);
      const early = async () => {
        for (const key of ["p", "q", "s", "Space"])
          await page.keyboard.press(key);
        await page.clock.runFor(8);
      };
      await early();
      assert.equal((await state()).systemOverlay, null);
      await note("early-first-flush");
      await wait(
        (s) => s.expeditionResult?.presentation?.phase === "wipe",
        "second-wipe",
      );
      assert.equal((await state()).money, 3400);
      assert.equal((await state()).pendingResultSystemKeys, undefined);
      assert.equal((await state()).pendingCaveSystemKeys, undefined);
      await note("second-wipe");
      await early();
      await note("early-second-flush");
      const ready = await wait(
        (s) =>
          s.scene === "expedition-result" &&
          s.expeditionResult.phase === "award" &&
          !s.expeditionResult.presentation,
        "ready",
      );
      assert.equal(ready.systemOverlay, null);
      assert.equal(
        await page.locator("#audio").isChecked(),
        device !== "muted",
      );
      assert.equal(ready.expeditionResult.skipRequested, false);
      assert.equal(ready.campaign.atomicAvailable, false);
      assert.equal(ready.money, 3400);
      assert.equal(ready.campaign.day, 3);
      assert.equal(await page.locator("#fire").isDisabled(), false);
      if (device !== "muted")
        await wait(
          (s, e) =>
            e.filter((v) => v.type === "ack" && v.argument === 0x49).length ===
            2,
          "award sound ACK",
        );
      await note("award-ready");
      const video = await page.evaluate(() => window.awardVideo),
        groups = video.filter(
          (v) => v.state.expeditionResult.presentation.transition,
        );
      const compareGroups = (data) => compareAwardGroups(data, target);
      compareGroups(groups);
      const changed = structuredClone(groups),
        bad = PNG.sync.read(
          Buffer.from(changed[0].png.split(",")[1], "base64"),
        );
      bad.data[0] = 255;
      changed[0].png =
        "data:image/png;base64," + PNG.sync.write(bad).toString("base64");
      assert.throws(() => compareGroups(changed), /Award row pixels/);
      assert.throws(
        () => compareGroups(groups.slice(1)),
        /Missing award row groups/,
      );
      const publication = video.find((v) => v.key === "publishing:none");
      assert.ok(publication);
      assert.equal(
        publication.state.expeditionResult.presentation.consumedRetraces,
        75,
      );
      assert.deepEqual(
        pixels(publication),
        target,
        "Completed award page changed",
      );
      const events = await audio(),
        acks = events.filter((e) => e.type === "ack");
      if (device !== "muted") {
        const queries = acks.filter((e) => e.query);
        assert.equal(queries.length, 1);
        if (queries[0].busy)
          assert.ok(
            events.some(
              (e) =>
                e.type === "complete" &&
                e.token === queries[0].token &&
                !e.busy,
            ),
          );
        const words = acks.filter((e) => e.argument === 0x49);
        assert.equal(words.length, 2);
        assert.equal(words[1].token, null);
        if (device === "speaker") assert.equal(words[1].accepted, true);
        else
          assert.equal(
            acks.find(
              (e) =>
                e.argument === 0 &&
                e.sequence > queries[0].sequence &&
                e.sequence < words[1].sequence,
            )?.busy,
            false,
          );
        assert.equal(words[1].busy, true);
        assert.ok(
          acks.some(
            (e) =>
              e.argument === 0 &&
              e.sequence > queries[0].sequence &&
              e.sequence < words[1].sequence,
          ),
        );
      } else assert.deepEqual(events, []);
      await page.keyboard.press("Space");
      await wait((s) => s.expeditionResult?.phase === "atomic", "atomic");
      await note("atomic");
      await page.keyboard.press("Space");
      await until((s) => s.scene === "map");
      assert.equal((await state()).money, 3400);
      assert.equal((await state()).campaign.atomicAvailable, true);
      assert.ok((await state()).campaign.playerCollected.includes(24));
      await note("map");
      await page.locator("#restart").click();
      await until((s) => s.scene === "title");
      assert.equal((await state()).money, 0);
      assert.equal((await state()).campaign.day, 1);
      await note("restarted");
      await saveRecordedRoute({
        page,
        root,
        observations,
        difficulty: 0,
        physical: true,
        scope:
          "Earned award75-retrace presentation;muted independent DOM replay or conditional real device I/O,not native uninterrupted timing parity",
      });
      await writeFile(
        root + "/presentation.json",
        JSON.stringify(
          {
            video,
            events,
            stats: await page
              .locator("#sound")
              .evaluate((e) => ({ ...e.dataset })),
          },
          null,
          2,
        ) + "\n",
      );
      return {
        completed: true,
        accepted: false,
        verifiedBrowserSpec: true,
        device,
        sourceCommit: revision.commit,
        producer,
        prefixEvents: award.eventCount,
        checkpoints: observations.length,
        events: observations.at(-1).eventCount,
        groups: groups.length,
        retraces: 75,
        pixelNegatives: 2,
        restart: true,
      };
    });
    await checkSource(root, protectedSource);
  } finally {
    await writeFile(
      root + "/result.json",
      JSON.stringify(result, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(result));
}
