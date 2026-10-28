// In Playwright1.64, install() followed by pauseAt() replays the real interval
// between those calls into a new document's performance clock. Pause first
// (the public API installs implicitly), then advance the declared origin while
// no application exists. No expected game state determines these clock values.
export async function installRecordedClock(page, origin) {
  if (!Number.isInteger(origin) || origin < 0)
    throw Error("SETUP: invalid recorded clock origin");
  const wall = Date.parse("2026-01-01T00:00:01Z");
  await page.clock.pauseAt(new Date(wall - origin));
  if (origin) await page.clock.runFor(origin);
}

// Configure the clock on the actual document before any translated game code
// executes. A new document can replay the framework's clock setup logs with a
// different absolute performance origin; the application consumes relative time.
export async function openRecordedApplication(page, origin) {
  await installRecordedClock(page, origin);
  let release;
  let reached;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const entry = new Promise((resolve) => {
    reached = resolve;
  });
  await page.route("**/src/game/browser.js*", async (route) => {
    reached();
    await ready;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "commit" });
  let timer;
  try {
    await Promise.race([
      entry,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(Error("SETUP: Vite game entry did not reach clock barrier")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  // This pre-application margin only allows the protocol call to pause safely.
  // No game object or simulation timer exists yet, and it is not replay time.
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 10000),
  );
  await page.clock.setSystemTime(new Date("2026-01-01T00:00:01Z"));
  await page.evaluate((start) => {
    const now = performance.now.bind(performance),
      base = now();
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: () => now() - base + start,
    });
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  }, origin);
  release();
}
