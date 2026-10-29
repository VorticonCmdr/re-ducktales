// Destination-era focused routes have new captures; historical contracts stay
// intact. This is scoped port/browser evidence, never native whole-level parity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : x,
  );
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing destination route artifact ${p}`);
  });
const json = async (p) => JSON.parse(await required(p));
const titles = {
  jungle: [
    "jungle defers global keys, pauses actors and resumes cancelled quit",
    "recorded jungle treasure carries independent DOM input through award and duplicate notice",
  ],
  mountain: [
    "recorded mountain summit carries independent DOM input through rival reports and duplicate notice",
  ],
};
const profiles = {
  "jungle-entry": {
    count: 1,
    events: 50,
    samples: 0,
    flight: 74,
    group: "jungle",
  },
  "jungle-treasure": {
    count: 27,
    events: 70,
    samples: 860,
    flight: 74,
    group: "jungle",
  },
  "mountain-ascent": {
    count: 27,
    events: 104,
    samples: 764,
    flight: 79,
    group: "mountain",
  },
};
function reportCases(report, group) {
  assert.deepEqual(report.errors, []);
  assert.equal(
    report.stats.expected,
    titles[group].length,
    "Zero or missing browser cases",
  );
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(report.stats[k], 0, k);
  const found = [];
  const visit = (s) => {
    for (const spec of s.specs ?? []) {
      assert.equal(spec.ok, true);
      assert.equal(spec.tests.length, 1);
      const t = spec.tests[0];
      assert.equal(t.status, "expected");
      assert.equal(t.results.length, 1);
      assert.equal(t.results[0].status, "passed");
      assert.equal(t.results[0].retry, 0);
      found.push(spec.title);
    }
    for (const child of s.suites ?? []) visit(child);
  };
  report.suites.forEach(visit);
  assert.deepEqual(found, titles[group], "Missing required browser route");
}
const runtime = (p) =>
  p.startsWith("src/") ||
  p.startsWith("tests/browser/") ||
  [
    "index.html",
    "vite.config.js",
    "vite.campaign.config.js",
    "playwright.config.js",
    "playwright.campaign.config.js",
  ].includes(p);
const sourceCache = new Map();
async function source(m, role, current) {
  const record = m.artifacts[`${role}-source`],
    zip = m.artifacts[`${role}-zip`];
  assert.ok(record && zip, `Missing ${role} source evidence`);
  if (!sourceCache.has(record.path))
    sourceCache.set(
      record.path,
      (async () => {
        const s = await json(record.path),
          bytes = await required(zip.path);
        assert.equal(s.commit, m[`${role}Commit`]);
        assert.equal(Object.keys(s.files).length, m.sourceFileCounts[role]);
        const archive = execFileSync(
          "git",
          ["archive", "--format=zip", s.commit],
          { maxBuffer: 32 * 1024 * 1024 },
        );
        assert.equal(
          sha(bytes),
          sha(archive),
          `Changed ${role} source archive`,
        );
        assert.equal(sha(bytes), s.archiveSha256);
        const files = JSON.parse(
          execFileSync(
            "python3",
            [
              "-c",
              "import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}))",
              zip.path,
            ],
            { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
          ),
        );
        assert.deepEqual(files, s.files, `Incomplete ${role} source inventory`);
        return s;
      })(),
    );
  const s = await sourceCache.get(record.path);
  assert.equal(s.commit, m[`${role}Commit`]);
  assert.equal(Object.keys(s.files).length, m.sourceFileCounts[role]);
  if (current) {
    const paths = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(runtime)
      .sort();
    assert.deepEqual(
      paths,
      Object.keys(s.files).filter(runtime).sort(),
      "Changed current runtime inventory",
    );
    for (const p of paths)
      assert.equal(
        sha(await required(p)),
        s.files[p],
        `Unverified current runtime ${p}`,
      );
  }
  return s;
}
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
for (const path of process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "reference/destination-jungle-entry.json",
      "reference/destination-jungle-treasure.json",
      "reference/destination-mountain-ascent.json",
    ]) {
  const m = await json(path),
    p = profiles[m.milestone];
  assert.ok(p, "Unknown destination route");
  const toolPaths = [
    "scripts/verify-destination-routes.js",
    "scripts/verify-destination-route-negatives.js",
    "scripts/replay-hard-campaign.js",
    "tests/browser/helpers/recorded-campaign.js",
    "tests/browser/helpers/clock.js",
  ];
  assert.deepEqual(
    Object.keys(m.verificationTools ?? {}).sort(),
    toolPaths.sort(),
    "Missing route verification tools",
  );
  for (const [tool, hash] of Object.entries(m.verificationTools))
    assert.equal(
      sha(await required(tool)),
      hash,
      `Changed route verifier ${tool}`,
    );

  assert.equal(m.verificationEdition, "destination");
  assert.equal(m.pending, false);
  assert.equal(m.browserVerified, true);
  assert.equal(m.expectedCheckpointCount, p.count);
  assert.equal(m.requiredEventCount, p.events);
  assert.equal(m.expectedInputCount ?? 0, p.samples);
  assert.equal(m.expectedFlightPresentations, p.flight);
  assert.equal(m.expectedFlagAliasPresentations, 0);
  assert.deepEqual(m.injections, []);
  assert.deepEqual(m.fittedInputs, []);
  assert.equal(m.partialRestore, false);
  assert.equal(sha(await required(m.buildManifest)), m.buildManifestSha256);
  const build = await json(m.buildManifest);
  assert.equal(Object.keys(build.files).length, 22);
  for (const [name, spec] of Object.entries(build.files)) {
    const b = await required(`game/${name}`);
    assert.equal(b.length, spec.bytes);
    assert.equal(sha(b), spec.sha256, name);
  }
  assert.ok(Object.keys(m.artifacts).length >= 12, "Missing route evidence");
  for (const [role, spec] of Object.entries(m.artifacts)) {
    const b = await required(spec.path);
    assert.equal(b.length, spec.bytes, `Truncated ${role}`);
    assert.equal(sha(b), spec.sha256, `Corrupt ${role}`);
  }
  const capture = await source(m, "capture", false);
  if (p.samples) {
    const spec = m.artifacts["input-profile"];
    assert.equal(
      spec.sha256,
      capture.files[spec.path],
      "Changed authored movement profile",
    );
    const input = await json(spec.path);
    const bytes = input.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
    assert.equal(bytes.length, p.samples);
    assert.equal(input.inputCount, p.samples);
    assert.equal(sha(Buffer.from(bytes)), input.sha256);
  }
  await source(m, "browser", true);
  const load = (role) => json(m.artifacts[role].path);
  const environment = await load("environment"),
    raw = await load("capture-environment");
  assert.equal(environment.completed, true);
  assert.equal(raw.completed, false);
  assert.equal(
    environment.rawEnvironmentSha256,
    m.artifacts["capture-environment"].sha256,
  );
  for (const key of [
    "hard",
    "clockOrigin",
    "displayMilliseconds",
    "capturePhase",
  ])
    assert.equal(environment[key], raw[key]);
  const points = await load("campaign-checkpoints"),
    events = await load("captured-events"),
    timeline = await load("timeline");
  assert.equal(points.length, p.count);
  assert.equal(events.length, p.events);
  assert.equal(timeline.observations.length, p.count);
  assert.deepEqual(
    points.map((c) => c.name),
    m.checkpointNames,
  );
  assert.equal(timeline.endAt, points.at(-1).at);
  assert.equal(points.at(-1).eventCount, events.length);
  for (let i = 0; i < points.length; i++) {
    const c = points[i];
    assert.equal(sha(canonical(c.state)), c.stateSha256, `Corrupt state${i}`);
    assert.deepEqual(
      { name: c.name, at: c.at, eventCount: c.eventCount },
      timeline.observations[i],
    );
  }
  for (const role of ["captured-events", "campaign-checkpoints", "timeline"]) {
    assert.equal(
      sha(await required(`${m.captureRoot}/${role}.json`)),
      m.artifacts[role].sha256,
      `Altered capture ${role}`,
    );
  }
  const runner = await load("browser-runner"),
    report = await load("browser-report");
  assert.equal(runner.completed, true);
  assert.equal(runner.sourceCommit, m.browserCommit);
  assert.deepEqual(
    runner.steps.map((s) => [s.name, s.exitCode]),
    [
      ["positive", 0],
      ["negative", 0],
    ],
  );
  assert.deepEqual(
    report.config.argv.slice(2),
    runner.steps[0].command.slice(2),
  );
  assert.equal(report.config.argv[1], resolve(runner.steps[0].command[1]));
  reportCases(report, p.group);
  for (const corrupt of [
    (r) => (r.stats.expected = 0),
    (r) => r.stats.skipped++,
    (r) => (r.suites = []),
    (r) => {
      const visit = (s) =>
        s.specs?.length
          ? (s.specs[0].tests[0].results[0].status = "failed")
          : s.suites.forEach(visit);
      r.suites.forEach(visit);
    },
  ]) {
    const broken = structuredClone(report);
    corrupt(broken);
    assert.throws(() => reportCases(broken, p.group));
  }
  const negative = (
    await required(m.artifacts["browser-negative"].path)
  ).toString();
  assert.match(negative, /Carried browser state/);
  assert.match(negative, /1 failed/);
  assert.doesNotMatch(
    negative,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|Test was interrupted/,
  );
  if (p.samples) {
    const actual = await load("browser-checkpoints"),
      consumed = await load("browser-events"),
      progress = await load("browser-progress");
    assert.deepEqual(actual, points, "Changed browser carried checkpoints");
    assert.deepEqual(
      consumed.map(boundary),
      events.map(boundary),
      "Changed consumed DOM inputs",
    );
    assert.equal(progress.completed, true);
    assert.equal(progress.consumed, p.events);
    assert.equal(progress.expectedEvents, p.events);
    assert.deepEqual(progress.errors, []);
    assert.equal(progress.navigation.length, 1);
    assert.deepEqual(progress.lastState, points.at(-1).state);
    assert.throws(() => assert.deepEqual(actual.slice(1), points));
    assert.throws(() =>
      assert.deepEqual(consumed.slice(1).map(boundary), events.map(boundary)),
    );
  }
  execFileSync(
    process.execPath,
    ["scripts/replay-hard-campaign.js", m.artifactRoot, `--manifest=${path}`],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 },
  );
  console.log(
    `Destination ${m.milestone}: ${p.count} exact carried checkpoints, ${p.events} consumed events; fresh-browser receipt, current runtime, original build, source archives and negative controls verified. Not native whole-level parity.`,
  );
}
