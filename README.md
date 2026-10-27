# DuckTales: The Quest for Gold — browser port

HTML, CSS, vanilla JavaScript and Vite, with original DOS assets loaded locally.

Playable routes include the money-bin coin,world-map travel and banking,flights,
cave/mountain/jungle expeditions,photography,stock trading with daily news,Glomgold campaign travel,atomic transport,and endings/replay.
The browser uses the original assets and shared RNG; completed routes include
rewards,campaign return,retries and duplicate-collection protection.
**The full game is incomplete:** save/load and
high scores remain unfinished,and original timing/presentation parity is partial. See
[current status](docs/STATUS.md) for exact evidence,limitations and verification.

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

This checks all 22 original file identities, deterministic unit tests, original
money-bin/campaign/departure/flight checkpoints and required negative controls,
actual browser flight controls, rendering and the existing audio adapter,
exact office/map/departure and aligned failed-pose pixels, folder loading, corrupted-file
rejection, cash banking, random treasure assignment, cave entry/movement and a
production build.
Original captures are local-only and required by strict checks; missing captures
fail with setup errors. Reproduction: [original scenario](docs/original-scenario.md).

Focused commands:

```sh
npm test
npm run verify:build
npm run verify:reference
npm run verify:campaign
npm run verify:departure
npm run verify:loot
npm run verify:cave
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

Campaign travel: Right+Space in the office opens the map. Select Macaroon to bank
cash, then select the office to return. See [campaign evidence and limits](docs/campaign-travel.md).

[Expedition departure evidence](docs/expedition-departures.md) records the flight
handoff and conditional RNG comparisons. [Flight evidence](docs/flight.md) covers
controls, outcomes, crash comparisons, and the remaining expedition boundary.
