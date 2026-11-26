import { CompatibilityIssue, CompatibilityReport, PCBuildState } from '../types/game';
import { getHardwareItem } from './hardwareDatabase';

function parseVersion(ver?: string): number {
  if (!ver) return 1.0;
  const parsed = parseFloat(ver);
  return Number.isNaN(parsed) ? 1.0 : parsed;
}

export function evaluateCompatibility(build: PCBuildState): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];

  const pcCase = getHardwareItem(build.caseId);
  const mb = getHardwareItem(build.motherboardId);
  const cpu = getHardwareItem(build.cpuId);
  const cooler = getHardwareItem(build.coolerId);
  const gpu = getHardwareItem(build.gpuId);
  const psu = getHardwareItem(build.psuId);
  const rams = build.ramIds.map((id) => getHardwareItem(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const storages = build.storageIds.map((id) => getHardwareItem(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const addons = (build.addonIds ?? []).map((id) => getHardwareItem(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  // 1. Case <-> Motherboard form factor
  if (pcCase && mb && pcCase.supportedFormFactors && mb.formFactor) {
    if (!pcCase.supportedFormFactors.includes(mb.formFactor)) {
      issues.push({
        severity: 'error',
        code: 'CASE_MB_FORM_FACTOR',
        message: `Motherboard ${mb.formFactor} tidak muat di casing ${pcCase.model} (hanya mendukung ${pcCase.supportedFormFactors.join('/')}).`,
        cause: `Ukuran fisik papan induk (${mb.formFactor}) lebih besar daripada ruang dudukan standoff casing ${pcCase.model}.`,
        fixSuggestion: `Ganti casing ke ukuran lebih besar (Mid/Full Tower) atau pilih motherboard ${pcCase.supportedFormFactors[0]}.`,
        involvedCategories: ['case', 'motherboard'],
      });
    }
  }

  // 2. CPU <-> Motherboard socket, generation & BIOS version
  if (cpu && mb) {
    if (cpu.socket !== mb.socket) {
      issues.push({
        severity: 'error',
        code: 'CPU_SOCKET_MISMATCH',
        message: `CPU socket tidak kompatibel. (${cpu.model} memakai ${cpu.socket}, motherboard ${mb.socket}).`,
        cause: `Susunan pin dan soket prosesor ${cpu.socket} berbeda secara fisik dari soket ${mb.socket} pada motherboard.`,
        fixSuggestion: `Pilih prosesor bersoket ${mb.socket} atau ganti motherboard dengan soket ${cpu.socket}.`,
        involvedCategories: ['cpu', 'motherboard'],
      });
    } else {
      if (mb.supportedGenerations && !mb.supportedGenerations.includes(cpu.generation)) {
        issues.push({
          severity: 'error',
          code: 'CPU_CHIPSET_UNSUPPORTED',
          message: `Chipset ${mb.chipset} tidak mendukung generasi ${cpu.generation}.`,
          cause: `Chipset ${mb.chipset} tidak membawa microcode untuk arsitektur ${cpu.generation}.`,
          fixSuggestion: `Gunakan CPU generasi ${mb.supportedGenerations.join('/')} atau upgrade motherboard.`,
          involvedCategories: ['cpu', 'motherboard'],
        });
      }
      if (cpu.minBiosVersion && parseVersion(mb.biosVersion) < parseVersion(cpu.minBiosVersion)) {
        issues.push({
          severity: 'error',
          code: 'CPU_BIOS_UNSUPPORTED',
          message: `CPU tidak didukung oleh versi BIOS ini. (Butuh BIOS ${cpu.minBiosVersion}+, terpasang ${mb.biosVersion}).`,
          cause: `Firmware BIOS ${mb.biosVersion} pada ${mb.model} belum memiliki tabel dukungan untuk ${cpu.model}.`,
          fixSuggestion: `Gunakan motherboard dengan BIOS ${cpu.minBiosVersion}+ (mis. Z790 / B760) atau CPU generasi lebih awal.`,
          involvedCategories: ['cpu', 'motherboard'],
        });
      }
    }
  }

  // 3. RAM <-> Motherboard generation, slots, capacity & dual channel
  let totalRamGB = 0;
  if (rams.length > 0) {
    const distinctTypes = new Set<string>();
    for (const ram of rams) {
      totalRamGB += ram.capacityGB ?? 0;
      if (ram.ramType) distinctTypes.add(ram.ramType);
      if (mb && mb.ramType && ram.ramType !== mb.ramType) {
        issues.push({
          severity: 'error',
          code: 'RAM_TYPE_MISMATCH',
          message: `Motherboard hanya mendukung ${mb.ramType}. (${ram.model} adalah ${ram.ramType}).`,
          cause: `Posisi takik (notch) dan voltase memori ${ram.ramType} tidak cocok di slot ${mb.ramType}.`,
          fixSuggestion: `Lepas ${ram.model} dan pasang modul RAM bertipe ${mb.ramType}.`,
          involvedCategories: ['ram', 'motherboard'],
        });
      }
    }
    if (distinctTypes.size > 1) {
      issues.push({
        severity: 'error',
        code: 'RAM_MIXED_TYPES',
        message: 'Terdapat modul RAM dengan generasi DDR berbeda secara bersamaan.',
        cause: 'Sistem tidak dapat menjalankan dua generasi DDR yang berbeda dalam satu kontroler memori.',
        fixSuggestion: 'Gunakan keping RAM dengan generasi dan kecepatan identik.',
        involvedCategories: ['ram'],
      });
    }
    if (mb && mb.ramSlots && rams.length > mb.ramSlots) {
      issues.push({
        severity: 'error',
        code: 'RAM_SLOTS_EXCEEDED',
        message: `Jumlah modul RAM (${rams.length}) melebihi slot motherboard (${mb.ramSlots}).`,
        cause: `Motherboard hanya menyediakan ${mb.ramSlots} slot DIMM fisik.`,
        fixSuggestion: `Kurangi jumlah keping RAM menjadi maksimal ${mb.ramSlots} keping.`,
        involvedCategories: ['ram', 'motherboard'],
      });
    }
    if (mb && mb.maxRamGB && totalRamGB > mb.maxRamGB) {
      issues.push({
        severity: 'error',
        code: 'RAM_CAPACITY_EXCEEDED',
        message: `Total kapasitas RAM (${totalRamGB}GB) melebihi batas motherboard (${mb.maxRamGB}GB).`,
        cause: `Chipset ${mb.chipset ?? ''} memiliki batas alamat memori maksimal ${mb.maxRamGB}GB.`,
        fixSuggestion: `Turunkan total kapasitas RAM agar <= ${mb.maxRamGB}GB.`,
        involvedCategories: ['ram', 'motherboard'],
      });
    }
  }
  const dualChannelActive = rams.length >= 2 && rams.length % 2 === 0;
  if (rams.length === 1 && mb && (mb.ramSlots ?? 2) >= 2) {
    issues.push({
      severity: 'warning',
      code: 'RAM_SINGLE_CHANNEL',
      message: 'RAM berjalan dalam mode single-channel. Pasang 2 modul identik untuk dual-channel.',
      cause: 'Hanya 1 saluran memori yang terisi sehingga bandwidth RAM berkurang hingga 35%.',
      fixSuggestion: 'Tambahkan 1 keping RAM sejenis lagi agar mode Dual-Channel aktif.',
      involvedCategories: ['ram'],
    });
  }

  // 4. Storage <-> Motherboard M.2 / SATA slots
  let totalStorageGB = 0;
  let nvmeCount = 0;
  let sataCount = 0;
  for (const sto of storages) {
    totalStorageGB += sto.capacityGB ?? 0;
    if (sto.storageInterface === 'NVMe') nvmeCount++;
    else sataCount++;
  }
  if (mb) {
    if (nvmeCount > (mb.m2Slots ?? 0)) {
      issues.push({
        severity: 'error',
        code: 'STORAGE_M2_LIMIT',
        message: `Slot M.2 NVMe tidak cukup (${nvmeCount} terpasang, tersedia ${mb.m2Slots ?? 0}).`,
        cause: `Motherboard ${mb.model} hanya menyediakan ${mb.m2Slots ?? 0} konektor M.2.`,
        fixSuggestion: (mb.m2Slots ?? 0) === 0
          ? 'Motherboard legacy tidak punya slot M.2 — gunakan SSD/HDD 2.5"/3.5" SATA.'
          : 'Kurangi jumlah SSD NVMe atau ganti ke drive SATA 2.5".',
        involvedCategories: ['storage', 'motherboard'],
      });
    }
    if (sataCount > (mb.sataPorts ?? 0)) {
      issues.push({
        severity: 'error',
        code: 'STORAGE_SATA_LIMIT',
        message: `Port SATA tidak cukup (${sataCount} terpasang, tersedia ${mb.sataPorts ?? 0}).`,
        cause: `Jumlah perangkat SATA melebihi ${mb.sataPorts ?? 0} header SATA pada motherboard.`,
        fixSuggestion: 'Lepas salah satu drive SATA atau gunakan SSD M.2 NVMe.',
        involvedCategories: ['storage', 'motherboard'],
      });
    }
  }

  // 5. GPU <-> Case clearance & Display check
  if (gpu && pcCase && pcCase.maxGpuLengthMm && gpu.lengthMm) {
    if (gpu.lengthMm > pcCase.maxGpuLengthMm) {
      issues.push({
        severity: 'error',
        code: 'GPU_TOO_LONG',
        message: `GPU terlalu panjang untuk casing. (${gpu.lengthMm}mm > maks ${pcCase.maxGpuLengthMm}mm).`,
        cause: `Panjang kartu grafis (${gpu.lengthMm}mm) menabrak rak depan casing (batas ${pcCase.maxGpuLengthMm}mm).`,
        fixSuggestion: 'Pilih casing Mid/Full Tower yang lebih panjang atau ganti GPU 2-kipas yang lebih pendek.',
        involvedCategories: ['gpu', 'case'],
      });
    }
  }
  if (cpu && !cpu.hasIntegratedGraphics && !gpu) {
    issues.push({
      severity: 'warning',
      code: 'NO_GRAPHICS_OUTPUT',
      message: `${cpu.model} tidak memiliki iGPU terintegrasi. Pasang GPU diskrit agar tampil ke monitor.`,
      cause: 'Prosesor seri F / non-G tidak memiliki unit pemroses grafis bawaan.',
      fixSuggestion: 'Pasang Kartu Grafis (GPU) diskrit pada slot PCIe x16.',
      involvedCategories: ['cpu', 'gpu'],
    });
  }

  // 6. Cooler <-> CPU socket, TDP capacity, radiator support & Case clearance
  if (cooler) {
    if (cpu && cooler.supportedSockets && cpu.socket && !cooler.supportedSockets.includes(cpu.socket)) {
      issues.push({
        severity: 'error',
        code: 'COOLER_SOCKET_MISMATCH',
        message: `Bracket cooler ${cooler.model} tidak mendukung socket ${cpu.socket}.`,
        cause: `Lubang baut mounting cooler tidak sejajar dengan pola dudukan ${cpu.socket}.`,
        fixSuggestion: `Pilih cooler yang mendukung soket ${cpu.socket}.`,
        involvedCategories: ['cooler', 'cpu'],
      });
    }
    if (pcCase && !cooler.isLiquidCooler && cooler.heightMm && pcCase.maxCoolerHeightMm && cooler.heightMm > pcCase.maxCoolerHeightMm) {
      issues.push({
        severity: 'error',
        code: 'COOLER_TOO_TALL',
        message: `CPU Cooler terlalu tinggi untuk casing (${cooler.heightMm}mm > maks ${pcCase.maxCoolerHeightMm}mm).`,
        cause: `Tinggi heatsink tower (${cooler.heightMm}mm) menghalangi penutupan panel samping casing.`,
        fixSuggestion: `Gunakan cooler low-profile (<= ${pcCase.maxCoolerHeightMm}mm) atau pendingin cair AIO.`,
        involvedCategories: ['cooler', 'case'],
      });
    }
    if (
      pcCase &&
      cooler.isLiquidCooler &&
      cooler.radiatorSizeMm &&
      pcCase.radiatorSupportMm &&
      !pcCase.radiatorSupportMm.includes(cooler.radiatorSizeMm)
    ) {
      issues.push({
        severity: 'error',
        code: 'CASE_RADIATOR_UNSUPPORTED',
        message: `Casing ${pcCase.model} tidak muat radiator AIO ${cooler.radiatorSizeMm}mm (mendukung ${pcCase.radiatorSupportMm.join('/')}mm).`,
        cause: `Dudukan kipas atap/depan casing tidak cukup panjang untuk radiator ${cooler.radiatorSizeMm}mm.`,
        fixSuggestion: `Pilih AIO ukuran ${pcCase.radiatorSupportMm[0]}mm atau upgrade ke casing Mid/Full Tower.`,
        involvedCategories: ['cooler', 'case'],
      });
    }
    if (cpu && cooler.coolingCapacityW && cpu.tdpW && cooler.coolingCapacityW < cpu.tdpW) {
      issues.push({
        severity: 'warning',
        code: 'COOLER_UNDERPOWERED',
        message: `Kapasitas pendinginan ${cooler.model} (${cooler.coolingCapacityW}W) di bawah TDP ${cpu.model} (${cpu.tdpW}W) — berisiko thermal throttling.`,
        cause: `Panas maksimal CPU (${cpu.tdpW}W) melebihi kemampuan disipasi cooler (${cooler.coolingCapacityW}W).`,
        fixSuggestion: 'Upgrade ke Tower Air Cooler atau Liquid AIO 240mm/360mm.',
        involvedCategories: ['cooler', 'cpu'],
      });
    }
  }

  // 7. Add-on PCIe slot availability check
  const pcieAddons = addons.filter(
    (a) => a.addonType === 'wifi' || a.addonType === 'sound_card' || a.addonType === 'capture_card' || a.addonType === 'nic'
  );
  if (mb && pcieAddons.length > Math.max(1, (mb.pcieSlots ?? 1))) {
    issues.push({
      severity: 'warning',
      code: 'PCIE_SLOTS_CROWDED',
      message: `Banyak kartu ekspansi PCIe (${pcieAddons.length}) terpasang pada motherboard ${mb.formFactor}.`,
      cause: 'Slot ekspansi PCIe fisik di motherboard terbatas.',
      fixSuggestion: 'Gunakan motherboard ATX dengan slot PCIe lebih banyak.',
      involvedCategories: ['addon', 'motherboard'],
    });
  }

  // 8. Power estimation & PSU form factor / wattage / PCIe connectors
  const addonWattage = addons.reduce((acc, a) => acc + (a.tdpW ?? 0), 0);
  const estimatedWattage =
    (cpu?.tdpW ?? 0) +
    (gpu?.tdpW ?? 0) +
    (mb?.tdpW ?? 30) +
    rams.reduce((acc, r) => acc + (r.tdpW ?? 5), 0) +
    storages.reduce((acc, s) => acc + (s.tdpW ?? 5), 0) +
    (cooler?.tdpW ?? 5) +
    addonWattage +
    build.fanCount * 3 +
    25; // headroom/peripherals

  const recommendedPsuWattage = Math.ceil((estimatedWattage * 1.35) / 50) * 50;

  if (psu) {
    if (pcCase && pcCase.supportsAtxPsu === false && psu.psuFormFactor !== 'SFX') {
      issues.push({
        severity: 'error',
        code: 'CASE_PSU_FORM_FACTOR',
        message: `Casing Mini-ITX ${pcCase.model} hanya menerima PSU ukuran SFX (terpasang ${psu.psuFormFactor ?? 'ATX'}).`,
        cause: `Ruang kompartemen daya Mini-ITX terlalu kecil untuk PSU ATX standar.`,
        fixSuggestion: 'Ganti Power Supply ke tipe SFX (mis. Corsair SF650 atau Cooler Master V850 SFX).',
        involvedCategories: ['case', 'psu'],
      });
    }
    if (psu.wattage) {
      if (psu.wattage < estimatedWattage) {
        issues.push({
          severity: 'error',
          code: 'PSU_INSUFFICIENT_WATTAGE',
          message: `PSU tidak memiliki kapasitas yang disarankan. (${psu.wattage}W < kebutuhan sistem ${estimatedWattage}W).`,
          cause: `Total beban listrik CPU+GPU (${estimatedWattage}W) melebihi daya maksimal PSU (${psu.wattage}W).`,
          fixSuggestion: `Ganti ke PSU minimal ${recommendedPsuWattage}W agar sistem aman.`,
          involvedCategories: ['psu'],
        });
      } else if (psu.wattage < recommendedPsuWattage) {
        issues.push({
          severity: 'warning',
          code: 'PSU_LOW_HEADROOM',
          message: `PSU ${psu.wattage}W di bawah rekomendasi aman ${recommendedPsuWattage}W.`,
          cause: 'Margin daya PSU tipis saat beban puncak gaming atau rendering.',
          fixSuggestion: `Pertimbangkan upgrade PSU ke ${recommendedPsuWattage}W atau lebih.`,
          involvedCategories: ['psu'],
        });
      }
      if (gpu && (gpu.pciePowerPins ?? 0) > (psu.pciePowerPins ?? 0)) {
        issues.push({
          severity: 'error',
          code: 'PSU_MISSING_PCIE_PINS',
          message: `PSU ${psu.model} kekurangan konektor daya PCIe untuk ${gpu.model} (butuh ${gpu.pciePowerPins}-pin).`,
          cause: `Kabel daya VGA bawaan PSU tidak mencukupi jumlah pin yang dibutuhkan ${gpu.model}.`,
          fixSuggestion: 'Ganti PSU dengan kapasitas watt dan konektor PCIe 8-pin/12VHPWR lebih banyak.',
          involvedCategories: ['psu', 'gpu'],
        });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');

  return {
    compatible: !hasError,
    issues,
    estimatedWattage,
    recommendedPsuWattage,
    dualChannelActive,
    totalRamGB,
    totalStorageGB,
  };
}
