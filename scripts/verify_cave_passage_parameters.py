"""Bounded constant-argument paths,not a general instruction interpreter."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import copy
import json
from capture_safari_cadence import relocated_overlay
from verify_cave_load_boundaries import ROOT, artifact, listing


def arguments(code, start):
    stack, ax, at = [], None, start
    for _ in range(24):
        raw = code[at]
        after = at+len(raw)
        if raw[0] == 0xb8: ax = int.from_bytes(raw[1:],'little')
        elif raw == b'\x2b\xc0': ax = 0
        elif raw == b'\x50':
            assert ax is not None
            stack.append(ax)
        elif raw == bytes.fromhex('ff76ec'): stack.append('cell')
        elif raw == b'\x0e': stack.append('cs')
        elif raw[0] in [0xeb,0xe9]: after += int.from_bytes(raw[1:],'little',signed=True)
        elif raw[0] == 0xe8:
            assert after+int.from_bytes(raw[1:],'little',signed=True) == 0x2496
            assert stack[-1] == 'cs' and len(stack) == 6
            return stack[:-1]
        else: raise AssertionError('Unsupported bounded argument opcode')
        at = after
    raise AssertionError('Unfinished argument path')


def verify():
    m=json.loads((ROOT/'reference/cave-passage-parameters.json').read_text())
    assert m['kind']=='original-cave-passage-parameters' and m['expectedCases']==len(m['cases'])==8
    assert not m['nativeTimingAcceptance']
    artifact(m['nativeParent'])
    body=relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(),0x1a800,0x1000,6,11054,196)
    code={}; total=0
    for s in m['source'].values():
        block=listing(artifact(s['artifact']),body,0x1c170,s['start'],s['end'])
        assert not code.keys() & block.keys()
        code.update(block);total+=s['end']-s['start']
    assert len(code)==m['expectedInstructions']==132 and total==m['expectedBytes']==333
    for c in m['cases']:
        at=c['load']
        assert code[at].hex()=='b8fc54' and code[at+4]==b'\xb8'+c['asset'].to_bytes(2,'little')
        assert code[at+8].hex()=='9a5c170e14'
        assert arguments(code,c['parameters'])==['cell',c['kind'],c['table'],c['count'],c['pose']], 'Passage arguments differ'
    changed=copy.deepcopy(code);changed[0x106f]=b'\xb8\x03\x00'
    assert arguments(changed,0x1060)!=arguments(code,0x1060), 'Changed-pose negative did not diverge'
    incomplete=copy.deepcopy(code);incomplete.pop(0x1074)
    try: arguments(incomplete,0xf40)
    except KeyError: pass
    else: raise AssertionError('Missing-call negative accepted')
    print('Passage source:333 original bytes/132 contiguous instructions across5 bounded ranges;8 loader/kind/table/count/pose paths,2 negatives. No elapsed-time acceptance.')


if __name__=='__main__':verify()
