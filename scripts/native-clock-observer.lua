-- Tool calibration only. No input or guest memory writes.
assert(type(dosbox.emulated_time_ms) == 'function', 'Missing read-only PIC timestamp API')
local samples = {}
for i = 1, 61 do
    local first = dosbox.emulated_time_ms()
    local second = dosbox.emulated_time_ms()
    assert(first == second, 'Reading PIC time changed emulation time')
    samples[i] = table.concat({i, dosbox.frame(), string.format('%.9f', first)}, ',')
    if i < 61 then dosbox.wait_frames(1) end
end
dosbox.output.samplesCSV = table.concat(samples, '\n')
dosbox.output.completed = true
