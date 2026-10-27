import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
const state = (canvas) => canvas.getAttribute("data-state").then(JSON.parse);
async function office(page, difficulty = 0) {
  await page.goto("/");
  const c = page.locator("#game");
  await expect(c).toHaveAttribute("data-scene", "title");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  if (difficulty === 2) await page.keyboard.press("ArrowUp");
  else if (difficulty === 1) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  return c;
}
async function point(canvas, x, y) {
  const r = await canvas.boundingBox();
  await canvas.click({
    position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
  });
}
async function caveMove(page, canvas, key, target) {
  await page.waitForFunction(
    () => {
      const s = JSON.parse(document.querySelector("#game").dataset.state);
      return s.diagnostic || s.scene !== "cave" || s.cave.phase === "exploring";
    },
    undefined,
    { timeout: 5000 },
  );
  expect((await state(canvas)).scene).toBe("cave");
  await page.keyboard.down(key);
  await page.keyboard.down("Space");
  await page.waitForFunction(
    (target) => {
      const s = JSON.parse(document.querySelector("#game").dataset.state);
      return s.diagnostic || s.scene !== "cave" || s.cave.room === target;
    },
    target,
    { polling: "raf", timeout: 5000 },
  );
  await page.keyboard.up("Space");
  await page.keyboard.up(key);
  expect((await state(canvas)).diagnostic).toBeNull();
  expect((await state(canvas)).cave.room).toBe(target);
}
test("original map pixels and keyboard bank round trip", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await office(page);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.up("ArrowRight");
  await expect(c).toHaveAttribute("data-scene", "map");
  const expected = PNG.sync.read(await readFile(".local/original-map.png"));
  const actual = PNG.sync.read(
    Buffer.from(
      (await c.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect([actual.width, actual.height]).toEqual([320, 200]);
  expect(actual.data).toEqual(expected.data);
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(async () => (await state(c)).campaign.cursor.y)
    .toBeLessThan(139);
  await page.keyboard.up("ArrowUp");
  await point(c, 212, 131);
  await expect.poll(async () => (await state(c)).campaign.asset).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  expect((await state(c)).campaign.travelDays).toBe(3);
  // Default is Map: inspecting and cancelling never advances the calendar.
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(false);
  expect((await state(c)).campaign.day).toBe(1);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.day).toBe(4);
  expect((await state(c)).campaign.location).toBe(0);
  expect((await state(c)).campaign.banked).toBe(0);
  await point(c, 46, 139);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "office");
  expect((await state(c)).campaign.day).toBe(7);
  expect((await state(c)).campaign.location).toBe(35);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).campaign.day).toBe(1);
});
test("expedition briefing, keyboard takeoff, crash, rival claim and campaign return", async ({
  page,
}) => {
  const c = await office(page, 2);
  await page.locator("#map").click();
  await expect(c).toHaveAttribute("data-scene", "map");
  await point(c, 37, 33);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "departure");
  await expect(page.locator("#diagnostic")).toBeHidden();
  await expect(page.locator("#status")).toContainText("Departure confirmed");
  const prepared = await state(c);
  expect(prepared.departure.flightRequest).toEqual({ days: 1, racing: 1 });
  expect(prepared.departure.activity).toBe("cave");
  expect(prepared.seed).toBe(54448);
  expect(prepared.departure.variant).toBe(0);
  await c.evaluate((canvas) => {
    canvas.addEventListener("gamepresent", (event) => {
      if (event.detail.flight?.phase === "crash")
        canvas.dataset.sawCrash = "true";
    });
  });
  await page.keyboard.down("Space");
  await expect(c).toHaveAttribute("data-scene", "flight");
  await expect
    .poll(async () => (await state(c)).flight.speed)
    .toBeGreaterThan(4);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => (await state(c)).flight.heading)
    .toBeGreaterThan(0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await expect.poll(async () => (await state(c)).flight.y).toBeLessThan(139);
  await page.screenshot({ path: ".local/browser-results/flight-takeoff.png" });
  await expect(c).toHaveAttribute("data-saw-crash", "true", { timeout: 20000 });
  await expect(c).toHaveAttribute("data-scene", "map", { timeout: 10000 });
  const result = await state(c);
  expect(result.flight.outcome.status).toBe("crashed");
  expect(result.campaign.day).toBe(2);
  expect(result.campaign.location).toBe(30);
  expect(result.campaign.rival.money).toBe(4500);
  expect(result.campaign.rival.location).toBe(30);
  expect(result.money).toBe(0);
  await page.locator("#audio").check();
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "visit-notice");
  const denied = await state(c);
  expect(denied.visitNotice.reason).toBe("rival");
  expect(denied.visitNotice.busy).toBe(true);
  expect([
    denied.money,
    denied.campaign.day,
    denied.campaign.location,
    denied.seed,
  ]).toEqual([
    result.money,
    result.campaign.day,
    result.campaign.location,
    result.seed,
  ]);
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: ".local/browser-results/rival-visit-notice.png",
  });
  // This return must come from the native audio completion event, without Fire.
  await expect(c).toHaveAttribute("data-scene", "map", { timeout: 12000 });
  expect(await page.locator("#sound").evaluate((a) => a.ended)).toBe(true);
  expect((await state(c)).seed).toBe(result.seed);
  await page.locator("#audio").uncheck();
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).flight).toBeNull();
});

// Other activity families share the flight dispatcher; the terrain games remain separate.
for (const [name, x, y, activity] of [
  ["El Capitan", 36, 61, "mountain"],
  ["Okeefadokie Swamp", 64, 73, "jungle"],
  ["Yellerstone Park", 46, 56, "photography"],
  ["Borneo", 280, 149, "photography"],
]) {
  test(`departure dispatch classifies ${name}`, async ({ page }) => {
    const c = await office(page);
    await page.locator("#map").click();
    await expect(c).toHaveAttribute("data-scene", "map");
    await point(c, x, y);
    await page.keyboard.press("Space");
    await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
    await page.keyboard.press("Space");
    await expect(c).toHaveAttribute("data-scene", "departure");
    expect((await state(c)).departure.activity).toBe(activity);
    if (name === "Borneo")
      expect((await state(c)).departure.flags >>> 4).toBe(6);
    expect((await state(c)).campaign.location).toBe(35);
    await expect(page.locator("#diagnostic")).toBeHidden();
    await page.locator("#restart").click();
    await expect(c).toHaveAttribute("data-scene", "title");
    expect((await state(c)).departure).toBeNull();
  });
}

test("keyboard flight lands, explores a cave, collects treasure and returns to the map", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await office(page);
  await page.locator("#map").click();
  await expect(c).toHaveAttribute("data-scene", "map");
  await point(c, 37, 33);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "departure");
  await page.keyboard.down("Space");
  await expect(c).toHaveAttribute("data-scene", "flight");
  let lastFrame = -1,
    heldDirection = null,
    steps = 0,
    landingSeen = false;
  // External feedback pilot using the same keyboard adapter as a player.
  // This is browser acceptance, not an original-game input replay.
  while (steps++ < 400) {
    const current = await state(c);
    if (current.diagnostic || current.flight.phase === "complete") break;
    if (current.flight.phase === "landing") {
      landingSeen = true;
      await page.screenshot({
        path: ".local/browser-results/flight-landing.png",
      });
      if (heldDirection) await page.keyboard.up(heldDirection);
      heldDirection = null;
      await page.keyboard.up("Space");
      await expect(c).toHaveAttribute("data-scene", "cave", { timeout: 10000 });
      break;
    }
    const f = current.flight;
    const desired =
      f.tile > 37 ? (f.y < 135 ? 15 : 0) : f.y > 90 ? 1 : f.y < 75 ? 15 : 0;
    const delta = (desired - f.heading + 16) % 16;
    const direction =
      f.speed < 4 || !delta ? null : delta < 8 ? "ArrowDown" : "ArrowUp";
    if (direction !== heldDirection) {
      if (heldDirection) await page.keyboard.up(heldDirection);
      if (direction) await page.keyboard.down(direction);
      heldDirection = direction;
    }
    lastFrame = f.frames;
    await page.waitForFunction(
      ({ frame, phase }) => {
        const s = JSON.parse(document.querySelector("#game").dataset.state);
        return (
          s.diagnostic || s.flight.frames > frame || s.flight.phase !== phase
        );
      },
      { frame: lastFrame, phase: f.phase },
      { timeout: 3000 },
    );
  }
  if (heldDirection) await page.keyboard.up(heldDirection);
  await page.keyboard.up("Space");
  expect(steps).toBeLessThan(400);
  expect(landingSeen).toBe(true);
  await expect(page.locator("#diagnostic")).toBeHidden();
  const result = await state(c);
  expect(result.flight.outcome.status).toBe("arrived");
  expect(result.flight.outcome.code).toBe(1);
  expect(result.campaign.location).toBe(30);
  // Real keyboard feedback can cross the original fast-arrival boundary.
  // Check its exact calendar rule using the flight's actual simulation count;
  // do not fit inputs or pretend this is a fixed-frame original replay.
  const frames = result.flight.outcome.frames;
  expect(result.campaign.day).toBe(
    2 + (frames < 210 ? -1 : frames > 462 ? 1 : 0),
  );
  const firstRoom = result.cave.room;
  expect(firstRoom).toBe(17);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector("#game").dataset.state).cave.room ===
      18,
    undefined,
    { polling: "raf" },
  );
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowRight");
  await expect
    .poll(async () => (await state(c)).cave.money)
    .toBe(result.cave.money + 50);
  await expect(page.locator("#diagnostic")).toBeHidden();

  // Intentionally fail this expedition, then retry the current destination.
  // The retry uses the real map/guide input route and must not create a flight.
  await caveMove(page, c, "ArrowLeft", 17);
  await caveMove(page, c, "ArrowUp", 9);
  await caveMove(page, c, "ArrowUp", 1);
  await expect(c).toHaveAttribute("data-scene", "expedition-result");
  const failed = await state(c);
  expect(failed.cave.outcome.status).toBe("pit");
  expect(failed.expeditionResult.phase).toBe("failure");
  const failedDay = failed.campaign.day;
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "map");
  const retryMap = await state(c);
  expect(retryMap.campaign.day).toBe(failedDay + 1);
  expect(retryMap.campaign.playerCollected).not.toContain(
    retryMap.campaign.location,
  );
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "expedition-briefing");
  const retry = await state(c);
  expect(retry.flight).toBeNull();
  expect(retry.departure).toBeNull();
  expect([retry.money, retry.campaign.day, retry.campaign.location]).toEqual([
    retryMap.money,
    retryMap.campaign.day,
    retryMap.campaign.location,
  ]);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "cave");

  // Plan from the original map; drive only real held-key controls. No game
  // memory or expected final state is injected into the browser.
  const before = await state(c);
  let moves = 0;
  while ((await state(c)).scene === "cave" && moves++ < 64) {
    const current = await state(c);
    if (["treasure", "complete"].includes(current.cave.phase)) break;
    await page.waitForFunction(
      () => {
        const s = JSON.parse(document.querySelector("#game").dataset.state);
        return (
          s.diagnostic ||
          s.scene !== "cave" ||
          ["exploring", "treasure"].includes(s.cave.phase)
        );
      },
      undefined,
      { timeout: 5000 },
    );
    const now = await state(c);
    expect(now.diagnostic).toBeNull();
    if (now.scene !== "cave") break;
    const { room, goal, rooms } = now.cave;

    let route;
    for (const margin of [1, 0, -1]) {
      const queue = [[room, []]],
        seen = new Set([room]);
      while (queue.length) {
        const [at, path] = queue.shift();
        if (at === goal) {
          route = path;
          break;
        }
        const danger =
          margin === 1
            ? [
                now.cave.enemy,
                now.cave.enemy - 8,
                now.cave.enemy + 8,
                now.cave.enemy - 1,
                now.cave.enemy + 1,
              ]
            : margin === 0
              ? [now.cave.enemy]
              : [];
        for (const [key, bit, delta] of [
          ["ArrowUp", 8, -8],
          ["ArrowRight", 2, 1],
          ["ArrowDown", 4, 8],
          ["ArrowLeft", 1, -1],
        ]) {
          const next = at + delta;
          if (
            !(rooms[at] & bit) ||
            next < 0 ||
            next >= 64 ||
            rooms[next] & 64 ||
            seen.has(next) ||
            (next !== goal && danger.includes(next))
          )
            continue;
          seen.add(next);
          queue.push([next, [...path, key]]);
        }
      }
      if (route?.length) break;
    }
    expect(route?.length, "safe path to the treasure").toBeGreaterThan(0);
    await page.keyboard.down(route[0]);
    await page.keyboard.down("Space");
    await page.waitForFunction(
      (room) => {
        const s = JSON.parse(document.querySelector("#game").dataset.state);
        return s.diagnostic || s.scene !== "cave" || s.cave.room !== room;
      },
      room,
      { polling: "raf" },
    );
    await page.keyboard.up("Space");
    await page.keyboard.up(route[0]);
    expect((await state(c)).diagnostic).toBeNull();
  }
  expect(moves).toBeLessThan(64);
  await expect(c).toHaveAttribute("data-scene", "expedition-result");
  const award = await state(c);
  expect(award.cave.outcome.status).toBe("treasure");
  expect(award.expeditionResult.phase).toBe("award");
  expect(award.expeditionResult.value).toBe(4500);
  expect(award.money).toBe(award.cave.money + 4500);
  expect(award.campaign.day).toBe(before.campaign.day + 1);
  await page.screenshot({
    path: ".local/browser-results/cave-treasure-award.png",
  });
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "map");
  const returned = await state(c);
  expect(returned.campaign.playerCollected).toContain(
    returned.campaign.location,
  );
  expect(returned.money).toBe(award.money);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "visit-notice");
  const collected = await state(c);
  expect(collected.visitNotice.reason).toBe("player");
  expect([
    collected.money,
    collected.campaign.day,
    collected.campaign.location,
    collected.seed,
  ]).toEqual([
    returned.money,
    returned.campaign.day,
    returned.campaign.location,
    returned.seed,
  ]);
  await page.screenshot({
    path: ".local/browser-results/collected-notice.png",
  });
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "map");
  expect((await state(c)).money).toBe(award.money);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).cave).toBeNull();
  expect(errors).toEqual([]);
});

// Conditional presentation comparison: this seed is the captured departure
// contract, independent of the browser's corrected complete initialization.
test("conditional original departure portrait pixels", async ({ page }) => {
  await office(page);
  const actual = await page.evaluate(async () => {
    const { verifiedResources } = await import("/src/game/resources.js");
    const { Renderer } = await import("/src/game/renderer.js");
    const { Departure } = await import("/src/game/departure.js");
    const resources = await verifiedResources(async (n) =>
      (await fetch("/game/" + n)).arrayBuffer(),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    new Renderer(canvas, resources).render({
      scene: "departure",
      departure: new Departure({
        from: 35,
        target: 25,
        days: 1,
        flags: 8,
        difficulty: 0,
        seed: 41725,
      }),
    });
    return canvas.toDataURL();
  });
  const image = PNG.sync.read(Buffer.from(actual.split(",")[1], "base64"));
  const expected = PNG.sync.read(
    await readFile(".local/original-departure.png"),
  );
  expect(image.data).toEqual(expected.data);
});
