import { test, expect } from "@playwright/test";

for (const [id, ticks, samples] of [
  ["036", 6, 3027],
  ["067", 17, 9686],
  ["068", 17, 9686],
]) {
  test(`asset viewer plays the Tandy${id} preview through native audio`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/viewer.html");
    await expect(page.locator("#status")).toContainText(
      "All resources decoded successfully",
    );
    await page
      .getByRole("searchbox", { name: "FIND AN ASSET" })
      .fill(`Sound ${id}`);
    await page
      .getByRole("button", { name: `IT.DRV · Sound ${id} Sound`, exact: true })
      .click();
    const audio = page.locator('audio[aria-label="Tandy sound preview"]');
    await expect(audio).toHaveAttribute("data-state", "ready");
    await expect(audio).toHaveAttribute("data-ticks", String(ticks));
    // Real keyboard input and native media clock; no mocked play(), fake timer,
    // injected ended event or expected-output-driven adapter.
    const button = page.getByRole("button", {
      name: "Play Tandy preview",
      exact: true,
    });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(audio).toHaveAttribute("data-state", "ended");
    const media = await audio.evaluate((a) => ({
      ended: a.ended,
      duration: a.duration,
      time: a.currentTime,
      paused: a.paused,
      error: a.error,
    }));
    expect(media.ended).toBe(true);
    expect(media.paused).toBe(true);
    expect(media.error).toBeNull();
    // Native WAV duration is rounded to microseconds; allow one PCM sample.
    expect(Math.abs(media.duration - samples / 44100)).toBeLessThan(1 / 44100);
    expect(Math.abs(media.time - media.duration)).toBeLessThan(1 / 44100);
    await expect(
      page.getByText("Supported Tandy previews:", { exact: false }),
    ).toBeVisible();
    await button.click();
    await expect(audio).toHaveAttribute("data-state", "ended");
    await page
      .getByRole("searchbox", { name: "FIND AN ASSET" })
      .fill("Sound 035");
    await page
      .getByRole("button", { name: "IT.DRV · Sound 035 Sound", exact: true })
      .click();
    await expect(audio).toHaveCount(0);
    await expect(page.locator("audio")).toHaveCount(1);
    await expect(page.locator("#note")).toContainText("PC-speaker playback");
    expect(errors).toEqual([]);
  });
}
