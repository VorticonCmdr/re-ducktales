import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { openRecordedApplication } from "./helpers/clock.js";

async function openOffice(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.officePictures = [];
    window.officeAudioEvents = [];
    const seen = new Set();
    document.addEventListener("gameaudio", (e) =>
      window.officeAudioEvents.push(e.detail),
    );
    document.addEventListener(
      "gamepresent",
      (e) => {
        const d = e.detail.officeDeparture;
        if (!d?.presentations || seen.has(d.presentations)) return;
        seen.add(d.presentations);
        window.officePictures.push({
          state: d,
          pixels: document.getElementById("game").toDataURL(),
        });
      },
      true,
    );
  });
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, label, max = 2500) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished office ${label}: ${await canvas.getAttribute("data-state")}`,
    );
  }
  await until((s) => s.scene === "title" && s.opening.skipEnabled, "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await until((s) => s.difficultyMenu?.ready, "difficulty");
  await page.keyboard.press("Enter");
  await until((s) => s.scene === "office", "initial office");
  return { canvas, state, until, errors };
}

test("original office door pictures lead through a real dive, reward and restart", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const t = await openOffice(page);
  const before = await t.state();
  await t.canvas.focus();
  if (process.env.DUCKTALES_OFFICE_NEGATIVE !== "omit-up")
    await page.keyboard.down("ArrowUp");
  await page.keyboard.down("Space");
  await t.until(
    (s) =>
      s.scene === "office-departure" && s.officeDeparture.presentations >= 2,
    "door entry",
    150,
  );
  await expect(page.locator("#back")).toBeDisabled();
  // No original input reader runs during this animation. Its exit19a5 flush
  // must discard this queued P and both physical held keys before bin input.
  await page.keyboard.press("p");
  await page.clock.runFor(16);
  const queued = await t.state();
  expect(queued.scene).toBe("office-departure");
  expect(queued.pendingBinSystemKeys).toEqual([[0x19, "pause"]]);
  expect(queued.systemOverlay).toBeNull();
  const entered = await t.until((s) => s.scene === "money-bin", "bin arrival");
  expect(entered.officeDeparture).toBeUndefined();
  expect(entered.pendingBinSystemKeys).toBeUndefined();
  expect(entered.systemOverlay).toBeNull();
  expect([entered.money, entered.seed, entered.campaign.day]).toEqual([
    before.money,
    before.seed,
    before.campaign.day,
  ]);
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowUp");
  const pictures = await page.evaluate(() => window.officePictures);
  expect(pictures).toHaveLength(19);
  for (const [i, picture] of pictures.entries()) {
    expect(picture.state.presentations).toBe(i + 1);
    const name =
      i === 0
        ? "initial"
        : i <= 13
          ? `pendulum-${i - 1}`
          : ["door-open", "door-pause", "roof-1", "roof-2", "roof-3"][i - 14];
    const actualBytes = Buffer.from(picture.pixels.split(",")[1], "base64");
    const actual = PNG.sync.read(actualBytes),
      original = PNG.sync.read(
        await readFile(`.local/office-native-postwait-20261028/${name}.png`),
      );
    expect([actual.width, actual.height]).toEqual([320, 200]);
    expect(
      actual.data.equals(original.data),
      `Original office departure ${name}`,
    ).toBe(true);
    await writeFile(info.outputPath(`office-${i}.png`), actualBytes);
  }
  await t.until(
    (s) =>
      s.bin.phase === "idle" && s.bin.nextPose === 3 && s.bin.remaining >= 10,
    "dive input",
  );
  expect((await t.state()).systemOverlay).toBeNull();
  await page.keyboard.press("Space");
  await t.until(
    (s) => s.scene === "money-bin" && s.bin.phase === "dive",
    "dive",
  );
  const returned = await t.until((s) => s.scene === "office", "reward return");
  expect(returned.money).toBe(1000);
  expect(returned.bin.won).toBe(true);
  expect(returned.rareCoinTaken).toBe(true);
  await t.canvas.screenshot({ path: info.outputPath("office-reward.png") });
  // Restart must cancel a second live door sequence and its pending effects.
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await t.until(
    (s) => s.officeDeparture?.presentations >= 2,
    "second departure",
  );
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const restarted = await t.until((s) => s.scene === "title", "restart");
  expect(restarted.officeDeparture).toBeUndefined();
  expect(restarted.money).toBe(0);
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("office door sound requests reach the persistent Tandy device in original order", async ({
  page,
}) => {
  const t = await openOffice(page);
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page.clock.runFor(16);
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await t.until((s) => s.scene === "money-bin", "audible bin arrival");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.officeAudioEvents
          .filter((e) => e.type === "ack")
          .map((e) => e.argument),
      ),
    )
    .toEqual([0, 4, 35, 34, 38]);
  await expect
    .poll(async () =>
      Number(await page.locator("#sound").getAttribute("data-signal-samples")),
    )
    .toBeGreaterThan(0);
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
