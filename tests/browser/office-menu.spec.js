import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import profile from "../../reference/office-menu-inputs.json" with { type: "json" };

const root = ".local/office-menu-native-03";
const codes = {
  0x1c: "Enter",
  0x39: "Space",
  0x48: "ArrowUp",
  0x4b: "ArrowLeft",
  0x4d: "ArrowRight",
  0x50: "ArrowDown",
};
async function nativePicture(bytes, name) {
  const actual = PNG.sync.read(bytes),
    native = PNG.sync.read(await readFile(`${root}/${name}.png`));
  expect([actual.width, actual.height]).toEqual([320, 200]);
  expect(
    actual.data.equals(native.data),
    `Original office picture ${name}`,
  ).toBe(true);
}

test("office entry bands, labels and63 original key polls use real browser controls", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.officeBands = [];
    const seen = new Set();
    document.addEventListener(
      "gamepresent",
      (e) => {
        const t = e.detail.officeMenu?.transition;
        if (!t) return;
        const name = `${t.kind}-${t.band}`;
        if (seen.has(name)) return;
        seen.add(name);
        window.officeBands.push({
          name,
          pixels: document.getElementById("game").toDataURL(),
        });
      },
      true,
    );
  });
  const t = await openOffice(page, {
    beforeConfirm: async () => {
      await page
        .getByLabel("Sound device", { exact: true })
        .selectOption("tandy");
      await page
        .getByRole("checkbox", { name: "Sound (reconstructed)" })
        .check();
    },
  });
  const bands = await page.evaluate(() => window.officeBands);
  expect(bands.map((b) => b.name)).toEqual(
    ["wipe", "reveal"].flatMap((k) =>
      Array.from({ length: 5 }, (_, i) => `${k}-${i}`),
    ),
  );
  for (const b of bands) {
    const bytes = Buffer.from(b.pixels.split(",")[1], "base64");
    await nativePicture(bytes, b.name);
    await writeFile(info.outputPath(`${b.name}.png`), bytes);
  }
  const original = JSON.parse(
    await readFile(`${root}/consumption.json`, "utf8"),
  );
  const pictureNames = new Set([
    "initial-input",
    "neutral-fire",
    "neutral-after-fire",
  ]);
  for (const n of [
    "up",
    "right",
    "left",
    "down",
    "up-right",
    "up-left",
    "left-right",
    "up-down",
  ]) {
    pictureNames.add(n + "-held");
    pictureNames.add(n + "-neutral");
  }
  const events = new Map(profile.events.map((e) => [e.beforeRead, e]));
  let held = new Set(),
    used = 0,
    pictures = 10;
  for (const [index, observed] of original.entries()) {
    const s = await t.state();
    expect(s.scene).toBe("office");
    expect(s.officeMenu.inputReads).toBe(index + 1);
    expect(s.officeMenu.lastInput, observed.name).toBe(observed.byte);
    if (pictureNames.has(observed.name)) {
      const bytes = Buffer.from(
        (await t.canvas.evaluate((c) => c.toDataURL())).split(",")[1],
        "base64",
      );
      await nativePicture(bytes, observed.name);
      await writeFile(info.outputPath(`${observed.name}.png`), bytes);
      pictures++;
    }
    if (index === original.length - 1) break;
    const e = events.get(index + 2);
    if (e) {
      const next = new Set(
        process.env.DUCKTALES_OFFICE_MENU_NEGATIVE === "omit-right-chord" &&
          e.name === "up-right-make"
          ? e.keys.filter((k) => k !== 0x4d)
          : e.keys,
      );
      for (const k of held) if (!next.has(k)) await page.keyboard.up(codes[k]);
      for (const k of next)
        if (!held.has(k)) await page.keyboard.down(codes[k]);
      held = next;
      used++;
    }
    await t.until(
      (s) => s.officeMenu?.inputReads > index + 1,
      `poll${index + 2}`,
    );
  }
  expect(used).toBe(19);
  expect(pictures).toBe(29);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.officeAudioEvents
          .filter((e) => e.type === "ack")
          .map((e) => e.argument),
      ),
    )
    .toEqual([36, 0, 6]);
  await t.until(
    (s) => s.scene === "security",
    "map dispatch through control center",
  );
  for (const k of held) await page.keyboard.up(codes[k]);
  await finishSecurityEntry({ page, state: t.state, until: t.until });
  expect((await t.state()).scene).toBe("map");
  expect((await t.state()).officeMenu).toBeUndefined();
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("office defers reveal keys until its reader and flushes held controls after pause", async ({
  page,
}) => {
  const t = await openOffice(page);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await t.until((s) => s.scene === "title" && s.opening.skipEnabled, "title");
  await page.keyboard.press("Space");
  await t.until((s) => s.difficultyMenu?.ready, "difficulty");
  await page.keyboard.press("Enter");
  await t.until((s) => s.officeMenu?.phase === "wipe", "entry wipe");
  await page.keyboard.press("p");
  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("Space");
  await page.clock.runFor(32);
  const queued = await t.state();
  expect(queued.officeMenu.ready).toBe(false);
  expect(queued.officeMenu.inputReads).toBe(0);
  expect(queued.pendingOfficeSystemKeys).toEqual([[0x19, "pause"]]);
  expect(queued.systemOverlay).toBeNull();
  const paused = await t.until(
    (s) =>
      s.systemOverlay?.kind === "pause" && s.systemOverlay.phase === "waiting",
    "office pause",
  );
  expect(paused.officeMenu.inputReads).toBe(0);
  await page.locator("#pause").click();
  const resumed = await t.until(
    (s) => !s.systemOverlay && s.officeMenu?.inputReads >= 2,
    "office resume",
  );
  expect(resumed.scene).toBe("office");
  expect(resumed.officeMenu.lastInput).toBe(0);
  expect(resumed.officeMenu.selection).toBeNull();
  expect(resumed.officeMenu.keyboardFlags).toEqual([]);
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowUp");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  expect(
    (await t.until((s) => s.scene === "title", "restart")).officeMenu,
  ).toBeUndefined();
  expect(t.errors).toEqual([]);
});
