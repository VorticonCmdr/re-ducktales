// Source-authored controls, observed first in actual Easy browser exploration.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { withCarlsbadBrowser as withRecordedBrowser } from "./carlsbad-browser.js";
import { finishSecurityEntry } from "../../tests/browser/helpers/security.js";
import { explorePhysicalFlight } from "../../tests/browser/helpers/flight-policy.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../../tests/browser/helpers/entry-recording.js";
import { runRecordedCampaign } from "../../tests/browser/helpers/recorded-campaign.js";
export const mountainCases = [
  {
    key: "thunderclap",
    variant: 1,
    location: 33,
    inputs: 494,
    treasure: 2000,
    pickups: 100,
  },
  {
    key: "machu",
    variant: 2,
    location: 5,
    inputs: 710,
    treasure: 2500,
    pickups: 200,
    waitAfter: 402,
    waitInputs: 4,
  },
];
export async function captureEasyMountain(root, c) {
  await mkdir(root);
  return withRecordedBrowser(async (tools) => {
    const { page, canvas, state, until, press } = tools,
      points = [];
    const observe = async (name) =>
      points.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office");
    await observe("office");
    await page.locator("#map").click();
    await finishSecurityEntry(tools);
    const recipe = JSON.parse(
      await readFile("reference/" + c.key + "-expedition-inputs.json"),
    );
    const b = await canvas.boundingBox();
    await canvas.click({
      position: {
        x: (b.width * recipe.departurePoint[0]) / 320,
        y: (b.height * recipe.departurePoint[1]) / 200,
      },
    });
    await page.clock.runFor(100);
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
    await explorePhysicalFlight({
      page,
      state,
      until,
      policy: { altitude: [25, 40], climbHeading: 3 },
    });
    await until((s) => s.scene === "mountain");
    const entry = await state();
    assert.equal(entry.briefing.variant, c.variant);
    assert.equal(entry.difficulty, 0);
    assert.equal(entry.mountain.frames, 0);
    assert.equal(entry.flight.outcome.code, 1);
    await observe("entry");
    const rows = structuredClone(recipe.mountain);
    const stream = rows.flatMap((e) => Array(e.count).fill(e.byte));
    if (c.waitInputs)
      stream.splice(c.waitAfter, 0, ...Array(c.waitInputs).fill(0));
    assert.equal(stream.length, c.inputs);
    const boundaries = new Set();
    let end = 0;
    for (const row of rows) {
      end += row.count;
      boundaries.add(
        end + (c.waitInputs && end > c.waitAfter ? c.waitInputs : 0),
      );
    }
    if (c.waitInputs) boundaries.add(c.waitAfter + c.waitInputs);
    const keys = (byte) =>
      new Set([
        ...(byte & 64 ? ["Space"] : []),
        ...({
          1: ["ArrowUp"],
          3: ["ArrowRight"],
          5: ["ArrowDown"],
          7: ["ArrowLeft"],
        }[byte & 63] ?? []),
      ]);
    let held = new Set(),
      used = 0;
    for (let i = 0; i < stream.length; i++) {
      assert.equal(
        (await state()).scene,
        "mountain",
        "Unfinished mountain input sequence",
      );
      const next = keys(stream[i]);
      for (const k of held) if (!next.has(k)) await page.keyboard.up(k);
      for (const k of next) await page.keyboard.down(k);
      held = next;
      // Mode0 consumes a released flag once. Release before the last intended read.
      const following = keys(stream[i + 1] ?? 0);
      for (const k of [...held])
        if (!following.has(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      const before = await state();
      assert.equal(before.mountain.frames, used);
      const after = await until(
        (s) => s.scene !== "mountain" || s.mountain.frames > used,
      );
      used++;
      assert.equal(after.mountain.frames, used, "Skipped mountain input frame");
      if (boundaries.has(used) || used % 40 === 0)
        await observe("input-" + used);
    }
    for (const k of held) await page.keyboard.up(k);
    const award = await until((s) => s.scene === "expedition-result");
    assert.equal(award.mountain.outcome.code, 1);
    assert.equal(award.mountain.lives, 3);
    assert.equal(award.mountain.money, c.pickups);
    assert.equal(award.expeditionResult.value, c.treasure);
    assert.equal(award.money, c.pickups + c.treasure);
    await observe("award");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "map");
    await page.keyboard.up("Space");
    await page.clock.runFor(16);
    const map = await state();
    assert.deepEqual(map.campaign.playerCollected, [c.location]);
    assert.equal(map.campaign.day, entry.campaign.day + 1);
    await observe("map");
    await saveRecordedRoute({
      page,
      root,
      observations: points,
      scope:
        "EXPLORATORY complete Easy alternate mountain;independent DOM replay required",
    });
    const environment = JSON.parse(await readFile(root + "/environment.json"));
    environment.completed = true;
    environment.scope = "Route complete;not accepted until independent replay";
    await writeFile(
      root + "/environment.json",
      JSON.stringify(environment, null, 2) + "\n",
    );
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).mountain, null);
    assert.deepEqual((await state()).campaign.playerCollected, []);
    return {
      key: c.key,
      completed: true,
      accepted: false,
      checkpoints: points.length,
      events: points.at(-1).eventCount,
      inputs: used,
      restart: true,
      expectedOutcome: {
        money: map.money,
        day: map.campaign.day,
        playerCollected: map.campaign.playerCollected,
        ...Object.fromEntries(
          ["frames", "presentations", "lives", "seed"].map((k) => [
            k,
            map.mountain[k],
          ]),
        ),
      },
    };
  });
}
// Reuse the existing strict timestamped DOM comparator on a fresh page. This
// server/context is owned by this one operation and always closed, including failure.
export async function replayEasyMountain(manifest, out, negativeMode) {
  await mkdir(out);
  const cache = await mkdtemp(join(tmpdir(), "ducktales-easy-mountain-"));
  let server, browser;
  try {
    server = await createServer({
      root: process.cwd(),
      configFile: process.cwd() + "/vite.campaign.config.js",
      cacheDir: cache,
      server: { host: "127.0.0.1", port: 0, strictPort: true },
      logLevel: "error",
    });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:" + server.httpServer.address().port,
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    await runRecordedCampaign({
      page,
      info: { outputPath: (name) => join(out, name) },
      manifest,
      negativeMode,
    });
    const s = JSON.parse(
      await page.locator("#game").getAttribute("data-state"),
    );
    assert.equal(s.money, manifest.expectedOutcome.money);
    await page.locator("#restart").click();
    for (let i = 0; i < 20000; i++) {
      const s = JSON.parse(
        await page.locator("#game").getAttribute("data-state"),
      );
      if (s.diagnostic) throw Error(s.diagnostic);
      if (s.scene === "title") {
        assert.equal(s.money, 0);
        assert.equal(s.mountain, null);
        assert.deepEqual(s.campaign.playerCollected, []);
        return {
          completed: true,
          checked: manifest.expectedCheckpointCount,
          consumed: manifest.requiredEventCount,
          restart: true,
        };
      }
      await page.clock.runFor(8);
    }
    throw Error("Unfinished mountain Restart");
  } finally {
    await browser?.close();
    await server?.close();
    await rm(cache, { recursive: true, force: true });
  }
}
