import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { openOffice } from "./helpers/office-entry.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { pressDestinationKey } from "./helpers/destination-input.js";

async function departure(page) {
  await page.addInitScript(() => {
    window.flightKeyboardEvents = [];
    for (const type of ["keydown", "keyup"])
      document.addEventListener(type, (e) =>
        window.flightKeyboardEvents.push({
          at: performance.now(),
          type,
          code: e.code,
          repeat: e.repeat,
        }),
      );
  });
  const t = await openOffice(page);
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until: t.until, state: t.state });
  const b = await t.canvas.boundingBox();
  await t.canvas.click({
    position: { x: (b.width * 37.5) / 320, y: (b.height * 33.5) / 200 },
  });
  await page.keyboard.press("Space");
  await pressDestinationKey(
    { page, state: t.state, until: t.until },
    "ArrowRight",
  );
  await pressDestinationKey({ page, state: t.state, until: t.until }, "Space");
  await t.until(
    (s) => s.scene === "departure" && s.departureScene.phase === "wipe",
    "departure wipe",
  );
  return t;
}

test("flight physical aliases, release edges, reveal handoff and real buttons reach the reader", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  if (process.env.DUCKTALES_FLIGHT_KEYBOARD_NEGATIVE === "drop-release")
    await page.route("**/src/game/ordinary-keyboard.js*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const hook = "if (flag & 0x40) flags.delete(scan);";
      expect(source.split(hook), "SETUP: ordinary break hook").toHaveLength(2);
      await route.fulfill({
        response,
        contentType: "application/javascript",
        body: source.replace(
          hook,
          "if (mode === 0 && scan === 0x32 && (flag & 0x40)) { flags.delete(scan); continue; } " +
            hook,
        ),
      });
    });
  const t = await departure(page),
    observations = [];
  async function read(expected, label) {
    const before = (await t.state()).flight.inputReads;
    const s = await t.until((s) => s.flight.inputReads > before, label);
    expect(s.flight.inputReads, "Skipped flight ordinary read").toBe(
      before + 1,
    );
    expect(s.flight.lastInputCode, label).toBe(expected);
    expect(s.expeditionKeys.reads).toBe(s.flight.inputReads);
    observations.push({ label, state: s });
    return s;
  }
  await page.keyboard.down("KeyM");
  await t.until((s) => s.expeditionKeys.flags[0x32] === 128, "early make");
  const reveal = await t.until(
    (s) => s.departureScene?.phase === "reveal",
    "source flush",
  );
  expect(reveal.expeditionKeys.flags.every((f) => f === 0)).toBe(true);
  await page.keyboard.up("KeyM");
  await page.clock.runFor(16);
  expect((await t.state()).expeditionKeys.flags[0x32]).toBe(0);
  await page.keyboard.down("KeyM");
  await page.keyboard.down("NumpadEnter");
  await t.until((s) => s.scene === "flight", "automatic handoff");
  expect((await t.state()).expeditionKeys.mode).toBe(0);
  await read(197, "Reveal makes survive the automatic flight handoff");
  await page.keyboard.up("KeyM");
  let s = await read(197, "Flight alias release-edge byte");
  expect(s.expeditionKeys.flags[0x32]).toBe(0);
  await read(192, "Alias consumed once");
  await page.keyboard.up("NumpadEnter");
  await read(192, "Fire release-edge byte");
  await read(0, "Released Fire becomes neutral");
  await page.keyboard.down("KeyM");
  await page.keyboard.down("ArrowUp");
  await read(1, "Raw slot priority precedes alias normalization");
  await page.keyboard.up("ArrowUp");
  await read(1, "Arrow release edge");
  await read(5, "Held letter remains after arrow release");
  await page.keyboard.up("KeyM");
  await read(5, "Letter release edge");
  await read(0, "Empty table");
  await page.keyboard.press("Numpad3");
  await read(4, "Flight keypad diagonal remains code4");
  await read(0, "Diagonal consumed once");
  await page.locator("#fire").click();
  await read(192, "On-screen Fire supplies an actual ordinary tap");
  await read(0, "Button tap consumed once");
  await t.canvas.focus();
  await page.keyboard.down("Space");
  await page.keyboard.press("KeyP");
  const beforePause = (await t.state()).flight.inputReads;
  await t.until((s) => s.systemOverlay?.phase === "waiting", "Pause reader");
  expect((await t.state()).flight.inputReads).toBe(beforePause);
  await page.keyboard.press("KeyP");
  s = await t.until((s) => !s.systemOverlay, "resume");
  expect(s.flight.lastInputCode).toBe(0);
  expect(s.expeditionKeys.flags.every((f) => f === 0)).toBe(true);
  await page.keyboard.up("Space");
  await read(0, "Release after dialog flush creates no slot");
  await writeFile(
    info.outputPath("flight-keyboard.json"),
    JSON.stringify(
      {
        observations,
        events: await page.evaluate(() => window.flightKeyboardEvents),
      },
      null,
      2,
    ),
  );
  await t.canvas.screenshot({ path: info.outputPath("flight-keyboard.png") });
  await page.locator("#restart").click();
  await t.until((s) => s.scene === "title", "Restart");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

for (const skip of [false, true])
  test(`flight natural crash ${skip ? "accepts fresh raw Fire" : "finishes all twenty neutral polls"} at the return reader`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const t = await departure(page);
    await t.until((s) => s.scene === "flight", "flight");
    await page.keyboard.down("Space");
    await t.until((s) => s.flight.speed >= 4, "accelerate");
    await page.keyboard.down("ArrowDown");
    await page.clock.runFor(300);
    await page.keyboard.up("ArrowDown");
    await page.clock.runFor(800);
    await page.keyboard.up("Space");
    const first = await t.until(
      (s) => s.flight?.phase === "return-wait",
      "natural crash return",
    );
    expect(first.flight.returnInputReads).toBe(1);
    expect(first.flight.lastReturnInputCode).toBe(0);
    expect(first.expeditionKeys.flags.every((f) => f === 0)).toBe(true);
    if (skip) await page.keyboard.press("NumpadEnter");
    const after = await t.until(
      (s) => s.flight?.phase === "complete",
      "complete return wait",
    );
    expect(after.flight.outcome.status).toBe("crashed");
    expect(after.flight.returnInputReads).toBe(skip ? 2 : 20);
    expect(after.flight.lastReturnInputCode).toBe(skip ? 192 : 0);
    await writeFile(
      info.outputPath(
        skip ? "flight-return-fire.json" : "flight-return-neutral.json",
      ),
      JSON.stringify(
        {
          first,
          after,
          events: await page.evaluate(() => window.flightKeyboardEvents),
        },
        null,
        2,
      ),
    );
    await expect(page.locator("#diagnostic")).toBeHidden();
    expect(t.errors).toEqual([]);
    await page.locator("#restart").click();
    await t.until((s) => s.scene === "title", "Restart");
  });
