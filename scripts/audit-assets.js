import { readdir, readFile } from 'node:fs/promises';
import { parseArchive, imagePixels, fontPixels } from '../src/assets.js';
import { renderSound, SOUND_COUNT } from '../src/audio.js';
let resources = 0, frames = 0, driver;
const counts = {};
for (const name of (await readdir('game')).filter(n => /\.(arc|drv)$/i.test(n)).sort()) {
  const entries = parseArchive(await readFile(`game/${name}`), name);
  for (const entry of entries) {
    counts[entry.kind] = (counts[entry.kind] || 0) + 1;
    if (entry.type < 4) for (let frame = 0; frame < entry.frames; frame++) { imagePixels(entry, frame); frames++; }
    if (entry.kind === 'Font') fontPixels(entry.data);
  }
  if (name === 'IT.DRV') driver = entries[5].data;
  resources += entries.length;
  console.log(`${name}: ${entries.length} resources decoded`);
}
let bounded = 0, approximate = 0, silent = 0;
for (let id = 0; id < SOUND_COUNT; id++) {
  const sound = renderSound(driver, id);
  if (sound.truncated) bounded++;
  if (sound.approximate) approximate++;
  if (sound.pcm.every(n => n === 0)) silent++;
}
console.log(JSON.stringify({ resources, frames, counts, soundIds: SOUND_COUNT, bounded, approximate, silent }, null, 2));
