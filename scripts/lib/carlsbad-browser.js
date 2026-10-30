import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRecordedApplication } from "../../tests/browser/helpers/clock.js";
import { finishSecurityEntry } from "../../tests/browser/helpers/security.js";
import { bankTrips } from "../../tests/browser/helpers/bank-trips.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "../../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../../tests/browser/helpers/recorded-dom-input.js";
export const CARLSBAD_POINTS = [
  "office",
  "departure",
  "cave-entry",
  "room-37",
  "room-29",
  "room-21",
  "room-13",
  "room-12",
  "room-11",
  "room-19",
  "award",
  "map",
];
const root = fileURLToPath(new URL("../../", import.meta.url));
function boundary({ time, type, key, target, x, y }) {
  return {
    time,
    type,
    key,
    target,
    ...(target === "game" && type === "pointerdown"
      ? {
          x: Math.max(32, Math.min(285, Math.trunc(x))),
          y: Math.max(28, Math.min(151, Math.trunc(y))),
        }
      : {}),
  };
}
export async function withCarlsbadBrowser(fn) {
  const cache = await mkdtemp(join(tmpdir(), "ducktales-carlsbad-"));
  let server, browser;
  try {
    server = await createServer({
      root,
      configFile: root + "vite.campaign.config.js",
      cacheDir: cache,
      server: { host: "127.0.0.1", port: 0, strictPort: true },
      logLevel: "error",
    });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        baseURL: "http://127.0.0.1:" + server.httpServer.address().port,
        timezoneId: "UTC",
      }),
      page = await context.newPage();
    const errors = [],
      navigation = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navigation.push(f.url());
    });
    await installEntryRecording(page);
    await openRecordedApplication(page, 1);
    // Network completion is an upstream readiness boundary, not simulation time.
    await expect(page.locator("#actions")).toBeVisible();
    await page.locator("#game").focus();
    const canvas = page.locator("#game"),
      state = async () => JSON.parse(await canvas.getAttribute("data-state"));
    async function until(predicate) {
      for (let i = 0; i < 20000; i++) {
        const s = await state();
        if (s?.diagnostic) throw Error(s.diagnostic);
        if (s && predicate(s)) return s;
        await page.clock.runFor(8);
      }
      throw Error("Unfinished Carlsbad UI sequence");
    }
    async function press(key) {
      await page.keyboard.press(key);
      await page.clock.runFor(100);
    }
    const result = await fn({ page, canvas, state, until, press });
    assert.deepEqual(errors, []);
    assert.equal(navigation.length, 1, "Unexpected Carlsbad navigation");
    return result;
  } finally {
    await browser?.close();
    await server?.close();
    await rm(cache, { recursive: true, force: true });
  }
}
export async function captureCarlsbad(output) {
  return withCarlsbadBrowser(async (c) => {
    const { page, canvas, state, until, press } = c,
      observations = [];
    async function observe(name) {
      observations.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
    }
    await until((s) => s.scene === "title");
    await canvas.focus();
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office");
    await observe("office");
    await page.locator("#map").click();
    await finishSecurityEntry(c);
    await bankTrips({ ...c, count: 2 });
    const box = await canvas.boundingBox();
    await canvas.click({
      position: { x: (box.width * 45) / 320, y: (box.height * 68) / 200 },
    });
    await page.clock.runFor(100);
    assert.equal((await state()).campaign.asset, 5);
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
    await page.keyboard.down("Space");
    await page.clock.runFor(1200);
    await page.keyboard.down("ArrowDown");
    await page.clock.runFor(300);
    await page.keyboard.up("ArrowDown");
    await page.clock.runFor(800);
    await page.keyboard.up("Space");
    await until((s) => s.scene === "cave");
    assert.equal((await state()).cave.room, 45);
    assert.equal((await state()).cave.goal, 19);
    await observe("cave-entry");
    await until((s) => s.cave.phase === "exploring");
    for (const key of [
      "ArrowUp",
      "ArrowUp",
      "ArrowUp",
      "ArrowUp",
      "ArrowLeft",
      "ArrowLeft",
      "ArrowDown",
    ]) {
      const old = await state();
      await page.keyboard.down(key);
      await page.keyboard.down("Space");
      const moved = await until(
        (s) => s.cave.room !== old.cave.room || s.scene !== "cave",
      );
      await page.keyboard.up("Space");
      await page.keyboard.up(key);
      await observe("room-" + moved.cave.room);
      if (moved.cave.room !== moved.cave.goal)
        await until((s) => s.cave.phase === "exploring");
    }
    await until((s) => s.scene === "expedition-result");
    assert.equal((await state()).money, 2800);
    await observe("award");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "map");
    await page.keyboard.up("Space");
    await page.clock.runFor(16);
    assert.deepEqual((await state()).campaign.playerCollected, [34]);
    await observe("map");
    assert.deepEqual(
      observations.map((p) => p.name),
      CARLSBAD_POINTS,
    );
    await saveRecordedRoute({
      page,
      root: output,
      observations,
      scope:
        "Exploratory Easy Carlsbad startup/flight/treasure/award/map route;not acceptance or native whole-level parity",
    });
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).cave, null);
    assert.equal((await state()).money, 0);
    assert.deepEqual((await state()).campaign.playerCollected, []);
    return {
      routeCompleted: true,
      accepted: false,
      checkpoints: observations.length,
      events: observations.at(-1).eventCount,
      restart: true,
    };
  });
}
export async function replayCarlsbad(events, checks, negative = null) {
  return withCarlsbadBrowser(async ({ page, canvas, state, until }) => {
    assert.deepEqual(
      checks.map((c) => c.name),
      CARLSBAD_POINTS,
    );
    assert.ok(events.length > 0);
    assert.equal(checks.at(-1).eventCount, events.length);
    let now = 1,
      consumed = 0;
    const omitted =
      negative === "omit-first-move"
        ? events.findIndex(
            (e, i) =>
              i >= checks[2].eventCount &&
              e.type === "keydown" &&
              e.key === "ArrowUp",
          )
        : -1;
    if (negative) assert.ok(omitted >= 0, "SETUP: missing first cave move");
    async function advance(at) {
      assert.ok(at >= now, "Late Carlsbad input");
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    }
    for (const expected of checks) {
      while (consumed < expected.eventCount) {
        const e = events[consumed];
        await advance(e.time);
        if (consumed !== omitted) await recordedDOMInput(page, e);
        consumed++;
      }
      await advance(expected.at);
      const actual = await observeRecordedRoute({
        page,
        state: await state(),
        name: expected.name,
      });
      assert.equal(actual.at, expected.at);
      assert.equal(actual.state.diagnostic, null);
      assert.equal(
        actual.stateSha256,
        expected.stateSha256,
        "Carried alternate-cave state " + expected.name,
      );
      assert.equal(
        actual.pixelsSha256,
        expected.pixelsSha256,
        "Carried alternate-cave pixels " + expected.name,
      );
      assert.deepEqual(
        (await page.evaluate(() => window.entryEvents)).map(boundary),
        events.slice(0, consumed).map(boundary),
        "Carried Carlsbad external events",
      );
    }
    assert.equal(consumed, events.length);
    const s = await state();
    assert.equal(s.scene, "map");
    assert.equal(s.money, 2800);
    assert.equal(s.campaign.day, 17);
    assert.deepEqual(s.campaign.playerCollected, [34]);
    await page.locator("#restart").click();
    await until((v) => v.scene === "title");
    assert.equal((await state()).cave, null);
    assert.equal((await state()).money, 0);
    assert.deepEqual((await state()).campaign.playerCollected, []);
    return { completed: true, checked: checks.length, consumed, restart: true };
  });
}
