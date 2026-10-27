import { test, expect } from "@playwright/test";

const preview = (page) => page.locator('section[aria-label="Tandy preview"]');
async function choose(page, id) {
  await page
    .getByRole("searchbox", { name: "FIND AN ASSET" })
    .fill(`Sound ${id}`);
  await page
    .getByRole("button", { name: `IT.DRV · Sound ${id} Sound`, exact: true })
    .click();
}
async function open(page, id) {
  await page.goto("/viewer.html");
  await expect(page.locator("#status")).toContainText(
    "All resources decoded successfully",
  );
  await choose(page, id);
  await expect(preview(page)).toHaveAttribute("data-state", "live-ready");
}

test("live Tandy engine uses real worklet audio,stops,replays and closes on asset switch", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "009");
  const section = preview(page);
  const play = section.getByRole("button", {
    name: "Play live Tandy",
    exact: true,
  });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(section).toHaveAttribute("data-state", "playing");
  await expect
    .poll(async () => Number(await section.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  const stats = await section.evaluate((s) => ({ ...s.dataset }));
  expect(stats.contextState).toBe("running");
  expect(Number(stats.acknowledgements) + Number(stats.chains)).toBe(
    Number(stats.interrupts),
  );
  expect(Number(stats.interrupts)).toBeGreaterThan(12);
  await section.getByRole("button", { name: "Stop Tandy playback" }).click();
  await expect(section).toHaveAttribute("data-state", "stopped");
  await expect(section).toHaveAttribute("data-context-state", "closed");
  await play.click();
  await expect(section).toHaveAttribute("data-state", "playing");
  const old = await section.elementHandle();
  await choose(page, "036");
  await expect(
    page.locator('audio[aria-label="Tandy sound preview"]'),
  ).toHaveAttribute("data-state", "ready");
  await expect
    .poll(() => old.getAttribute("data-context-state"))
    .toBe("closed");
  await expect(
    page.getByRole("button", { name: "Stop Tandy playback" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("long Tandy music runs beyond the file preview and ends naturally", async ({
  page,
}) => {
  // Original sequence001 takes about49 seconds. Keep this allowance scoped to
  // its actual native audio completion; no virtual clock or injected end event.
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "001");
  const section = preview(page);
  await section
    .getByRole("button", { name: "Play live Tandy", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(section).toHaveAttribute("data-state", "playing");
  await expect(section).toHaveAttribute("data-state", "ended", {
    timeout: 75000,
  });
  await expect(section).toHaveAttribute("data-context-state", "closed");
  const state = await section.evaluate((s) => ({ ...s.dataset }));
  expect(Number(state.ticks)).toBe(3558);
  expect(Number(state.frames)).toBeGreaterThan(Number(state.sampleRate) * 40);
  expect(Number(state.signalSamples)).toBeGreaterThan(0);
  expect(Number(state.acknowledgements) + Number(state.chains)).toBe(
    Number(state.interrupts),
  );
  await expect(
    section.getByText("Original sequence complete.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("missing worklet module stops with a visible diagnostic and no fallback playback", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Chromium's AudioWorklet fetch is not exposed to page/context routing.
  // Substitute only Vite's observed URL-export module,then let a real
  // AudioContext attempt the missing same-origin resource. No audio mock.
  let blocked = 0;
  await page.route(
    (url) =>
      url.pathname.endsWith("/src/tandy-worklet.js") &&
      url.searchParams.has("worker") &&
      url.searchParams.has("url"),
    (route) => {
      blocked++;
      return route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: 'export default "/src/__missing_tandy_worklet__.js";',
      });
    },
  );
  await open(page, "009");
  const section = preview(page);
  await section
    .getByRole("button", { name: "Play live Tandy", exact: true })
    .click();
  await expect.poll(() => blocked).toBe(1);
  await expect(section).toHaveAttribute("data-state", "error");
  await expect(section.getByRole("alert")).toContainText(
    "Tandy preview stopped:",
  );
  await expect(section).toHaveAttribute("data-context-state", "closed");
  expect(
    await page.locator("audio").evaluateAll((a) => a.every((x) => x.paused)),
  ).toBe(true);
  expect(errors).toEqual([]);
});
