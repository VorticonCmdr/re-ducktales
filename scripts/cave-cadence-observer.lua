-- Read-only callbacks; independent Right+Fire make/release schedule.
local ds, ega = __DS__, __EGA__
local samples = {}
local function byte(at) return dosbox.mem_read_byte(ds, at) end
local function word(at) return dosbox.mem_read_word(ds, at) end
-- CSV avoids the script-status32KiB output cap;fixed13-column integer rows.
for i = 1, 480 do
    samples[i] = table.concat({
        i, dosbox.frame(), word(0x2225) + word(0x2227) * 65536,
        dosbox.mem_read_byte(ega, 0x27), word(0x4d32), byte(0x8b54),
        word(0x8cc0) + word(0x8cc2) * 65536,
        word(0x2229), word(0x6810), word(0x54fc), word(0x54fe),
        byte(0x550e), word(0x8eb2)
    }, ",")
    if i < 480 then dosbox.wait_frames(1) end
end
dosbox.output.samplesCSV = table.concat(samples, "\n")
dosbox.output.completed = true
dosbox.output.expectedSamples = 480
