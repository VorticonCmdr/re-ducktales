# Original HUD number formatter

The supported original resident formatter is11c4:0227..02a6. It calls stack
allocation140e:1e9e..1eb0, signed remainder4968..4a09, assignment division4a22..4a45
and signed division4898..4933, always with divisor10. Its digit loop is a signed
32-bit operation; it continues while the quotient is strictly positive. Thus
negative values produce one remainder glyph without a minus sign (`-1` becomes
`/`, `INT32_MIN` becomes `(`). Unsigned money at or above2^31 enters that same
negative path. Right alignment still subtracts8 pixels per produced glyph with
16-bit wrap. No replacement signed-number formatting is introduced.

`scripts/lib/hud-number-work.js` translates these targeted paths and delegates
transparent driver work to the already verified EGA text model. Unsupported stack
exhaustion fails explicitly. It does not emulate arbitrary x86 or interpret a
P-code export. No DOM, clock, host randomness or expected-state injection is used.

## Verification

```sh
node scripts/verify-hud-number.js
```

The [manifest](../reference/hud-number-work.json) requires26 local artifacts and16
independently authored values spanning decimal transitions, the high-word loop
branch, zero, both signed limits and the two original HUD numbers. The carried
native comparison checks12,197 instruction addresses,800 exact port/value writes,
actual generated text/driver arguments and every45,056 relocated code/driver byte.
Six negative controls reject altered code, instruction path, port word, input,
missing case and the wrong signed-value output. Stack exhaustion is explicitly
unsupported. Missing/corrupt local evidence and zero/unfinished cases fail.

Static helper instructions come from explicitly selected Ghidra program
`DUCK_UNPACKED.EXE`,x86 LE16 real mode. Every byte is checked against the supported
original EXEPACK image, applying its own relocation stream at bias1000. The native
recipe executes original bytes at a separately allocated live code segment; the
same relocation stream establishes exact static-to-live correspondence. The
analysis executable is never launched. The original EGA resource1 and MAIN42 font
hashes are pinned too.

Repeat in a fresh ignored directory with the existing DOSBox MCP installation:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp \
/path/to/dosbox-mcp/.venv/bin/python scripts/capture-hud-number.py \
  --output=.local/new-hud-number --port=8398
```

The recipe checks an unused private port and refuses shared8386. It creates and
owns one emulator, pauses real mode and allocates three private64KB blocks for
original code/driver, data/stack/RAM surface, and a bootstrap trampoline. Code is
copied once and rebased by the supported relocation stream. The caller sets DS=SS,
a healthy original stack threshold and IF/DF clear. Calls carry their state; no
machine checkpoint or partial restore is used. Each original formatter call is
single-stepped through its helpers and the actual driver. At driver entry the
original string and arguments are read, never supplied from expected output.
The complete code region must remain unchanged. `finally` stops the owned emulator;
the shared session is untouched. Failed attempts preserve a diagnostic record.

This is conditional native work/formatting evidence with a RAM surface. It is not
screen pixel, natural IRQ/scanout cadence, original whole-campaign, or browser
acceptance. The runtime still needs to consume this count and use the original
formatting rules. Opaque text remains a separate uncounted path.
