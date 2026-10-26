"""Local-only flight analysis image: combine resident code and overlay 4.

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
overlay=(OUT/'OVERLAY_04.EXE').read_bytes()
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
struct.pack_into('<14H',header,0,0x5a4d,size%512,(size+511)//512,len(relocs),len(header)//16,0,65535,h[7],h[8],0,0,0xc17,32,0)
for i,values in enumerate(relocs):struct.pack_into('<HH',header,32+4*i,*values)
(OUT/'FLIGHT_TRANSLATION.EXE').write_bytes(header+image)
(OUT/'flight-analysis-patches.json').write_text(json.dumps({
    'purpose':'analysis only, not an original executable or runtime',
    'source':'OVERLAY_04.EXE',
    'sourceSha256':hashlib.sha256(overlay).hexdigest(),
    'residentSha256':hashlib.sha256(resident).hexdigest(),
    'originalBodySha256':hashlib.sha256(overlay[oh[4]*16:]).hexdigest(),
    'outputSha256':hashlib.sha256(header+image).hexdigest(),
    'overlayImageOffset':base,
    'patches':patches,
    'stackProbes':probes,
    'functionOffsets':[0,0xf78,0x1330,0x194b,0x22ee,0x2577,0x261f,0x2ba0,0x2cf8,0x2d40,0x2da8,0x3498,0x36c9,0x43f9,0x4430],
    'jumpTables':[{'jump':j,'table':t,'count':n,'csRelativeImageOffset':c} for j,t,n,c in [
        (0x1092,0x10de,10,0),(0x1fd4,0x2150,7,0),(0x2798,0x289f,36,0),
        (0x295d,0x2b09,26,0),(0x3f89,0x15aa,6,0x2da0)]],
},indent=2)+'\n')
print(f'Combined flight analysis: {len(body)} overlay bytes, {len(patches)} software-FPU escapes, {len(relocs)} relocations')
