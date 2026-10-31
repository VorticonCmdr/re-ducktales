// Actual player capture and independent DOM replay; no expected output selects input.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { withCarlsbadBrowser as withRecordedBrowser } from "./carlsbad-browser.js";
import { finishSecurityEntry } from "../../tests/browser/helpers/security.js";
import { explorePhysicalFlight } from "../../tests/browser/helpers/flight-policy.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../../tests/browser/helpers/recorded-dom-input.js";
export const safariCases = [
  {
    variant: 1,
    asset: 3,
    location: 32,
    x: 46,
    y: 56,
    name: "Yellerstone Park",
  },
  { variant: 2, asset: 8, location: 3, x: 32, y: 80, name: "Duckbill Island" },
  { variant: 3, asset: 13, location: 8, x: 62, y: 106, name: "Ronguay" },
  {
    variant: 4,
    asset: 23,
    location: 18,
    x: 173,
    y: 98,
    name: "Kenya Game Reserve",
  },
  { variant: 5, asset: 28, location: 23, x: 227, y: 57, name: "Xanadu" },
  { variant: 6, asset: 31, location: 26, x: 280, y: 149, name: "Borneo" },
];
export const photoScore = (photos, target) =>
  photos.reduce((n, p) => n + (p === target ? 500 : p ? 50 : 0), 0);
export function safariNames(attempts) {
  assert.ok(Number.isInteger(attempts) && attempts > 0 && attempts <= 8);
  return [
    "office",
    "departure",
    "entry",
    ...Array.from({ length: attempts }, (_, i) => [
      "aim-" + (i + 1),
      "photo-" + (i + 1),
    ]).flat(),
    "film-exhausted",
    "results",
    "map",
  ];
}
export async function captureSafari(root, c) {
  await mkdir(root);
  return withRecordedBrowser(async (base) => {
    const { page, canvas, state, press } = base;
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Sound (reconstructed)" })
        .isChecked(),
      false,
    );
    let repeat = null;
    const observations = [];
    async function until(predicate) {
      for (let i = 0; i < 20000; i++) {
        const s = await state();
        if (s?.diagnostic) throw Error(s.diagnostic);
        if (s && predicate(s)) return s;
        const ms = repeat ? Math.min(8, repeat.remaining) : 8;
        await page.clock.runFor(ms);
        if (repeat) {
          repeat.remaining -= ms;
          if (!repeat.remaining) {
            await page.keyboard.down(repeat.key);
            repeat.remaining = 32;
          }
        }
      }
      throw Error(
        "Unfinished Safari " + c.name + ":" + JSON.stringify(await state()),
      );
    }
    const observe = async (name) =>
      observations.push(
        await observeRecordedRoute({ page, state: await state(), name }),
      );
    await until((s) => s.scene === "title");
    await press("Space");
    await until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
    await press("Enter");
    await until((s) => s.scene === "office");
    await observe("office");
    await page.locator("#map").click();
    await finishSecurityEntry({ page, state, until });
    const b = await canvas.boundingBox();
    await canvas.click({
      position: { x: (b.width * c.x) / 320, y: (b.height * c.y) / 200 },
    });
    await page.clock.runFor(100);
    assert.equal((await state()).campaign.asset, c.asset);
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
    const entry = await until(
      (s) => s.scene === "photography" && s.photography.phase === "playing",
    );
    assert.equal(entry.difficulty, 0);
    assert.equal(entry.briefing.variant, c.variant);
    assert.equal(entry.campaign.location, c.location);
    assert.equal(entry.flight.outcome.code, 1);
    assert.equal(entry.expeditionKeys.mode, 1);
    await observe("entry");
    let targetShot = false,
      attempts = 0;
    while (attempts < 8 && !targetShot) {
      const ready = await until(
        (s) =>
          s.scene !== "photography" ||
          s.photography.phase !== "playing" ||
          s.photography.animals.some(
            (a) =>
              a.place && a.animal === s.photography.target && a.frame === 0,
          ),
      );
      assert.equal(ready.scene, "photography");
      assert.equal(ready.photography.phase, "playing");
      const column = ready.photography.animals.findIndex(
          (a) =>
            a.place && a.animal === ready.photography.target && a.frame === 0,
        ),
        key = ["ArrowLeft", "ArrowUp", "ArrowRight"][column];
      assert.ok(key);
      await page.keyboard.down(key);
      await until((s) => s.photography.column === column);
      await page.keyboard.up(key);
      attempts++;
      await observe("aim-" + attempts);
      const count = (await state()).photography.photoCount;
      await page.keyboard.down("Space");
      await until(
        (s) =>
          s.photography.photoCount > count || s.photography.phase !== "playing",
      );
      await page.keyboard.up("Space");
      assert.equal((await state()).photography.photoCount, count + 1);
      targetShot = (await state()).photography.photos.includes(
        ready.photography.target,
      );
      await observe("photo-" + attempts);
    }
    assert.equal(targetShot, true, "No target photo");
    await page.keyboard.down("Space");
    repeat = { key: "Space", remaining: 250 };
    const exhausted = await until(
      (s) => s.scene === "photography" && s.photography.phase === "results",
    );
    repeat = null;
    await page.keyboard.up("Space");
    assert.equal(exhausted.photography.photoCount, 12);
    assert.equal(exhausted.photography.film, -1);
    const score = photoScore(
      exhausted.photography.photos,
      exhausted.photography.target,
    );
    assert.ok(score >= 500);
    await observe("film-exhausted");
    const results = await until(
      (s) =>
        s.scene === "photography" &&
        s.photography.phase === "results" &&
        s.photography.wait?.clock === "driver",
    );
    assert.equal(results.photography.score, score);
    assert.equal(results.money, entry.money + score);
    await observe("results");
    const map = await until((s) => s.scene === "map");
    assert.equal(map.money, entry.money + score);
    assert.equal(map.campaign.day, entry.campaign.day + 2);
    assert.deepEqual(map.campaign.playerCollected, [c.location]);
    assert.equal(map.photography.outcome.code, 1);
    await observe("map");
    assert.deepEqual(
      observations.map((p) => p.name),
      safariNames(attempts),
    );
    await saveRecordedRoute({
      page,
      root,
      observations,
      scope:
        "EXPLORATORY completed Easy Safari;independent DOM replay required",
    });
    const env = JSON.parse(await readFile(root + "/environment.json"));
    env.completed = true;
    env.scope = "Route completed;not acceptance";
    await writeFile(
      root + "/environment.json",
      JSON.stringify(env, null, 2) + "\n",
    );
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    const reset = await state();
    assert.equal(reset.photography, null);
    assert.equal(reset.money, 0);
    assert.deepEqual(reset.campaign.playerCollected, []);
    return {
      variant: c.variant,
      completed: true,
      accepted: false,
      attempts,
      score,
      photos: exhausted.photography.photos,
      checkpoints: observations.length,
      events: observations.at(-1).eventCount,
      restart: true,
      final: {
        money: map.money,
        day: map.campaign.day,
        location: c.location,
        target: map.photography.target,
        seed: map.photography.seed,
        frames: map.photography.frames,
        presentations: map.photography.presentations,
      },
    };
  });
}
function boundary({ time, type, key, target, x, y }) {
  return {
    time,
    type,
    key,
    target,
    ...(type === "pointerdown" && target === "game"
      ? {
          x: Math.max(32, Math.min(285, Math.trunc(x))),
          y: Math.max(28, Math.min(151, Math.trunc(y))),
        }
      : {}),
  };
}
export async function replaySafari(
  events,
  checks,
  description,
  negative = false,
) {
  assert.ok(events.length > 0);
  assert.deepEqual(
    checks.map((p) => p.name),
    safariNames(description.attempts),
  );
  assert.equal(checks.at(-1).eventCount, events.length);
  return withRecordedBrowser(async ({ page, state, until }) => {
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Sound (reconstructed)" })
        .isChecked(),
      false,
    );
    const observed = [];
    let now = 1,
      consumed = 0;
    const aim = checks.find((p) => p.name === "aim-1"),
      photo = checks.find((p) => p.name === "photo-1"),
      omitted = negative
        ? events.findIndex(
            (e, i) =>
              i >= aim.eventCount &&
              i < photo.eventCount &&
              e.type === "keydown" &&
              [" ", "Space"].includes(e.key),
          )
        : -1;
    if (negative) assert.ok(omitted >= 0, "SETUP: missing first shutter");
    async function advance(at) {
      assert.ok(Number.isFinite(at) && at >= now, "Late Safari event");
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    }
    for (const expected of checks) {
      assert.ok(
        expected.eventCount >= consumed && expected.eventCount <= events.length,
      );
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
      assert.equal(actual.state?.diagnostic, null);
      assert.equal(actual.at, expected.at);
      assert.equal(
        actual.stateSha256,
        expected.stateSha256,
        "Safari state " + expected.name,
      );
      assert.equal(
        actual.pixelsSha256,
        expected.pixelsSha256,
        "Safari pixels " + expected.name,
      );
      assert.equal(actual.eventCount, consumed);
      assert.deepEqual(
        (await page.evaluate(() => window.entryEvents)).map(boundary),
        events.slice(0, consumed).map(boundary),
        "Safari external event sequence",
      );
      observed.push({
        name: actual.name,
        at: actual.at,
        eventCount: actual.eventCount,
        stateSha256: actual.stateSha256,
        pixelsSha256: actual.pixelsSha256,
      });
      console.log(
        "Safari" + description.variant + " checkpoint " + expected.name,
      );
    }
    assert.equal(consumed, events.length);
    const final = await state();
    assert.equal(final.scene, "map");
    assert.equal(final.money, description.final.money);
    assert.equal(final.campaign.day, description.final.day);
    assert.deepEqual(final.campaign.playerCollected, [
      description.final.location,
    ]);
    assert.equal(final.photography.outcome.code, 1);
    assert.equal(final.photography.score, 0);
    assert.equal(final.photography.outcome.score, description.score);
    assert.deepEqual(final.photography.photos, description.photos);
    assert.equal(
      photoScore(final.photography.photos, final.photography.target),
      description.score,
    );
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).photography, null);
    assert.equal((await state()).money, 0);
    assert.deepEqual((await state()).campaign.playerCollected, []);
    return {
      variant: description.variant,
      completed: true,
      checked: checks.length,
      consumed,
      restart: true,
      observed,
      final,
    };
  });
}
