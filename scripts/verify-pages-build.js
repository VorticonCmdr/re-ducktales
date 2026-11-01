// Publish only the Vite application, never originals, captures or source dumps.
import assert from "node:assert/strict";
import { lstat, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const pages = ["index.html", "viewer.html"];
const entries = await readdir(root);
assert.deepEqual([...entries].sort(), ["assets", ...pages].sort(),
  "Pages output must contain only index.html, viewer.html and assets/");
for (const page of pages) {
  assert.ok((await lstat(join(root, page))).isFile(), `Missing page ${page}`);
  const html = await readFile(join(root, page), "utf8");
  assert.ok(html.includes('type="module"'), `Unbuilt page ${page}`);
  assert.ok(html.includes('"./assets/'), `Missing relative assets in ${page}`);
  assert.ok(!/(?:src|href)=["']\/(?!\/)/.test(html),
    `Root-relative URL would break the repository path in ${page}`);
}
const assets = join(root, "assets");
assert.ok((await lstat(assets)).isDirectory(), "Missing built assets directory");
const files = await readdir(assets);
assert.ok(files.length > 0, "No compiled assets");
for (const name of files) {
  assert.ok(/^[\w-]+\.(?:js|css)$/.test(name), `Unexpected published asset ${name}`);
  assert.ok((await lstat(join(assets, name))).isFile(),
    `Published asset must be a regular file: ${name}`);
}
console.log(`Pages output verified: ${pages.length} pages, ${files.length} compiled assets; no original files or captures.`);
