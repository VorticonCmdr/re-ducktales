import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

async function campaign(page, hard = false) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 3000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(`unfinished ending scenario ${JSON.stringify(await state())}`);
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
  async function bankRoundTrip() {
    if ((await state()).scene === "office") {
      await page.locator("#map").click();
      await page.clock.runFor(100);
    }
    expect((await state()).scene).toBe("map");
    await point(212, 131);
    await press("Space");
    await press("ArrowRight");
    await press("Space");
    if ((await state()).scene !== "ending") await press("Escape");
  }
  async function ending() {
    for (let trip = 0; trip < 6 && (await state()).scene !== "ending"; trip++)
      await bankRoundTrip();
    const s = await until((s) => s.scene === "ending");
    expect(s.ending.phase).toBe("cover");
    return s;
  }
  async function pixels(path) {
    const expected = PNG.sync.read(await readFile(path));
    const actual = PNG.sync.read(
      Buffer.from(
        (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
        "base64",
      ),
    );
    expect([actual.width, actual.height]).toEqual([320, 200]);
    expect(Buffer.compare(actual.data, expected.data)).toBe(0);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  if (hard) await press("ArrowUp");
  await press("Enter");
  await until((s) => s.scene === "office");
  return { canvas, state, until, press, point, ending, pixels, errors };
}

for (const choice of ["yes", "no"])
  test(`ending Tandy music follows pictures, replay and ${choice} return`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.endingAudioEvents = [];
      document.addEventListener("gameaudio", (event) =>
        window.endingAudioEvents.push(event.detail),
      );
    });
    const t = await campaign(page),
      device = page.locator("#sound");
    await page
      .getByLabel("Sound device", { exact: true })
      .selectOption("tandy");
    await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
    await page.clock.runFor(100);
    await expect(device).toHaveAttribute("data-context-state", "running");
    await t.ending();
    await expect(device).toHaveAttribute("data-last-argument", "1");
    await expect
      .poll(async () =>
        Number(await device.getAttribute("data-signal-samples")),
      )
      .toBeGreaterThan(1024);
    async function settled() {
      await expect
        .poll(() =>
          device.evaluate(
            (a) => a.dataset.requests === a.dataset.lastAcknowledged,
          ),
        )
        .toBe(true);
    }
    await settled();
    const firstRequests = Number(await device.getAttribute("data-requests"));
    const initial = await page.evaluate(() =>
      window.endingAudioEvents.filter((e) => e.type === "ack"),
    );
    expect(initial.at(-1).argument).toBe(1);
    const start = initial.length - 1;
    await t.pixels(".local/ending-winner-first.png");
    await t.press("Space");
    await t.until((s) => s.ending.phase === "celebration");
    await expect(device).toHaveAttribute(
      "data-requests",
      String(firstRequests),
    );
    await t.press("Space");
    await t.until((s) => s.ending.phase === "replay");
    await settled();
    await expect(device).toHaveAttribute("data-last-argument", "1");
    await expect(device).toHaveAttribute(
      "data-requests",
      String(firstRequests + 1),
    );
    await t.pixels(".local/ending-replay-yes.png");
    if (choice === "no") await t.press("ArrowDown");
    await t.canvas.screenshot({
      path: `.local/browser-results/ending-audio-${choice}.png`,
    });
    await t.press("Space");
    await settled();
    await expect(device).toHaveAttribute("data-last-argument", "0");
    await expect(device).toHaveAttribute("data-playback-status", "0");
    if (choice === "yes") {
      expect((await t.state()).scene).toBe("difficulty");
      await expect(device).toHaveAttribute(
        "data-requests",
        String(firstRequests + 2),
      );
      await t.press("Enter");
      expect((await t.state()).scene).toBe("office");
      expect((await t.state()).campaign.day).toBe(1);
      expect((await t.state()).ending).toBeNull();
      await settled();
    } else {
      expect((await t.state()).ending.phase).toBe("credits");
      await page.clock.runFor(2000);
      expect((await t.state()).ending.credit).toBe(0);
    }
    await expect(device).toHaveAttribute(
      "data-requests",
      String(firstRequests + 3),
    );
    const acks = await page.evaluate(() =>
      window.endingAudioEvents.filter((e) => e.type === "ack"),
    );
    expect(acks.map((e) => e.sequence)).toEqual(acks.map((_, i) => i + 1));
    expect(acks.slice(start).map((e) => e.argument)).toEqual([1, 1, 0, 0]);
    await expect(device).toHaveAttribute("data-pending-tokens", "0");
    expect(t.errors).toEqual([]);
    await expect(page.locator("#diagnostic")).toBeHidden();
  });
