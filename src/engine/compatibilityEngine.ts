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

  // 1. Case <-> Motherboard form factor
  if (pcCase && mb && pcCase.supportedFormFactors && mb.formFactor) {
    if (!pcCase.supportedFormFactors.includes(mb.formFactor)) {
      issues.push({
        severity: 'error',
        code: 'CASE_MB_FORM_FACTOR',
        message: `Motherboard ${mb.formFactor} tidak muat di casing ${pcCase.model} (hanya mendukung ${pcCase.supportedFormFactors.join('/')}).`,
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
        involvedCategories: ['cpu', 'motherboard'],
      });
    } else {
      if (mb.supportedGenerations && !mb.supportedGenerations.includes(cpu.generation)) {
        issues.push({
          severity: 'error',
          code: 'CPU_CHIPSET_UNSUPPORTED',
          message: `Chipset ${mb.chipset} tidak mendukung generasi ${cpu.generation}.`,
          involvedCategories: ['cpu', 'motherboard'],
        });
      }
      if (cpu.minBiosVersion && parseVersion(mb.biosVersion) < parseVersion(cpu.minBiosVersion)) {
        issues.push({
          severity: 'error',
          code: 'CPU_BIOS_UNSUPPORTED',
          message: `CPU tidak didukung oleh versi BIOS ini. (Butuh BIOS ${cpu.minBiosVersion}+, terpasang ${mb.biosVersion}).`,
          involvedCategories: ['cpu', 'motherboard'],
        });
      }
    }
  }

  // 3. RAM <-> Motherboard generation, slots, capacity & dual channel
  let totalRamGB = 0;
  if (rams.length > 0) {
    for (const ram of rams) {
      totalRamGB += ram.capacityGB ?? 0;
      if (mb && mb.ramType && ram.ramType !== mb.ramType) {
        issues.push({
          severity: 'error',
          code: 'RAM_TYPE_MISMATCH',
          message: `Motherboard hanya mendukung ${mb.ramType}. (${ram.model} adalah ${ram.ramType}).`,
          involvedCategories: ['ram', 'motherboard'],
        });
      }
    }
    if (mb && mb.ramSlots && rams.length > mb.ramSlots) {
      issues.push({
        severity: 'error',
        code: 'RAM_SLOTS_EXCEEDED',
        message: `Jumlah modul RAM (${rams.length}) melebihi slot motherboard (${mb.ramSlots}).`,
        involvedCategories: ['ram', 'motherboard'],
      });
    }
    if (mb && mb.maxRamGB && totalRamGB > mb.maxRamGB) {
      issues.push({
        severity: 'error',
        code: 'RAM_CAPACITY_EXCEEDED',
        message: `Total kapasitas RAM (${totalRamGB}GB) melebihi batas motherboard (${mb.maxRamGB}GB).`,
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
        involvedCategories: ['storage', 'motherboard'],
      });
    }
    if (sataCount > (mb.sataPorts ?? 0)) {
      issues.push({
        severity: 'error',
        code: 'STORAGE_SATA_LIMIT',
        message: `Port SATA tidak cukup (${sataCount} terpasang, tersedia ${mb.sataPorts ?? 0}).`,
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
        involvedCategories: ['gpu', 'case'],
      });
    }
  }
  if (cpu && !cpu.hasIntegratedGraphics && !gpu) {
    issues.push({
      severity: 'warning',
      code: 'NO_GRAPHICS_OUTPUT',
      message: `${cpu.model} tidak memiliki iGPU terintegrasi. Pasang GPU diskrit agar tampil ke monitor.`,
      involvedCategories: ['cpu', 'gpu'],
    });
  }

  // 6. Cooler <-> CPU socket, TDP capacity & Case clearance
  if (cooler) {
    if (cpu && cooler.supportedSockets && cpu.socket && !cooler.supportedSockets.includes(cpu.socket)) {
      issues.push({
        severity: 'error',
        code: 'COOLER_SOCKET_MISMATCH',
        message: `Bracket cooler ${cooler.model} tidak mendukung socket ${cpu.socket}.`,
        involvedCategories: ['cooler', 'cpu'],
      });
    }
    if (pcCase && !cooler.isLiquidCooler && cooler.heightMm && pcCase.maxCoolerHeightMm && cooler.heightMm > pcCase.maxCoolerHeightMm) {
      issues.push({
        severity: 'error',
        code: 'COOLER_TOO_TALL',
        message: `CPU Cooler terlalu tinggi untuk casing (${cooler.heightMm}mm > maks ${pcCase.maxCoolerHeightMm}mm).`,
        involvedCategories: ['cooler', 'case'],
      });
    }
    if (cpu && cooler.coolingCapacityW && cpu.tdpW && cooler.coolingCapacityW < cpu.tdpW) {
      issues.push({
        severity: 'warning',
        code: 'COOLER_UNDERPOWERED',
        message: `Kapasitas pendinginan ${cooler.model} (${cooler.coolingCapacityW}W) di bawah TDP ${cpu.model} (${cpu.tdpW}W) — berisiko thermal throttling.`,
        involvedCategories: ['cooler', 'cpu'],
      });
    }
  }

  // 7. Power estimation & PSU check
  const estimatedWattage =
    (cpu?.tdpW ?? 0) +
    (gpu?.tdpW ?? 0) +
    (mb?.tdpW ?? 30) +
    rams.reduce((acc, r) => acc + (r.tdpW ?? 5), 0) +
    storages.reduce((acc, s) => acc + (s.tdpW ?? 5), 0) +
    (cooler?.tdpW ?? 5) +
    build.fanCount * 3 +
    25; // headroom/peripherals

  const recommendedPsuWattage = Math.ceil((estimatedWattage * 1.35) / 50) * 50;

  if (psu && psu.wattage) {
    if (psu.wattage < estimatedWattage) {
      issues.push({
        severity: 'error',
        code: 'PSU_INSUFFICIENT_WATTAGE',
        message: `PSU tidak memiliki kapasitas yang disarankan. (${psu.wattage}W < kebutuhan sistem ${estimatedWattage}W).`,
        involvedCategories: ['psu'],
      });
    } else if (psu.wattage < recommendedPsuWattage) {
      issues.push({
        severity: 'warning',
        code: 'PSU_LOW_HEADROOM',
        message: `PSU ${psu.wattage}W di bawah rekomendasi aman ${recommendedPsuWattage}W.`,
        involvedCategories: ['psu'],
      });
    }
    if (gpu && (gpu.pciePowerPins ?? 0) > (psu.pciePowerPins ?? 0)) {
      issues.push({
        severity: 'error',
        code: 'PSU_MISSING_PCIE_PINS',
        message: `PSU ${psu.model} kekurangan konektor daya PCIe untuk ${gpu.model}.`,
        involvedCategories: ['psu', 'gpu'],
      });
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
