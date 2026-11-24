import {
  BusinessLevel,
  CustomerArchetype,
  CustomerProfile,
  Difficulty,
  FaultType,
  GameState,
  InventoryEntry,
  Language,
  LeaderboardCategory,
  LeaderboardRecord,
  LeaderboardSeason,
  OrderType,
  OSType,
  WorkshopOrder,
  WorkshopUpgrade,
} from '../types/game';
import { evaluateCompatibility } from './compatibilityEngine';
import { buildCustomerBrokenPC } from './diagnosticsEngine';
import { getHardwareItem } from './hardwareDatabase';
import { createEmptyPCBuild, runPOST } from './simulationEngine';
import { createDefaultTutorialState, createTutorialStarterOrder } from './tutorialEngine';

// Fair identical starting capital & assets per competition rules
export const COMPETITIVE_STARTING_CAPITAL_IDR = 15_000_000;

export function getStartingCapital(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 20_000_000;
  if (difficulty === 'hard') return 10_000_000;
  return COMPETITIVE_STARTING_CAPITAL_IDR;
}

export const DEFAULT_UPGRADES: WorkshopUpgrade[] = [
  {
    id: 'upg_pro_tools',
    name: 'Pro Precision Screwdriver & ESD Kit',
    category: 'tools',
    description: 'Magnetic precision driver kit & anti-static wrist strap that speeds up workbench prep.',
    cost: 850_000,
    assetValue: 650_000,
    minLevel: 1,
    purchased: false,
    effectSummary: '+5% build quality reputation bonus',
  },
  {
    id: 'upg_thermal_cam',
    name: 'FLIR Thermal Imaging Camera',
    category: 'tools',
    description: 'High-accuracy IR thermal probe for instant hotspot & VRM diagnostics.',
    cost: 1_800_000,
    assetValue: 1_400_000,
    minLevel: 1,
    purchased: false,
    effectSummary: 'Unlock precision thermal inspection bonus',
  },
  {
    id: 'upg_workbench_pro',
    name: 'Pro Dual-Rail Assembly Workbench',
    category: 'workshop',
    description: 'Upgraded illuminated carbon-steel assembly bench with overhead LED bar.',
    cost: 3_500_000,
    assetValue: 2_800_000,
    minLevel: 2,
    purchased: false,
    effectSummary: 'Visually upgrades main workbench + higher customer trust',
  },
  {
    id: 'upg_lighting_studio',
    name: 'Studio LED & Showcase Lighting',
    category: 'workshop',
    description: 'Architectural blue accent strips and high-CRI overhead workshop fixtures.',
    cost: 2_200_000,
    assetValue: 1_750_000,
    minLevel: 1,
    purchased: false,
    effectSummary: 'Brighter workshop ambiance + faster customer arrivals',
  },
  {
    id: 'upg_testing_rig',
    name: 'Dual-Monitor Burn-In Testing Station',
    category: 'workshop',
    description: 'Dedicated high-refresh testing station with automated load validation.',
    cost: 4_200_000,
    assetValue: 3_400_000,
    minLevel: 2,
    purchased: false,
    effectSummary: '+10% labor payout on benchmarked builds',
  },
  {
    id: 'upg_storage_rack',
    name: 'Expanded Component Storage Racks',
    category: 'business',
    description: 'Extra shelving & climate-controlled cabinet for bulk parts stock.',
    cost: 2_800_000,
    assetValue: 2_200_000,
    minLevel: 2,
    purchased: false,
    effectSummary: 'Allows holding up to 6 simultaneous active orders',
  },
  {
    id: 'upg_vip_contracts',
    name: 'Enterprise & Creator Supplier Tier',
    category: 'business',
    description: 'Unlocks corporate workstation contracts and flagship RTX 4080 / Core i9 clients.',
    cost: 6_500_000,
    assetValue: 5_000_000,
    minLevel: 3,
    purchased: false,
    effectSummary: 'Attracts high-budget enthusiast & business orders',
  },
];

export function getBusinessLevelTitle(level: BusinessLevel, lang: Language = 'id'): string {
  if (lang === 'en') {
    const titles: Record<BusinessLevel, string> = {
      1: 'New Technician',
      2: 'Local Repair Shop',
      3: 'Trusted Technician',
      4: 'Professional Workshop',
      5: 'Established PC Business',
    };
    return titles[level];
  }
  const titlesId: Record<BusinessLevel, string> = {
    1: 'Teknisi Pemula',
    2: 'Bengkel Lokal',
    3: 'Teknisi Terpercaya',
    4: 'Bengkel Profesional',
    5: 'Bisnis PC Ternama',
  };
  return titlesId[level];
}

export function calculateBusinessLevel(reputation: number, completedOrders: number): BusinessLevel {
  if (reputation >= 85 && completedOrders >= 20) return 5;
  if (reputation >= 65 && completedOrders >= 12) return 4;
  if (reputation >= 45 && completedOrders >= 6) return 3;
  if (reputation >= 30 && completedOrders >= 2) return 2;
  return 1;
}

export function calculateInventoryAssetValue(inventory: InventoryEntry[]): number {
  let total = 0;
  for (const entry of inventory) {
    if (entry.quantity <= 0) continue;
    const item = getHardwareItem(entry.itemId);
    if (item) {
      total += item.purchasePrice * entry.quantity;
    }
  }
  return total;
}

export function calculateInstalledBuildAssetValue(state: GameState): number {
  // Only count player-owned parts installed in sandboxPC or player-funded assembly builds (no double-counting with inventory)
  const countBuild = (build: GameState['sandboxPC']): number => {
    const ids = [
      build.caseId,
      build.motherboardId,
      build.cpuId,
      build.coolerId,
      build.gpuId,
      build.psuId,
      ...build.ramIds,
      ...build.storageIds,
    ];
    return ids.reduce((sum, id) => {
      const item = getHardwareItem(id);
      return sum + (item ? item.purchasePrice : 0);
    }, 0);
  };

  let val = countBuild(state.sandboxPC);
  for (const order of state.orders) {
    if (
      (order.status === 'Accepted' ||
        order.status === 'In Progress' ||
        order.status === 'Waiting for Parts' ||
        order.status === 'Testing' ||
        order.status === 'Completed') &&
      (order.type === 'PC Assembly' || order.type === 'Custom Gaming PC')
    ) {
      val += countBuild(order.pcBuild);
    }
  }
  return val;
}

export function calculateNetWorth(state: GameState): {
  cash: number;
  inventoryValue: number;
  equipmentValue: number;
  upgradesValue: number;
  workInProgressValue: number;
  debt: number;
  totalNetWorth: number;
} {
  const cash = Math.round(state.cash);
  const inventoryValue = Math.round(calculateInventoryAssetValue(state.inventory));
  const equipmentValue = 2_500_000; // Base starter workbench + diagnostic equipment valuation
  const upgradesValue = state.upgrades
    .filter((u) => u.purchased)
    .reduce((sum, u) => sum + u.assetValue, 0);
  const workInProgressValue = Math.round(calculateInstalledBuildAssetValue(state));
  const debt = Math.round(state.outstandingDebt);

  const totalNetWorth =
    cash + inventoryValue + equipmentValue + upgradesValue + workInProgressValue - debt;

  return {
    cash,
    inventoryValue,
    equipmentValue,
    upgradesValue,
    workInProgressValue,
    debt,
    totalNetWorth,
  };
}

export function createInitialGameState(
  workshopName: string,
  playerUsername: string,
  difficulty: Difficulty,
  lang: Language = 'id'
): GameState {
  const starterInventory: InventoryEntry[] = [
    { itemId: 'case_budget_matx', quantity: 1 },
    { itemId: 'mb_h510m', quantity: 1 },
    { itemId: 'cpu_i3_10100', quantity: 1 },
    { itemId: 'ram_ddr4_8', quantity: 2 },
    { itemId: 'sto_sata_500', quantity: 1 },
    { itemId: 'gpu_gtx1650', quantity: 1 },
    { itemId: 'psu_450w', quantity: 1 },
    { itemId: 'cool_stock', quantity: 2 },
    { itemId: 'cons_paste', quantity: 3 },
  ];

  const initialState: GameState = {
    version: 2,
    saveSlotId: 'slot_1',
    workshopName: workshopName.trim() || 'Garuda Tech Workshop',
    playerUsername: playerUsername.trim() || 'Teknisi',
    difficulty,
    cash: getStartingCapital(difficulty),
    totalRevenue: 0,
    totalExpenses: 0,
    outstandingDebt: 0,
    reputation: 20,
    businessLevel: 1,
    completedOrdersCount: 0,
    satisfactionHistory: [],
    day: 1,
    minuteOfDay: 480, // 08:00
    timeSpeed: 1,
    inventory: starterInventory,
    pendingDeliveries: [],
    orders: [],
    activeOrderId: null,
    upgrades: DEFAULT_UPGRADES.map((u) => ({ ...u })),
    transactions: [],
    dailyReports: [],
    notifications: [
      {
        id: 'notif_welcome',
        title: lang === 'en' ? 'Workshop Open for Business' : 'Bengkel Resmi Dibuka!',
        message:
          lang === 'en'
            ? 'Check the Reception Desk for incoming customers, or follow the interactive tutorial.'
            : 'Periksa Meja Resepsionis untuk melayani pelanggan pertama atau ikuti panduan tutorial interaktif.',
        kind: 'info',
        day: 1,
        timeStr: '08:00',
      },
    ],
    sandboxPC: createEmptyPCBuild('case_budget_matx'),
    tutorialState: createDefaultTutorialState(true),
  };

  // Seed starter tutorial assembly order + 1 diagnostic repair order so gameplay starts immediately
  initialState.orders = [
    createTutorialStarterOrder(1, lang),
    generateCustomerOrder(initialState, 2, 'PC Repair', lang),
  ];

  return initialState;
}

const MALE_NAMES = [
  'Andi Pratama',
  'Budi Santoso',
  'Rizky Ramadhan',
  'Fajar Nugroho',
  'Kevin Tanoto',
  'Dimas Saputra',
  'Hendra Gunawan',
  'Pak Bambang',
];

const FEMALE_NAMES = [
  'Siti Rahmawati',
  'Nadia Kusuma',
  'Dewi Lestari',
  'Clara Wijaya',
  'Putri Handayani',
  'Hana Salsabila',
  'Rina Kartika',
  'Ibu Ratna',
];

const AVATAR_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

export function generateCustomerOrder(
  state: GameState,
  seedOffset = 0,
  forcedType?: OrderType,
  lang: Language = 'id'
): WorkshopOrder {
  const seed = state.day * 100 + state.orders.length * 17 + seedOffset * 7 + Math.floor(state.minuteOfDay);
  const pick = <T,>(arr: T[], offset = 0): T => arr[(seed + offset) % arr.length];

  const archetypes: CustomerArchetype[] = [
    'Office Worker',
    'Student',
    'Casual Gamer',
    'Professional Gamer',
    'Content Creator',
    'Business Owner',
    'PC Enthusiast',
    'Budget Customer',
    'Older Customer',
    'Female Customer',
  ];

  const orderTypes: OrderType[] =
    state.businessLevel >= 2
      ? ['PC Assembly', 'PC Repair', 'Hardware Upgrade', 'OS Installation', 'Troubleshooting', 'Maintenance', 'Custom Gaming PC']
      : ['PC Repair', 'PC Assembly', 'OS Installation', 'Hardware Upgrade', 'Maintenance'];

  const type = forcedType ?? pick(orderTypes, 3);
  const archetype = pick(archetypes, 1);
  const isFemale = archetype === 'Female Customer' || (archetype !== 'Older Customer' && seed % 2 === 1);
  const name = isFemale ? pick(FEMALE_NAMES, 2) : pick(MALE_NAMES, 2);
  const personalities: CustomerProfile['personality'][] = ['Patient', 'Impatient', 'Detail-Oriented', 'Friendly', 'Frugal'];
  const knowledgeLevels: CustomerProfile['technicalKnowledge'][] = ['Low', 'Medium', 'High'];

  const customer: CustomerProfile = {
    id: `cust_${seed}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    archetype,
    avatarColor: pick(AVATAR_COLORS, 4),
    personality: pick(personalities, 5),
    technicalKnowledge: pick(knowledgeLevels, 2),
    patience: 75 + (seed % 25),
    satisfaction: 80,
    gender: isFemale ? 'female' : 'male',
    appearanceVariant: seed % 4,
  };

  const orderNumber = `ORD-${String(state.day).padStart(2, '0')}${String(state.orders.length + 1 + seedOffset).padStart(2, '0')}`;
  const isEn = lang === 'en';

  if (type === 'PC Assembly' || type === 'Custom Gaming PC') {
    const isGaming = type === 'Custom Gaming PC' || state.businessLevel >= 2;
    const highTier = isGaming && state.businessLevel >= 3;
    const minCpuScore = highTier ? 12000 : isGaming ? 8000 : 3800;
    const minGpuScore = highTier ? 13000 : isGaming ? 5000 : 0;
    const minRamGB = highTier ? 32 : 16;
    const minStorageGB = highTier ? 1000 : 500;
    const partsAllowance = highTier ? 22_000_000 : isGaming ? 11_500_000 : 6_200_000;
    const laborReward = highTier ? 1_800_000 : isGaming ? 950_000 : 550_000;
    const requiredOS: OSType = pick(['Windows 11', 'Windows 10', 'Ubuntu'], 1);

    return {
      id: `order_${Date.now()}_${seedOffset}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customer,
      type,
      title: isEn
        ? highTier
          ? 'Enthusiast Custom Gaming Build'
          : isGaming
          ? 'Budget Gaming PC Assembly'
          : 'Compact Office PC Build'
        : highTier
        ? 'Rakitan PC Gaming Kelas Atas'
        : isGaming
        ? 'Rakitan PC Gaming Ekonomis'
        : 'Rakitan PC Kantor Ringkas',
      description: isEn
        ? `Assemble a compatible ${isGaming ? 'gaming' : 'office'} PC with >=${minRamGB}GB RAM, >=${minStorageGB}GB storage, ${requiredOS}, drivers, and verified benchmark.`
        : `Rakit PC ${isGaming ? 'gaming' : 'kantor'} yang kompatibel dengan RAM minimal ${minRamGB}GB, penyimpanan minimal ${minStorageGB}GB, instal ${requiredOS}, seluruh driver, dan lolos uji benchmark.`,
      dialogue: isEn
        ? isGaming
          ? `"Hi! I want a custom gaming PC that handles modern games smoothly. Please install ${requiredOS}, drivers, and test thermals!"`
          : `"Hello, I need an inexpensive office PC for spreadsheets and browsing with ${requiredOS} ready to use."`
        : isGaming
        ? `"Halo! Saya mau rakit PC gaming kustom yang lancar main game modern. Tolong pasang ${requiredOS}, semua driver, dan uji suhunya ya!"`
        : `"Permisi, saya butuh PC kantor yang stabil untuk kerja dan browsing dengan ${requiredOS} siap pakai."`,
      requirements: {
        minCpuScore,
        minGpuScore,
        minRamGB,
        minStorageGB,
        requiredOS,
        requireDrivers: true,
        requireBenchmark: true,
      },
      budget: partsAllowance + laborReward + 1_500_000,
      laborReward,
      partsAllowance,
      deadlineDay: state.day + (highTier ? 3 : 2),
      createdDay: state.day,
      difficulty: highTier ? 'Hard' : isGaming ? 'Medium' : 'Easy',
      status: 'New',
      pcBuild: createEmptyPCBuild(null),
      usedDiagnosticTools: [],
      discoveredClues: [],
    };
  }

  if (type === 'OS Installation') {
    const targetOS: OSType = pick(['Windows 10', 'Windows 11', 'Linux Mint', 'Ubuntu'], 2);
    const pc = buildCustomerBrokenPC(['corrupted_os', 'missing_drivers'], 'budget');
    return {
      id: `order_${Date.now()}_${seedOffset}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customer,
      type,
      title: isEn ? `Fresh ${targetOS} & Driver Setup` : `Instalasi Bersih ${targetOS} & Driver`,
      description: isEn
        ? `Prepare bootable USB, enter BIOS, partition drive, install ${targetOS}, and install all 6 driver categories.`
        : `Siapkan USB bootable, atur BIOS, buat & format partisi, instal ${targetOS}, serta pasang seluruh 6 kategori driver.`,
      dialogue: isEn
        ? `"My PC keeps crashing at startup. Please do a clean install of ${targetOS} with all drivers working!"`
        : `"PC saya sering crash saat baru dinyalakan. Tolong instal ulang bersih ${targetOS} beserta seluruh drivernya!"`,
      requirements: {
        requiredOS: targetOS,
        requireDrivers: true,
        fixAllFaults: true,
      },
      budget: 600_000,
      laborReward: 380_000,
      partsAllowance: 0,
      deadlineDay: state.day + 1,
      createdDay: state.day,
      difficulty: 'Easy',
      status: 'New',
      pcBuild: pc,
      usedDiagnosticTools: [],
      discoveredClues: [],
    };
  }

  if (type === 'Hardware Upgrade') {
    const pc = buildCustomerBrokenPC([], 'budget');
    pc.ramIds = ['ram_ddr4_8']; // single 8GB stick
    return {
      id: `order_${Date.now()}_${seedOffset}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customer,
      type,
      title: isEn ? 'RAM Dual-Channel Upgrade (16GB+)' : 'Upgrade RAM Dual-Channel (16GB+)',
      description: isEn
        ? 'Upgrade customer PC memory to at least 16GB dual-channel DDR4 and verify stability.'
        : 'Tingkatkan memori PC pelanggan hingga minimal 16GB DDR4 dual-channel dan pastikan lolos uji stabilitas.',
      dialogue: isEn
        ? '"Can you upgrade my RAM to 16GB so multitasking and editing feel much faster?"'
        : '"Bisa tolong upgrade RAM PC saya ke 16GB supaya multitasking dan edit tugas lebih ngebut?"',
      requirements: {
        minRamGB: 16,
        requireBenchmark: true,
      },
      budget: 1_200_000,
      laborReward: 320_000,
      partsAllowance: 430_000,
      deadlineDay: state.day + 2,
      createdDay: state.day,
      difficulty: 'Easy',
      status: 'New',
      pcBuild: pc,
      usedDiagnosticTools: [],
      discoveredClues: [],
    };
  }

  // PC Repair / Troubleshooting / Maintenance
  const faultCombos: FaultType[][] = [
    ['loose_ram', 'overheating_paste'],
    ['loose_cables', 'bios_misconfig'],
    ['faulty_psu'],
    ['damaged_connector', 'missing_drivers'],
    ['bootloader_failure'],
    ['cooler_failure', 'overheating_paste'],
    ['faulty_storage', 'corrupted_os'],
  ];
  const chosenFaults = pick(faultCombos, 5);
  const pc = buildCustomerBrokenPC(chosenFaults, state.businessLevel >= 2 ? 'mid' : 'budget');
  const laborReward = 350_000 + chosenFaults.length * 140_000;
  const partsAllowance = chosenFaults.includes('faulty_psu')
    ? 700_000
    : chosenFaults.includes('faulty_storage')
    ? 820_000
    : chosenFaults.includes('cooler_failure')
    ? 250_000
    : 100_000;

  return {
    id: `order_${Date.now()}_${seedOffset}_${Math.random().toString(36).slice(2, 6)}`,
    orderNumber,
    customer,
    type,
    title: isEn
      ? type === 'Maintenance'
        ? 'Thermal Cleaning & Maintenance'
        : chosenFaults.includes('faulty_psu') || chosenFaults.includes('loose_cables')
        ? 'No-Power Computer Repair'
        : 'System Diagnostics & Repair'
      : type === 'Maintenance'
      ? 'Pembersihan & Perawatan Suhu'
      : chosenFaults.includes('faulty_psu') || chosenFaults.includes('loose_cables')
      ? 'Perbaikan PC Mati Total'
      : 'Diagnostik & Perbaikan Sistem',
    description: isEn
      ? 'Diagnose hidden hardware/software faults using workshop tools, fix every root cause, and pass POST & stability check.'
      : 'Diagnosa kerusakan tersembunyi dengan alat bengkel, perbaiki setiap sumber masalah, lalu pastikan lolos POST & uji stabilitas.',
    dialogue: isEn
      ? chosenFaults.includes('overheating_paste') || chosenFaults.includes('cooler_failure')
        ? '"My computer gets way too hot and shuts off after a few minutes!"'
        : chosenFaults.includes('faulty_psu') || chosenFaults.includes('loose_cables')
        ? '"My computer suddenly stopped turning on this morning. Please figure out what died!"'
        : '"Something is wrong with my PC — it refuses to boot properly. Can you diagnose and repair it?"'
      : chosenFaults.includes('overheating_paste') || chosenFaults.includes('cooler_failure')
      ? '"Komputer saya cepat sekali panas dan tiba-tiba mati sendiri setelah beberapa menit dipakai!"'
      : chosenFaults.includes('faulty_psu') || chosenFaults.includes('loose_cables')
      ? '"Komputer saya tiba-tiba mati total pagi ini dan tidak mau menyala. Tolong dicek kerusakannya ya!"'
      : '"PC saya bermasalah dan gagal masuk ke sistem operasi. Tolong didiagnosa dan diperbaiki!"',
    requirements: {
      fixAllFaults: true,
      requireBenchmark: type === 'Maintenance',
    },
    budget: laborReward + partsAllowance + 400_000,
    laborReward,
    partsAllowance,
    deadlineDay: state.day + 2,
    createdDay: state.day,
    difficulty: chosenFaults.length > 1 ? 'Medium' : 'Easy',
    status: 'New',
    pcBuild: pc,
    usedDiagnosticTools: [],
    discoveredClues: [],
  };
}

export function validateOrderCompletion(
  order: WorkshopOrder,
  lang: Language = 'id'
): {
  ready: boolean;
  reasons: string[];
  actualPartsCost: number;
} {
  const reasons: string[] = [];
  const build = order.pcBuild;
  const compat = evaluateCompatibility(build);
  const post = runPOST(build);
  const isEn = lang === 'en';

  if (!compat.compatible) {
    reasons.push(...compat.issues.filter((i) => i.severity === 'error').map((i) => i.message));
  }
  if (!post.passed) {
    reasons.push(isEn ? `PC failed POST: ${post.message}` : `PC gagal lolos POST: ${post.message}`);
  }
  if (build.sidePanelOpen) {
    reasons.push(isEn ? 'Close the PC side panel before delivery.' : 'Tutup panel samping casing PC sebelum diserahkan.');
  }

  const unresolvedFaults = build.faults.filter((f) => !f.resolved);
  if (order.requirements.fixAllFaults && unresolvedFaults.length > 0) {
    reasons.push(
      isEn
        ? `Unresolved fault(s): ${unresolvedFaults.map((f) => f.label).join(', ')}`
        : `Kerusakan belum selesai: ${unresolvedFaults.length} masalah tersisa`
    );
  }

  const cpu = getHardwareItem(build.cpuId);
  const gpu = getHardwareItem(build.gpuId);

  if (order.requirements.minCpuScore && (cpu?.performanceScore ?? 0) < order.requirements.minCpuScore) {
    reasons.push(
      isEn
        ? `CPU performance below customer requirement (${cpu?.performanceScore ?? 0} < ${order.requirements.minCpuScore}).`
        : `Performa CPU di bawah syarat pelanggan (${cpu?.performanceScore ?? 0} < ${order.requirements.minCpuScore}).`
    );
  }
  if (order.requirements.minGpuScore && (gpu?.performanceScore ?? 0) < order.requirements.minGpuScore) {
    reasons.push(
      isEn
        ? `GPU performance below customer requirement (${gpu?.performanceScore ?? 0} < ${order.requirements.minGpuScore}).`
        : `Performa GPU di bawah syarat pelanggan (${gpu?.performanceScore ?? 0} < ${order.requirements.minGpuScore}).`
    );
  }
  if (order.requirements.minRamGB && compat.totalRamGB < order.requirements.minRamGB) {
    reasons.push(
      isEn
        ? `RAM capacity below requirement (${compat.totalRamGB}GB < ${order.requirements.minRamGB}GB).`
        : `Kapasitas RAM kurang dari permintaan (${compat.totalRamGB}GB < ${order.requirements.minRamGB}GB).`
    );
  }
  if (order.requirements.minStorageGB && compat.totalStorageGB < order.requirements.minStorageGB) {
    reasons.push(
      isEn
        ? `Storage capacity below requirement (${compat.totalStorageGB}GB < ${order.requirements.minStorageGB}GB).`
        : `Kapasitas penyimpanan kurang (${compat.totalStorageGB}GB < ${order.requirements.minStorageGB}GB).`
    );
  }
  if (order.requirements.requiredOS) {
    if (build.osState.installedOS !== order.requirements.requiredOS || !build.osState.setupCompleted || build.osState.corrupted) {
      reasons.push(
        isEn
          ? `Operating system ${order.requirements.requiredOS} must be cleanly installed.`
          : `Sistem operasi ${order.requirements.requiredOS} harus diinstal dengan benar.`
      );
    }
  }
  if (order.requirements.requireDrivers) {
    const missingDrivers = Object.entries(build.drivers)
      .filter(([, installed]) => !installed)
      .map(([k]) => k);
    if (missingDrivers.length > 0) {
      reasons.push(
        isEn
          ? `Missing drivers: ${missingDrivers.join(', ')}.`
          : `Driver belum lengkap (${missingDrivers.join(', ')}).`
      );
    }
  }
  if (order.requirements.requireBenchmark) {
    if (!build.benchmarks || !build.benchmarks.stabilityPassed) {
      reasons.push(
        isEn
          ? 'Run a passing Stability & Benchmark test on the OS Desktop.'
          : 'Jalankan Uji Stabilitas & Benchmark di Desktop OS hingga lulus.'
      );
    }
  }

  // Calculate installed parts sell value for new builds or upgrades
  let actualPartsCost = 0;
  if (order.type === 'PC Assembly' || order.type === 'Custom Gaming PC') {
    const partIds = [
      build.caseId,
      build.motherboardId,
      build.cpuId,
      build.coolerId,
      build.gpuId,
      build.psuId,
      ...build.ramIds,
      ...build.storageIds,
    ];
    for (const id of partIds) {
      const item = getHardwareItem(id);
      if (item) actualPartsCost += item.sellingPrice;
    }
  } else if (order.type === 'Hardware Upgrade') {
    actualPartsCost = order.partsAllowance;
  } else if (order.type === 'PC Repair' || order.type === 'Troubleshooting') {
    actualPartsCost = order.partsAllowance;
  }

  return {
    ready: reasons.length === 0,
    reasons,
    actualPartsCost,
  };
}

export function sortLeaderboardRecords(
  records: LeaderboardRecord[],
  category: LeaderboardCategory,
  season: LeaderboardSeason
): LeaderboardRecord[] {
  const filtered = records.filter((r) => r.season === season || season === 'all_time');
  // Deduplicate by username + workshopName when combining into all_time view, picking best metrics
  const byPlayer = new Map<string, LeaderboardRecord>();
  for (const rec of filtered) {
    const key = `${rec.username.toLowerCase()}::${rec.workshopName.toLowerCase()}`;
    const existing = byPlayer.get(key);
    if (!existing || rec.netWorth >= existing.netWorth) {
      byPlayer.set(key, rec);
    }
  }

  const list = Array.from(byPlayer.values());
  const metric = (r: LeaderboardRecord): number => {
    switch (category) {
      case 'net_worth':
        return r.netWorth;
      case 'total_revenue':
        return r.totalRevenue;
      case 'net_profit':
        return r.netProfit;
      case 'completed_orders':
        return r.completedOrders;
      case 'satisfaction':
        return r.avgSatisfaction;
      case 'reputation':
        return r.reputation;
    }
  };

  return list.sort((a, b) => metric(b) - metric(a));
}
