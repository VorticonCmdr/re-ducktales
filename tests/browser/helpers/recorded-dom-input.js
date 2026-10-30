import { expect } from "@playwright/test";

// The caller owns the independently recorded clock. This adapter sends only
// actual browser events;it never reads or modifies simulation state.
export async function recordedDOMInput(page, event) {
  if (event.type === "keydown" || event.type === "keyup") {
    const key = event.key === " " ? "Space" : event.key;
    if (event.type === "keydown") await page.keyboard.down(key);
    else await page.keyboard.up(key);
    return;
  }
  expect(["pointerdown", "pointerup"]).toContain(event.type);
  expect(["game", "map", "back"]).toContain(event.target);
  const target = page.locator(`#${event.target}`);
  if (event.type === "pointerdown") await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  const x =
    event.target === "game"
      ? bounds.x + (event.x * bounds.width) / 320
      : bounds.x + bounds.width / 2;
  const y =
    event.target === "game"
      ? bounds.y + (event.y * bounds.height) / 200
      : bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  if (event.type === "pointerdown") await page.mouse.down();
  else await page.mouse.up();
}
