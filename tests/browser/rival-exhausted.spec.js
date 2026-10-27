import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

// Conditional component acceptance. The all-collected starting state is authored;
// this does not claim to have played a whole campaign to exhaustion in the UI.
test("conditional exhausted rival report matches original pixels and keyboard Fire resumes carried campaign actions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  await page.evaluate(async () => {
    const { verifiedResources } = await import("/src/game/resources.js"),
      { Renderer } = await import("/src/game/renderer.js"),
      { Game } = await import("/src/game/application.js"),
      { Scheduler } = await import("/src/game/scheduler.js"),
      { FlightMemory } = await import("/src/game/flight-physics.js"),
      { parseLocations, parseLoot } = await import("/src/game/campaign.js");
    const resources = await verifiedResources(async (n) =>
      (await fetch("/game/" + n)).arrayBuffer(),
    );
    const game = new Game({
      locations: parseLocations(resources.archives.get("LOC.ARC")),
      loot: parseLoot(resources.archives.get("LOOT.ARC")),
    });
    // Canonical post-flight table alias and independent all-collected condition.
    const bytes = new Uint8Array(65536);
    bytes.set(resources.executable.subarray(0x120e0));
    game.flightMemory = new FlightMemory(bytes);
    game.flightMemory.i(0x4f42, 15);
    game.flightMemory.i(0x4f44, 0);
    game.flightMemory.i(0x4f48, -1);
    game.scene = "office";
    game.campaign.day = 14;
    game.campaign.rivalUnlockMask = 6;
    game.campaign.rival.day = 9;
    game.campaign.rival.location = 35;
    game.campaign.locations.forEach((l) => (l.playerCollected = true));
    game.seed = game.campaign.seed = 56;
    const canvas = document.createElement("canvas");
    canvas.id = "exhausted-fixture";
    canvas.width = 320;
    canvas.height = 200;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Conditional exhausted rival fixture");
    document.body.prepend(canvas);
    const renderer = new Renderer(canvas, resources);
    const present = () => {
      renderer.render(game);
      canvas.dataset.state = JSON.stringify(game.snapshot());
      canvas.dataset.alias = String(game.flightMemory.i(0x4f48));
    };
    const scheduler = new Scheduler(game, performance.now(), { present });
    const map = document.createElement("button");
    map.textContent = "Trigger exhausted rival turn";
    map.onclick = () => scheduler.enqueue({ type: "map" }, performance.now());
    document.body.prepend(map);
    const back = document.createElement("button");
    back.textContent = "Continue exhausted campaign to office";
    back.onclick = () => scheduler.enqueue({ type: "back" }, performance.now());
    document.body.prepend(back);
    // Test-host adapter delivers a real browser key through the production
    // scheduler/Game input boundary; the production page adapter is unchanged.
    canvas.addEventListener("keydown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.code === "Space")
        scheduler.enqueue({ type: "fire" }, performance.now());
    });
    function frame() {
      scheduler.advanceTo(performance.now());
      present();
      requestAnimationFrame(frame);
    }
    present();
    requestAnimationFrame(frame);
  });
  const c = page.locator("#exhausted-fixture"),
    state = () => c.getAttribute("data-state").then(JSON.parse);
  await page
    .getByRole("button", { name: "Trigger exhausted rival turn", exact: true })
    .click();
  await page.clock.runFor(32);
  const report = await state();
  expect(report.scene).toBe("rival-report");
  expect(report.rivalReport.target).toBe(35);
  expect(report.rivalReport.name.length).toBe(50);
  expect(report.seed).toBe(29915);
  expect(report.money).toBe(0);
  await expect(c).toHaveAttribute("data-alias", "511");
  const actual = PNG.sync.read(
      Buffer.from(
        (await c.evaluate((el) => el.toDataURL())).split(",")[1],
        "base64",
      ),
    ),
    expected = PNG.sync.read(
      await readFile(".local/rival-exhausted-report.png"),
    );
  expect([actual.width, actual.height]).toEqual([320, 200]);
  expect(actual.data).toEqual(expected.data);
  await c.screenshot({
    path: ".local/browser-results/rival-exhausted-report.png",
  });
  await c.focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(120);
  const returned = await state();
  expect(returned.scene).toBe("map");
  expect(returned.pendingCampaignAction).toBeNull();
  expect(returned.campaign.rival.location).toBe(35);
  expect(returned.campaign.day).toBe(14);
  expect(returned.seed).toBe(29915);
  await page
    .getByRole("button", {
      name: "Continue exhausted campaign to office",
      exact: true,
    })
    .click();
  await page.clock.runFor(4200);
  const next = await state();
  expect(next.scene).toBe("office");
  expect(next.pendingCampaignAction).toBeNull();
  expect(next.diagnostic).toBeNull();
  expect(next.seed).toBe(42517);
  expect(next.campaign.rival.day).toBe(8);
  expect(errors).toEqual([]);
});
