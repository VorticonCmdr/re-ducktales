import { test, expect } from "@playwright/test";
import { openRecordedApplication } from "./helpers/clock.js";
test.use({ timezoneId: "UTC" });
async function boot(page, biosSeed) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DUCKTALES_BIOS_SEED_NEGATIVE) {
    expect(process.env.DUCKTALES_BIOS_SEED_NEGATIVE).toBe("cached-word");
    await page.route("**/src/game/application.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text(),
        hook = 'this.consumeBiosSeed("difficulty")';
      expect(body.split(hook).length, "SETUP: BIOS read hook").toBe(2);
      await route.fulfill({
        response,
        body: body.replace(hook, "this.biosSeed"),
      });
    });
  }
  await openRecordedApplication(page, 1, { biosSeed });
  const canvas = page.locator("#game"),
    state = () =>
      canvas.getAttribute("data-state").then((v) => (v ? JSON.parse(v) : null)),
    bios = () => canvas.getAttribute("data-bios-clock").then(JSON.parse);
  async function until(predicate) {
    for (let i = 0; i < 1500; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      "Unfinished BIOS browser scenario " + JSON.stringify(await state()),
    );
  }
  return { canvas, state, bios, until, errors };
}
async function confirm(c, page) {
  await c.until((s) => s.scene === "title");
  await c.canvas.focus();
  await page.keyboard.press("Space");
  await c.until((s) => s.scene === "difficulty" && s.difficultyMenu.ready);
  await page.clock.runFor(1000);
  await page.keyboard.press("Enter");
  return c.until((s) => s.difficultyMenu?.phase === "exit");
}
test("default BIOS clock samples current input again at confirmation and survives Restart", async ({
  page,
}) => {
  const c = await boot(page, null);
  const exit = await confirm(c, page),
    b = await c.bios();
  expect(b.mode).toBe("local-clock");
  expect(b.reads.length, "Original BIOS confirmation read").toBe(2);
  expect(b.initialTicks).toBe(
    Math.floor(b.initialMilliseconds * (1193182 / 65536 / 1000)),
  );
  for (const r of b.reads) {
    // These are upstream external clock values,not expected final game seeds.
    expect(r.ticks).toBe(
      b.initialTicks + Math.floor(r.elapsed * (1193182 / 65536 / 1000)),
    );
    expect(r.value).toBe(r.ticks & 65535);
  }
  expect(b.reads.map((r) => r.boundary)).toEqual(["startup", "difficulty"]);
  expect(b.reads[1].value).not.toBe(b.reads[0].value);
  expect(
    exit.difficultyMenu.biosSeed,
    "BIOS word reaches original seed write",
  ).toBe(b.reads[1].value);
  expect(exit.seed).toBe(b.reads[1].value);
  await c.until((s) => s.scene === "office");
  await page.locator("#restart").click();
  await c.until((s) => s.scene === "title");
  const restart = await c.bios();
  expect(restart.reads.length).toBe(3);
  expect(restart.reads[2].boundary).toBe("startup");
  expect(restart.reads[2].elapsed).toBeGreaterThan(b.reads[1].elapsed);
  expect((await c.state()).opening.seed).toBe(restart.reads[2].value);
  expect(c.errors).toEqual([]);
});
test("explicit fixed BIOS word remains zero through confirmation and Restart", async ({
  page,
}) => {
  const c = await boot(page, 0),
    exit = await confirm(c, page),
    b = await c.bios();
  expect(b.mode).toBe("fixed-word");
  expect(b.reads.map((r) => r.value)).toEqual([0, 0]);
  expect(exit.difficultyMenu.biosSeed).toBe(0);
  await c.until((s) => s.scene === "office");
  await page.locator("#restart").click();
  await c.until((s) => s.scene === "title");
  expect((await c.bios()).reads.map((r) => r.value)).toEqual([0, 0, 0]);
  expect(c.errors).toEqual([]);
});
test("invalid BIOS replay override stops with a useful diagnostic", async ({
  page,
}) => {
  await boot(page, 65536);
  await expect(page.locator("#diagnostic")).toBeVisible();
  await expect(page.locator("#diagnostic")).toContainText(
    "Invalid bios-seed override",
  );
});
