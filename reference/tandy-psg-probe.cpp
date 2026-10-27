// Narrow digital-state probe of the pinned, external DOSBox MAME chip source.
// No chip algorithm is duplicated here. Private visibility is exposed only to
// install an authored state and inspect register/counter/LFSR boundaries.
#include <algorithm>
#include <array>
#include <cassert>
#include <iostream>
#include <memory>
#include "hardware/audio/private/mame/emu.h"
#define private public
#define protected public
#include "hardware/audio/private/mame/sn76496.h"
#undef private
#undef protected
#include "hardware/audio/mame/sn76496.cpp"

int main() {
  ncr8496_device chip("NCR8496", nullptr, 3579552);
  chip.device_start();
  for (int i = 0; i < 3; i++) {
    chip.m_register[i * 2] = 1;
    chip.m_period[i] = 1;
    chip.m_count[i] = 1;
    chip.m_output[i] = 1;
  }
  for (int i = 0; i < 4; i++) chip.write(0x9f + i * 32);
  chip.m_last_register = 0;
  chip.m_register[6] = 0;
  chip.m_period[3] = 32;
  chip.m_count[3] = 1;
  chip.m_output[3] = 0;
  chip.m_RNG = 0x8000;
  chip.m_current_clock = 7;
  const auto array = [](const auto& a, int n) {
    std::cout << '[';
    for (int i = 0; i < n; i++) std::cout << (i ? "," : "") << a[i];
    std::cout << ']';
  };
  const auto snapshot = [&]() {
    std::cout << "{\"registers\":"; array(chip.m_register, 8);
    std::cout << ",\"periods\":"; array(chip.m_period, 4);
    std::cout << ",\"counters\":"; array(chip.m_count, 4);
    std::cout << ",\"outputs\":"; array(chip.m_output, 4);
    std::cout << ",\"lfsr\":" << chip.m_RNG
              << ",\"latched\":" << chip.m_last_register
              << ",\"negate\":" << (chip.m_negate ? "true" : "false") << '}';
  };
  std::cout << '['; snapshot();
  char op; int value;
  while (std::cin >> op >> value) {
    if (op == 'w' && value >= 0 && value <= 255) chip.write(value);
    else if (op == 'c' && value >= 0 && value <= 65536) {
      for (int i = 0; i < value; i++) {
        stream_sample_t buffer[8] = {};
        stream_sample_t* output[] = {buffer};
        chip.sound_stream_update(chip.temp, nullptr, output, 8);
      }
    } else return 2;
    std::cout << ','; snapshot();
  }
  if (!std::cin.eof()) return 3;
  std::cout << "]\n";
}
