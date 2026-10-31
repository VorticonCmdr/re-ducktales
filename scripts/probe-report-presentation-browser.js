// Real startup exploration/capture,not self-acceptance or native timing parity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
import {
  fresh,
  archiveSource,
  checkSource,
  checkArtifacts,
  json,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith("--" + name + "="))
    ?.slice(name.length + 3);
const reason = arg("reason") ?? "player";
assert.ok(["player", "rival"].includes(reason));
await originalGame();
const root = await fresh(arg("output")),
  source = await archiveSource(root),
  prefix = await json("reference/current-earned-route.json");
await checkArtifacts(prefix.artifacts);
await validateProducerArchive(prefix.producer);
const all = await json(prefix.artifacts.checkpoints.path),
  events = await json(prefix.artifacts.events.path),
  expected = all.slice(0, all.findIndex((c) => c.name === "award") + 1);
assert.equal(expected.length, 16);
let result = {
  completed: false,
  accepted: false,
  reason,
  sourceCommit: source.commit,
};
try {
  result = await withCarlsbadBrowser(
    async ({ page, canvas, state, until, press }) => {
      const points = [];
      await page.evaluate(() => {
        window.reportFrames = [];
        const seen = new Set();
        document.getElementById("game").addEventListener("gamepresent", (e) => {
          const s = e.detail,
            p = s.reportPresentation;
          if (!p) return;
          const who = s.rivalReport ?? s.claim ?? s.visitNotice;
          const key = `${s.scene}:${who.target}:${who.reason ?? "rival"}:${p.phase}:${p.transition?.band ?? "none"}`;
          if (seen.has(key)) return;
          seen.add(key);
          window.reportFrames.push({
            key,
            at: performance.now(),
            state: s,
            png: document.getElementById("game").toDataURL(),
          });
        });
      });
      const note = async (name) => {
        const p = await observeRecordedRoute({
          page,
          state: await state(),
          name,
        });
        points.push(p);
        console.log(
          name,
          JSON.stringify({
            scene: p.state.scene,
            presentation: p.state.reportPresentation?.phase,
          }),
        );
        return p;
      };
      let now = 1,
        consumed = 0;
      try {
        for (const c of expected) {
          while (consumed < c.eventCount) {
            const e = events[consumed++];
            assert.ok(e.time >= now);
            if (e.time > now) await page.clock.runFor(e.time - now);
            now = e.time;
            await recordedDOMInput(page, e);
          }
          if (c.at > now) await page.clock.runFor(c.at - now);
          now = c.at;
          const actual = await note(c.name);
          assert.equal(
            actual.stateSha256,
            c.stateSha256,
            "Unchanged startup state " + c.name,
          );
          assert.equal(
            actual.pixelsSha256,
            c.pixelsSha256,
            "Unchanged startup pixels " + c.name,
          );
          assert.equal(actual.eventCount, c.eventCount);
        }
        await until((s) => !s.expeditionResult.presentation);
        await press("Space");
        assert.equal((await state()).expeditionResult.phase, "atomic");
        await note("before-normal");
        await press("Space");
        assert.equal((await state()).scene, "rival-report");
        await note("normal-entry");
        assert.equal(await page.locator("#fire").isDisabled(), true);
        for (const key of ["p", "q", "s", "Space"])
          await page.keyboard.press(key);
        await until((s) => s.reportPresentation?.phase === "reading");
        assert.equal((await state()).systemOverlay, null);
        assert.equal(await page.locator("#audio").isChecked(), false);
        const ready = await note("normal-ready"),
          old = all.find((p) => p.name === "dialogue-18");
        assert.equal(
          ready.pixelsSha256,
          old.pixelsSha256,
          "Independent retained ordinary report pixels",
        );
        await press("Space");
        await until((s) => s.reportPresentation?.phase === "exit-wipe");
        await note("normal-exit");
        await until((s) => s.scene === "map");
        await note("normal-map");
        const [x, y] = reason === "player" ? [240, 70] : [64, 73],
          box = await canvas.boundingBox();
        await canvas.click({
          position: { x: (box.width * x) / 320, y: (box.height * y) / 200 },
        });
        await page.clock.runFor(100);
        await press("Space");
        await until((s) => s.scene !== "map" || s.campaign.destination?.ready);
        if ((await state()).scene === "map") {
          for (let n = 0; n < 3 && (await state()).campaign.choice !== 1; n++) {
            await press("ArrowRight");
            await until((s) => s.campaign.destination?.ready);
          }
          assert.equal((await state()).campaign.choice, 1);
          await press("Space");
        }
        for (
          let n = 0;
          (await state()).scene === "rival-report" && n < 4;
          n++
        ) {
          await until((s) => s.reportPresentation?.phase === "reading");
          await press("Space");
          await until((s) => s.scene !== "rival-report");
        }
        await until((s) => s.scene === "visit-notice");
        assert.equal((await state()).visitNotice.reason, reason);
        await note("notice-entry");
        for (const key of ["p", "q", "s", "Space"])
          await page.keyboard.press(key);
        await until((s) => s.reportPresentation?.phase === "reading");
        assert.equal((await state()).systemOverlay, null);
        await note("notice-ready");
        await press("p");
        await until((s) => s.systemOverlay?.kind === "pause");
        await note("pause");
        await until((s) => s.systemOverlay.phase === "waiting");
        await press("p");
        await until((s) => !s.systemOverlay);
        await note("resumed");
        await press("Space");
        await until((s) => s.reportPresentation?.phase === "exit-wipe");
        await note("notice-exit");
        await until((s) => s.scene !== "visit-notice");
        for (
          let n = 0;
          (await state()).scene === "rival-report" && n < 4;
          n++
        ) {
          await until((s) => s.reportPresentation?.phase === "reading");
          await press("Space");
          await until((s) => s.scene !== "rival-report");
        }
        assert.equal((await state()).scene, "map");
        await note("map");
        await saveRecordedRoute({
          page,
          root,
          observations: points,
          difficulty: 1,
          physical: true,
          scope:
            "EXPLORATORY report/collected-notice graphics and real controls from startup;not acceptance or native timing parity",
        });
        await writeFile(
          root + "/presentations.json",
          JSON.stringify(
            await page.evaluate(() => window.reportFrames),
            null,
            2,
          ) + "\n",
        );
        await page.locator("#restart").click();
        await until((s) => s.scene === "title");
        assert.equal((await state()).campaign.banked, 0);
        return {
          completed: true,
          accepted: false,
          reason,
          sourceCommit: source.commit,
          prefixCheckpoints: 16,
          prefixEvents: consumed,
          checkpoints: points.length,
          events: points.at(-1).eventCount,
          restart: true,
          independentNormalPixels: true,
        };
      } catch (error) {
        await note("failure");
        await saveRecordedRoute({
          page,
          root,
          observations: points,
          difficulty: 1,
          physical: true,
          scope: "FAILED report exploration,not acceptance",
        });
        await writeFile(
          root + "/presentations.json",
          JSON.stringify(
            await page.evaluate(() => window.reportFrames),
            null,
            2,
          ) + "\n",
        );
        throw error;
      }
    },
  );
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/"),
  );
} finally {
  await writeFile(
    root + "/result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
