"""Natural original Safari cadence;one owner,zero guest writes/restores.
Setup may stop for input/code checks. Measurement has no execution breakpoints.
"""
import base64
import hashlib
import json
import struct
import subprocess


def relocated_overlay(exe, at, load, number, length, relocations):
    h = struct.unpack_from('<14H', exe, at)
    assert h[0] == 0x5a4d and h[3] == relocations and h[13] == number
    size = (h[2]-1)*512 + (h[1] or 512)
    body = bytearray(exe[at+h[4]*16:at+size])
    assert len(body) == length
    for i in range(h[3]):
        offset, segment = struct.unpack_from('<HH', exe, at+h[12]+i*4)
        offset += segment*16-0xc170
        struct.pack_into('<H', body, offset, (struct.unpack_from('<H', body, offset)[0]+load)&65535)
    return body


def capture_safari_cadence(*, client, stop, load, ds, overlay, add, remove,
                           resume, state, keys, sequence, wait_until, save, root):
    initial_stop = stop['stop_id']
    map_cs = overlay + 0xca
    marker = add(0x1228, map_cs)
    stop = resume(initial_stop)
    assert stop['breakpoint']['id'] == marker
    data = state('timing-map-entry', stop)
    sp = stop['registers']['esp'] & 65535
    x_ptr, y_ptr = struct.unpack_from('<HH', data, sp + 4)
    assert struct.unpack_from('<hh', data, x_ptr)[0] == 46
    assert struct.unpack_from('<h', data, y_ptr)[0] == 139
    remove(marker)
    # The map caller uses its +0ca paragraph alias throughout the destination.
    entry = add(0x1757 - 0xca0, map_cs)
    end = add(0x140e, map_cs)
    stop = resume(stop['stop_id'])
    reset = False
    reached = False
    # Feedback is setup only. Alternate one-pixel makes with neutral polls to
    # reset original acceleration; never write the cursor or target slot.
    for index in range(200):
        assert stop['breakpoint']['id'] == end
        data = state(f'timing-map-step-{index:03d}', stop, False)
        x, y = struct.unpack_from('<h', data, x_ptr)[0], struct.unpack_from('<h', data, y_ptr)[0]
        if (x, y) == (46, 56):
            reached = True
            break
        if reset:
            reset = False
        else:
            key = ('KBD_right' if x < 46 else 'KBD_left') if x != 46 else ('KBD_down' if y < 56 else 'KBD_up')
            keys((key, True), (key, False))
            reset = True
        stop = resume(stop['stop_id'])
    assert reached, 'Unfinished natural Yellerstone map selection'
    remove(end)
    keys(('KBD_space', True))
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == entry
    data = state('timing-destination-entry', stop)
    remove(entry)
    keys(('KBD_space', False))
    flush, read = add(0x1e33 - 0xca0, map_cs), add(0x1e8e - 0xca0, map_cs)
    destination = []
    for name, key, expected in [('travel', 'KBD_right', 3),
                                 ('confirm', 'KBD_space', 192)]:
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == flush
        state('timing-destination-' + name + '-flush', stop, False)
        keys((key, True), (key, False))
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == read
        assert stop['registers']['eax'] & 255 == expected
        state('timing-destination-' + name + '-read', stop)
        destination.append({'case': name, 'byte': expected})
    remove(flush)
    remove(read)
    marker = add(0x1ec7 - 0xca0, map_cs)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    assert stop['registers']['eax'] & 65535 == 1
    state('timing-destination-return', stop)
    remove(marker)
    flight = add(0x2ae, condition={'segment': overlay, 'offset': 0x2b1,
                 'width': 2, 'op': 'eq', 'value': load + 0x124})
    keys(('KBD_space', True))
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == flight
    flight_data = state('timing-flight-first-input', stop)
    exe = (root/'game/DUCKTALE.EXE').read_bytes()
    expected_flight = relocated_overlay(exe, 0x12c00, load, 4, 17548, 248)
    flight_read = client.post('/api/v1/batch', json={'ops': [
        {'op':'mem_read','segment':overlay,'offset':0,'len':17548},
        {'op':'mem_read','segment':load,'offset':0xa395,'len':129},
        {'op':'mem_read','segment':0,'offset':0xd0,'len':40}]})
    assert not flight_read['aborted'] and all(r['status']=='ok' for r in flight_read['results'])
    save('safari-flight-code-observed', {'load':load,'segment':overlay,'read':flight_read})
    live_flight = base64.b64decode(flight_read['results'][0]['data'])
    # Only exact transformations by the unchanged original hardware-FPU handler
    # are permitted,at the91 already identified escape sites. No operand mask.
    image = bytearray(base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',
        "import{readFile}from'node:fs/promises';import{unpackImage}from'./src/game/executable.js';process.stdout.write(Buffer.from(unpackImage(await readFile('game/DUCKTALE.EXE'))).toString('base64'));"],cwd=root)))
    cursor = struct.unpack_from('<H',exe,8)[0]*16+struct.unpack_from('<H',exe,22)[0]*16+0x125
    for region in range(16):
        count = struct.unpack_from('<H',exe,cursor)[0];cursor += 2
        for _ in range(count):
            pos = region*65536+struct.unpack_from('<H',exe,cursor)[0];cursor += 2
            struct.pack_into('<H',image,pos,(struct.unpack_from('<H',image,pos)[0]+load)&65535)
    assert base64.b64decode(flight_read['results'][1]['data']) == image[0xa395:0xa416]
    vectors = base64.b64decode(flight_read['results'][2]['data'])
    for n in range(10):
        assert struct.unpack_from('<HH',vectors,n*4) == (0x755 if n==8 else 0x782 if n==9 else 0x78a,load+0x9c4)
    sites = json.loads((root/'reference/flight-input.json').read_text())['runtimeFpuPatchedOffsets']
    assert len(sites) == len(set(sites)) == 91
    patched = []
    for text in sites:
        pos = int(text,16)
        if live_flight[pos:pos+2] == expected_flight[pos:pos+2]:
            continue
        assert expected_flight[pos] == 0xcd
        interrupt = expected_flight[pos+1]
        transformed = bytearray(expected_flight)
        delta = 0xa23d if interrupt == 0x3d else 0x5c32
        assert interrupt == 0x3d or 0x34 <= interrupt <= 0x3b
        struct.pack_into('<H',transformed,pos,(struct.unpack_from('<H',transformed,pos)[0]-delta)&65535)
        if interrupt != 0x3d:
            operand = struct.unpack_from('<H',transformed,pos+1)[0]
            keep = ((operand&0x30fb)==0x30d9 and transformed[pos+2]<0xf0) or (operand&0xfeff)==0xe2db or operand==0xe0df
            if not keep: transformed[pos] = 0x90
        assert live_flight[pos:pos+2] == transformed[pos:pos+2]
        expected_flight[pos:pos+2] = transformed[pos:pos+2]
        patched.append(text)
    assert live_flight == expected_flight, 'Original live flight body mismatch'
    save('safari-flight-code',{'load':load,'segment':overlay,'read':flight_read,'runtimeFpuPatchedOffsets':patched})
    bp = stop['registers']['ebp'] & 65535
    duration, racing = struct.unpack_from('<HH', flight_data, bp + 6)
    assert duration in [1, 2, 3] and racing in [0, 1]
    save('timing-flight-contract', {'duration': duration, 'racing': racing,
         'scope': 'Original caller arguments;crash setup requires a naturally nonracing flight. No flag is overwritten.'})
    assert racing == 0, 'SETUP: racing flight cannot use the crash-to-Safari recipe'
    remove(flight)
    keys(('KBD_space', False))
    # The established original flight-input setup, with a fresh make after the
    # release. These frame numbers are setup inputs, never benchmark timestamps.
    sequence([{'type': 'key', 'key': 'KBD_space', 'pressed': True, 'frame': 3},
              {'type': 'key', 'key': 'KBD_down', 'pressed': True, 'frame': 80},
              {'type': 'key', 'key': 'KBD_down', 'pressed': False, 'frame': 100},
              {'type': 'key', 'key': 'KBD_space', 'pressed': False, 'frame': 160}])
    entry = add(0)
    stop = resume(stop['stop_id'], wait_seconds=60)
    assert stop['breakpoint']['id'] == entry
    data = state('safari-entry',stop)
    expected = relocated_overlay(exe,0x1d800,load,7,7924,93)
    read = client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':overlay,'offset':0,'len':7924}]})
    assert not read['aborted'] and read['results'][0]['status']=='ok'
    assert base64.b64decode(read['results'][0]['data']) == expected, 'Actual Safari overlay mismatch'
    save('safari-code',{'load':load,'ds':ds,'segment':overlay,'read':read})
    sp = stop['registers']['esp']&65535
    save('safari-entry-contract',{'variant':struct.unpack_from('<H',data,sp+4)[0],
        'difficulty':data[0x8990],'location':data[0x5b3c],
        'day':data[0x4e0e],'seed':struct.unpack_from('<H',data,0x2229)[0],
        'money':struct.unpack_from('<I',data,0x8cc0)[0]})
    remove(entry)
    replay = client.get('/api/v1/input/replay/status')
    assert not replay['active'] and replay['remaining']==0
    marker = add(0x7d7)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id']==marker and stop['registers']['eax']&255==0
    data = state('safari-first-input',stop)
    bp = stop['registers']['ebp']&65535
    assert 0x66 <= bp < 0xfffe and data[0x3c1]==1
    assert struct.unpack_from('<H',data,bp-0x58)[0]==0 and data[0x5d2a]==12
    remove(marker)
    flip,ega = struct.unpack_from('<HH',data,0x1fd4)
    assert flip==0xe5
    driver_read=client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':ega,'offset':0,'len':2599}]})
    assert not driver_read['aborted'] and driver_read['results'][0]['status']=='ok'
    save('safari-driver-observed', {'segment':ega,'read':driver_read})
    driver=base64.b64decode(driver_read['results'][0]['data'])
    original=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',
        "import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'))[1].data).toString('base64'));"],cwd=root))
    # Compare executed instruction ranges,not the intervening palette/mode
    # helper region85..e4. The complete observed resource is retained above.
    for lo,hi in [(0x64,0x85),(0xe5,0x101),(0x1ef,0x35d),(0x35d,0x515),(0x515,0x81d),(0x81f,0x909)]:
        assert driver[lo:hi]==original[lo:hi], 'Measured EGA instruction range mismatch'
    formatter=client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':load,'offset':0x1e67,'len':128}]})
    save('safari-formatter-code',{'load':load,'read':formatter})
    assert not formatter['aborted'] and formatter['results'][0]['status']=='ok'
    assert base64.b64decode(formatter['results'][0]['data'])==image[0x1e67:0x1ee7]

    save('safari-driver-code',{'segment':ega,'read':driver_read,'originalSHA256':hashlib.sha256(original).hexdigest()})
    assert client.get('/api/v1/debug/breakpoints')['breakpoints']==[]
    template=(root/'scripts/safari-cadence-observer.lua').read_text()
    lua=template.replace('__DS__',str(ds)).replace('__EGA__',str(ega)).replace('__BP__',str(bp))
    save('safari-observer-script',{'source':lua,'templateSHA256':hashlib.sha256(template.encode()).hexdigest(),'ds':ds,'ega':ega,'bp':bp})
    loaded=client.post_text('/api/v1/script/load',lua,params={'name':'safari-cadence-observer'})
    started=client.post('/api/v1/script/start')
    save('safari-observer-loaded',{'load':loaded,'start':started})
    save('safari-observer-inputs',{'events':[],'scope':'Neutral observation after the verified first returned input0;all flight key schedules finished. No fitted values or injected state.'})
    continued=client.post('/api/v1/debug/continue')
    assert continued['resumed_from_stop_id']==stop['stop_id']
    result=wait_until(lambda:client.get('/api/v1/script/status'),lambda r:r['state'] in ['completed','error'],timeout=20)
    save('safari-observer-result',result)
    assert result['state']=='completed' and not result['output_truncated']
    assert result['output']['completed'] is True and len(result['output']['samples'])==120
    final_stop=client.post('/api/v1/debug/pause')['stop']
    assert final_stop['stop_id']==stop['stop_id']+1
    after=state('safari-observer-final',final_stop)
    assert after[0x5d2a]==12 and struct.unpack_from('<H',after,bp-0x38)[0]==0
    save('safari-cadence',{'completed':True,'expectedSamples':120,'initialStopId':stop['stop_id'],'finalStopId':final_stop['stop_id'],'injections':[],'partialRestore':False,'scope':'Natural original neutral Safari loop,monotonic Main BP-58 counter and page observations at consecutive render callbacks. No intermediate execution stops;not exact instruction/scanout checkpoints or port timing acceptance.'})
