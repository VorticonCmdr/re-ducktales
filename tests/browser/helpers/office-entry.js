import { expect } from "@playwright/test";
import { openRecordedApplication } from "./clock.js";

export async function openOffice(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.officePictures = [];
    window.officeAudioEvents = [];
    const seen = new Set();
    document.addEventListener("gameaudio", (e) =>
      window.officeAudioEvents.push(e.detail),
    );
    document.addEventListener(
      "gamepresent",
      (e) => {
        const d = e.detail.officeDeparture;
        if (!d?.presentations || seen.has(d.presentations)) return;
        seen.add(d.presentations);
        window.officePictures.push({
          state: d,
          pixels: document.getElementById("game").toDataURL(),
        });
      },
      true,
    );
  });
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, label, max = 2500) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished office ${label}: ${await canvas.getAttribute("data-state")}`,
    );
  }
  await until((s) => s.scene === "title" && s.opening.skipEnabled, "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await until((s) => s.difficultyMenu?.ready, "difficulty");
  await page.keyboard.press("Enter");
  await until((s) => s.scene === "office", "initial office");
  return { canvas, state, until, errors };
}
