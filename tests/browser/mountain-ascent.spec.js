import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { openRecordedApplication } from "./helpers/clock.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "./helpers/entry-recording.js";
import inputs from "../../reference/security-mountain-ascent-inputs.json" with { type: "json" };
import accepted from "../../reference/office-mountain-ascent.json" with { type: "json" };
import entry from "../../reference/security-mountain-entry.json" with { type: "json" };

test("keyboard mountain ascent awards treasure and prevents duplicate collection", async ({
  page,
}) => {
  test.setTimeout(180000);
  const capture = process.env.DUCKTALES_CAPTURE_MOUNTAIN_ASCENT;
  if (!capture)
    expect(
      accepted.pending,
      "SETUP: mountain capture needs independent acceptance",
    ).toBe(false);
  const errors = [],
    observations = [];
  let checked = 0,
    reports = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const c = page.locator("#game");
  await c.waitFor({ state: "visible" });
  const state = async () => JSON.parse(await c.getAttribute("data-state"));
  for (
    let i = 0;
    i < 100 && (await c.getAttribute("data-scene")) !== "title";
    i++
  )
    await page.clock.runFor(20);
  await c.focus();
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function until(p, max = 4000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && p(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(`unfinished ascent ${JSON.stringify(await state())}`);
  }
  async function observe(name) {
    const p = await observeRecordedRoute({ page, state: await state(), name });
    observations.push(p);
    if (!capture) {
      const expected = accepted.checkpoints[checked++];
      expect(expected).toBeDefined();
      for (const k of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        expect(p[k], `Ascent ${name} ${k}`).toEqual(expected[k]);
    }
    return p;
  }
  async function report(name, action, from) {
    const s = await state();
    expect(s.pendingCampaignAction).toEqual(action);
    expect(s.campaign.rival.location).toBe(from);
    if (s.rivalReport.target > 0 && s.rivalReport.target < 35)
      expect(s.campaign.rivalCollected).toContain(s.rivalReport.target);
    const original = PNG.sync.read(
      await readFile(".local/rival-value-report.png"),
    );
    const actual = PNG.sync.read(
      Buffer.from(
        (await c.evaluate((e) => e.toDataURL())).split(",")[1],
        "base64",
      ),
    );
    for (let y = 0; y < 200; y++)
      expect(
        Buffer.compare(
          actual.data.subarray(y * 1280, y * 1280 + 512),
          original.data.subarray(y * 1280, y * 1280 + 512),
        ),
        "Native Glomgold portrait",
      ).toBe(0);
    reports++;
    await observe(name);
    return s.rivalReport.target;
  }
  async function finishScene(scene, label, action, from) {
    let seen = false,
      target;
    for (let i = 0; i < 5000; i++) {
      const s = await state();
      if (s.diagnostic) throw Error(s.diagnostic);
      if (s.scene === "rival-report" && !seen) {
        target = await report(label + "-rival-report", action, from);
        seen = true;
      }
      if (s.scene === scene) {
        if (seen) expect(s.campaign.rival.location).toBe(target);
        return s;
      }
      await page.clock.runFor(8);
    }
    throw Error(`unfinished reported ${scene}`);
  }
  await press("Space");
  await waitForScene(page, c, "difficulty");
  await press("Enter");
  await waitForScene(page, c, "office");
  await page.locator("#map").click();
  await finishSecurityEntry({ page, state, until });
  expect(
    await bankTrips({ page, canvas: c, state, until, press, count: 2 }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
  ]);
  const b = await c.boundingBox();
  await c.click({
    position: { x: (b.width * 36) / 320, y: (b.height * 61) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.racing).toBe(false);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await until((s) => s.scene === "mountain");
  const initial = await observe("entry");
  // Exploratory capture records the complete new entry before any gameplay.
  // Acceptance compares it through the declared current route, never a fitted
  // timer or a normalized historical hash.
  if (!capture) {
    expect(initial.stateSha256).toBe(
      accepted.entryStateSha256 ?? entry.entryStateSha256,
    );
    expect(initial.pixelsSha256).toBe(
      accepted.entryPixelsSha256 ?? entry.entryPixelsSha256,
    );
  }
  expect(initial.state.mountain.lives).toBe(3);
  expect(initial.state.flight.outcome.status).toBe("crashed");
  expect(initial.state.campaign.location).toBe(31);
  const stream = inputs.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream).toHaveLength(764);
  expect(createHash("sha256").update(Buffer.from(stream)).digest("hex")).toBe(
    inputs.sha256,
  );
  let held = new Set(),
    used = 0;
  const rows = [];
  for (const byte of stream) {
    const next = new Set([
      ...(byte & 64 ? ["Space"] : []),
      ...({
        1: ["ArrowUp"],
        3: ["ArrowRight"],
        5: ["ArrowDown"],
        7: ["ArrowLeft"],
      }[byte & 63] ?? []),
    ]);
    for (const k of held) if (!next.has(k)) await page.keyboard.up(k);
    for (const k of next) if (!held.has(k)) await page.keyboard.down(k);
    held = next;
    const before = await state();
    expect(before.scene).toBe("mountain");
    expect(before.mountain.frames).toBe(used);
    const after = await until(
      (s) =>
        s.scene !== "mountain" || s.mountain.frames > before.mountain.frames,
      1500,
    );
    expect(after.mountain.frames, "Exactly one mountain input frame").toBe(
      before.mountain.frames + 1,
    );
    used++;
    if (rows.at(-1) !== after.mountain.row) rows.push(after.mountain.row);
    if (used % 40 === 0 || used === stream.length)
      await observe(`input-${used}`);
  }
  for (const k of held) await page.keyboard.up(k);
  const award = await until((s) => s.scene !== "mountain", 1500);
  expect(award.scene).toBe("expedition-result");
  expect(award.mountain.outcome.code).toBe(1);
  expect(used).toBe(764);
  expect(award.expeditionResult.value).toBe(8000);
  expect(award.money).toBe(award.mountain.money + 8000);
  expect(award.campaign.day).toBe(initial.state.campaign.day + 1);
  expect(rows).toContain(24);
  await observe("award");
  await c.screenshot({
    path: ".local/browser-results/mountain-summit-award.png",
  });
  await press("Space");
  const returned = await finishScene(
    "map",
    "award",
    { type: "map" },
    award.campaign.rival.location,
  );
  expect(returned.campaign.playerCollected).toContain(31);
  expect(returned.money).toBe(award.money);
  expect(returned.campaign.rivalUnlockMask).toBe(2);
  await observe("returned-map");
  await press("Space");
  const notice = await finishScene(
    "visit-notice",
    "visit",
    { type: "travel", target: 31 },
    returned.campaign.rival.location,
  );
  expect(notice.visitNotice.reason).toBe("player");
  expect([notice.money, notice.campaign.day, notice.campaign.location]).toEqual(
    [returned.money, returned.campaign.day, returned.campaign.location],
  );
  await observe("collected-notice");
  await press("Space");
  const again = await until((s) => s.scene === "map");
  expect(again.money).toBe(award.money);
  expect(again.campaign.day).toBe(award.campaign.day);
  expect(
    reports,
    "Required native portrait comparison executes",
  ).toBeGreaterThan(0);
  await observe("complete-map");
  if (capture)
    await saveRecordedRoute({
      page,
      root: capture,
      observations,
      scope:
        "Exploratory Easy mountain summit and duplicate-notice route;not a complete campaign",
    });
  else expect(checked).toBe(accepted.expectedCheckpointCount);
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("title");
  expect((await state()).mountain).toBeNull();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
  if (capture) throw Error("EXPLORATORY mountain ascent saved;not acceptance");
});
