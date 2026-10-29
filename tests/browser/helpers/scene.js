import { expect } from "@playwright/test";

// Wait on the visible application state while advancing the test's browser clock.
// This supplies no game state and does not change or retry the input stream.
export async function waitForScene(page, canvas, scene) {
  for (let elapsed = 0; elapsed <= 2000; elapsed += 16) {
    const text = await canvas.getAttribute("data-state");
    const state = text ? JSON.parse(text) : null;
    if (state?.diagnostic) throw Error(state.diagnostic);
    if (
      state?.scene === scene &&
      (scene !== "office" || !state.officeMenu || state.officeMenu.ready) &&
      (scene !== "difficulty" ||
        !state.difficultyMenu ||
        state.difficultyMenu.ready)
    )
      return state;
    await page.clock.runFor(16);
  }
  throw Error(
    `Scene ${scene} not reached: ${await canvas.getAttribute("data-state")}`,
  );
}

// Real-clock startup needs the same boundary without advancing a test clock.
export async function waitForDifficulty(canvas) {
  await expect
    .poll(
      async () => {
        const text = await canvas.getAttribute("data-state");
        const state = text ? JSON.parse(text) : null;
        if (state?.diagnostic) throw Error(state.diagnostic);
        return (
          state?.scene === "difficulty" && state.difficultyMenu?.ready === true
        );
      },
      {
        message: "Original difficulty menu ready after reveal and input flush",
      },
    )
    .toBe(true);
}
