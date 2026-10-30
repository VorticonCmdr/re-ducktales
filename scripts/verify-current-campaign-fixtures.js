// Deliberately broken contracts refer to owned copies. No authoritative fixture
// is renamed, overwritten, or restored as part of a negative control.
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/current-physical-campaign.json";
const m = JSON.parse(await readFile(manifestPath));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const originals = {};
for (const [role, spec] of Object.entries(m.artifacts))
  originals[role] = sha(await readFile(spec.path));
await mkdir(".local/current-campaign-verification", { recursive: true });
const root = await mkdtemp(
  ".local/current-campaign-verification/fixture-negatives-",
);
for (const kind of ["missing-source-archive", "corrupt-ending-picture"]) {
  const contract = structuredClone(m);
  if (kind === "missing-source-archive")
    contract.artifacts["producer-archive"].path = `${root}/missing.zip`;
  else {
    const bytes = Buffer.from(await readFile(m.artifacts["ending-png"].path));
    bytes[bytes.length - 1] ^= 1;
    contract.artifacts["ending-png"].path = `${root}/corrupt.png`;
    await writeFile(contract.artifacts["ending-png"].path, bytes);
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
  assert.match(
    output,
    kind === "missing-source-archive"
      ? /SETUP: missing producer-archive artifact/
      : /Corrupt ending-png artifact/,
  );
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
  `Full campaign fixture controls:missing producer archive and corrupt ending image rejected;all original bytes preserved. Reports:${root}`,
);
