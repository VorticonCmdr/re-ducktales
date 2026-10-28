import { expect } from "@playwright/test";

// Fixed choice for the supported BIOS0 fresh-campaign route, independently
// explored in security.spec.js. No target/final RNG selects a replay input.
export async function finishSecurityEntry({ page, until, state }) {
  let s = await state();
  // A DOM click queues the office action for the next simulation poll. Wait
  // for that action to be consumed before deciding whether security is needed.
  if (s.scene === "office") s = await until((v) => v.scene !== "office");
  if (s.scene === "office-departure")
    s = await until((v) => v.scene !== "office-departure");
  if (s.scene !== "security") return s;
  await until((v) => v.security?.ready);
  await page.keyboard.press("ArrowRight");
  await until((v) => v.security?.selection === 1 && v.security.ready);
  await page.keyboard.press("Space");
  s = await until((v) => v.scene !== "security");
  expect(s.scene, "Fixed decoded security choice reaches map").toBe("map");
  expect(s.securityPending).toBe(false);
  return s;
}

// The same player choices with the application's real browser clock. Polls
// observe progress; they neither advance simulation time nor inject game state.
export async function finishSecurityEntryRealTime(page, canvas) {
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate) {
    let current;
    await expect
      .poll(
        async () => {
          current = await state();
          if (current?.diagnostic) throw Error(current.diagnostic);
          return Boolean(current && predicate(current));
        },
        {
          message: "Original control-center/security transition",
          timeout: 10000,
        },
      )
      .toBe(true);
    return current;
  }
  return finishSecurityEntry({ page, until, state });
}
