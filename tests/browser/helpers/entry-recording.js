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
// never choose controls or timestamps. Only the pre-activity prefix is saved.
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
