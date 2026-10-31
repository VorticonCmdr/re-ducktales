// Bounded exploratory real-browser player. Not acceptance,not an original-game
// runtime comparison. No game state,seed,ownership or timers are patched.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
} from "./lib/local-scenario-source.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { finishSecurityEntry } from "../tests/browser/helpers/security.js";
import { explorePhysicalFlight } from "../tests/browser/helpers/flight-policy.js";
import { planCaveVariant } from "./lib/easy-cave-variants.js";
import { continueWinningCampaign } from "./lib/winning-browser-player.js";
import { replayWinningPrefix } from "./lib/replay-winning-prefix.js";
import { installReportFrameRecording } from "./lib/report-frame-recording.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
const arg = (k) =>
    process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3),
  root = await fresh(arg("output")),
  source = await archiveSource(root);
const winning = process.argv.includes("--winning");
const reportProbe = process.argv.includes("--forced-report");
const safari = winning || reportProbe || process.argv.includes("--safari");
const original = await originalGame();
const prefixManifest = arg("prefix");
assert.ok(!prefixManifest || winning, "Prefix continuation requires --winning");
assert.ok(
  !reportProbe || (!winning && !prefixManifest),
  "Forced report exploration requires fresh startup",
);
let result = {
  completed: false,
  accepted: false,
  scope:
    "EXPLORATORY Standard Wages first playable leg,not campaign completion",
};
try {
  result = await withCarlsbadBrowser(async (c) => {
    const { page, canvas, state, until, press } = c,
      points = [];
    if (reportProbe) await installReportFrameRecording(page);
    if (winning)
      await page.evaluate(() => {
        window.campaignAwards = [];
        const seen = new Set();
        document.getElementById("game").addEventListener("gamepresent", (e) => {
          const s = e.detail,
            p = s.expeditionResult?.presentation;
          if (!p) return;
          const key = `${s.campaign.location}:${p.phase}:${p.transition?.band ?? "none"}`;
          if (seen.has(key)) return;
          seen.add(key);
          window.campaignAwards.push({
            key,
            location: s.campaign.location,
            activity: s.briefing.activity,
            at: performance.now(),
            state: s,
            png: document.getElementById("game").toDataURL(),
          });
        });
      });
    const observe = async (name) => {
      const s = await state();
      points.push(await observeRecordedRoute({ page, state: s, name }));
      console.log(
        name,
        JSON.stringify({
          scene: s.scene,
          difficulty: s.difficulty,
          day: s.campaign?.day,
          money: s.money,
          banked: s.campaign?.banked,
          seed: s.seed,
          room: s.cave?.room,
          flight: s.flight?.outcome,
        }),
      );
    };
    async function point(x, y) {
      const b = await canvas.boundingBox();
      await canvas.click({
        position: { x: (b.width * x) / 320, y: (b.height * y) / 200 },
      });
      await page.clock.runFor(100);
    }
    async function settle() {
      for (let n = 0; n < 12; n++) {
        let s = await state();
        if (
          ![
            "expedition-result",
            "rival-report",
            "visit-notice",
            "rival-claim",
          ].includes(s.scene)
        )
          return;
        if (s.reportPresentation && s.reportPresentation.phase !== "reading") {
          await until(
            (v) =>
              !v.reportPresentation || v.reportPresentation.phase === "reading",
          );
          s = await state();
          if (
            !["rival-report", "rival-claim", "visit-notice"].includes(s.scene)
          )
            continue;
        }
        if (s.expeditionResult?.presentation) {
          await until(
            (v) =>
              v.scene !== "expedition-result" ||
              !v.expeditionResult.presentation,
          );
          s = await state();
          assert.equal(s.scene, "expedition-result");
        }
        await observe("dialogue-" + points.length);
        const phase =
          s.expeditionResult?.phase ??
          s.rivalReport?.phase ??
          s.visitNotice?.phase;
        await press("Space");
        await until(
          (v) =>
            v.scene !== s.scene ||
            (v.expeditionResult?.phase ??
              v.rivalReport?.phase ??
              v.visitNotice?.phase) !== phase,
        );
      }
      throw Error("Unfinished Standard report sequence");
    }
    try {
      if (prefixManifest) {
        await replayWinningPrefix({
          page,
          state,
          points,
          manifest: prefixManifest,
        });
      } else {
        await until((s) => s.scene === "title");
        await press("Space");
        await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
        await press("ArrowDown");
        await until((s) => s.difficultyMenu.ready && s.difficulty === 1);
        await observe("standard-choice");
        await press("Enter");
        await until((s) => s.scene === "office");
        assert.equal((await state()).difficulty, 1);
        await observe("office");
        await page.locator("#map").click();
        await finishSecurityEntry(c);
        await point(240, 70);
        assert.equal((await state()).campaign.asset, 29);
        await press("Space");
        await until((s) => s.campaign.destination?.ready);
        await press("ArrowRight");
        await until(
          (s) => s.campaign.choice === 1 && s.campaign.destination?.ready,
        );
        await press("Space");
        await until((s) => s.scene === "departure");
        await observe("departure");
        await press("Space");
        await until((s) => s.scene === "flight");
        await observe("flight-start");
        const flight = await explorePhysicalFlight({
          page,
          state,
          until,
          policy: { altitude: [25, 40], climbHeading: 3 },
        });
        await writeFile(
          root + "/flight-controls.json",
          JSON.stringify(flight, null, 2) + "\n",
        );
        await until((s) => s.scene !== "flight");
        await observe("flight-return");
        assert.equal(
          (await state()).flight.outcome.code,
          1,
          "Exploratory pilot did not arrive;inspect normal crash/race result before calling this a port defect",
        );
        await until((s) => s.scene === "cave");
        await observe("cave-entry");
        const entry = await state(),
          plan = planCaveVariant(entry.cave.rooms, entry.briefing.variant);
        assert.equal(entry.cave.room, plan.start);
        await writeFile(
          root + "/cave-player-plan.json",
          JSON.stringify(
            {
              scope:
                "Original map geometry used only to choose player controls;not expected checkpoints or state initialization",
              variant: plan.variant,
              start: plan.start,
              goal: plan.goal,
              events: plan.events,
            },
            null,
            2,
          ) + "\n",
        );
        for (const event of plan.events.slice(1)) {
          await until(
            (s) => s.scene !== "cave" || s.cave.phase === "exploring",
          );
          assert.equal(
            (await state()).scene,
            "cave",
            "Player failed before completing planned map path",
          );
          const old = (await state()).cave.room,
            key = {
              up: "ArrowUp",
              down: "ArrowDown",
              left: "ArrowLeft",
              right: "ArrowRight",
            }[event.controls.direction];
          await page.keyboard.down(key);
          await page.keyboard.down("Space");
          await until((s) => s.scene !== "cave" || s.cave.room !== old);
          await page.keyboard.up("Space");
          await page.keyboard.up(key);
          await observe("room-" + (await state()).cave.room);
        }
        await until((s) => s.scene === "expedition-result");
        await observe("award");
        assert.equal(
          (await state()).cave.outcome.code,
          1,
          "Normal cave failure is not an unsupported-path diagnosis",
        );
        await settle();
        assert.equal((await state()).scene, "map");
        await observe("map-after-cave");
        await point(212, 131);
        assert.equal((await state()).campaign.selected, 0);
        await press("Space");
        await settle();
        await until((s) => s.scene === "bank" || s.scene === "ending");
        assert.equal((await state()).scene, "bank");
        await observe("bank-deposited");
        assert.equal((await state()).money, 0);
        assert.ok((await state()).campaign.banked > 0);
        await page.keyboard.down("Space");
        await until((s) => s.scene !== "bank");
        await page.keyboard.up("Space");
        await settle();
        assert.equal((await state()).scene, "map");
        await observe("map-after-bank");
        if (safari) {
          // Continue the same campaign. This policy chooses real controls from
          // visible animal state; it never supplies expected results or RNG.
          let arrived = false;
          // A lost race is a normal campaign branch. Read its claim and continue
          // to another unclaimed Safari instead of calling it a port dead end.
          for (const [attempt, destination] of [
            [46, 56],
            [173, 98],
          ].entries()) {
            await point(...destination);
            await press("Space");
            await settle();
            await until((s) => s.scene === "departure");
            await observe("safari-departure-" + attempt);
            await press("Space");
            await until((s) => s.scene === "flight");
            const secondFlight = await explorePhysicalFlight({
              page,
              state,
              until,
              policy: { altitude: [25, 40], climbHeading: 3 },
            });
            await writeFile(
              root + "/safari-flight-controls-" + attempt + ".json",
              JSON.stringify(secondFlight, null, 2) + "\n",
            );
            await until((s) => s.scene !== "flight");
            await observe("safari-flight-return-" + attempt);
            if ((await state()).flight.outcome.status === "race-lost") {
              assert.equal((await state()).scene, "rival-claim");
              if (reportProbe) {
                await observe("forced-entry");
                for (const key of ["p", "q", "s", "Space"])
                  await page.keyboard.press(key);
                await until((s) => s.reportPresentation?.phase === "reading");
                assert.equal((await state()).systemOverlay, null);
                assert.equal(await page.locator("#audio").isChecked(), false);
                await observe("forced-ready");
                await press("p");
                await until((s) => s.systemOverlay?.kind === "pause");
                await observe("pause");
                await until((s) => s.systemOverlay.phase === "waiting");
                await press("p");
                await until((s) => !s.systemOverlay);
                await observe("resumed");
                await press("Space");
                await until((s) => s.reportPresentation?.phase === "exit-wipe");
                await observe("forced-exit");
                await until((s) => s.scene !== "rival-claim");
                await settle();
                assert.equal((await state()).scene, "map");
                await observe("map");
                await writeFile(
                  root + "/presentations.json",
                  JSON.stringify(
                    await page.evaluate(() => window.reportFrames),
                    null,
                    2,
                  ) + "\n",
                );
                await saveRecordedRoute({
                  page,
                  root,
                  observations: points,
                  difficulty: 1,
                  physical: true,
                  scope:
                    "EXPLORATORY actual forced claim after naturally lost Standard Safari race;graphics,early-key flush,Pause/resume,map and Restart;not acceptance",
                });
                await page.locator("#restart").click();
                await until((s) => s.scene === "title");
                assert.equal((await state()).campaign.banked, 0);
                return {
                  completed: true,
                  accepted: false,
                  reason: "forced",
                  sourceCommit: source.commit,
                  checkpoints: points.length,
                  events: points.at(-1).eventCount,
                  restart: true,
                  nativeComparison: false,
                };
              }
              await settle();
              assert.equal((await state()).scene, "map");
              await observe("map-after-lost-race-" + attempt);
              continue;
            }
            assert.equal(
              reportProbe,
              false,
              "No forced-claim case executed;the player did not naturally lose this race",
            );
            assert.equal(
              (await state()).flight.outcome.code,
              1,
              "Exploratory second flight did not arrive;inspect its normal consequence",
            );
            arrived = true;
            break;
          }
          assert.ok(
            arrived,
            "Both exploratory Safari flights failed;all normal consequences retained",
          );
          await until(
            (s) =>
              s.scene === "photography" && s.photography.phase === "playing",
          );
          await observe("safari-entry");
          let targetShot = false;
          for (let shot = 0; shot < 12 && !targetShot; shot++) {
            const ready = await until(
              (s) =>
                s.scene !== "photography" ||
                s.photography.phase === "results" ||
                (s.photography.phase === "playing" &&
                  s.photography.animals.some(
                    (a) =>
                      a.place &&
                      a.animal === s.photography.target &&
                      a.frame === 0,
                  )),
            );
            assert.equal(ready.scene, "photography");
            if (ready.photography.phase === "results") break;
            const column = ready.photography.animals.findIndex(
              (a) =>
                a.place &&
                a.animal === ready.photography.target &&
                a.frame === 0,
            );
            const key = ["ArrowLeft", "ArrowUp", "ArrowRight"][column];
            await page.keyboard.down(key);
            await until((s) => s.photography.column === column);
            await page.keyboard.up(key);
            const before = await state();
            await page.keyboard.down("Space");
            await until(
              (s) =>
                s.photography.phase !== "playing" ||
                s.photography.photoCount > before.photography.photoCount ||
                s.photography.film < before.photography.film,
            );
            await page.keyboard.up("Space");
            targetShot = (await state()).photography.photos.includes(
              ready.photography.target,
            );
            await observe("safari-shot-" + shot);
          }
          assert.ok(
            targetShot,
            "Exploratory photographer missed the target;not an unsupported-path diagnosis",
          );
          for (
            let n = 0;
            n < 13 && (await state()).photography.phase === "playing";
            n++
          ) {
            const film = (await state()).photography.film;
            await page.keyboard.down("Space");
            await until(
              (s) =>
                s.photography.phase !== "playing" || s.photography.film < film,
            );
            await page.keyboard.up("Space");
          }
          await until((s) => s.photography.phase === "results");
          await observe("safari-results");
          await until((s) => s.scene !== "photography");
          await settle();
          assert.equal((await state()).scene, "map");
          await observe("map-after-safari");
          await point(212, 131);
          await press("Space");
          await settle();
          await until((s) => s.scene === "bank");
          await observe("safari-banked");
          assert.ok((await state()).campaign.banked > 3400);
          await page.keyboard.down("Space");
          await until((s) => s.scene !== "bank");
          await page.keyboard.up("Space");
          await settle();
          assert.equal((await state()).scene, "map");
          await observe("map-after-safari-bank");
        }
      }
      let final = null;
      if (winning) {
        final = await continueWinningCampaign({
          ...c,
          point,
          settle,
          observe,
          root,
          locations: original.game.campaign.locations,
          afterJungle: !!prefixManifest,
          afterMountain:
            prefixManifest &&
            (await json(prefixManifest)).lastCheckpoint === "mountain-map",
        });
        await writeFile(
          root + "/award-presentations.json",
          JSON.stringify(
            await page.evaluate(() => window.campaignAwards),
            null,
            2,
          ) + "\n",
        );
      }
      await saveRecordedRoute({
        page,
        root,
        observations: points,
        difficulty: 1,
        physical: true,
        scope: winning
          ? "EXPLORATORY winning Standard campaign with restored reward timing,all four families,later caves,credits/Restart;not self-acceptance or native parity"
          : "EXPLORATORY Standard Wages real startup/flight/cave/reward/deposit" +
            (safari ? "/second flight/Safari/deposit" : "") +
            ";not complete campaign or acceptance",
      });
      await page.locator("#restart").click();
      await until((s) => s.scene === "title");
      assert.equal((await state()).money, 0);
      assert.equal((await state()).campaign.banked, 0);
      return {
        completed: true,
        accepted: false,
        scope: winning
          ? "Winning Standard browser capture;independent replay required,not native parity"
          : safari
            ? "Standard Wages cave and Safari legs;not campaign completion"
            : "Standard Wages first playable leg only;not campaign completion",
        checkpoints: points.length,
        events: points.at(-1).eventCount,
        restart: true,
        sourceCommit: source.commit,
        ...(winning
          ? {
              expectedOutcome: {
                day: final.campaign.day,
                banked: final.campaign.banked,
                rivalBanked: final.campaign.rival.banked,
                playerCollected: final.campaign.playerCollected,
                won: final.ending.won,
                ready: final.ending.ready,
              },
            }
          : {}),
      };
    } catch (error) {
      await observe("failure");
      if (reportProbe)
        await writeFile(
          root + "/presentations.json",
          JSON.stringify(
            await page.evaluate(() => window.reportFrames),
            null,
            2,
          ) + "\n",
        );
      if (winning)
        await writeFile(
          root + "/award-presentations.json",
          JSON.stringify(
            await page.evaluate(() => window.campaignAwards),
            null,
            2,
          ) + "\n",
        );
      await saveRecordedRoute({
        page,
        root,
        observations: points,
        difficulty: 1,
        physical: true,
        scope: "FAILED exploratory Standard Wages leg;not acceptance",
      });
      throw error;
    }
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
  console.log(JSON.stringify(result));
} finally {
  await writeFile(
    root + "/exploration-status.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
