# Report presentation restoration: source evidence

Status: statically established sequencing;runtime restoration pending. The
existing report controllers translate input and audio status,but omit the
original striped graphics transitions. This document does not claim those
transitions are implemented or browser accepted.

Supported executable/assets are exactly `reference/build.json`. The prepared
`INVESTMENT_CODE.EXE` SHA is
`4d1ceb7227d4f0d77abca186f931edc16b3773b47f0cef9720536de8755ef611`.
Ghidra program `INVESTMENT_CODE.EXE`,x86 little-endian16 real mode,was explicitly
selected for each read. Its actual resident code is mapped at load base1000.
The shared live DOSBox session was not used or changed.

`node scripts/verify-report-presentation-source.js` checks1238 bytes across
original unpacked image,prepared executable and retained Ghidra bytes,with16
declared loader relocations. The original compiler's stack probe at image26be
is `9a9e1e0e04`;the existing preparation recipe replaces it with `81ec120090`
(SUB SP,18;NOP). The verifier checks that exact transformation explicitly.
Prepared analysis images are never executed. Original bytes are authoritative.

The source ranges and implications are:

| Source | Statically inferred sequencing |
| --- | --- |
| resident0326..03d9 | Collected-by-rival notice invokes picture helper10(MAIN33),writes text,requests enabled6e,then calls reveal1fdc and flush19a5 before querying global audio/input. |
| resident0e82..0f7e | Collected-by-player notice invokes helper3(MAIN30),writes seven rows,reveals through1fdc,then shared09f5(80);enabled click24 only for a shortened wait;exit wipe1fe0 precedes root return. |
| rival126b:0008..032c | Ordinary/forced rival report commits ownership/reward before helper10,consumes variant RNG after that helper,writes text,requests enabled6e before reveal0289,flushes028d,then polls audio/input. Exit wipe02d5 precedes enabled21;location is published at0322 afterward. |
| shared11c4:0008 | Existing picture-dispatch proof establishes fill0,initial striped wipe,portrait copy and helper input flush. Each1fe0/1fdc is5 row groups×5 retraces. |

The helper and EGA row rules are inherited from the independently checked
award-presentation source proof. Graphics calls must remain between the original
sound calls and their later status/input reads. Starting all waits immediately
on report creation,or postponing sound6e until after reveal,would change that
ordering. A user S/P/Q make during graphics must be considered against the
original flush/reader boundaries,not delivered to a reader invented for a wipe.

Next implementation must preserve the outgoing committed frame,portrait copy,
reveal and exit wipe independently of browser wall time. Ordinary reports,forced
claims and player/rival collected notices need their own real startup browser
routes and independent replay inputs. Audio completion during reveal and modal
return remain explicit environment cases. The1238-byte check establishes code
identity and order;it does not establish uninterrupted native CPU/PIT duration,
waveform parity or successful arbitrary campaigns.

Local proprietary Ghidra bytes remain ignored in
`.local/report-presentation-source-01/ghidra.json`;the versioned manifest contains
only hashes,addresses,declared normalization and the verification recipe.
Missing or corrupt evidence fails setup.
