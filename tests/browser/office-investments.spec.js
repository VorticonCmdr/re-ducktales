import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { openOffice } from "./helpers/office-entry.js";

test("original investment departure pictures, queued input flush, Tandy cues and restart use real controls", async ({
  page,
}, info) => {
  const t = await openOffice(page),
    before = await t.state();
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await t.canvas.focus();
  if (process.env.DUCKTALES_INVESTMENT_DEPARTURE_NEGATIVE !== "omit-left")
    await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("Space");
  await t.until(
    (s) =>
      s.scene === "office-departure" && s.officeDeparture.presentations >= 1,
    "investment departure entry",
    150,
  );
  await page.keyboard.down("p");
  await page.clock.runFor(16);
  const queued = await t.state();
  expect(queued.scene).toBe("office-departure");
  expect(queued.pendingBinSystemKeys).toEqual([[0x19, "pause"]]);
  expect(queued.systemOverlay).toBeNull();
  const entered = await t.until(
    (s) => s.scene === "investments",
    "investment arrival",
  );
  expect(entered.officeDeparture).toBeUndefined();
  expect(entered.pendingBinSystemKeys).toBeUndefined();
  expect(entered.systemOverlay).toBeNull();
  expect(entered.investments.phase).toBe("portfolio");
  // Held keys were cleared by the original exit boundary: remaining held
  // physically must not open a company, change selection, or invoke pause.
  await page.clock.runFor(200);
  const idle = await t.state();
  expect(idle.investments.phase).toBe("portfolio");
  expect(idle.investments.selected).toBe(entered.investments.selected);
  expect(idle.systemOverlay).toBeNull();
  expect([entered.money, entered.seed, entered.campaign.day]).toEqual([
    before.money,
    before.seed,
    before.campaign.day,
  ]);
  for (const key of ["p", "Space", "ArrowLeft"]) await page.keyboard.up(key);
  const pictures = await page.evaluate(() => window.officePictures);
  // The seventh flip repeats the final picture and hands off immediately to
  // investments in the same simulation boundary. Its count/picture are checked
  // by the component verifier; six office states are observable by this adapter.
  expect(pictures).toHaveLength(6);
  const nativeNames = [
    "pose-0",
    "pose-0",
    "pose-1",
    "pose-2",
    "pose-3",
    "final-hold",
  ];
  for (const [i, picture] of pictures.entries()) {
    expect(picture.state.presentations).toBe(i + 1);
    const bytes = Buffer.from(picture.pixels.split(",")[1], "base64"),
      actual = PNG.sync.read(bytes);
    const original = PNG.sync.read(
      await readFile(
        `.local/office-investment-native-02/${nativeNames[i]}.png`,
      ),
    );
    expect([actual.width, actual.height]).toEqual([320, 200]);
    expect(
      actual.data.equals(original.data),
      `Native investment picture ${i}`,
    ).toBe(true);
    await writeFile(info.outputPath(`investment-${i}.png`), bytes);
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.officeAudioEvents
          .filter((e) => e.type === "ack")
          .map((e) => e.argument),
      ),
    )
    .toEqual([0, 3]);
  await expect
    .poll(async () =>
      Number(await page.locator("#sound").getAttribute("data-signal-samples")),
    )
    .toBeGreaterThan(0);
  await page.locator("#back").click();
  await t.until((s) => s.scene === "office", "office return");
  await page.locator("#investments").click();
  await t.until(
    (s) => s.officeDeparture?.presentations >= 2,
    "second investment departure",
  );
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const restarted = await t.until((s) => s.scene === "title", "restart");
  expect(restarted.officeDeparture).toBeUndefined();
  expect(restarted.money).toBe(0);
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
