import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { parseArchive, imagePixels } from "../../src/assets.js";
import { campaign } from "./helpers/ending-route.js";

// Route explored interactively through the title, office and five bank journeys.
// Observer captures only public snapshots/canvas pixels; it cannot modify game state.
test("ending row groups, input flush and pause work on the real campaign route", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.endingRows = [];
    let previous = null;
    const seen = new Set();
    document.addEventListener(
      "gamepresent",
      ({ detail: s }) => {
        const canvas = document.querySelector("#game");
        if (s.scene !== "ending") {
          previous = canvas.toDataURL();
          return;
        }
        const t = s.ending.transition;
        if (!t || t.kind === "flip") return;
        const key = `${s.ending.phase}:${t.token}:${t.band}`;
        if (seen.has(key)) return;
        seen.add(key);
        window.endingRows.push({
          phase: s.ending.phase,
          ...t,
          png: canvas.toDataURL(),
          previous,
        });
      },
      true,
    );
  });
  const t = await campaign(page);
  await t.ending({ waitForReady: false });
  // Keys during presentation are flushed at the first dialogue input boundary.
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  await page.keyboard.press("Space");
  await t.until((s) => s.ending.phase === "cover" && s.ending.ready);
  expect((await t.state()).systemOverlay).toBeNull();
  await expect(page.locator("#audio")).not.toBeChecked();
  const entries = parseArchive(await readFile("game/MAIN.ARC"));
  const decode = (url) =>
    PNG.sync.read(Buffer.from(url.split(",")[1], "base64")).data;
  const black = Buffer.alloc(256000);
  for (let i = 3; i < black.length; i += 4) black[i] = 255;
  async function compare(phase, incoming, target) {
    const rows = await page.evaluate(
      (phase) => window.endingRows.filter((r) => r.phase === phase),
      phase,
    );
    expect(rows.length).toBe(10);
    expect(rows.map((r) => [r.kind, r.band])).toEqual(
      ["wipe", "reveal"].flatMap((kind) =>
        [0, 1, 2, 3, 4].map((band) => [kind, band]),
      ),
    );
    for (const r of rows) {
      const source = incoming ?? decode(r.previous),
        actual = decode(r.png);
      const expected = Buffer.from(r.kind === "wipe" ? source : black);
      // Independent expected scanlines, not the production compositor.
      for (let residue = 0; residue <= r.band; residue++)
        for (let y = residue; y < 200; y += 5) {
          const start = y * 1280;
          expected.set(
            (r.kind === "wipe" ? black : target).subarray(start, start + 1280),
            start,
          );
        }
      expect(
        Buffer.compare(actual, expected),
        `${phase} ${r.kind} group${r.band}`,
      ).toBe(0);
      if (phase === "cover" && r.kind === "reveal" && r.band === 2)
        await writeFile(
          ".local/browser-results/ending-reveal-group2.png",
          PNG.sync.write({ width: 320, height: 200, data: actual }),
        );
    }
  }
  await compare("cover", null, imagePixels(entries[36]));
  await t.pixels(".local/ending-winner-first.png");
  await t.press("p");
  const paused = await t.until(
    (s) =>
      s.systemOverlay?.kind === "pause" && s.systemOverlay.phase === "waiting",
  );
  const pausedImage = await t.canvas.evaluate((c) => c.toDataURL());
  await page.clock.runFor(1000);
  expect((await t.state()).ending).toEqual(paused.ending);
  expect(await t.canvas.evaluate((c) => c.toDataURL())).toBe(pausedImage);
  await t.press("p");
  await t.until((s) => s.systemOverlay === null);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "celebration" && s.ending.ready);
  await compare(
    "celebration",
    imagePixels(entries[36]),
    imagePixels(entries[39]),
  );
  await t.pixels(".local/ending-winner-second.png");
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay" && s.ending.ready);
  await compare("replay", imagePixels(entries[39]), black);
  await t.pixels(".local/ending-replay-yes.png");
  await t.press("ArrowDown");
  await t.until((s) => s.ending.choice === 1 && s.ending.ready);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "credits" && s.ending.ready);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "farewell" && s.ending.ready);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "closed");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
