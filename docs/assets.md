# Original asset types

These findings come from the local DOS edition's bytes and decoded outputs.
Indices are zero-based. Resource names are synthesized from archive + index;
the archive does not contain filenames. Do not assume other releases are identical.

## Inventory

| File | Resources | Contents |
| --- | ---: | --- |
| CAVEMAPS.ARC | 8 | ASCII cave tile grids |
| CHART.ARC | 5 | ASCII stock chart values |
| CLUES.ARC | 16 | Hint text |
| EXP.ARC | 47 | Exploration backgrounds and sprite strips |
| INVART.ARC | 5 | Investment artwork |
| INVEST.ARC | 15 | Company text and numeric fields |
| IT.DRV | 7 | Four graphics drivers and three sound drivers; executable DOS code and embedded data |
| JG.ARC | 20 | Jungle sprites and ASCII level tables |
| LOC.ARC | 35 | Location coordinates, IDs, names and descriptions |
| LOOT.ARC | 37 | Treasure values, names and descriptions |
| MAC.ARC | 15 | Sprites / artwork |
| MAIN.ARC | 43 | Main screens, sprites, font; #002 is the title screen, #042 the font |
| MBIN.ARC | 11 | Money-bin background and sprites |
| MT.ARC | 16 | Mountain background and sprites |
| PLANE.ARC | 68 | Plane backgrounds, tiles and sprite strips |
| PS.ARC | 52 | Background and sprites |

Total: **400 archive resources**, including **48 pictures**, **225 sprite
strips**, **119 text/data records**, **1 font**, and **7 drivers**. Graphics contain
**726 individual frames**. The 121 sound IDs are separately indexed views into
one decoded driver, not additional archive records.

Six other files are available in the viewer: `DUCKTALE.EXE` as raw hex;
`README1.DOC`, `README2.DOC`, `README3.DOC`, `README.BAT`, and the `.ba1` batch file
as text. `.DOC` here is plain DOS text, not Microsoft Word. The EXE is DOS MZ
machine code; it is not executed by the viewer. The 22 source files produce 527
viewer entries when derived sound IDs are included.

## ARC container (also used by IT.DRV)

This is a custom resource container, not a generic ZIP or SEA ARC file.
All integers are little-endian.

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | uint16 | Resource count N |
| 2 | uint32[N] | Absolute file offsets of each resource |

The first resource starts at `2 + 4*N`. Each resource has a 16-byte header:

| Relative offset | Type | Meaning |
| --- | --- | --- |
| +0 | uint32 | Compressed payload byte count (excludes header) |
| +4 | uint16 | Type: 1 picture, 2 sprite strip, 4 arbitrary data |
| +6 | uint16 | Width in pixels for types 1/2; decoded size for type 4 |
| +8 | uint16 | Height for types 1/2; 0xffff for observed type-4 entries |
| +10 | uint16 | Frame count for type 2; flag/unknown for other types |
| +12 | uint16 | Flag/unknown |
| +14 | uint16 | Flag/unknown |
| +16 | bytes | LZW-compressed payload |

Observed unknown words frequently contain 0 or 0xffff. The viewer exposes them
without asserting their meaning. Entry boundaries exactly match the next offset
(or EOF); the parser rejects overlapping/out-of-file entries and size mismatch.

## LZW compression

Codes are packed least-significant-bit first. Start with 9-bit codes, literal
bytes 0–255, clear code 256, end code 257, and first dictionary index 258. Clear
resets code width and the dictionary. Each decoded code after the first inserts
`previous sequence + first byte of current sequence`. The special next-index
code expands to `previous + first byte of previous`. Increase code width when
the dictionary length reaches `2^width`, up to 12 bits. Stop inserting at 4096
entries until a clear code occurs. All 400 resources decode with this algorithm
and match their header-derived decoded lengths.

## Pictures and sprite strips

Pixels use packed 4-bit color indices, **high nibble first**, with the standard
16-color RGBI/EGA palette in the viewer. Type 1 is a single row-major image.
Type 2 is a horizontal strip of frames: **each scanline contains the same row
from every frame**, rather than all rows of one frame followed by the next.

For frame `f`, pixel `(x,y)`, frame width `w`, count `n`:

```text
byteOffset = y * (w*n/2) + f*(w/2) + floor(x/2)
color = x is even ? byte >> 4 : byte & 15
```

Decoded sizes are `w*h/2` for pictures and `w*h*n/2` for sprite strips. Every
observed width is even. Browser Canvas receives RGBA data, and CSS uses nearest
neighbor scaling. Zoom fits the available panel width on small displays.

Sprite background indices differ between assets. The viewer defaults to opaque
pixels; choosing a transparent palette index is an inspection option. It is not
a claim about the game's masking rules. Likewise 10 fps is a preview default,
not recovered game timing. Original monitor aspect correction and graphics-driver
palette/dithering variants are not reproduced.

## Font

`MAIN.ARC #042` is type 4, 2056 decoded bytes. Header: `AA 55 08 00 08 00 08 00`.
The following 2048 bytes contain 256 glyphs, 8 bytes per 8×8 glyph, one byte per
row, MSB at the left. The viewer displays a 16×16 glyph atlas. Header fields
beyond the observed 8×8 dimensions have not been fully interpreted.

## Text and structured data

Type 4 is generic, not synonymous with text. Text is recognized from printable
ASCII plus TAB, CR, LF and DOS EOF (`0x1a`). DOS EOF is hidden only in the visual
preview. Decoded export preserves the original bytes. Cave maps, stock values,
location metadata and jungle tables are shown verbatim; a gameplay schema for
all their columns is still to be established.

## Campaign location use

The runtime now consumes all 35 `LOC.ARC` text records through the same verified
archive decoder as the viewer. Coordinates are screen positions; flags and treasure
IDs are retained separately. Campaign order is a permutation of resource IDs, not
the archive order. See [campaign travel](campaign-travel.md) for static sources,
RNG scope, map colors, travel costs, and the local original capture recipe.

The game runtime now reads Launchpad speech from a read-only EXEPACK image of
`DUCKTALE.EXE`, alongside MAIN.ARC portrait30. No executable code runs in the
browser. Image identity, string locations, and original pixel evidence are in
[expedition departures](expedition-departures.md).


JG.ARC entries1–3 are now consumed by the jungle map loader. Their ten ASCII
sections initialize sparse16-bit DS records with original scanf addressing.
Some printed row labels are suppressed, and declared counts can leave trailing
source rows unused. See [jungle map contract](jungle.md) and
`reference/jungle-maps.json`; this is static asset evidence, not playable-jungle
or original runtime parity.

Stock resource field layouts and first30-of31 chart loading are documented in
[investments.md](investments.md). Original resources remain authoritative.
