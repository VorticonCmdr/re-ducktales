import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import manifest from "../../reference/destination.json" with { type: "json" };

// This fresh BIOS0 route naturally selects Bolognia/Redbeard's Rubies. Original
// capture context selects another destination. Only invariant label/footer
// regions are compared here; the two full original pages are separate checks.
test("destination shows original treasure labels and flight selector through real browser controls", async ({
  page,
}, info) => {
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (100.5 * b.width) / 320, y: (100.5 * b.height) / 200 },
  });
  await page.keyboard.press("Space");
  await t.until((s) => s.campaign.info, "destination page");
  await page.keyboard.press("Space");
  await t.until((s) => !s.campaign.info, "Map confirmation returns to pointer");
  await page.keyboard.press("Space");
  await t.until((s) => s.campaign.info, "reopened destination page");
  await page.keyboard.press("ArrowRight");
  await t.until((s) => s.campaign.choice === 1, "flight selection");
  // One complete70.086Hz video interval lets this observer see the new page.
  await page.clock.runFor(16);
  const state = await t.state();
  expect(state.campaign.day).toBe(1);
  expect(state.money).toBe(0);
  const actualBytes = Buffer.from(
    await t.canvas.evaluate((c) => c.toDataURL().split(",")[1]),
    "base64",
  );
  const actual = PNG.sync.read(actualBytes);
  expect([actual.width, actual.height]).toEqual([320, 200]);
  const spec = manifest.artifacts["notice-004-flush.png"];
  const expectedBytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing original destination picture ${spec.path}`);
  });
  expect(expectedBytes.length).toBe(spec.bytes);
  expect(createHash("sha256").update(expectedBytes).digest("hex")).toBe(
    spec.sha256,
  );
  const expected = PNG.sync.read(expectedBytes);
  const region = (data, x, y, width, height) =>
    Buffer.concat(
      Array.from({ length: height }, (_, i) =>
        data.subarray(((y + i) * 320 + x) * 4, ((y + i) * 320 + x + width) * 4),
      ),
    );
  for (const [name, x, y, width, height] of [
    ["treasure label", 32, 62, 80, 8],
    ["description label", 32, 78, 168, 8],
    ["value label", 32, 110, 128, 8],
    ["travel label", 32, 126, 104, 8],
    ["whole footer and integer flight border", 0, 168, 320, 32],
  ]) {
    const got = region(actual.data, x, y, width, height),
      want = region(expected.data, x, y, width, height);
    expect(got.equals(want), `Original destination ${name}`).toBe(true);
    const changed = Buffer.from(want);
    changed[0] ^= 1;
    expect(got.equals(changed), `Changed ${name} must be rejected`).toBe(false);
  }
  await writeFile(info.outputPath("destination-bolognia.png"), actualBytes);
  await page.keyboard.press("Space");
  await t.until((s) => s.scene === "departure", "flight departure");
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
