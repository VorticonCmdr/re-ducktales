"""Exact bounded source proof for native Safari setup's flight FPU sites."""
import copy
import hashlib
import json
from pathlib import Path
import struct
from capture_safari_cadence import relocated_overlay

EXTRA = [0x2c7e, 0x2c82, 0x2c86, 0x2c8b, 0x2ca6, 0x2cab, 0x2caf, 0x2cb4]


def check_function(original, expected, observed, listing, sites):
    assert sites == EXTRA, 'Changed source FPU instruction sites'
    assert observed == expected, 'Original/prepared/Ghidra flight function mismatch'
    assert listing['program'] == 'FLIGHT_TRANSLATION.EXE'
    assert listing['count'] == len(listing['instructions']) == 143, 'Missing source instruction'
    instructions = {int(i['address'].split(':')[1], 16)+0x2ba0: i['instruction']
                    for i in listing['instructions']}
    assert len(instructions) == 143
    for pos in sites:
        assert original[pos] == 0xcd and 0x34 <= original[pos+1] <= 0x3b
        assert instructions[pos] == 'NOP'
        assert instructions[pos+1].split()[0] in ['FLD', 'FDIV', 'FMUL', 'FADD', 'FILD']


def verify_source(root):
    root = Path(root)
    manifest = json.loads((root/'reference/safari-flight-fpu-sites.json').read_text())
    assert manifest['kind'] == 'safari-flight-fpu-source-sites'
    assert manifest['expectedExtraSites'] == 8 and manifest['sourceBytes'] == 344
    specs = {**manifest['artifacts'], 'base': manifest['baseManifest']}
    objects = {}
    for key, spec in specs.items():
        path = root/spec['path']
        assert path.is_file(), 'SETUP: missing Safari FPU source artifact '+str(path)
        data = path.read_bytes()
        assert len(data) == spec['bytes'] and hashlib.sha256(data).hexdigest() == spec['sha256'], 'Corrupt Safari FPU source artifact'
        objects[key] = json.loads(data)
    assert manifest['baseManifest']['path'] == 'reference/flight-input.json'
    exe = (root/'game/DUCKTALE.EXE').read_bytes()
    build = json.loads((root/'reference/build.json').read_text())
    assert hashlib.sha256(exe).hexdigest() == build['files']['DUCKTALE.EXE']['sha256']
    body = relocated_overlay(exe, 0x12c00, 0x1000, 4, 17548, 248)
    original = exe[0x13000:0x13000+17548]
    meta = objects['analysisPreparation']
    assert hashlib.sha256(original).hexdigest() == meta['originalBodySha256']
    lo, hi = 0x2ba0, 0x2cf8
    for pos, before, after in meta['patches']:
        if lo <= pos < hi:
            assert original[pos:pos+2].hex() == before
            body[pos:pos+2] = bytes.fromhex(after)
    for absolute, before, after in meta['stackProbes']:
        pos = absolute-0xc170
        if lo <= pos < hi:
            assert original[pos:pos+5].hex() == before
            body[pos:pos+5] = bytes.fromhex(after)
    def unwrap(key):
        assert objects[key]['isError'] is False
        return json.loads(objects[key]['content'][0]['text'])
    observed = unwrap('bytes')
    assert observed['program'] == 'FLIGHT_TRANSLATION.EXE' and observed['address'] == '1ed1:0000'
    assert observed['length'] == len(observed['data']) == 344
    listing = unwrap('instructions')
    sites = [int(p, 16) for p in manifest['extraSites']]
    check_function(original, body[lo:hi], bytes(observed['data']), listing, sites)
    negatives = 0
    for mutation in ['byte', 'missing-instruction', 'site']:
        data = bytearray(observed['data'])
        wrong_listing, wrong_sites = copy.deepcopy(listing), sites[:]
        if mutation == 'byte':
            data[17] ^= 1
        elif mutation == 'missing-instruction':
            wrong_listing['instructions'].pop()
        else:
            wrong_sites[0] += 1
        try:
            check_function(original, body[lo:hi], bytes(data), wrong_listing, wrong_sites)
        except AssertionError:
            negatives += 1
        else:
            raise AssertionError('Accepted altered FPU source '+mutation)
    assert negatives == 3
    base = objects['base']['runtimeFpuPatchedOffsets']
    assert len(base) == len(set(base)) == 91
    assert not (set(int(p, 16) for p in base) & set(sites))
    return base + manifest['extraSites']


if __name__ == '__main__':
    sites = verify_source(Path(__file__).resolve().parents[1])
    assert len(sites) == 99
    print('Safari flight anchor:344 original/prepared/Ghidra bytes,143 instruction boundaries,8 additional exact FPU sites,3 negatives;99 eligible runtime sites,not a byte mask.')
