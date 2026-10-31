-- Read-only render callbacks. Input comes from a separate fixed engine schedule.
local ds, ega = __DS__, __EGA__
local samples = {}
local function word(at) return dosbox.mem_read_word(ds, at) end
for i = 1, 120 do
    samples[i] = {
        index = i, frame = dosbox.frame(),
        clock = word(0x2225) + word(0x2227) * 65536,
        page = dosbox.mem_read_byte(ega, 0x27),
        x = word(0x5f46), y = word(0x6858), action = word(0x6882),
        actorFrame = word(0x88ae), lostLives = word(0x5cfc),
        column = word(0x544c), row = word(0x5462),
        scroll = word(0x5ed2), outcome = word(0x1aac),
        right = dosbox.mem_read_byte(ds, 0x27b9), seed = word(0x2229)
    }
    assert(samples[i].outcome == 0, 'Jungle exited during bounded observation')
    if i < 120 then dosbox.wait_frames(1) end
end
dosbox.output.samples = samples
dosbox.output.completed = true
dosbox.output.expectedSamples = 120
