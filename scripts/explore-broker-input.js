// Actual browser exploration:earn a coin,buy one share,leave via portfolio exit.
// No private state injection. Captures are port evidence,not native timing.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
} from "./lib/local-scenario-source.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
const root = await fresh(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9),
);
const source = await archiveSource(root);
const controls = process.argv.includes("--controls"),
  timeout = process.argv.includes("--timeout");
const result = await withCarlsbadBrowser(
  async ({ page, state, until, press }) => {
    const points = [];
    const note = async (name) =>
      points.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office" && s.officeMenu.ready);
    await page.keyboard.down("ArrowUp");
    await press("Space");
    await page.keyboard.up("ArrowUp");
    await until(
      (s) =>
        s.bin?.phase === "idle" &&
        s.bin.nextPose === 3 &&
        s.bin.remaining >= 10,
    );
    await press("Space");
    await until((s) => s.scene === "office" && s.officeMenu.ready);
    assert.equal((await state()).money, 1000);
    await note("earned-coin");
    await page.keyboard.down("ArrowLeft");
    await press("Space");
    await page.keyboard.up("ArrowLeft");
    await until((s) => s.scene === "investments");
    assert.equal((await state()).investments.phase, "portfolio");
    await press("Space");
    await press("ArrowRight");
    const quote = (await state()).investments.prices[10];
    await press("Space");
    assert.equal((await state()).money, 1000 - quote);
    assert.equal((await state()).investments.shares[10], 1);
    await note("bought-share");
    await press("ArrowLeft");
    await press("Space");
    assert.equal((await state()).investments.phase, "portfolio");
    for (let i = 0; i < 5; i++) await press("ArrowDown");
    assert.equal((await state()).investments.selected, 15);
    await page.keyboard.press("Space");
    await until((s) => s.investments?.phase === "broker");
    const entered = await state();
    await note("entry");
    await page.keyboard.press("p");
    await page.clock.runFor(16);
    const earlyPause = await state();
    await note("after-p");
    if (controls) assert.equal(earlyPause.systemOverlay, null);
    await until((s) => !!s.systemOverlay);
    await note("pause");
    if (controls) {
      assert.equal((await state()).investments.waitingForInputPoll, true);
      const remaining = (await state()).investments.remaining;
      await until((s) => s.systemOverlay?.phase === "waiting");
      assert.equal((await state()).investments.remaining, remaining);
      await note("pause-waiting");
      await page.keyboard.press("p");
      await until((s) => !s.systemOverlay);
      assert.equal((await state()).investments.remaining, remaining);
      await note("resumed");
      await page.keyboard.press("q");
      await page.keyboard.press("Space");
      await until((s) => s.systemOverlay?.kind === "quit");
      const quitRemaining = (await state()).investments.remaining;
      await note("quit");
      await page.keyboard.press("n");
      await until((s) => !s.systemOverlay);
      await note("quit-no");
      await until((s) => s.investments.remaining <= quitRemaining - 7);
      assert.equal(
        (await state()).scene,
        "investments",
        "Old Fire survived Quit-No",
      );
      await note("neutral");
      if (!timeout) await page.keyboard.press("Space");
      await until((s) => s.scene === "office" && s.officeMenu.ready);
      assert.equal((await state()).money, 1000 - quote);
      assert.equal((await state()).campaign.day, 1);
      assert.equal((await state()).rareCoinTaken, true);
      assert.equal((await state()).investments.shares[10], 1);
      await note("office");
      await page.keyboard.down("ArrowLeft");
      await press("Space");
      await page.keyboard.up("ArrowLeft");
      await until((s) => s.scene === "investments");
      assert.equal((await state()).investments.shares[10], 1);
      assert.equal((await state()).investments.phase, "portfolio");
      await note("reopened");
      for (let i = 0; i < 5; i++) await press("ArrowDown");
      await page.keyboard.press("Space");
      await until((s) => s.scene === "office" && s.officeMenu.ready);
      assert.equal(
        (await state()).investments.phase,
        "portfolio",
        "No-trade visit must not show broker",
      );
      assert.equal((await state()).money, 1000 - quote);
      assert.equal((await state()).campaign.day, 1);
      await note("no-trade-office");
    }
    await saveRecordedRoute({
      page,
      root,
      observations: points,
      difficulty: 0,
      physical: true,
      scope:
        "Exploratory Easy earned coin/share/broker Pause;not acceptance or original timing parity",
    });
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    return {
      completed: true,
      accepted: false,
      controls,
      timeout,
      entered,
      earlyPause,
      quote,
      checkpoints: points.length,
      events: points.at(-1).eventCount,
      restart: true,
      sourceCommit: source.commit,
    };
  },
);
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"),
);
await writeFile(
  root + "/capture-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    completed: true,
    quote: result.quote,
    earlyPause: result.earlyPause.systemOverlay,
  }),
);
