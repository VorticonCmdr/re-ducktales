import { test, expect } from "@playwright/test";

async function open(page, device) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.titleAudioEvents = [];
    document.addEventListener("gameaudio", (e) =>
      window.titleAudioEvents.push(e.detail),
    );
  });
  await page.goto("/");
  await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
  await page.getByLabel("Sound device", { exact: true }).selectOption(device);
  return {
    canvas: page.locator("#game"),
    device: page.locator("#sound"),
    checkbox: page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
    errors,
  };
}
test("title plays Sound001 to its natural Tandy ending once, restarts and stops on Fire", async ({
  page,
}) => {
  test.setTimeout(80000);
  const { canvas, device, checkbox, errors } = await open(page, "tandy");
  await checkbox.check();
  await expect(device).toHaveAttribute("data-last-argument", "1");
  await expect
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  await expect(device).toHaveAttribute("data-playback-status", "0", {
    timeout: 65000,
  });
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  const opening = JSON.parse(await canvas.getAttribute("data-state")).opening;
  expect(opening.outcome.status).toBe("complete");
  expect(opening.rngCalls).toBe(136);
  await expect(device).toHaveAttribute("data-requests", "1");
  const endedTicks = Number(await device.getAttribute("data-ticks"));
  // Status reports arrive at audio-block boundaries. Exact sequence timing is
  // checked by verify:tandy-live; this is actual native browser completion.
  expect(endedTicks).toBeGreaterThanOrEqual(3558);
  await expect
    .poll(async () => Number(await device.getAttribute("data-ticks")))
    .toBeGreaterThan(endedTicks + 30);
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await checkbox.uncheck();
  await expect(device).toHaveAttribute("data-last-argument", "0");
  const mutedRequests = await device.getAttribute("data-requests");
  await checkbox.check();
  const mutedTicks = Number(await device.getAttribute("data-ticks"));
  await expect
    .poll(async () => Number(await device.getAttribute("data-ticks")))
    .toBeGreaterThan(mutedTicks + 20);
  await expect(device).toHaveAttribute("data-requests", mutedRequests);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(device).toHaveAttribute("data-last-argument", "1");
  await expect(device).toHaveAttribute(
    "data-requests",
    // Browser Restart immediately resets its device, then the model emits its
    // own reset and fresh title start. Both explicit resets must be consumed.
    String(Number(mutedRequests) + 3),
  );
  await canvas.screenshot({ path: ".local/browser-results/title-audio.png" });
  await canvas.focus();
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await expect(device).toHaveAttribute("data-last-argument", "0");
  await expect(device).toHaveAttribute("data-playback-status", "0");
  const events = await page.evaluate(() => window.titleAudioEvents);
  expect(events.filter((e) => e.type === "ack").map((e) => e.argument)).toEqual(
    [1, 0, 0, 0, 1, 0],
  );
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
test("keyboard sound enables title music before skip with both sound devices", async ({
  page,
}) => {
  const { canvas, device, checkbox, errors } = await open(page, "tandy");
  await canvas.focus();
  await page.keyboard.press("s");
  await expect(checkbox).toBeChecked();
  await expect(device).toHaveAttribute("data-last-argument", "1");
  await expect(device).toHaveAttribute("data-requests", "2");
  await expect
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  expect(
    await page.evaluate(() =>
      window.titleAudioEvents
        .filter((e) => e.type === "ack")
        .map((e) => e.argument),
    ),
  ).toEqual([0, 1]);
  await page.keyboard.press("s");
  await expect(checkbox).not.toBeChecked();
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await page
    .getByLabel("Sound device", { exact: true })
    .selectOption("speaker");
  await expect(device).toHaveAttribute("data-context-state", "closed");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await canvas.focus();
  await page.keyboard.press("s");
  await expect(checkbox).toBeChecked();
  await expect
    .poll(() => device.evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "difficulty");
  await expect
    .poll(() => device.evaluate((a) => a.paused || a.ended))
    .toBe(true);
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
