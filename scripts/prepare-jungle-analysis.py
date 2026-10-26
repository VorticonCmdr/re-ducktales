"""Local-only jungle analysis image: combine resident code and overlay 8.

INT 34..3b software-FPU escapes become same-length NOP+x87 instructions;
INT 3d (wait) becomes WAIT+NOP. Original bytes are never modified or executed.
"""
from pathlib import Path
import struct
import hashlib
import json
import runpy
ROOT=Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT/'scripts/prepare-analysis.py'), run_name='__main__')
OUT=ROOT/'.local/analysis'
resident=(OUT/'DUCK_UNPACKED.EXE').read_bytes()
overlay=(OUT/'OVERLAY_08.EXE').read_bytes()
h=struct.unpack_from('<14H',resident)
oh=struct.unpack_from('<14H',overlay)
image=bytearray(resident[h[4]*16:])
body=bytearray(overlay[oh[4]*16:])
base=0xc17*16
patches=[]
for i in range(len(body)-1):
    if body[i]==0xcd and 0x34<=body[i+1]<=0x3b:
        before=bytes(body[i:i+2]);body[i:i+2]=bytes([0x90,0xd8+body[i+1]-0x34]);patches.append((i,before.hex(),bytes(body[i:i+2]).hex()))
    elif body[i:i+2]==b'\xcd\x3d':
        body[i:i+2]=b'\x9b\x90';patches.append((i,'cd3d','9b90'))
image[base:base+len(body)]=body
relocs=[]
for i in range(h[3]):
    o,s=struct.unpack_from('<HH',resident,h[12]+4*i)
    if not base<=s*16+o<base+len(body):relocs.append((o,s))
for i in range(oh[3]):
    o,s=struct.unpack_from('<HH',overlay,oh[12]+4*i)
    assert 0 <= (s-0xc17)*16+o <= len(body)-2
    relocs.append((o,s))
# Replace only recognized fixed-size compiler stack probes with equivalent
# SUB SP,imm16 + NOP so the decompiler can recover BP-relative locals.
probes=[]
for i in range(3,len(image)-4):
    if image[i:i+5]==b'\x9a\x9e\x1e\x0e\x04':
        if image[i-3]==0xb8:
            count=struct.unpack_from('<H',image,i-2)[0]
        elif image[i-2:i]==b'\x33\xc0':count=0
        else:continue
        before=bytes(image[i:i+5])
        image[i:i+5]=b'\x81\xec'+struct.pack('<H',count)+b'\x90'
        probes.append((i,before.hex(),bytes(image[i:i+5]).hex()))
        # This removed a relocation operand from the analysis image.
        relocs=[(o,s) for o,s in relocs if s*16+o!=i+3]
# Rebuild the relocation header after probe normalization.
header=bytearray(((32+len(relocs)*4+511)//512)*512)
size=len(header)+len(image)
struct.pack_into('<14H',header,0,0x5a4d,size%512,(size+511)//512,len(relocs),len(header)//16,0,65535,h[7],h[8],0,h[10],h[11],32,0)
for i,values in enumerate(relocs):struct.pack_into('<HH',header,32+4*i,*values)
(OUT/'JUNGLE_CODE.EXE').write_bytes(header+image)
(OUT/'jungle-analysis-patches.json').write_text(json.dumps({
    'purpose':'analysis only, not an original executable or runtime',
    'source':'OVERLAY_08.EXE',
    'sourceSha256':hashlib.sha256(overlay).hexdigest(),
    'residentSha256':hashlib.sha256(resident).hexdigest(),
    'originalBodySha256':hashlib.sha256(overlay[oh[4]*16:]).hexdigest(),
    'outputSha256':hashlib.sha256(header+image).hexdigest(),
    'overlayImageOffset':base,
    'patches':patches,
    'stackProbes':probes,
    'functionOffsets':[0],
},indent=2)+'\n')
print(f'Combined jungle analysis: {len(body)} overlay bytes, {len(patches)} software-FPU escapes, {len(relocs)} relocations')
