import { test, expect } from "@playwright/test";
import inputs from "../../reference/flight-boundary-inputs.json" with { type: "json" };

// Conditional Flight component host, with native browser keys and independent
// clocks. This starts a seeded flight, not a naturally navigated campaign.
test("seeded flight crosses the visible left boundary and completes after native keyboard release", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const c = inputs.cases[0];
  await page.evaluate(async (options) => {
    const { verifiedResources } = await import("/src/game/resources.js"),
      { Flight } = await import("/src/game/flight.js"),
      { DRIVER_HZ, RETRACE_HZ } = await import("/src/game/application.js"),
      { renderFlightPixels } = await import("/src/game/flight-raster.js");
    const r = await verifiedResources(async (n) =>
      (await fetch("/game/" + n)).arrayBuffer(),
    );
    const canvas = document.createElement("canvas");
    canvas.id = "flight-boundary-fixture";
    canvas.width = 320;
    canvas.height = 200;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Conditional flight boundary fixture");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d"),
      held = new Set();
    const f = new Flight({
      image: r.executable,
      entries: r.archives.get("PLANE.ARC"),
      ...options,
      flushInput: () => held.clear(),
    });
    const start = performance.now();
    let driver = 1000 / DRIVER_HZ,
      retrace = 1000 / RETRACE_HZ,
      last = null,
      min = 0,
      rendered = 0;
    function controls(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "keydown") held.add(e.code);
      else held.delete(e.code);
      f.setControls({
        fire: held.has("Space"),
        direction: held.has("ArrowUp")
          ? "up"
          : held.has("ArrowDown")
            ? "down"
            : null,
      });
    }
    canvas.addEventListener("keydown", controls);
    canvas.addEventListener("keyup", controls);
    setInterval(() => {
      const now = performance.now() - start;
      while (Math.min(driver, retrace) <= now) {
        if (driver <= retrace) {
          f.advanceTick();
          driver += 1000 / DRIVER_HZ;
        } else {
          f.advanceRetrace();
          retrace += 1000 / RETRACE_HZ;
        }
        if (f.memory.i(0xfb2) === 0) min = Math.min(min, f.memory.i(0x5ed6));
        if (f.current && last !== f.current) {
          ctx.putImageData(
            new ImageData(
              renderFlightPixels(
                f.current,
                r.archives.get("PLANE.ARC"),
                r.archives.get("MAIN.ARC")[42].data,
              ),
              320,
              200,
            ),
            0,
            0,
          );
          last = f.current;
          rendered++;
        }
      }
      canvas.dataset.state = JSON.stringify({
        flight: f.snapshot(),
        min,
        rendered,
      });
    }, 8);
  }, c.options);
  const canvas = page.locator("#flight-boundary-fixture");
  await canvas.focus();
  let now = 0;
  for (const event of c.events) {
    await page.clock.runFor(event.at - now);
    now = event.at;
    // Reassert the complete independent event at this timestamp, including held
    // Fire after any original flush. All changes precede the next 8ms callback.
    for (const key of ["Space", "ArrowUp", "ArrowDown"])
      await page.keyboard.up(key);
    if (event.fire) await page.keyboard.down("Space");
    if (event.direction)
      await page.keyboard.down(
        event.direction === "up" ? "ArrowUp" : "ArrowDown",
      );
  }
  await page.clock.runFor(c.endAt - now);
  const s = JSON.parse(await canvas.getAttribute("data-state"));
  expect(s.min).toBe(-8);
  expect(s.flight.phase).toBe("complete");
  expect(s.flight.outcome.status).toBe("crashed");
  expect(s.flight.frames).toBe(288);
  expect(s.flight.seed).toBe(28211);
  expect(s.rendered).toBe(709);
  expect(errors).toEqual([]);
  await canvas.screenshot({
    path: ".local/browser-results/flight-visible-left-edge.png",
  });
});
