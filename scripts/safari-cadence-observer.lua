-- Read-only:Main BP-58 increments after each ordinary flip returns at0b14.
-- No input/event is inferred from a native output. No hardware/page writes.
local ds, ega, bp = __DS__, __EGA__, __BP__
local samples = {}
local function byte(at) return dosbox.mem_read_byte(ds, at) end
local function word(at) return dosbox.mem_read_word(ds, at) end
for i = 1, 120 do
    samples[i] = {
        index = i, frame = dosbox.frame(),
        clock = word(0x2225) + word(0x2227) * 65536,
        page = dosbox.mem_read_byte(ega, 0x27),
        counter = word(bp - 0x58), started = byte(bp - 0x3e),
        film = byte(0x5d2a), column = byte(0x4dde), seed = word(0x2229)
    }
    assert(samples[i].film == 12, 'Unexpected Safari shot during neutral observation')
    assert(samples[i].counter < 52, 'Timer wrap exceeds this bounded observation')
    if i < 120 then dosbox.wait_frames(1) end
end
dosbox.output.samples = samples
dosbox.output.completed = true
dosbox.output.expectedSamples = 120
