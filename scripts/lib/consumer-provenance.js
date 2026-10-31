// Producer fixtures stay immutable when implementation source evolves. The
// consumer records its own clean archive; comparisons, not source equality to
// the producer, decide whether behavior still matches.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { json, sha } from "./local-scenario-source.js";
export async function validateProducerArchive(root) {
  const source = await json(root + "/source-revision.json"),
    archive = await readFile(root + "/sources.zip");
  assert.equal(sha(archive), source.archiveSha256, "Corrupt producer archive");
  assert.equal(
    sha(
      execFileSync("git", ["archive", "--format=zip", source.commit], {
        maxBuffer: 32 * 1024 * 1024,
      }),
    ),
    source.archiveSha256,
    "Producer archive differs from recorded Git revision",
  );
  const files = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import json,zipfile,hashlib,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}))",
        root + "/sources.zip",
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    ),
  );
  assert.deepEqual(files, source.files, "Incomplete producer inventory");
  assert.equal(
    source.files["reference/build.json"],
    sha(await readFile("reference/build.json")),
    "Different original build pairing",
  );
  return source;
}
export async function validateHistoricalManifest(path) {
  const bytes = await readFile(path),
    m = JSON.parse(bytes),
    protectedFiles = { [path]: sha(bytes) };
  assert.ok(Object.keys(m.artifacts).length > 0);
  for (const a of Object.values(m.artifacts)) {
    const b = await readFile(a.path).catch(() => {
      throw Error("SETUP: missing historical fixture " + a.path);
    });
    assert.equal(sha(b), a.sha256, "Corrupt historical fixture " + a.path);
    if (a.bytes !== undefined) assert.equal(b.length, a.bytes);
    protectedFiles[a.path] = a.sha256;
  }
  return { manifest: m, protectedFiles };
}
export async function verifyProtected(files) {
  assert.ok(Object.keys(files).length > 0);
  for (const [p, h] of Object.entries(files))
    assert.equal(sha(await readFile(p)), h, "Historical evidence changed " + p);
}
