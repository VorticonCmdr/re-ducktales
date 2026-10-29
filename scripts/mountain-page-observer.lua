-- Read-only observation; DS/EGA placeholders are validated original mappings.
-- Input is independently scheduled by input_sequence, never chosen from outputs.
local ds, ega = __DS__, __EGA__
local samples = {}
local function byte(at) return dosbox.mem_read_byte(ds, at) end
local function word(at) return dosbox.mem_read_word(ds, at) end
for i = 1, 80 do
    samples[i] = {
        index = i, frame = dosbox.frame(),
        clock = word(0x2225) + word(0x2227) * 65536,
        page = dosbox.mem_read_byte(ega, 0x27),
        historyPage = byte(0x370a),
        x = word(0x5ae0), y = word(0x5c72), action = word(0x6882),
        actorFrame = word(0x6d3c), lives = byte(0x4d34),
        right = byte(0x27b9), seed = word(0x2229)
    }
    assert(samples[i].lives == 3, 'Life change invalidates page observer scenario')
    if i < 80 then dosbox.wait_frames(1) end
end
dosbox.output.samples = samples
dosbox.output.completed = true
dosbox.output.expectedSamples = 80
