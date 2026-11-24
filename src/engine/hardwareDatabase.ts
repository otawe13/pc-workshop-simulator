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
  };
  return labelsId[category];
}

