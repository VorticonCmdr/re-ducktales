-- Read-only fixed-window movement observation. Inputs are scheduled separately.
local ds, ega = __DS__, __EGA__
assert(type(dosbox.emulated_time_ms)=='function', 'Missing calibrated read-only clock API')
local samples = {}
local function word(at) return dosbox.mem_read_word(ds, at) end
for i = 1, 120 do
    local outcome = word(0x1aac)
    assert(outcome == 0, 'Jungle exited during bounded observation')
    samples[i] = table.concat({
        i, dosbox.frame(), word(0x2225) + word(0x2227) * 65536,
        dosbox.mem_read_byte(ega, 0x27),
        word(0x5f46), word(0x6858), word(0x6882), word(0x88ae),
        word(0x5cfc), word(0x544c), word(0x5462), word(0x5ed2), outcome,
        dosbox.mem_read_byte(ds, 0x27b9),
        dosbox.mem_read_byte(ds, 0x27a5), word(0x2229), string.format('%.9f', dosbox.emulated_time_ms())
    }, ',')
    if i < 120 then dosbox.wait_frames(1) end
end
dosbox.output.samplesCSV = table.concat(samples, '\n')
dosbox.output.completed = true
dosbox.output.expectedSamples = 120
