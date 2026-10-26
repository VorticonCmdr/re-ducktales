import { parseArchive } from "../assets.js";
import build from "../../reference/build.json";
export const REQUIRED_FILES = [
  "DUCKTALE.EXE",
  "MAIN.ARC",
  "MBIN.ARC",
  "LOC.ARC",
  "IT.DRV",
];
export async function verifiedResources(readFile) {
  const raw = new Map();
  for (const name of REQUIRED_FILES) {
    const bytes = new Uint8Array(await readFile(name));
    const expected = build.files[name];
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
    if (bytes.length !== expected.bytes || hash !== expected.sha256)
      throw Error(
        `Unsupported or corrupt ${name}: expected ${expected.sha256}, got ${hash}`,
      );
    raw.set(name, bytes);
  }
  const archives = new Map();
  for (const [name, bytes] of raw)
    if (name !== "DUCKTALE.EXE") archives.set(name, parseArchive(bytes, name));
  return { raw, archives };
}
