// Deliberately broken contracts refer to owned copies. No authoritative fixture
// is renamed, overwritten, or restored as part of a negative control.
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/cave-composition-campaign.json";
const m = JSON.parse(await readFile(manifestPath));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const originals = {};
for (const [role, spec] of Object.entries(m.artifacts))
  originals[role] = sha(await readFile(spec.path));
await mkdir(".local/current-campaign-verification", { recursive: true });
const root = await mkdtemp(
  ".local/current-campaign-verification/fixture-negatives-",
);
const kinds = [
  "missing-source-archive",
  "corrupt-ending-picture",
  ...(m.completeSourceInventory
    ? [
        "missing-consumer-archive",
        "corrupt-consumer-inventory",
        "changed-browser-contract",
      ]
    : []),
  ...(m.runtimeComparison
    ? [
        "missing-runtime-archive",
        "corrupt-runtime-inventory",
        "changed-historical-ending",
      ]
    : []),
];
for (const kind of kinds) {
  const contract = structuredClone(m);
  if (kind === "missing-source-archive")
    contract.artifacts["producer-archive"].path = `${root}/missing.zip`;
  else if (kind === "corrupt-ending-picture") {
    const bytes = Buffer.from(await readFile(m.artifacts["ending-png"].path));
    bytes[bytes.length - 1] ^= 1;
    contract.artifacts["ending-png"].path = `${root}/corrupt.png`;
    await writeFile(contract.artifacts["ending-png"].path, bytes);
  }
  if (kind === "missing-runtime-archive")
    contract.artifacts["runtime-archive"].path = `${root}/missing-runtime.zip`;
  if (kind === "corrupt-runtime-inventory") {
    const inventory = JSON.parse(
      await readFile(m.artifacts["runtime-source"].path),
    );
    inventory.files["src/game/browser.js"] = "0".repeat(64);
    const bytes = Buffer.from(JSON.stringify(inventory));
    const path = `${root}/corrupt-runtime-source.json`;
    await writeFile(path, bytes);
    contract.artifacts["runtime-source"] = {
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
    };
  }
  if (kind === "changed-historical-ending") contract.expectedEnding.banked++;
  if (kind === "missing-consumer-archive")
    contract.artifacts["consumer-archive"].path =
      `${root}/missing-consumer.zip`;
  if (kind === "corrupt-consumer-inventory") {
    const inventory = JSON.parse(
      await readFile(m.artifacts["consumer-source"].path),
    );
    inventory.files["src/game/browser.js"] = "0".repeat(64);
    const bytes = Buffer.from(JSON.stringify(inventory)),
      path = `${root}/bad-consumer-source.json`;
    await writeFile(path, bytes);
    contract.artifacts["consumer-source"] = {
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
    };
  }
  if (kind === "changed-browser-contract") {
    const pending = JSON.parse(
      await readFile(m.artifacts["browser-contract"].path),
    );
    pending.expectedEnding.banked++;
    const bytes = Buffer.from(JSON.stringify(pending)),
      path = `${root}/bad-browser-contract.json`;
    await writeFile(path, bytes);
    contract.artifacts["browser-contract"] = {
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
    };
  }
  const path = `${root}/${kind}.json`;
  await writeFile(path, JSON.stringify(contract));
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-current-campaign.js", `--manifest=${path}`],
    { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 },
  );
  const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
  await writeFile(`${root}/${kind}.log`, output);
  assert.ifError(r.error);
  assert.equal(r.status, 1);
  const patterns = {
    "missing-consumer-archive": /SETUP: missing consumer-archive artifact/,
    "corrupt-consumer-inventory":
      /Independent consumer source differs src\/game\/browser.js/,
    "changed-browser-contract":
      /Changed independent browser contract expectedEnding/,
    "missing-source-archive": /SETUP: missing producer-archive artifact/,
    "corrupt-ending-picture": /Corrupt ending-png artifact/,
    "missing-runtime-archive": /SETUP: missing runtime-archive artifact/,
    "corrupt-runtime-inventory": /Corrupt runtime source:src\/game\/browser.js/,
    "changed-historical-ending":
      /Changed historical expectation expectedEnding/,
  };
  assert.match(output, patterns[kind]);
  assert.doesNotMatch(
    output,
    /independent browser replay pending|ETIMEDOUT|Zero replay cases/,
  );
}
for (const [role, spec] of Object.entries(m.artifacts))
  assert.equal(
    sha(await readFile(spec.path)),
    originals[role],
    `Original ${role} changed`,
  );
console.log(
  `Full campaign fixture controls:${kinds.length} broken contracts rejected;all original bytes preserved. Reports:${root}`,
);
