import rawCatalog from '../data/hardwareCatalog.json';
import { ComponentCategory, HardwareItem } from '../types/game';

export const HARDWARE_CATALOG: HardwareItem[] = rawCatalog as HardwareItem[];

const ITEM_MAP = new Map<string, HardwareItem>(
  HARDWARE_CATALOG.map((item) => [item.id, item])
);

export function getHardwareItem(id: string | null | undefined): HardwareItem | null {
  if (!id) return null;
  return ITEM_MAP.get(id) ?? null;
}

export function getHardwareByCategory(category: ComponentCategory): HardwareItem[] {
  return HARDWARE_CATALOG.filter((item) => item.category === category);
}

export function formatIDR(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString('id-ID');
  return rounded < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function getCategoryLabel(category: ComponentCategory, lang: 'id' | 'en' = 'id'): string {
  if (lang === 'en') {
    const labels: Record<ComponentCategory, string> = {
      cpu: 'Processor (CPU)',
      motherboard: 'Motherboard',
      ram: 'Memory (RAM)',
      storage: 'Storage (SSD/HDD)',
      gpu: 'Graphics Card (GPU)',
      psu: 'Power Supply (PSU)',
      case: 'PC Case',
      cooler: 'CPU Cooler',
      fan: 'Case Fan',
      consumable: 'Consumables',
      addon: 'Add-on & Expansion',
      peripheral: 'External Peripherals',
    };
    return labels[category];
  }
  const labelsId: Record<ComponentCategory, string> = {
    cpu: 'Prosesor (CPU)',
    motherboard: 'Motherboard',
    ram: 'Memori (RAM)',
    storage: 'Penyimpanan (SSD/HDD)',
    gpu: 'Kartu Grafis (GPU)',
    psu: 'Power Supply (PSU)',
    case: 'Casing PC',
    cooler: 'Pendingin CPU',
    fan: 'Kipas Casing',
    consumable: 'Bahan Habis Pakai',
    addon: 'Komponen Tambahan',
    peripheral: 'Perangkat Eksternal',
  };
  return labelsId[category];
}

export function formatItemSpecsSummary(item: HardwareItem, lang: 'id' | 'en' = 'id'): string[] {
  const specs: string[] = [];
  if (item.category === 'cpu') {
    if (item.socket) specs.push(`Socket ${item.socket}`);
    if (item.cores && item.threads) specs.push(`${item.cores}C/${item.threads}T`);
    if (item.baseClockGHz && item.boostClockGHz) specs.push(`${item.baseClockGHz}-${item.boostClockGHz} GHz`);
    if (item.l3CacheMB) specs.push(`L3 ${item.l3CacheMB}MB`);
    if (item.tdpW) specs.push(`TDP ${item.tdpW}W`);
    specs.push(item.hasIntegratedGraphics ? 'iGPU Ready' : lang === 'en' ? 'No iGPU' : 'Tanpa iGPU');
  } else if (item.category === 'motherboard') {
    if (item.socket) specs.push(item.socket);
    if (item.formFactor) specs.push(item.formFactor);
    if (item.ramType) specs.push(`${item.ramType} (${item.ramSlots ?? 2} slot, max ${item.maxRamGB ?? 64}GB)`);
    if (item.m2Slots !== undefined) specs.push(`M.2 x${item.m2Slots} · SATA x${item.sataPorts ?? 4}`);
    if (item.vrmPhases) specs.push(`VRM ${item.vrmPhases}`);
  } else if (item.category === 'ram') {
    if (item.ramType) specs.push(item.ramType);
    if (item.capacityGB) specs.push(`${item.capacityGB}GB (${item.modules ?? 1}x)`);
    if (item.speedMHz) specs.push(`${item.speedMHz} MHz`);
    if (item.latencyCL) specs.push(`CL${item.latencyCL}`);
  } else if (item.category === 'gpu') {
    if (item.vramGB) specs.push(`${item.vramGB}GB ${item.memoryType ?? 'GDDR6'}`);
    if (item.boostClockMHz) specs.push(`Boost ${item.boostClockMHz} MHz`);
    if (item.tdpW) specs.push(`TDP ${item.tdpW}W`);
    if (item.lengthMm) specs.push(`${item.lengthMm}mm`);
    specs.push((item.pciePowerPins ?? 0) > 0 ? `${item.pciePowerPins}-Pin PCIe` : 'Slot Power');
  } else if (item.category === 'storage') {
    if (item.capacityGB) specs.push(item.capacityGB >= 1000 ? `${item.capacityGB / 1000}TB` : `${item.capacityGB}GB`);
    if (item.storageFormFactor) specs.push(item.storageFormFactor);
    if (item.pcieGen) specs.push(item.pcieGen);
    if (item.readMBps && item.writeMBps) specs.push(`R/W ${item.readMBps}/${item.writeMBps} MB/s`);
  } else if (item.category === 'psu') {
    if (item.wattage) specs.push(`${item.wattage}W`);
    if (item.efficiencyRating) specs.push(item.efficiencyRating);
    if (item.psuFormFactor) specs.push(item.psuFormFactor);
    if (item.pciePowerPins !== undefined) specs.push(`PCIe ${item.pciePowerPins}-Pin`);
  } else if (item.category === 'case') {
    if (item.caseSizeClass) specs.push(item.caseSizeClass);
    if (item.supportedFormFactors) specs.push(item.supportedFormFactors.join('/'));
    if (item.maxGpuLengthMm) specs.push(`Max GPU ${item.maxGpuLengthMm}mm`);
    if (item.maxCoolerHeightMm) specs.push(`Max Cooler ${item.maxCoolerHeightMm}mm`);
    if (item.radiatorSupportMm?.length) specs.push(`Rad ${item.radiatorSupportMm.join('/')}mm`);
  } else if (item.category === 'cooler') {
    if (item.isLiquidCooler && item.radiatorSizeMm) specs.push(`AIO ${item.radiatorSizeMm}mm`);
    else if (item.heightMm) specs.push(`Air ${item.heightMm}mm`);
    if (item.coolingCapacityW) specs.push(`Cap ${item.coolingCapacityW}W`);
    if (item.supportedSockets) specs.push(item.supportedSockets.join(', '));
  } else {
    specs.push(item.generation);
    if (item.tdpW) specs.push(`${item.tdpW}W`);
  }
  return specs;
}
