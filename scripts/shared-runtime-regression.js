// A changed runtime needs an actual newer regression receipt. Older producers,
// golden values and their archives remain independently checked by the caller.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing current runtime regression ${p};see docs/ordinary-keyboard.md`,
    );
  });
const json = async (p) => JSON.parse(await required(p));
const cache = new Map();
const runtimePath = (p) =>
  p.startsWith("src/") ||
  p.startsWith("tests/browser/") ||
  ["index.html", "vite.config.js", "playwright.config.js"].includes(p);
const expectedTitles = {
  campaign: [
    "Hard campaign carries all four families through the final bank and result",
    "jungle defers global keys, pauses actors and resumes cancelled quit",
    "recorded jungle treasure carries independent DOM input through award and duplicate notice",
    "keyboard jungle completion awards treasure and prevents duplicate collection",
    "one campaign carries four expeditions, rival activity and deposits through the deadline",
  ],
  mountain: [
    "recorded mountain summit carries independent DOM input through rival reports and duplicate notice",
    "keyboard mountain ascent awards treasure and prevents duplicate collection",
  ],
};
function checkReport(report, group) {
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.expected, expectedTitles[group].length);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(report.stats[k], 0);
  const cases = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      assert.equal(spec.ok, true);
      assert.equal(spec.tests.length, 1);
      const t = spec.tests[0];
      assert.equal(t.status, "expected");
      assert.equal(t.results.length, 1);
      assert.equal(t.results[0].status, "passed");
      assert.equal(t.results[0].retry, 0);
      cases.push(spec.title);
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  report.suites.forEach(visit);
  assert.deepEqual(cases, expectedTitles[group]);
}
async function verifyReceipt(path) {
  assert.equal(
    path,
    "reference/keyboard-campaign-regression.json",
    "Changed runtime requires the registered independent browser regression",
  );
  const m = await json(path);
  assert.equal(m.completed, true);
  assert.equal(m.sourceFileCount, 525);
  assert.match(m.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(m.runs).sort(), ["campaign", "mountain"]);
  assert.equal(Object.keys(m.artifacts).length, m.expectedArtifacts);
  assert.equal(m.expectedArtifacts, 22);
  for (const [p, h] of Object.entries(m.verificationTools))
    assert.equal(
      sha(await required(p)),
      h,
      `Changed runtime regression verifier ${p}`,
    );
  for (const [role, a] of Object.entries(m.artifacts)) {
    const b = await required(a.path);
    assert.equal(b.length, a.bytes, `Truncated ${role}`);
    assert.equal(sha(b), a.sha256, `Corrupt ${role}`);
  }
  const load = (role) => json(m.artifacts[role].path);
  const source = await load("source");
  assert.equal(source.sourceCommit, m.sourceCommit);
  assert.equal(Object.keys(source.files).length, 525);
  const tree = (revision) =>
    execFileSync("git", ["ls-tree", "-r", "--name-only", revision], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .sort();
  assert.deepEqual(Object.keys(source.files).sort(), tree(m.sourceCommit));
  assert.deepEqual(
    tree("HEAD").filter(runtimePath),
    Object.keys(source.files).filter(runtimePath).sort(),
    "Runtime file inventory changed since browser regression",
  );
  for (const [p, h] of Object.entries(source.files)) {
    assert.ok(!p.startsWith("/") && !p.split("/").includes(".."));
    assert.equal(
      sha(await required(`${m.sourceArchive}/${p}`)),
      h,
      `Archived source ${p}`,
    );
    assert.equal(
      sha(execFileSync("git", ["show", `${m.sourceCommit}:${p}`])),
      h,
      `Git source ${p}`,
    );
    if (runtimePath(p))
      assert.equal(
        sha(await required(p)),
        h,
        `Current runtime changed after browser regression ${p}`,
      );
  }
  for (const [group, run] of Object.entries(m.runs)) {
    assert.deepEqual(await load(run.source), source);
    const runner = await load(run.runner);
    assert.equal(runner.sourceCommit, m.sourceCommit);
    assert.equal(runner.status, "finished");
    assert.equal(runner.exitCode, 0);
    assert.ok(Date.parse(runner.finishedAt) >= Date.parse(runner.startedAt));
    assert.deepEqual(await load(run.status), {
      status: "passed",
      failedTests: [],
    });
    const report = await load(run.report);
    assert.deepEqual(
      report.config.argv.slice(2),
      runner.command.slice(1),
      `Mismatched browser runner/report ${group}`,
    );
    checkReport(report, group);
    for (const alter of [
      (r) => {
        r.stats.expected = 0;
      },
      (r) => {
        r.stats.skipped++;
      },
      (r) => {
        r.suites.pop();
      },
      (r) => {
        r.suites[0].specs[0].tests[0].results[0].status = "failed";
      },
    ]) {
      const broken = structuredClone(report);
      alter(broken);
      assert.throws(() => checkReport(broken, group));
    }
  }
  assert.deepEqual(Object.keys(m.replays).sort(), [
    "easy",
    "hard",
    "jungle",
    "mountain",
  ]);
  for (const [role, replay] of Object.entries(m.replays)) {
    const ref = await json(replay.reference);
    const archived = JSON.parse(
      await required(`${m.sourceArchive}/${replay.reference}`),
    );
    // Only verifier metadata may advance. Inputs,expected values,comparison
    // rules and all original capture identities remain byte-for-byte material.
    const material = (v) => {
      const out = structuredClone(v);
      delete out.verificationTools;
      delete out.currentRuntimeRegression;
      return out;
    };
    assert.deepEqual(
      material(ref),
      material(archived),
      `Changed expected reference ${role}`,
    );
    const points = await load(replay.checkpoints),
      progress = await load(replay.progress);
    assert.equal(points.length, ref.expectedCheckpointCount);
    assert.equal(progress.completed, true);
    assert.equal(progress.consumed, ref.requiredEventCount);
    assert.equal(progress.expectedEvents, ref.requiredEventCount);
    assert.equal(progress.navigation.length, 1);
    assert.deepEqual(progress.errors, []);
    const fixture = async (name) => {
      const a = ref.artifacts[name],
        b = await required(a.path);
      assert.equal(sha(b), a.sha256, `Changed ${role} fixture ${name}`);
      return JSON.parse(b);
    };
    const expectedPoints = await fixture("campaign-checkpoints");
    const checkPoints = (values) => {
      assert.equal(values.length, ref.expectedCheckpointCount);
      for (let i = 0; i < values.length; i++) {
        for (const k of [
          "name",
          "at",
          "eventCount",
          "stateSha256",
          "pixelsSha256",
        ])
          assert.equal(
            values[i][k],
            expectedPoints[i][k],
            `Changed ${role} checkpoint${i} ${k}`,
          );
        assert.deepEqual(
          values[i].state,
          expectedPoints[i].state,
          `Changed ${role} carried state${i}`,
        );
      }
    };
    checkPoints(points);
    assert.deepEqual(progress.lastState, points.at(-1).state);
    assert.throws(() => checkPoints(points.slice(1)));
    const badPixel = structuredClone(points);
    badPixel[0].pixelsSha256 = "0".repeat(64);
    assert.throws(() => checkPoints(badPixel));
    const events = await load(replay.events);
    assert.equal(events.length, ref.requiredEventCount);
    const expectedEvents = await fixture("captured-events");
    // Same consumed boundary as the recorded browser adapter: only game-canvas
    // pointerdown coordinates affect logic,which clamps/truncates them to words.
    const boundary = ({ time, type, key, target, x, y }) => ({
      time,
      type,
      key,
      target,
      ...(type === "pointerdown" && target === "game"
        ? {
            x: Math.max(32, Math.min(285, Math.trunc(x))),
            y: Math.max(28, Math.min(151, Math.trunc(y))),
          }
        : {}),
    });
    const checkEvents = (values) => {
      assert.equal(values.length, ref.requiredEventCount);
      assert.deepEqual(
        values.map(boundary),
        expectedEvents.map(boundary),
        `Changed ${role} actual event stream`,
      );
    };
    checkEvents(events);
    assert.throws(() => checkEvents(events.slice(1)));
    const badTime = structuredClone(events);
    badTime[0].time++;
    assert.throws(() => checkEvents(badTime));
  }
  return source;
}
export async function verifySharedRuntimeFile(
  p,
  historicalHash,
  receipt,
  role,
) {
  assert.ok(["hard", "jungle", "mountain"].includes(role));
  if (sha(await required(p)) === historicalHash) return;
  if (!cache.has(receipt)) cache.set(receipt, verifyReceipt(receipt));
  const source = await cache.get(receipt);
  assert.ok(Object.hasOwn(source.files, p));
  assert.equal(
    sha(await required(p)),
    source.files[p],
    `Unverified changed runtime ${p}`,
  );
}
export async function verifyCurrentRuntimeRegression() {
  await verifyReceipt("reference/keyboard-campaign-regression.json");
  console.log(
    "Current runtime regression:seven actual browser cases including complete Easy/Hard and jungle/mountain routes;525 exact producer sources,four complete event/checkpoint streams,24 damaged-report/event/checkpoint controls. Historical captures retained;whole-native parity unproven.",
  );
}
