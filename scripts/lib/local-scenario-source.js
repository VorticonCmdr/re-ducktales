// Source provenance for local, proprietary-fixture browser scenarios.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function json(p) {
  return JSON.parse(
    await readFile(p).catch(() => {
      throw Error("SETUP: missing scenario fixture " + p);
    }),
  );
}
export async function spec(p) {
  const b = await readFile(p);
  return { path: p, bytes: b.length, sha256: sha(b) };
}
export async function fresh(p) {
  assert.ok(
    p && resolve(p).startsWith(resolve(".local") + "/"),
    "Use a fresh ignored local output",
  );
  await mkdir(p, { recursive: false });
  return p;
}
export async function archiveSource(root) {
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "SETUP: commit clean scenario source",
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    archive = execFileSync("git", ["archive", "--format=zip", commit], {
      maxBuffer: 32 * 1024 * 1024,
    });
  await writeFile(root + "/sources.zip", archive);
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean),
    files = Object.fromEntries(
      await Promise.all(paths.map(async (p) => [p, sha(await readFile(p))])),
    ),
    source = { commit, archiveSha256: sha(archive), files };
  await writeFile(
    root + "/source-revision.json",
    JSON.stringify(source, null, 2) + "\n",
  );
  return source;
}
export async function checkSource(root, loaded) {
  const source = await json(root + "/source-revision.json"),
    archive = await readFile(root + "/sources.zip");
  assert.equal(sha(archive), source.archiveSha256, "Corrupt scenario archive");
  assert.equal(
    sha(
      execFileSync("git", ["archive", "--format=zip", source.commit], {
        maxBuffer: 32 * 1024 * 1024,
      }),
    ),
    source.archiveSha256,
    "Changed source archive",
  );
  const inv = JSON.parse(
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
  assert.deepEqual(inv, source.files, "Incomplete source archive");
  for (const [p, h] of Object.entries(source.files))
    if (loaded(p))
      assert.equal(sha(await readFile(p)), h, "Changed loaded source " + p);
  const actual = (
    await readdir("src", { recursive: true, withFileTypes: true })
  )
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    actual,
    Object.keys(source.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
    "Unexpected runtime source",
  );
  return source;
}
export async function inventory(root, names) {
  return Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await spec(root + "/" + n)])),
  );
}
export async function checkArtifacts(artifacts) {
  assert.ok(Object.keys(artifacts).length);
  for (const a of Object.values(artifacts)) {
    const actual = await spec(a.path);
    assert.deepEqual(actual, a, "Corrupt scenario fixture " + a.path);
  }
}
