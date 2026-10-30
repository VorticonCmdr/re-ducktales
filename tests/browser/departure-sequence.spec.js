import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { pressDestinationKey } from "./helpers/destination-input.js";
import { originalGame } from "../helpers/original-game.js";
import { renderFlightPixels } from "../../src/game/flight-raster.js";
import { executableText } from "../../src/game/executable.js";
import { nextRandom } from "../../src/game/integer.js";

async function prepare(page) {
  await page.addInitScript(() => {
    window.departurePublications = [];
    window.departureKeys = [];
    document.addEventListener("keydown", (e) =>
      window.departureKeys.push(e.code),
    );
    document.addEventListener(
      "gamepresent",
      (e) => {
        const s = e.detail;
        if (s.scene === "departure")
          window.departurePublications.push({
            at: performance.now(),
            state: s,
            png: document.querySelector("#game").toDataURL(),
          });
      },
      true,
    );
  });
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (37.5 * b.width) / 320, y: (33.5 * b.height) / 200 },
  });
  await page.keyboard.press("Space");
  await pressDestinationKey(
    { page, state: t.state, until: t.until },
    "ArrowRight",
  );
  await pressDestinationKey({ page, state: t.state, until: t.until }, "Space");
  return t;
}
const digest = (b) => createHash("sha256").update(b).digest("hex");

test("Launchpad wipes, reveals and starts flight automatically with no extra Fire", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  if (process.env.DUCKTALES_DEPARTURE_SEQUENCE_NEGATIVE === "stall")
    await page.route("**/src/game/departure-scene.js*", async (route) => {
      const response = await route.fetch();
      let source = await response.text();
      expect(
        source.split("this.outcome = this.prepared.flightRequest;"),
      ).toHaveLength(2);
      source = source.replace(
        "this.outcome = this.prepared.flightRequest;",
        "this.outcome = null;",
      );
      await route.fulfill({
        response,
        body: source,
        contentType: "application/javascript",
      });
    });
  const t = await prepare(page);
  const keyCount = await page.evaluate(() => window.departureKeys.length);
  await page.clock.runFor(1000);
  let s = await t.state();
  expect(
    s.scene,
    "Required automatic departure handoff without another Fire",
  ).toBe("flight");
  expect(await page.evaluate(() => window.departureKeys.length)).toBe(keyCount);
  expect(s.campaign.day).toBe(1);
  expect(s.campaign.location).toBe(35);
  expect(s.money).toBe(0);
  const frames = await page.evaluate(() => window.departurePublications);
  // Fill can cross one incoming retrace phase;copy starts at a retrace and
  // finishes within one period. Every one of the50 source waits is required.
  expect([50, 51]).toContain(frames.length);
  expect(frames.map((f) => f.state.departureScene.consumedRetraces)).toEqual(
    Array.from(
      { length: frames.length },
      (_, i) => i + (frames.length === 51 ? 0 : 1),
    ),
  );
  const scene = frames.at(-1).state.departureScene;
  expect(scene.phase).toBe("handoff");
  expect(scene.consumedRetraces).toBe(50);
  expect(scene.completedWork).toBe(2);
  expect(scene.rngDraws).toBe(2);
  const metadata = frames[0].state.departure,
    firstSeed = nextRandom(metadata.seedBefore);
  for (const kind of ["wipe", "reveal"]) {
    const rows = frames.filter(
      (f) => f.state.departureScene.transition?.kind === kind,
    );
    expect([
      ...new Set(rows.map((f) => f.state.departureScene.transition.band)),
    ]).toEqual([0, 1, 2, 3, 4]);
    for (const row of rows) {
      expect(row.state.campaign.day).toBe(1);
      expect(row.state.money).toBe(0);
      expect(row.state.seed).toBe(
        kind === "wipe" ? metadata.seedBefore : firstSeed,
      );
    }
  }
  expect(frames.at(-1).state.seed).toBe(metadata.seed);
  // Conditional presentation comparison for the naturally generated starting
  // seed. Original pixels and RNG rules supply expected output;no result drives
  // the route's keys or clocks, and no Game object is accessed from the page.
  const original = await originalGame(),
    entries = original.archives.get("MAIN.ARC");
  const offsets = [
    [0x186, 0x199, 0x1a7],
    [0x1b8, 0x1c1, 0x1d0],
    [0x1d9, 0x1e2, 0x1ec],
  ][firstSeed % 3];
  const target = renderFlightPixels(
    [
      {
        op: "copy",
        asset: 30,
        x: 0,
        y: 0,
        sourceX: 0,
        sourceY: 0,
        width: 320,
        height: 200,
      },
      ...offsets.map((at, i) => ({
        op: "text",
        text: executableText(original.image, at),
        x: 168,
        y: 60 + i * 16,
        color: 15,
      })),
    ],
    entries,
    entries[42].data,
    "MAIN.ARC",
  );
  let checked = 0;
  for (let band = 0; band < 5; band++) {
    const row = frames.find(
      (f) =>
        f.state.departureScene.transition?.kind === "reveal" &&
        f.state.departureScene.transition.band === band,
    );
    expect(row).toBeTruthy();
    const actual = PNG.sync.read(
      Buffer.from(row.png.split(",")[1], "base64"),
    ).data;
    const expected = new Uint8Array(320 * 200 * 4);
    for (let y = 0; y < 200; y++)
      for (let x = 0; x < 320; x++) {
        const at = (y * 320 + x) * 4;
        if (y % 5 <= band) expected.set(target.subarray(at, at + 4), at);
        else expected[at + 3] = 255;
      }
    expect(digest(actual), `Source reveal group ${band}`).toBe(
      digest(expected),
    );
    checked++;
  }
  expect(checked).toBe(5);
  const full = Buffer.from(frames.at(-1).png.split(",")[1], "base64");
  expect(digest(PNG.sync.read(full).data)).toBe(digest(target));
  await writeFile(info.outputPath("departure-full.png"), full);
  await writeFile(
    info.outputPath("departure-sequence.json"),
    JSON.stringify(
      frames.map(({ png, ...f }) => ({
        ...f,
        pixelsSha256: digest(
          PNG.sync.read(Buffer.from(png.split(",")[1], "base64")).data,
        ),
      })),
      null,
      2,
    ),
  );
  // A meaningful flight action starts only after the automatic source call.
  await page.keyboard.down("Space");
  await t.until((s) => s.flight.speed >= 3, "throttle accelerates the plane");
  const before = await t.state();
  await page.keyboard.down("ArrowDown");
  await t.until(
    (s) => s.flight.y < before.flight.y,
    "takeoff raises the plane",
  );
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  expect((await t.state()).flight.frames).toBeGreaterThan(before.flight.frames);
  await t.canvas.screenshot({ path: info.outputPath("departure-flight.png") });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "Restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("departure discards early Pause, preserves reveal input to flight and cancels on Restart", async ({
  page,
}, info) => {
  const t = await prepare(page);
  await t.until(
    (s) => s.scene === "departure" && s.departureScene.phase === "wipe",
    "wipe",
  );
  await page.keyboard.press("KeyP");
  expect((await t.state()).systemOverlay).toBeNull();
  await t.until(
    (s) => s.scene === "departure" && s.departureScene.phase === "reveal",
    "reveal",
  );
  expect((await t.state()).pendingFlightSystemKeys).toBeUndefined();
  await page.keyboard.press("KeyP");
  expect((await t.state()).systemOverlay).toBeNull();
  const paused = await t.until(
    (s) => s.systemOverlay?.kind === "pause",
    "first flight reader Pause",
  );
  expect(paused.scene).toBe("flight");
  expect(paused.flight.frames).toBe(1);
  expect(paused.flight.inputReads).toBe(0);
  await t.until((s) => s.systemOverlay.phase === "waiting", "Pause lock");
  await page.keyboard.press("KeyP");
  await t.until((s) => !s.systemOverlay, "resume");
  expect((await t.state()).flight.inputReads).toBeGreaterThan(0);
  await writeFile(
    info.outputPath("departure-pause.json"),
    JSON.stringify(paused, null, 2),
  );
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "Restart");
  expect((await t.state()).departure).toBeNull();
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
