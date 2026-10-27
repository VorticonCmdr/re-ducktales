import { test, expect } from "@playwright/test";
import { realpath } from "node:fs/promises";

test("production worklet loads with original folder files,plays and stops", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/viewer.html");
  await expect(
    page.getByRole("button", { name: "Load local game/" }),
  ).toBeHidden();
  await expect(page.locator("#status")).toContainText(
    "Open your original game folder",
  );
  const choosing = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open game folder", exact: true })
    .click();
  await (await choosing).setFiles(await realpath("game"));
  await expect(page.locator("#status")).toContainText("22 files opened");
  await expect(page.locator("#status")).toContainText(
    "All resources decoded successfully",
  );
  await page
    .getByRole("searchbox", { name: "FIND AN ASSET" })
    .fill("Sound 009");
  await page
    .getByRole("button", { name: "IT.DRV · Sound 009 Sound", exact: true })
    .click();
  const section = page.locator('section[aria-label="Tandy preview"]');
  await expect(section).toHaveAttribute("data-state", "live-ready");
  await section
    .getByRole("button", { name: "Play live Tandy", exact: true })
    .focus();
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
  await section.getByRole("button", { name: "Stop Tandy playback" }).click();
  await expect(section).toHaveAttribute("data-state", "stopped");
  await expect(section).toHaveAttribute("data-context-state", "closed");
  expect(errors).toEqual([]);
});
