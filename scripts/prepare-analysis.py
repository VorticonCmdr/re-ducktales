"""Reproduce local EXEPACK analysis copies. Never modify originals."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'game/DUCKTALE.EXE'
EXPECTED = 'fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981'


def prepare():
    original = SOURCE.read_bytes()
    if hashlib.sha256(original).hexdigest() != EXPECTED:
        raise ValueError('Unsupported DUCKTALE.EXE build: SHA-256 mismatch')
    h = struct.unpack_from('<14H', original)
    image_start = h[4] * 16
    pack = image_start + h[11] * 16
    info = struct.unpack_from('<8H', original, pack)
    if info[7] != 0x4252 or h[10] != 16:
        raise ValueError('EXEPACK signature or entry differs')
    src = pack - 1
    while original[src] == 255:
        src -= 1
    image = bytearray(info[6] * 16)
    dst = len(image) - 1
    while True:
        op = original[src]
        count = struct.unpack_from('<H', original, src - 2)[0]
        src -= 3
        if count > dst + 1:
            raise ValueError('EXEPACK output underflow')
        if op & 254 == 176:
            image[dst - count + 1:dst + 1] = bytes([original[src]]) * count
            src -= 1
        elif op & 254 == 178:
            image[dst - count + 1:dst + 1] = original[src - count + 1:src + 1]
            src -= count
        else:
            raise ValueError(f'Unsupported EXEPACK opcode {op:02x}')
        dst -= count
        if op & 1:
            break
    if src - image_start != dst:
        raise ValueError('EXEPACK unchanged prefix does not align')
    image[:dst + 1] = original[image_start:src + 1]
    relocations = []
    cursor = pack + 0x125  # verified loader instruction at pack+0x96
    for region in range(16):
        count = struct.unpack_from('<H', original, cursor)[0]
        cursor += 2
        for _ in range(count):
            offset = struct.unpack_from('<H', original, cursor)[0]
            cursor += 2
            relocations.append((offset, region * 4096))
    declared = (h[2] - 1) * 512 + (h[1] or 512)
    if cursor != declared:
        raise ValueError('Packed relocation table does not end at MZ declared EOF')
    header = bytearray(((32 + len(relocations) * 4 + 511) // 512) * 512)
    size = len(header) + len(image)
    struct.pack_into('<14H', header, 0, 0x5a4d, size % 512, (size + 511) // 512,
                     len(relocations), len(header) // 16, 0, 65535,
                     info[5], info[4], 0, info[0], info[1], 32, 0)
    for i, values in enumerate(relocations):
        struct.pack_into('<HH', header, 32 + i * 4, *values)
    output = ROOT / '.local/analysis'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'DUCK_UNPACKED.EXE').write_bytes(header + image)
    overlays = []
    offset = (declared + 511) // 512 * 512
    while offset < len(original):
        oh = struct.unpack_from('<14H', original, offset)
        if oh[0] != 0x5a4d:
            raise ValueError(f'Missing overlay MZ header at {offset:x}')
        length = (oh[2] - 1) * 512 + (oh[1] or 512)
        payload = original[offset:offset + length]
        if len(payload) != length:
            raise ValueError('Truncated overlay')
        name = f'OVERLAY_{oh[13]:02d}.EXE'
        (output / name).write_bytes(payload)
        overlays.append(dict(index=oh[13], offset=offset, length=length,
                             headerBytes=oh[4] * 16,
                             sha256=hashlib.sha256(payload).hexdigest()))
        offset = (offset + length + 511) // 512 * 512
    analysis_overlay = bytearray((output / 'OVERLAY_09.EXE').read_bytes())
    struct.pack_into('<HH', analysis_overlay, 20, 0, 0)
    struct.pack_into('<H', analysis_overlay, 26, 0)
    (output / 'MBIN_ANALYSIS.EXE').write_bytes(analysis_overlay)
    office_map = bytearray((output / 'OVERLAY_02.EXE').read_bytes())
    struct.pack_into('<HH', office_map, 20, 0xcaa, 0)
    struct.pack_into('<H', office_map, 26, 0)
    (output / 'OFFICE_MAP.EXE').write_bytes(office_map)
    report = dict(executableSha256=EXPECTED, packedHeaderOffset=pack,
                  imageBytes=len(image), relocations=len(relocations),
                  originalEntry=dict(cs=info[1], ip=info[0]), overlays=overlays)
    (output / 'layout.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare()
