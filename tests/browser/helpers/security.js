import { expect } from "@playwright/test";

// Fixed choice for the supported BIOS0 fresh-campaign route, independently
// explored in security.spec.js. No target/final RNG selects a replay input.
export async function finishSecurityEntry({ page, until, state }) {
  let s = await state();
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
