import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
// Fixed already-accepted startup/flight inputs. Expected snapshots never choose
// controls; the first3 checkpoints are copied verbatim from the original stream.
async function entry(page, info) {
  const manifest = JSON.parse(
    await readFile("reference/speaker-runtime-campaign.json"),
  );
  const artifacts = {};
  for (const role of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
  ]) {
    const spec = manifest.artifacts[role],
      b = await readFile(spec.path);
    expect(hash(b)).toBe(spec.sha256);
    artifacts[role] = JSON.parse(b);
  }
  const checks = artifacts["campaign-checkpoints"].slice(0, 3);
  expect(checks.map((c) => c.name)).toEqual([
    "campaign-start",
    "flight-start",
    "arrival",
  ]);
  expect(checks[2].state.scene).toBe("jungle");
  expect(checks[2].state.jungle.frames).toBe(0);
  expect(checks[2].eventCount).toBe(1016);
  artifacts["campaign-checkpoints"] = checks;
  artifacts["captured-events"] = artifacts["captured-events"].slice(0, 1016);
  artifacts.timeline.observations = artifacts.timeline.observations.slice(0, 3);
  artifacts.timeline.endAt = checks[2].at;
  const root = info.outputPath("prefix");
  await mkdir(root, { recursive: true });
  const prefix = {
    ...manifest,
    milestone: "jungle-entry",
    expectedCheckpointCount: 3,
    requiredEventCount: 1016,
    artifacts: {},
  };
  for (const [role, value] of Object.entries(artifacts)) {
    const path = `${root}/${role}.json`,
      bytes = Buffer.from(JSON.stringify(value));
    await writeFile(path, bytes);
    prefix.artifacts[role] = { path, bytes: bytes.length, sha256: hash(bytes) };
  }
  await runRecordedCampaign({ page, info, manifest: prefix });
}
test("line-inclusive jungle drawing waits, pauses and resumes cancelled quit through actual controls", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  if (process.env.DUCKTALES_JUNGLE_LINE_NEGATIVE === "zero-work")
    await page.route("**/src/game/jungle.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      expect(body).toContain("until: this.now() + milliseconds");
      await route.fulfill({
        response,
        body: body.replace(
          "until: this.now() + milliseconds",
          "until: this.now()",
        ),
      });
    });
  await entry(page, info);
  const canvas = page.locator("#game"),
    state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function until(predicate, limit = 5000) {
    for (let i = 0; i < limit; i++) {
      const s = await state();
      if (s.diagnostic) throw Error(s.diagnostic);
      if (predicate(s)) return s;
      await page.clock.runFor(1);
    }
    throw Error(
      `Unfinished line browser boundary:${JSON.stringify(await state())}`,
    );
  }
  const first = await until(
    (s) => s.jungle.frames === 1 && s.jungle.drawingWork,
  );
  expect(first.jungle.drawingWork.lines).toBeGreaterThan(0);
  expect(first.jungle.drawingWork.lineInstructions).toBeGreaterThan(0);
  expect(first.jungle.drawingWork.omittedLines).toBe(0);
  // Observe the exact declared first draw deadline before either wipe starts.
  const started = await page.evaluate(() => performance.now());
  const duration = first.jungle.drawingWork.milliseconds;
  // Simulation's graphics wait is visible through source state only as metadata;
  // use publication boundary timing at1ms observer precision below.
  const beforePresentations = first.jungle.presentations;
  await page.clock.runFor(Math.max(0, Math.floor(duration) - 2));
  expect(
    (await state()).jungle.presentations,
    "Line-inclusive initial drawing deadline",
  ).toBe(beforePresentations);
  await until((s) => s.jungle.frames === 2);
  const second = await state();
  expect(second.jungle.drawingWork.lines).toBeGreaterThan(0);
  await canvas.focus();
  await page.keyboard.press("p");
  await until((s) => s.systemOverlay?.kind === "pause");
  const paused = (await state()).jungle;
  await page.clock.runFor(400);
  const afterPause = (await state()).jungle;
  const actors = ({ tick, retrace, ...rest }) => rest;
  expect(actors(afterPause)).toEqual(actors(paused));
  expect(afterPause.tick).toBeGreaterThan(paused.tick);
  expect(afterPause.retrace).toBeGreaterThan(paused.retrace);
  await until((s) => s.systemOverlay?.phase === "waiting");
  await page.keyboard.press("p");
  await until((s) => !s.systemOverlay);
  await page.keyboard.press("q");
  await until((s) => s.systemOverlay?.kind === "quit");
  await page.keyboard.press("n");
  await until((s) => !s.systemOverlay);
  await until((s) => s.jungle.frames > paused.frames);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await info.attach("line-boundaries", {
    body: JSON.stringify({
      started,
      first: first.jungle,
      second: second.jungle,
      paused,
      final: (await state()).jungle,
    }),
    contentType: "application/json",
  });
});
