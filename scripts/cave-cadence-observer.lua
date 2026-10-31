-- Read-only callbacks; independent Right+Fire make/release schedule.
local ds, ega = __DS__, __EGA__
local samples = {}
local function byte(at) return dosbox.mem_read_byte(ds, at) end
local function word(at) return dosbox.mem_read_word(ds, at) end
for i = 1, 180 do
    samples[i] = {
        index = i, frame = dosbox.frame(),
        clock = word(0x2225) + word(0x2227) * 65536,
        page = dosbox.mem_read_byte(ega, 0x27),
        room = word(0x4d32), torch = byte(0x8b54),
        money = word(0x8cc0) + word(0x8cc2) * 65536,
        seed = word(0x2229), enemy = word(0x6810),
        partyX = word(0x54fc), partyY = word(0x54fe),
        partyFrame = byte(0x550e), entering = word(0x8eb2)
    }
    if i < 180 then dosbox.wait_frames(1) end
end
dosbox.output.samples = samples
dosbox.output.completed = true
dosbox.output.expectedSamples = 180
