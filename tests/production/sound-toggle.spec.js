import { test, expect } from "@playwright/test";
import { realpath, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { waitForDifficulty } from "../browser/helpers/scene.js";
for (const device of ["speaker", "tandy"])
  test(
    "production " + device + " keyboard sound uses original stop/click calls",
    async ({ page }, info) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/?bios-seed=0");
      const choosing = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Open game folder", exact: true })
        .click();
      await (await choosing).setFiles(await realpath("game"));
      const canvas = page.locator("#game"),
        sound = page.locator("#sound"),
        audio = page.locator("#audio");
      await expect(canvas).toHaveAttribute("data-scene", "title");
      await page.locator("#audio-device").selectOption(device);
      await audio.check();
      await expect(sound).toHaveAttribute("data-last-argument", "1");
      await canvas.focus();
      await page.keyboard.press("Space");
      await waitForDifficulty(canvas);
      await page.keyboard.press("Enter");
      await expect(canvas).toHaveAttribute("data-scene", "office");
      await expect
        .poll(
          async () =>
            JSON.parse(await canvas.getAttribute("data-state")).officeMenu
              ?.ready,
        )
        .toBe(true);
      await expect
        .poll(async () => {
          const s = await sound.evaluate((e) => ({ ...e.dataset }));
          return s.requests === s.lastAcknowledged;
        })
        .toBe(true);
      await page.evaluate(() => {
        window.productionToggle = [];
        document.addEventListener("gameaudio", (e) =>
          window.productionToggle.push(e.detail),
        );
      });
      await page.keyboard.press("s");
      await expect(audio).not.toBeChecked();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.productionToggle.filter((e) => e.type === "ack").length,
          ),
        )
        .toBe(2);
      await expect(sound).toHaveAttribute("data-playback-status", "0");
      await page.keyboard.press("s");
      await expect(audio).toBeChecked();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.productionToggle.filter((e) => e.type === "ack").length,
          ),
        )
        .toBe(3);
      const events = await page.evaluate(() => window.productionToggle),
        acks = events.filter((e) => e.type === "ack");
      expect(acks.map((e) => e.argument)).toEqual([0, 0x24, 0]);
      expect(acks[0].frame).toBe(acks[1].frame);
      if (device === "speaker") expect(acks[1].accepted).toBe(false);
      else expect(acks[1].busy).toBe(true);
      const stats = await sound.evaluate((e) => ({ ...e.dataset }));
      expect(stats.contextState).toBe("running");
      expect(stats.requests).toBe(stats.lastAcknowledged);
      await expect(page.locator("#diagnostic")).toBeHidden();
      expect(errors).toEqual([]);
      await page.locator("#restart").click();
      await expect(canvas).toHaveAttribute("data-scene", "title");
      const path = info.outputPath("toggle-" + device + ".json");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(
        path,
        JSON.stringify(
          {
            completed: true,
            device,
            clock: "real browser clock;explicit BIOS0",
            events,
            stats,
            restart: true,
          },
          null,
          2,
        ) + "\n",
      );
      await info.attach("toggle-" + device, {
        path,
        contentType: "application/json",
      });
    },
  );
