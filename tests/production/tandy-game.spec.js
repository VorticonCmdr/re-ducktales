import { test, expect } from "@playwright/test";
import { realpath } from "node:fs/promises";

test("production game loads originals and plays, mutes and closes its persistent Tandy device", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#status")).toContainText(
    "Select your original game folder",
  );
  const choosing = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open game folder", exact: true })
    .click();
  await (await choosing).setFiles(await realpath("game"));
  const c = page.locator("#game"),
    device = page.locator("#sound");
  await expect(c).toHaveAttribute("data-scene", "title");
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await expect(device).toHaveAttribute("data-last-argument", "1");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await expect(c).toHaveAttribute("data-scene", "money-bin");
  await expect
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  await expect(device).toHaveAttribute("data-context-state", "running");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).uncheck();
  await expect(device).toHaveAttribute("data-last-argument", "0");
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await page
    .getByLabel("Sound device", { exact: true })
    .selectOption("speaker");
  await expect(device).toHaveAttribute("data-context-state", "closed");
  const stats = await device.evaluate((a) => ({ ...a.dataset }));
  expect(stats.requests).toBe(stats.lastAcknowledged);
  expect(stats.pendingTokens).toBe("0");
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
});
