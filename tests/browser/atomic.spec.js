import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("earn the transmitter in Too-Pei, choose atomic transport and enter the next expedition", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game"),
    state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 4000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(
      `unfinished atomic browser scenario ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    if (key === "Escape") await page.locator("#back").click();
    else await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function point(x, y) {
    const r = await canvas.boundingBox();
    await canvas.click({
      position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
    });
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  await point(240, 70);
  await press("Space");
  expect((await state()).campaign.choice).toBe(0);
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.activity).toBe("cave");
  await page.keyboard.down("Space");
  await page.keyboard.down("ArrowUp");
  await until((s) => s.scene === "crash-repairs");
  await page.keyboard.up("ArrowUp");
  await page.keyboard.up("Space");
  await press("Space");
  await until((s) => s.scene === "expedition-briefing");
  expect((await state()).briefing.variant).toBe(7);
  await press("Space");
  await until((s) => s.scene === "cave");
  let usedMoves = 0,
    award;
  for (let attempt = 0; attempt < 3 && !award; attempt++) {
    while ((await state()).scene === "cave" && usedMoves < 96) {
      const now = await until(
        (s) =>
          s.scene !== "cave" ||
          ["exploring", "treasure", "complete"].includes(s.cave.phase),
      );
      if (now.scene !== "cave" || now.cave.phase !== "exploring") break;
      const { room, goal, rooms, enemy } = now.cave;
      let route;
      for (const margin of [1, 0, -1]) {
        const queue = [[room, []]],
          seen = new Set([room]);
        const danger =
          margin === 1
            ? [enemy, enemy - 8, enemy + 8, enemy - 1, enemy + 1]
            : margin === 0
              ? [enemy]
              : [];
        while (queue.length) {
          const [at, path] = queue.shift();
          if (at === goal) {
            route = path;
            break;
          }
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
      expect(route?.length, "safe path through Too-Pei").toBeGreaterThan(0);
      await page.keyboard.down(route[0]);
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "cave" || s.cave.room !== room);
      await page.keyboard.up("Space");
      await page.keyboard.up(route[0]);
      usedMoves++;
    }
    const result = await until((s) => s.scene === "expedition-result");
    if (result.expeditionResult.phase === "award") {
      award = result;
      break;
    }
    expect(result.expeditionResult.phase).toBe("failure");
    await press("Space");
    await until((s) => s.scene === "map");
    await press("Space");
    await until((s) => s.scene === "expedition-briefing");
    await press("Space");
    await until((s) => s.scene === "cave");
  }
  expect(award, "earned atomic treasure").toBeTruthy();
  expect(usedMoves).toBeGreaterThan(0);
  expect(usedMoves).toBeLessThan(96);
  expect(award.cave.outcome.code).toBe(1);
  expect(award.campaign.location).toBe(24);
  await press("Space");
  const unlocked = await until(
    (s) =>
      s.scene === "expedition-result" && s.expeditionResult.phase === "atomic",
  );
  expect(unlocked.campaign.atomicAvailable).toBe(true);
  expect(unlocked.campaign.playerCollected).toContain(24);
  await press("Space");
  await until((s) => s.scene === "map");
  await press("Escape");
  await until((s) => s.scene === "office");
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  await point(39, 48);
  await press("Space");
  expect((await state()).campaign.choice).toBe(0);
  await press("ArrowLeft");
  expect((await state()).campaign.choice).toBe(2);
  await canvas.screenshot({ path: ".local/browser-results/atomic-choice.png" });
  await page.keyboard.press("Space");
  await page.clock.runFor(16);
  const charging = await until((s) => s.scene === "atomic-transport");
  expect(charging.departure).toBeNull();
  expect(charging.flight).toBeNull();
  expect(charging.campaign.aircraft).toBe("atomic");
  const startingDay = charging.atomicTransport.success
    ? charging.campaign.day - charging.atomicTransport.days
    : charging.campaign.day;
  const arrival = await until((s) => s.scene === "expedition-briefing");
  expect(arrival.atomicTransport.outcome).not.toBeNull();
  expect(arrival.campaign.location).toBe(
    arrival.atomicTransport.outcome.target,
  );
  expect(arrival.campaign.day).toBe(
    startingDay + arrival.atomicTransport.outcome.days,
  );
  expect(arrival.departure).toBeNull();
  expect(arrival.flight).toBeNull();
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  const restarted = await state();
  expect(restarted.scene).toBe("title");
  expect(restarted.atomicTransport).toBeNull();
  expect(restarted.campaign.atomicAvailable).toBe(false);
  expect(restarted.campaign.aircraft).toBe("launchpad");
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});

test("conditional original atomic misdirection report pixels", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
  const actual = await page.evaluate(async () => {
    const { verifiedResources } = await import("/src/game/resources.js");
    const { Renderer } = await import("/src/game/renderer.js");
    const r = await verifiedResources(async (n) =>
      (await fetch("/game/" + n)).arrayBuffer(),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    new Renderer(canvas, r).render({
      scene: "atomic-transport",
      atomicTransport: { phase: "report", target: 1 },
      campaign: { locations: [null, { name: "Klondike Mines" }] },
    });
    return canvas.toDataURL();
  });
  const expected = PNG.sync.read(
    await readFile(".local/atomic-first-report.png"),
  );
  const image = PNG.sync.read(Buffer.from(actual.split(",")[1], "base64"));
  expect(Buffer.compare(image.data, expected.data)).toBe(0);
});
