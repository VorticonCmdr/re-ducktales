import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

export const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

// Capture external DOM events before the application handler. Expected states
// never choose controls or timestamps. The caller declares the recorded route;
// capture alone is never acceptance.
export async function installEntryRecording(page) {
  await page.addInitScript(() => {
    window.entryEvents = [];
    for (const type of ["keydown", "keyup", "pointerdown", "pointerup"])
      document.addEventListener(
        type,
        (event) => {
          const target = event.target.closest?.("canvas,button");
          const bounds = target?.getBoundingClientRect();
          window.entryEvents.push({
            time: performance.now(),
            type,
            key: event.key ?? null,
            target: target?.id ?? null,
            ...(target?.id === "game"
              ? {
                  x: ((event.clientX - bounds.left) * 320) / bounds.width,
                  y: ((event.clientY - bounds.top) * 200) / bounds.height,
                }
              : {}),
          });
        },
        true,
      );
  });
}

export async function saveEntryRecording({ page, canvas, state, root, name }) {
  await mkdir(root, { recursive: true });
  const { events, at, pixels } = await page.evaluate(() => ({
    events: window.entryEvents,
    at: performance.now(),
    pixels: document.getElementById("game").toDataURL(),
  }));
  const png = Buffer.from(pixels.split(",")[1], "base64");
  const observation = { name, at, eventCount: events.length };
  const checkpoint = {
    ...observation,
    state,
    stateSha256: digest(canonical(state)),
    pixelsSha256: digest(PNG.sync.read(png).data),
  };
  const artifacts = {
    "environment.json": {
      hard: false,
      completed: false,
      clockOrigin: 1,
      displayMilliseconds: 8,
      capturePhase: "before-target-handler",
      scope: "Exploratory Easy activity-entry prefix; not a complete campaign",
    },
    "captured-events.json": events,
    "campaign-checkpoints.json": [checkpoint],
    "timeline.json": {
      clockOrigin: 1,
      displayMilliseconds: 8,
      endAt: at,
      observations: [observation],
    },
  };
  for (const [file, value] of Object.entries(artifacts))
    await writeFile(`${root}/${file}`, JSON.stringify(value, null, 2) + "\n");
  await writeFile(`${root}/entry.png`, png);
  return checkpoint;
}

export async function observeRecordedRoute({ page, state, name }) {
  const { at, eventCount, pixels } = await page.evaluate(() => ({
    at: performance.now(),
    eventCount: window.entryEvents.length,
    pixels: document.getElementById("game").toDataURL(),
  }));
  const png = Buffer.from(pixels.split(",")[1], "base64");
  return {
    name,
    at,
    eventCount,
    state,
    png,
    stateSha256: digest(canonical(state)),
    pixelsSha256: digest(PNG.sync.read(png).data),
  };
}

export async function saveRecordedRoute({ page, root, observations, scope }) {
  if (!observations.length) throw Error("SETUP: empty recorded route");
  await mkdir(root, { recursive: true });
  const events = await page.evaluate(() => window.entryEvents);
  const checkpoints = observations.map(({ png, ...point }) => point);
  const points = checkpoints.map(({ name, at, eventCount }) => ({
    name,
    at,
    eventCount,
  }));
  const files = {
    "environment.json": {
      hard: false,
      completed: false,
      clockOrigin: 1,
      displayMilliseconds: 8,
      capturePhase: "before-target-handler",
      scope,
    },
    "captured-events.json": events,
    "campaign-checkpoints.json": checkpoints,
    "timeline.json": {
      clockOrigin: 1,
      displayMilliseconds: 8,
      endAt: points.at(-1).at,
      observations: points,
    },
  };
  for (const [name, value] of Object.entries(files))
    await writeFile(`${root}/${name}`, JSON.stringify(value, null, 2) + "\n");
  for (const point of observations)
    await writeFile(`${root}/${point.name}.png`, point.png);
}
