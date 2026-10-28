import { test, expect } from "@playwright/test";
import { campaign } from "./helpers/ending-route.js";

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
    await t.until((s) => s.ending.phase === "celebration" && s.ending.ready);
    await expect(device).toHaveAttribute(
      "data-requests",
      String(firstRequests),
    );
    await t.press("Space");
    await t.until((s) => s.ending.phase === "replay" && s.ending.ready);
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
    await t.until((s) =>
      choice === "yes"
        ? s.scene === "difficulty"
        : s.ending.phase === "credits",
    );
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
      await t.until(
        (s) =>
          s.ending.phase === "credits" &&
          s.ending.credit === 0 &&
          s.ending.ready,
      );
    }
    await expect(device).toHaveAttribute(
      "data-requests",
      String(firstRequests + (choice === "no" ? 4 : 3)),
    );
    const acks = await page.evaluate(() =>
      window.endingAudioEvents.filter((e) => e.type === "ack"),
    );
    expect(acks.map((e) => e.sequence)).toEqual(acks.map((_, i) => i + 1));
    expect(acks.slice(start).map((e) => e.argument)).toEqual(
      choice === "no" ? [1, 1, 0, 0, 0] : [1, 1, 0, 0],
    );
    await expect(device).toHaveAttribute("data-pending-tokens", "0");
    expect(t.errors).toEqual([]);
    await expect(page.locator("#diagnostic")).toBeHidden();
  });
