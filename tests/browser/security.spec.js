import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { parseArchive } from "../../src/assets.js";
import { unpackImage } from "../../src/game/executable.js";
import { renderFlightPixels } from "../../src/game/flight-raster.js";
import { securitySetup, securityCommands } from "../../src/game/security.js";
const entries = parseArchive(await readFile("game/MAIN.ARC"));
const image = unpackImage(await readFile("game/DUCKTALE.EXE"));
// Browser provider BIOS0 reaches the independently observed campaign-entry
// seed1960. Expectations do not read the browser's target or final RNG state.
const setup = securitySetup(1960);
function comparePicture(dataURL, options, label) {
  const actual = PNG.sync.read(Buffer.from(dataURL.split(",")[1], "base64"));
  const expected = Buffer.from(
    renderFlightPixels(
      securityCommands(image, setup, options),
      entries,
      entries[42].data,
      "MAIN.ARC",
    ),
  );
  expect([actual.width, actual.height]).toEqual([320, 200]);
  expect(actual.data.equals(expected), `Browser security pixels ${label}`).toBe(
    true,
  );
}
async function compareCanvas(page, options, label) {
  comparePicture(
    await page.locator("#game").evaluate((c) => c.toDataURL()),
    options,
    label,
  );
}
import { openRecordedApplication } from "./helpers/clock.js";

async function openOffice(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.securityPictures = [];
    window.securityAudio = [];
    const seen = new Set();
    document.addEventListener("gameaudio", (e) =>
      window.securityAudio.push(e.detail),
    );
    document.addEventListener(
      "gamepresent",
      (e) => {
        const s = e.detail.security,
          d = e.detail.officeDeparture;
        const key =
          s?.phase === "entry"
            ? "control-center"
            : s
              ? `${s.phase}/${s.selection}/${s.failures}/${s.alarmPhase}/${s.presentations}`
              : d?.source === 0x04fe
                ? "control-center"
                : null;
        if (!key || seen.has(key)) return;
        seen.add(key);
        window.securityPictures.push({
          key,
          state: e.detail,
          pixels: document.getElementById("game").toDataURL(),
        });
      },
      true,
    );
  });
  await openRecordedApplication(page, 1);
  const canvas = page.locator("#game");
  await expect(page.locator("#actions")).toBeVisible();
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, label, max = 2000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished security ${label}: ${await canvas.getAttribute("data-state")}`,
    );
  }
  await until((s) => s.scene === "title" && s.opening.skipEnabled, "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await until((s) => s.difficultyMenu?.ready, "difficulty");
  await page.keyboard.press("Enter");
  await until(
    (s) => s.scene === "office" && s.officeMenu?.ready === true,
    "office input ready",
  );
  expect((await state()).seed).toBe(1960);
  return { canvas, state, until, errors };
}

test("first control-center entry consumes original security RNG, accepts a decoded choice and stays cleared until restart", async ({
  page,
}, info) => {
  const t = await openOffice(page);
  await t.canvas.focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await t.until(
    (s) => s.scene === "security" && s.security.phase === "reveal",
    "reveal",
  );
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowRight");
  await expect(page.locator("#back")).toBeDisabled();
  // These keyboard flags arrive during an uninterruptible reveal and must be
  // discarded by the original19a5 flush rather than pause or choose a row.
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowDown");
  const entered = await t.until((s) => s.security?.ready, "challenge input");
  expect(entered.securityPending).toBe(false);
  expect([
    entered.seed,
    entered.security.target,
    entered.security.targetRow,
    entered.security.selection,
    entered.security.failures,
  ]).toEqual([46760, "METK", 1, 0, 0]);
  expect(entered.systemOverlay).toBeNull();
  await compareCanvas(page, { selection: 0 }, "initial");
  await page.keyboard.press("p");
  const paused = await t.until(
    (s) => s.systemOverlay?.phase === "waiting",
    "pause at input read",
  );
  const reads = paused.security.inputReads;
  await page.clock.runFor(250);
  expect((await t.state()).security.inputReads).toBe(reads);
  await page.keyboard.press("Space");
  await page.keyboard.press("p");
  const resumed = await t.until(
    (s) => !s.systemOverlay && s.security?.ready,
    "pause resume flush",
  );
  expect([resumed.security.selection, resumed.security.failures]).toEqual([
    0, 0,
  ]);
  const pictures = await page.evaluate(() => window.securityPictures);
  const departure = pictures.find((p) => p.key === "control-center");
  expect(departure, "Control-center page was actually presented").toBeTruthy();
  const png = Buffer.from(departure.pixels.split(",")[1], "base64");
  expect(
    PNG.sync
      .read(png)
      .data.equals(
        PNG.sync.read(
          await readFile(".local/security-native-fire0-03/entry.png"),
        ).data,
      ),
  ).toBe(true);
  await writeFile(info.outputPath("control-center.png"), png);
  await t.canvas.screenshot({ path: info.outputPath("security.png") });
  if (process.env.DUCKTALES_SECURITY_NEGATIVE !== "omit-right") {
    await page.keyboard.press("ArrowRight");
    await t.until(
      (s) => s.security?.selection === 1 && s.security.ready,
      "Right selection",
    );
    await compareCanvas(page, { selection: 1 }, "Right selection");
  }
  await page.keyboard.press("Space");
  const map = await t.until(
    (s) => s.scene === "map",
    "correct-choice map return",
    250,
  );
  expect(map.security).toBeUndefined();
  expect(map.securityPending).toBe(false);
  expect([map.seed, map.campaign.day, map.money]).toEqual([46760, 1, 0]);
  await page
    .getByRole("button", { name: "Back / Office", exact: true })
    .click();
  await t.until((s) => s.scene === "office", "office return");
  await page
    .getByRole("button", { name: "Control center", exact: true })
    .click();
  const again = await t.until((s) => s.scene === "map", "second map entry");
  expect(again.seed).toBe(46760);
  expect(again.security).toBeUndefined();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const restart = await t.until((s) => s.scene === "title", "restart");
  expect(restart.securityPending).toBe(true);
  expect(restart.security).toBeUndefined();
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("two fixed wrong choices show warning and three alarms, reach Tandy and return without reseeding", async ({
  page,
}, info) => {
  const t = await openOffice(page);
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page.clock.runFor(16);
  await page
    .getByRole("button", { name: "Control center", exact: true })
    .click();
  await t.until((s) => s.security?.ready, "challenge input");
  await page.getByRole("button", { name: "Start / Fire", exact: true }).click();
  await t.until(
    (s) => s.security?.failures === 1 && s.security.ready,
    "first warning",
  );
  await compareCanvas(page, { selection: 0, warning: true }, "warning");
  await t.canvas.screenshot({ path: info.outputPath("warning.png") });
  // A real direction removes the warning through helper06d0. Return to the
  // fixed wrong row0 before the second Fire, without deriving input from target.
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await t.until(
    (s) => s.security?.selection === 1 && s.security.ready,
    "Right after warning",
  );
  await compareCanvas(page, { selection: 1 }, "warning erased by Right");
  await t.canvas.screenshot({ path: info.outputPath("warning-cleared.png") });
  await page.getByRole("button", { name: "Left", exact: true }).click();
  await t.until(
    (s) => s.security?.selection === 0 && s.security.ready,
    "Left after warning",
  );
  await page.getByRole("button", { name: "Start / Fire", exact: true }).click();
  await t.until((s) => s.security?.phase === "alarm", "alarm");
  const map = await t.until(
    (s) => s.scene === "map",
    "forced-success map return",
  );
  expect([map.seed, map.campaign.day, map.money, map.securityPending]).toEqual([
    46760,
    1,
    0,
    false,
  ]);
  const pictures = await page.evaluate(() => window.securityPictures);
  for (let i = 0; i < 6; i++) {
    const p = pictures.find(
      (p) =>
        p.state.security?.phase === "alarm" &&
        p.state.security.alarmPhase === i &&
        p.state.security.wait?.clock === "driver",
    );
    expect(p, `Completed alarm phase${i}`).toBeTruthy();
    comparePicture(p.pixels, { selection: 0, alarm: i % 2 === 0 }, `alarm${i}`);
    await writeFile(
      info.outputPath(`alarm-${i}.png`),
      Buffer.from(p.pixels.split(",")[1], "base64"),
    );
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.securityAudio
          .filter((e) => e.type === "ack")
          .map((e) => e.argument),
      ),
    )
    .toEqual([0, 5, 33, 0, 111, 70, 70, 70, 70, 33]);
  await expect
    .poll(async () =>
      Number(await page.locator("#sound").getAttribute("data-signal-samples")),
    )
    .toBeGreaterThan(0);
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
