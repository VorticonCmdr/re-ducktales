# DuckTales: The Quest for Gold — browser port

HTML, CSS, vanilla JavaScript and Vite, with original DOS assets loaded locally.

The current playable milestone is **title → difficulty → office → money-bin
dive → office**, including the timing-based rare coin and $1000 reward. The full
campaign and expedition levels remain unimplemented. See [current status](docs/STATUS.md)
for supported behavior, evidence and limitations.

## Run

Requires Node.js 22.12+ (or 20.19+) and npm.

```sh
npm install
npm run dev
```

Open the displayed URL. Development loads originals from `game/` automatically.
On a static production build, select your original game folder. The exact
supported build is pinned in `reference/build.json`; corrupt or different files
stop loading with a diagnostic.

Space / Enter starts and fires, arrows choose difficulty, and **Up + Space**
enters the money bin from the office. Buttons provide equivalent accessible
inputs. Time the dive while Scrooge moves on the board. Restart begins again.
Sound is optional and labeled reconstructed because PC-speaker effects retain
known approximation limits.

The [asset explorer](viewer.html) remains available at `/viewer.html` with image,
font, sprite, text, driver and PC-speaker sequence inspection/export.

## Verification

```sh
npx playwright install chromium
npm run verify
```

This checks all 22 original file identities, deterministic unit tests, 30 original
segment checkpoints and negative controls, actual browser controls/rendering/audio,
exact office and aligned failed-pose pixels, folder loading, corrupted-file rejection, and a production build.
Original captures are local-only and required by strict checks; missing captures
fail with setup errors. Reproduction: [original scenario](docs/original-scenario.md).

Focused commands:

```sh
npm test
npm run verify:build
npm run verify:reference
npm run test:browser
npm run audit:assets
npm run prepare:analysis
npm run build
npm run preview
```

## Source organization

- `src/game/`: independent game state, integer/RNG helpers, scheduler, renderer,
  validated asset loading, and browser input/audio adapters.
- `src/assets.js`, `src/audio.js`: shared original resource decoders.
- `reference/`: permitted hashes, scenario contracts and evidence manifests.
- `docs/`: [current status](docs/STATUS.md), [executable analysis](docs/executable.md),
  [asset formats](docs/assets.md), [audio](docs/audio.md), capture recipe.

`game/`, `.local/`, Ghidra databases, dependencies and builds are excluded from
Git. Original files are never overwritten or bundled in the build. Keep asset
exports and diagnostic dumps in `.local/` or outside the repository.

`dist/` uses relative URLs for eventual GitHub Pages hosting. No remote, push,
publication or deployment is configured by this milestone.
