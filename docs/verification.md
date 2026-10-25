# Verification and next steps

## Completed checks

- All 16 ARC/DRV containers: directory bounds, exact compressed payload lengths,
  successful LZW termination and decoded size checks (400 resources).
- All 726 graphics frames passed through RGBA conversion.
- All 121 PC-speaker IDs rendered through bounded sequence interpretation.
- Synthetic unit tests cover dictionary references/reset/special LZW codes,
  malformed input, archive bounds, horizontal sprite-strip extraction,
  transparency, font bit order, WAV structure and runaway sound loops.
- Browser checks: original title screen, money-bin Scrooge sprite, advancing
  animation/frame control, text search, sound waveform and native audio playback.
- Production build succeeds and contains only HTML, JS and CSS. `game/` is
  excluded from both Git and build artifacts.

Run `npm test`, `npm run audit:assets`, and `npm run build` to repeat the checks.
The asset audit requires the originals; automated unit tests do not.

## Remaining port work

1. Map resource IDs to gameplay roles and names by tracing DOS executable usage.
2. Establish per-scene palette, transparency, compositing and animation timing.
3. Document numeric level-data schemas and input/state transitions.
4. Reproduce alternate sound-driver output and exact PC-speaker noise behavior.
5. Build the actual game loop, scenes and gameplay around the reusable decoders.
6. Configure GitHub Pages deployment when a destination repository is chosen.

The viewer is not the game port, and successful decompression does not establish
full gameplay semantics. Driver and EXE entries are inspected as bytes rather
than executed. Browser playback verifies a usable player, not original-hardware
fidelity.
