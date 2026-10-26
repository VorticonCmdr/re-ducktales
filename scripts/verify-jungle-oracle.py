"""Independent static map oracle; original source stays local.

Offsets/scanf behavior come from physical overlay8, not jungle-map.js.
Only counts, starts and memory hashes leave this process; no asset dumps.
"""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
build = json.loads((ROOT / 'reference/build.json').read_text())
for name in ['DUCKTALE.EXE', 'JG.ARC']:
    raw = (ROOT / 'game' / name).read_bytes()
    assert len(raw) == build['files'][name]['bytes'], f'{name}: byte length'
    assert hashlib.sha256(raw).hexdigest() == build['files'][name]['sha256'], \
        f'{name}: original hash'

# Reuse separately verified archive/EXEPACK decoders. The map scanner and
# memory packing below are independent of jungle-map.js.
decode = """
import { readFileSync } from 'node:fs';
import { parseArchive } from './src/assets.js';
import { unpackImage } from './src/game/executable.js';
console.log(JSON.stringify({
  imageHex: Buffer.from(unpackImage(readFileSync('game/DUCKTALE.EXE'))).toString('hex'),
  maps: parseArchive(readFileSync('game/JG.ARC')).slice(1, 4)
    .map(e => Buffer.from(e.data).toString('ascii')),
}));
"""
payload = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', decode], cwd=ROOT, text=True))
image = bytes.fromhex(payload['imageHex'])
# Base, stride, sparse destinations, and whether sscanf honors the label.
schema = {
    'L': (0x6a26, 14, list(range(0, 14, 2)), False),
    'A': (0x95ea, 8, [0, 2, 4, 6], False),
    'B': (0x6040, 50, [0, 2, 42, 44, 4, 6, 8, 10, 12, 14, 16], False),
    'P': (0x397e, 38, [32, 34, 36, 24, 26, 28, 30, 22], True),
    'S': (0x7034, 38, [0, 2, 32, 34], True),
    'V': (0x5d40, 34, [12, 14, 16, 24, 26, 28, 0, 2], True),
    'J': (0x5bb2, 2, [0], True),
    'M': (0x58cc, 62, [22, 24, 26, 28, 30, 0], True),
    'X': (0x776e, 10, [0, 2], True),
    'F': (0x514a, 32, [6, 4, 18], True),
}
cases = []
for variant in range(3):
    text = payload['maps'][variant].replace('\r\n', '\n')
    memory = bytearray(65536)
    memory[:len(image) - 0x120e0] = image[0x120e0:]
    struct.pack_into('<H', memory, 0x54f8, variant)
    counts, total = {}, 0
    for key, (base, stride, offsets, indexed) in schema.items():
        header = re.search(r'^' + key + r' (\d+)\r?$', text, re.M)
        count = int(header[1])
        counts[key] = count
        section = text[header.end():].split('\n\n')[0]
        rows = re.findall(r'^\s*(-?\d+(?:[ \t]+-?\d+)*)\s*$', section, re.M)
        assert len(rows) >= count, (key, count, len(rows))
        # Traverse exactly the declared count. L/A/B suppress printed labels.
        for position, line in enumerate(rows[:count]):
            row = list(map(int, line.split()))
            assert len(row) == len(offsets) + 1
            at = base + (row[0] if indexed else position) * stride
            for offset, value in zip(offsets, row[1:]):
                struct.pack_into('<h', memory, at + offset, value)
            if key == 'M':
                memory[at + 32:at + 34] = memory[at + 28:at + 30]
        total += count
    struct.pack_into('<H', memory, 0x3a42, counts['B'])
    struct.pack_into('<H', memory, 0x882c, counts['F'])
    start = next(
        {'column': x, 'row': y}
        for x in range(6) for y in range(3)
        if struct.unpack_from('<h', memory, 0x95ea + x * 8 + y * 2)[0])
    cases.append({
        'variant': variant, 'counts': counts, 'recordCount': total,
        'memorySha256': hashlib.sha256(memory).hexdigest(), 'start': start,
    })
manifest = json.loads((ROOT / 'reference/jungle-maps.json').read_text())
assert manifest['expectedCaseCount'] == len(cases) == 3, 'missing/zero cases'
assert manifest['cases'] == cases, 'independent static oracle divergence'
print('Independent jungle scanf-table oracle: all3 exact DS cases match.')
