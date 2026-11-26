import {
  AssemblyStageId,
  GameState,
  Language,
  StationId,
  TutorialChapterId,
  TutorialState,
  WorkshopOrder,
} from '../types/game';
import { evaluateCompatibility } from './compatibilityEngine';
import { validateOrderCompletion } from './businessEngine';
import { createEmptyPCBuild, runPOST } from './simulationEngine';
import { evaluateNetworkHealth } from './virtualOsEngine';

export interface TutorialChapterMeta {
  index: number;
  id: TutorialChapterId;
  title: Record<Language, string>;
  instruction: Record<Language, string>;
  whyItMatters: Record<Language, string>;
  targetStation: StationId;
  beaconWorldPos: [number, number, number];
  hintAssemblyStage?: AssemblyStageId;
}

export const TUTORIAL_REWARD_CASH_IDR = 500_000;
export const TUTORIAL_REWARD_REPUTATION = 5;

export const TUTORIAL_CHAPTERS: TutorialChapterMeta[] = [
  {
    index: 0,
    id: 'welcome',
    title: {
      id: 'Bab 1: Pengenalan Bengkel',
      en: 'Chapter 1: Workshop Introduction',
    },
    instruction: {
      id: 'Putar atau geser kamera (drag layar / WASD) lalu kunjungi Meja Resepsionis atau stasiun lain untuk mengenal area bengkel.',
      en: 'Orbit or pan the camera (drag / WASD) and click Reception or another workstation to explore your shop.',
    },
    whyItMatters: {
      id: 'Bengkel terbagi atas area Resepsionis, Meja Perakitan, Meja Perbaikan, Layar Uji OS, dan Komputer Bisnis.',
      en: 'Your shop has dedicated areas for Reception, Assembly, Repair, Testing OS, and Business management.',
    },
    targetStation: 'reception',
    beaconWorldPos: [-3.6, 2.0, 2.2],
  },
  {
    index: 1,
    id: 'parts_recognition',
    title: {
      id: 'Bab 2: Mengenal Komponen PC',
      en: 'Chapter 2: Recognizing PC Parts',
    },
    instruction: {
      id: 'Buka Meja Perakitan atau klik salah satu komponen 3D pada PC untuk melihat spesifikasi & edukasi perangkat keras.',
      en: 'Open the Workbench or click a 3D PC component to inspect specs and hardware education notes.',
    },
    whyItMatters: {
      id: 'Memahami soket CPU, tipe RAM (DDR4/DDR5), panjang GPU, serta daya PSU mencegah kesalahan saat belanja maupun merakit.',
      en: 'Knowing CPU sockets, DDR generations, GPU length, and PSU wattage avoids costly assembly errors.',
    },
    targetStation: 'workbench',
    beaconWorldPos: [0.45, 1.9, -0.35],
  },
  {
    index: 2,
    id: 'customer',
    title: {
      id: 'Bab 3: Menerima Pesanan Pelanggan',
      en: 'Chapter 3: Accepting Customer Orders',
    },
    instruction: {
      id: 'Buka Meja Resepsionis dan terima pesanan tutorial pertama dari Budi Santoso (klik "Terima Pesanan" lalu "Buka di Meja Rakit").',
      en: 'Open Reception and accept the starter customer order from Budi Santoso ("Accept Order" -> "Open at Workbench").',
    },
    whyItMatters: {
      id: 'Setiap pesanan mencantumkan anggaran, kebutuhan performa, sistem operasi, serta tenggat hari.',
      en: 'Each order specifies the client budget, minimum hardware specs, OS, and deadline.',
    },
    targetStation: 'reception',
    beaconWorldPos: [-3.6, 2.0, 2.2],
  },
  {
    index: 3,
    id: 'assembly',
    title: {
      id: 'Bab 4: Perakitan PC Langkah demi Langkah',
      en: 'Chapter 4: Step-by-Step PC Assembly',
    },
    instruction: {
      id: 'Di Meja Perakitan, pasang Casing, buka panel samping, lalu pasang Motherboard, CPU, Pasta & Cooler, 2x RAM, SSD, GPU, PSU, dan kabel utama.',
      en: 'At the Workbench, install Case, open side panel, mount Motherboard, CPU, Paste & Cooler, 2x RAM, SSD, GPU, PSU, and power cables.',
    },
    whyItMatters: {
      id: 'Cobalah juga fitur Exploded View & klik bagian 3D PC untuk memeriksa posisi tiap komponen secara visual.',
      en: 'You can also use the Exploded View slider and click 3D parts to verify installation cleanly.',
    },
    targetStation: 'workbench',
    beaconWorldPos: [0.45, 1.9, -0.35],
  },
  {
    index: 4,
    id: 'compatibility',
    title: {
      id: 'Bab 5: Cek Kompatibilitas & Daya',
      en: 'Chapter 5: Compatibility & Power Check',
    },
    instruction: {
      id: 'Periksa panel Status Kompatibilitas pada Meja Perakitan dan pastikan estimasi watt PSU mencukupi tanpa ada Error kompatibilitas.',
      en: 'Review the Compatibility Status on the Workbench and confirm zero compatibility errors and sufficient PSU headroom.',
    },
    whyItMatters: {
      id: 'Setiap error kompatibilitas di bengkel menampilkan penyebab dan saran perbaikan agar rakitan 100% aman.',
      en: 'Compatibility checks highlight both the root cause and suggested fix before powering on.',
    },
    targetStation: 'workbench',
    beaconWorldPos: [0.45, 1.9, -0.35],
    hintAssemblyStage: 'inspection',
  },
  {
    index: 5,
    id: 'diagnostics',
    title: {
      id: 'Bab 6: Diagnostik & Perbaikan',
      en: 'Chapter 6: Diagnostics & Troubleshooting',
    },
    instruction: {
      id: 'Kunjungi Meja Perbaikan atau periksa alat diagnostik bengkel (Obeng, Air Blower, Multimeter, Cable Tester, PSU Tester) lalu bersiap menyalakan PC.',
      en: 'Visit the Repair Bench to inspect workshop diagnostic tools (Screwdriver, Air Blower, Multimeter, Cable Tester, PSU Tester).',
    },
    whyItMatters: {
      id: 'Pesanan servis memiliki kerusakan tersembunyi seperti debu, pasta kering, kabel longgar, hingga gangguan IP jaringan.',
      en: 'Repair jobs contain hidden faults such as dust clogging, dried paste, loose cables, or IP network errors.',
    },
    targetStation: 'repair_table',
    beaconWorldPos: [3.6, 2.0, 2.0],
  },
  {
    index: 6,
    id: 'power_post',
    title: {
      id: 'Bab 7: Uji Nyala PC & POST',
      en: 'Chapter 7: Power On & POST',
    },
    instruction: {
      id: 'Pada Tahap 11 (Uji Nyala), hubungkan Kabel Monitor & Keyboard lalu tekan "Nyalakan PC & Buka Layar Uji" agar lolos POST.',
      en: 'On Stage 11, connect Monitor & Keyboard cables and power on the PC to pass POST.',
    },
    whyItMatters: {
      id: 'POST (Power-On Self-Test) memastikan CPU, RAM, GPU, kabel daya, dan suhu dalam keadaan sehat sebelum masuk BIOS.',
      en: 'POST verifies CPU, RAM, GPU, power headers, and thermals before booting an OS.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [0.45, 1.9, -0.35],
    hintAssemblyStage: 'first_boot',
  },
  {
    index: 7,
    id: 'os_install',
    title: {
      id: 'Bab 8: Instalasi Windows & OOBE',
      en: 'Chapter 8: Windows Setup & OOBE',
    },
    instruction: {
      id: 'Pasang USB Windows 11, masuk BIOS (USB urutan #1), buat & format partisi EFI + System, jalankan Windows Setup hingga OOBE selesai!',
      en: 'Insert Windows 11 USB, set USB #1 in BIOS, create & format EFI + System partitions, complete Windows Setup and OOBE.',
    },
    whyItMatters: {
      id: 'Proses instalasi lengkap meliputi pemilihan bahasa, partisi, penyalinan berkas, hingga konfigurasi akun OOBE.',
      en: 'Full setup covers language, partitioning, file copy, and OOBE account creation.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [3.8, 2.0, -2.8],
  },
  {
    index: 8,
    id: 'virtual_desktop',
    title: {
      id: 'Bab 9: Desktop Virtual & Driver',
      en: 'Chapter 9: Virtual Desktop & Drivers',
    },
    instruction: {
      id: 'Di Desktop Windows virtual, buka Manajer Driver untuk memasang seluruh 6 driver, lalu jalankan Uji Stabilitas Benchmark.',
      en: 'On the Virtual Windows Desktop, install all 6 hardware drivers in Driver Manager and run a Benchmark test.',
    },
    whyItMatters: {
      id: 'Tanpa driver Chipset, Grafis, dan Jaringan, performa GPU & koneksi internet belum bekerja optimal.',
      en: 'Installing Chipset, Graphics, and Network drivers unlocks full hardware speed and connectivity.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [3.8, 2.0, -2.8],
  },
  {
    index: 9,
    id: 'network_cmd',
    title: {
      id: 'Bab 10: Command Prompt & Jaringan',
      en: 'Chapter 10: Command Prompt & Network',
    },
    instruction: {
      id: 'Buka Command Prompt (CMD) atau Network Settings di Desktop virtual, jalankan "ipconfig" atau "ping 8.8.8.8", lalu serahkan pesanan di Resepsionis!',
      en: 'Open CMD or Network Settings on the Virtual Desktop, run "ipconfig" or "ping 8.8.8.8", and deliver the finished PC at Reception.',
    },
    whyItMatters: {
      id: 'Teknisi profesional selalu memverifikasi IP, Gateway, DNS, dan tes ping sebelum mengembalikan PC ke pelanggan.',
      en: 'Verifying IPv4, Gateway, DNS, and ping confirms the client can browse immediately.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [3.8, 2.0, -2.8],
  },
  {
    index: 10,
    id: 'business',
    title: {
      id: 'Bab 11: Manajemen Bisnis Bengkel',
      en: 'Chapter 11: Workshop Business Management',
    },
    instruction: {
      id: 'Buka Komputer Bisnis untuk melihat Toko Komponen, Harga Pasar Harian, Laporan Keuangan (Net Worth), Cloud Save, dan Papan Peringkat.',
      en: 'Open the Business Computer to explore the Parts Store, Daily Market Prices, Finances, Cloud Save, and Leaderboards.',
    },
    whyItMatters: {
      id: 'Mengelola margin keuntungan, stok komponen, dan upgrade bengkel menentukan pertumbuhan level bisnismu.',
      en: 'Managing profit margins, part stock, and upgrades grows your shop reputation and net worth.',
    },
    targetStation: 'business_pc',
    beaconWorldPos: [-3.4, 2.0, -2.8],
  },
];

export const TUTORIAL_TOTAL_CHAPTERS = TUTORIAL_CHAPTERS.length; // 11

export function createDefaultTutorialState(active = true): TutorialState {
  return {
    active,
    completed: !active,
    skipped: false,
    chapterIndex: active ? 0 : TUTORIAL_TOTAL_CHAPTERS - 1,
    rewardClaimed: !active,
    cameraMoved: !active,
    visitedStationCount: active ? 0 : 6,
    checkedBusinessPC: !active,
    checkedCompatibility: !active,
    checkedDiagnostics: !active,
    openedDesktop: !active,
    ranCmdCommand: !active,
    configuredNetwork: !active,
  };
}

export function createTutorialStarterOrder(day: number, lang: Language = 'id'): WorkshopOrder {
  const isEn = lang === 'en';
  return {
    id: `order_tutorial_starter_${day}`,
    orderNumber: 'ORD-0101',
    customer: {
      id: 'cust_tutorial_budi',
      name: 'Budi Santoso',
      archetype: 'Student',
      avatarColor: '#0ea5e9',
      personality: 'Friendly',
      technicalKnowledge: 'Low',
      patience: 98,
      satisfaction: 90,
      gender: 'male',
      appearanceVariant: 0,
    },
    type: 'PC Assembly',
    title: isEn ? 'Starter PC Build (Guided Tutorial)' : 'Rakit PC Perdana (Pesanan Panduan)',
    description: isEn
      ? 'Build a complete PC using your starter workshop stock: 16GB RAM, 500GB SSD, GTX 1650 GPU, Windows 11, all drivers, active network, and passing benchmark.'
      : 'Rakit PC lengkap memakai stok komponen awal bengkel: RAM 16GB, SSD 500GB, GPU GTX 1650, Windows 11, seluruh driver, jaringan aktif, dan lolos benchmark.',
    dialogue: isEn
      ? '"Hi technician! This is my first custom PC for college and light gaming. Please build it neatly with Windows 11!"'
      : '"Halo Kak Teknisi! Ini PC rakitan pertama saya untuk kuliah dan game ringan. Tolong dirakit rapi dengan Windows 11 ya!"',
    requirements: {
      minCpuScore: 3800,
      minGpuScore: 2500,
      minRamGB: 16,
      minStorageGB: 500,
      requiredOS: 'Windows 11',
      requireDrivers: true,
      requireBenchmark: true,
      requireNetworkReady: true,
    },
    budget: 9_200_000,
    laborReward: 650_000,
    partsAllowance: 6_800_000,
    deadlineDay: day + 4,
    createdDay: day,
    difficulty: 'Easy',
    status: 'New',
    pcBuild: createEmptyPCBuild(null),
    usedDiagnosticTools: [],
    discoveredClues: [],
    isTutorialOrder: true,
  };
}

export interface TutorialEvaluation {
  tutorial: TutorialState;
  currentChapter: TutorialChapterMeta;
  subHintId: string;
  subHintEn: string;
  targetStation: StationId;
  beaconWorldPos: [number, number, number];
  suggestedAssemblyStage?: AssemblyStageId;
  progressPercent: number;
  readyToClaimReward: boolean;
}

export function evaluateTutorialProgress(
  state: GameState,
  activeStation: StationId
): TutorialEvaluation {
  const tut = state.tutorialState ?? createDefaultTutorialState(false);

  const tutorialOrder =
    state.orders.find((o) => o.isTutorialOrder) ??
    state.orders.find((o) => o.id === state.activeOrderId) ??
    state.orders[0];

  const orderAccepted = Boolean(
    state.orders.some((o) => o.status !== 'New' && o.status !== 'Cancelled')
  );
  const orderDelivered = Boolean(
    tutorialOrder?.status === 'Delivered' || state.completedOrdersCount > 0
  );

  const activeBuild =
    state.orders.find((o) => o.id === state.activeOrderId)?.pcBuild ??
    tutorialOrder?.pcBuild ??
    state.sandboxPC;

  const compat = evaluateCompatibility(activeBuild);

  const assemblyReadyForPower = Boolean(
    activeBuild.caseId &&
      activeBuild.motherboardId &&
      activeBuild.cpuId &&
      activeBuild.cpuRetentionClosed &&
      activeBuild.thermalPasteApplied &&
      activeBuild.coolerId &&
      activeBuild.coolerSecured &&
      activeBuild.cpuFanConnected &&
      activeBuild.ramIds.length >= 2 &&
      activeBuild.storageIds.length >= 1 &&
      activeBuild.psuId &&
      activeBuild.atx24PinConnected &&
      activeBuild.cpu8PinConnected &&
      activeBuild.frontPanelConnected
  );

  const postPassed = runPOST(activeBuild).passed;
  const driversComplete = Object.values(activeBuild.drivers).every(Boolean);
  const osInstalled = Boolean(
    activeBuild.osState.setupCompleted &&
      activeBuild.osState.installedOS &&
      !activeBuild.osState.corrupted
  );
  const desktopComplete = Boolean(osInstalled && driversComplete && activeBuild.benchmarks?.stabilityPassed);
  const networkHealthy = evaluateNetworkHealth(activeBuild).online;

  // Track interactive milestone flags cleanly without resetting monotonic progress
  const checkedCompatibility = Boolean(tut.checkedCompatibility || (assemblyReadyForPower && compat.compatible));
  const checkedDiagnostics = Boolean(
    tut.checkedDiagnostics ||
      activeStation === 'repair_table' ||
      (tutorialOrder && tutorialOrder.usedDiagnosticTools.length > 0) ||
      postPassed
  );
  const openedDesktop = Boolean(tut.openedDesktop || osInstalled);
  const ranCmdCommand = Boolean(tut.ranCmdCommand || (desktopComplete && networkHealthy && orderDelivered));

  let nextChapter = Math.min(TUTORIAL_TOTAL_CHAPTERS - 1, Math.max(0, tut.chapterIndex));
  if (tut.active && !tut.completed && !tut.skipped) {
    if (nextChapter === 0 && (tut.visitedStationCount >= 1 || activeStation !== 'overview' || orderAccepted)) {
      nextChapter = 1;
    }
    if (nextChapter === 1 && (activeStation === 'workbench' || activeStation === 'reception' || orderAccepted)) {
      nextChapter = 2;
    }
    if (nextChapter === 2 && orderAccepted) {
      nextChapter = 3;
    }
    if (nextChapter === 3 && assemblyReadyForPower) {
      nextChapter = 4;
    }
    if (nextChapter === 4 && checkedCompatibility) {
      nextChapter = 5;
    }
    if (nextChapter === 5 && (checkedDiagnostics || activeBuild.poweredOn)) {
      nextChapter = 6;
    }
    if (nextChapter === 6 && postPassed && activeBuild.poweredOn) {
      nextChapter = 7;
    }
    if (nextChapter === 7 && osInstalled) {
      nextChapter = 8;
    }
    if (nextChapter === 8 && desktopComplete) {
      nextChapter = 9;
    }
    if (nextChapter === 9 && (orderDelivered || (ranCmdCommand && !activeBuild.sidePanelOpen))) {
      nextChapter = 10;
    }
  }

  const chapterMeta = TUTORIAL_CHAPTERS[nextChapter];

  let suggestedStage: AssemblyStageId | undefined = chapterMeta.hintAssemblyStage;
  let subHintId = chapterMeta.instruction.id;
  let subHintEn = chapterMeta.instruction.en;

  if (nextChapter === 3) {
    if (!activeBuild.caseId || !activeBuild.sidePanelOpen) {
      suggestedStage = 'preparation';
      subHintId = !activeBuild.caseId
        ? 'Tahap 1: Pasang Casing PC dari inventaris di panel Meja Perakitan.'
        : 'Tahap 1: Klik "Buka Panel Samping" agar komponen dalam bisa dipasang.';
      subHintEn = !activeBuild.caseId
        ? 'Stage 1: Install the PC Case from inventory at the Workbench.'
        : 'Stage 1: Click "Open Side Panel" to access the interior.';
    } else if (!activeBuild.motherboardId || !activeBuild.motherboardScrewsSecured) {
      suggestedStage = 'motherboard';
      subHintId = !activeBuild.motherboardId
        ? 'Tahap 2: Pasang Motherboard PRIME H510M-K ke dalam casing.'
        : 'Tahap 2: Pilih alat Obeng lalu klik "Pasang Baut Motherboard".';
      subHintEn = !activeBuild.motherboardId
        ? 'Stage 2: Install the PRIME H510M-K Motherboard.'
        : 'Stage 2: Select Screwdriver and secure motherboard standoff screws.';
    } else if (!activeBuild.cpuId || !activeBuild.cpuRetentionClosed) {
      suggestedStage = 'cpu';
      subHintId = !activeBuild.cpuSocketOpen && !activeBuild.cpuId
        ? 'Tahap 3: Buka tuas soket CPU, pasang prosesor Intel Core i3, lalu tutup pengunci CPU.'
        : !activeBuild.cpuId
        ? 'Tahap 3: Pasang CPU Intel Core i3-10100F dari inventaris.'
        : 'Tahap 3: Klik "2. Tutup Pengunci CPU" untuk mengunci prosesor.';
      subHintEn = !activeBuild.cpuId
        ? 'Stage 3: Open socket lever, install the Intel Core i3 CPU, then close retention bracket.'
        : 'Stage 3: Close the CPU retention bracket.';
    } else if (
      !activeBuild.thermalPasteApplied ||
      !activeBuild.coolerId ||
      !activeBuild.coolerSecured ||
      !activeBuild.cpuFanConnected
    ) {
      suggestedStage = 'cooling';
      subHintId = !activeBuild.thermalPasteApplied
        ? 'Tahap 4: Klik "Oleskan Pasta Termal", pasang CPU Cooler, kencangkan baut & colok kabel CPU_FAN.'
        : !activeBuild.coolerId
        ? 'Tahap 4: Pasang CPU Cooler dari inventaris.'
        : 'Tahap 4: Kencangkan baut cooler (Obeng) dan hubungkan kabel CPU_FAN.';
      subHintEn = 'Stage 4: Apply thermal paste, install CPU Cooler, tighten screws, and plug CPU_FAN.';
    } else if (activeBuild.ramIds.length < 2) {
      suggestedStage = 'ram';
      subHintId = `Tahap 5: Pasang 2 keping RAM DDR4 (${activeBuild.ramIds.length}/2) untuk mode Dual-Channel 16GB.`;
      subHintEn = `Stage 5: Install 2 DDR4 RAM modules (${activeBuild.ramIds.length}/2) for 16GB Dual-Channel.`;
    } else if (activeBuild.storageIds.length === 0 || !activeBuild.storageCablesConnected) {
      suggestedStage = 'storage';
      subHintId =
        activeBuild.storageIds.length === 0
          ? 'Tahap 6: Pasang SSD 500GB dari inventaris.'
          : 'Tahap 6: Klik "Pasang Kabel Data SATA" untuk menyambungkan SSD.';
      subHintEn = 'Stage 6: Install the 500GB SSD and connect its SATA data cable.';
    } else if (!activeBuild.gpuId || !activeBuild.gpuBracketSecured || !activeBuild.gpuPowerConnected) {
      suggestedStage = 'gpu';
      subHintId = !activeBuild.gpuId
        ? 'Tahap 7: Pasang GPU GTX 1650 ke slot PCIe x16.'
        : 'Tahap 7: Baut bracket GPU (Obeng) dan colok kabel daya GPU.';
      subHintEn = 'Stage 7: Install GTX 1650 GPU, screw bracket, and connect PCIe power.';
    } else if (!activeBuild.psuId || !activeBuild.atx24PinConnected || !activeBuild.cpu8PinConnected) {
      suggestedStage = 'psu';
      subHintId = !activeBuild.psuId
        ? 'Tahap 8: Pasang Power Supply (PSU) 450W.'
        : 'Tahap 8: Pasang kabel daya 24-Pin ATX, 8-Pin CPU, dan Daya SATA.';
      subHintEn = 'Stage 8: Install 450W PSU and connect 24-Pin ATX, 8-Pin CPU, and SATA power.';
    } else {
      suggestedStage = 'cables';
      subHintId = 'Tahap 9: Hubungkan Kabel Tombol Power (JFP1) dan kabel kipas casing.';
      subHintEn = 'Stage 9: Connect Front Panel Power Switch (JFP1) and case fan headers.';
    }
  } else if (nextChapter === 6) {
    subHintId = !activeBuild.monitorConnected
      ? 'Tahap 11: Hubungkan Kabel Monitor & Keyboard, lalu klik "Nyalakan PC & Buka Layar Uji".'
      : 'Tekan tombol "Nyalakan PC" di Layar Pengujian untuk menjalankan POST.';
    subHintEn = !activeBuild.monitorConnected
      ? 'Stage 11: Connect Monitor & Keyboard cables, then click Power On & Open Monitor.'
      : 'Click "Power On" in the Monitor screen to run POST.';
  } else if (nextChapter === 7) {
    if (!activeBuild.usbBootMediaInserted) {
      subHintId = 'Langkah OS 1/4: Pilih "Windows 11 USB" di bar atas layar uji, lalu klik "Pasang USB".';
      subHintEn = 'OS Step 1/4: Select "Windows 11 USB" at the top of the monitor and click Insert USB.';
    } else if (activeBuild.biosSettings.bootPriority[0] !== 'usb' && !activeBuild.osState.setupCompleted) {
      subHintId = 'Langkah OS 2/4: Masuk BIOS -> tab Boot -> atur USB Flash ke #1, lalu Simpan & Restart (F10).';
      subHintEn = 'OS Step 2/4: Enter BIOS -> Boot tab -> move USB Flash to #1, then Save & Reboot (F10).';
    } else {
      subHintId = 'Langkah OS 3/4: Buat & format partisi EFI + System, jalankan instalasi Windows 11 hingga pengaturan akun OOBE selesai.';
      subHintEn = 'OS Step 3/4: Create & format EFI + System partitions, install Windows 11, and finish OOBE setup.';
    }
  } else if (nextChapter === 8) {
    if (!driversComplete) {
      subHintId = 'Buka "Manajer Driver" di Desktop OS dan klik "Instal Semua" untuk melengkapi 6 kategori driver.';
      subHintEn = 'Open Driver Manager on the Virtual Desktop and click "Install All" for all 6 drivers.';
    } else {
      subHintId = 'Buka aplikasi "Benchmark" di Desktop OS dan jalankan uji performa hingga status STABILITAS LULUS.';
      subHintEn = 'Open Benchmark Suite on the Virtual Desktop and run a test until STABILITY PASS.';
    }
  } else if (nextChapter === 9) {
    if (!tut.ranCmdCommand) {
      subHintId = 'Buka "Command Prompt" di Desktop OS, ketik "ipconfig" lalu "ping 8.8.8.8", dan tutup panel samping casing untuk serah terima.';
      subHintEn = 'Open Command Prompt on the Virtual Desktop, run "ipconfig" and "ping 8.8.8.8", close side panel, and deliver at Reception.';
    } else if (activeBuild.sidePanelOpen) {
      subHintId = 'Tutup Layar Uji lalu tutup Panel Samping casing di Tahap 10 Meja Perakitan.';
      subHintEn = 'Close Monitor, open Stage 10 at Workbench, and close the PC side panel.';
    } else {
      subHintId = 'Buka Meja Resepsionis dan klik tombol hijau "Serahkan & Terima Bayaran"!';
      subHintEn = 'Open Reception Desk and click "Deliver & Collect Payment"!';
    }
  }

  const readyToClaimReward =
    nextChapter === TUTORIAL_TOTAL_CHAPTERS - 1 &&
    (tut.checkedBusinessPC || activeStation === 'business_pc' || activeStation === 'shelves') &&
    !tut.rewardClaimed;

  const doneCount = nextChapter + (readyToClaimReward || tut.completed ? 1 : 0);
  const progressPercent = Math.min(100, Math.round((doneCount / TUTORIAL_TOTAL_CHAPTERS) * 100));

  const nextTutState: TutorialState = {
    ...tut,
    chapterIndex: nextChapter,
    checkedCompatibility,
    checkedDiagnostics,
    openedDesktop,
    ranCmdCommand,
    checkedBusinessPC:
      tut.checkedBusinessPC || activeStation === 'business_pc' || activeStation === 'shelves',
  };

  return {
    tutorial: nextTutState,
    currentChapter: chapterMeta,
    subHintId,
    subHintEn,
    targetStation: chapterMeta.targetStation,
    beaconWorldPos: chapterMeta.beaconWorldPos,
    suggestedAssemblyStage: suggestedStage,
    progressPercent,
    readyToClaimReward,
  };
}

export interface CurrentObjectiveSummary {
  title: string;
  stepText: string;
  remainingText: string;
  progressPercent: number;
  helpTips: string[];
  targetStation: StationId;
}

export function getObjectiveSummary(
  state: GameState,
  activeStation: StationId,
  lang: Language
): CurrentObjectiveSummary {
  const tut = state.tutorialState;
  if (tut?.active && !tut.completed && !tut.skipped) {
    const evalRes = evaluateTutorialProgress(state, activeStation);
    const total = TUTORIAL_CHAPTERS.length;
    const ch = evalRes.currentChapter;
    return {
      title: ch.title[lang],
      stepText: lang === 'en' ? evalRes.subHintEn : evalRes.subHintId,
      remainingText:
        lang === 'en'
          ? `${total - ch.index} tutorial chapter(s) left`
          : `Sisa ${total - ch.index} bab panduan`,
      progressPercent: evalRes.progressPercent,
      helpTips: [
        ch.whyItMatters[lang],
        lang === 'en'
          ? 'Use the glowing cyan 3D beacon or bottom workstation dock to jump straight to the active station.'
          : 'Ikuti penanda biru 3D yang berputar atau tombol stasiun di bilah bawah untuk menuju lokasi kerja.',
      ],
      targetStation: evalRes.targetStation,
    };
  }

  const activeOrder =
    state.orders.find((o) => o.id === state.activeOrderId && o.status !== 'Delivered' && o.status !== 'Cancelled') ??
    state.orders.find((o) => o.status === 'Accepted' || o.status === 'In Progress' || o.status === 'Testing');

  if (!activeOrder) {
    const waiting = state.orders.filter((o) => o.status === 'New').length;
    return {
      title: lang === 'en' ? 'Accept a Customer Order' : 'Terima Pesanan Pelanggan',
      stepText:
        waiting > 0
          ? lang === 'en'
            ? `${waiting} customer(s) waiting at Reception. Accept an order to earn income!`
            : `Ada ${waiting} pelanggan menunggu di Meja Resepsionis. Terima pesanan untuk mulai bekerja!`
          : lang === 'en'
          ? 'Call a new customer at Reception or purchase parts on the Business PC.'
          : 'Panggil pelanggan baru di Meja Resepsionis atau belanja stok komponen di Komputer Bisnis.',
      remainingText: lang === 'en' ? '0 active jobs' : '0 pesanan aktif',
      progressPercent: 0,
      helpTips:
        lang === 'en'
          ? [
              'Open Reception to review customer budgets, deadlines, and PC requirements.',
              'Keep common spare parts like RAM, SSD, PSU, and Thermal Paste stocked.',
            ]
          : [
              'Buka Resepsionis untuk melihat anggaran, tenggat hari, dan spesifikasi permintaan pelanggan.',
              'Selalu siapkan stok dasar seperti RAM, SSD, PSU, dan Pasta Termal di Inventaris.',
            ],
      targetStation: 'reception',
    };
  }

  const val = validateOrderCompletion(activeOrder, lang);
  if (val.ready) {
    return {
      title: `${activeOrder.orderNumber} · ${lang === 'en' ? 'Ready for Delivery!' : 'Siap Diserahkan!'}`,
      stepText:
        lang === 'en'
          ? `All checks passed for ${activeOrder.customer.name}. Open Reception to collect payment!`
          : `Semua syarat pesanan ${activeOrder.customer.name} terpenuhi! Buka Resepsionis untuk serah terima & terima bayaran.`,
      remainingText: lang === 'en' ? 'Final step: Delivery' : 'Langkah akhir: Serah terima',
      progressPercent: 95,
      helpTips:
        lang === 'en'
          ? ['Open Reception and click "Deliver & Collect Payment".']
          : ['Buka Meja Resepsionis lalu tekan "Serahkan & Terima Bayaran".'],
      targetStation: 'reception',
    };
  }

  const totalIssues = Math.max(1, val.reasons.length);
  const progress = Math.max(15, Math.min(90, Math.round(100 - totalIssues * 14)));
  const needsRepairBench =
    (activeOrder.type === 'PC Repair' || activeOrder.type === 'Troubleshooting' || activeOrder.type === 'Maintenance') &&
    activeOrder.pcBuild.faults.some((f) => !f.resolved);

  return {
    title: `${activeOrder.orderNumber} · ${activeOrder.customer.name}`,
    stepText: val.reasons[0],
    remainingText:
      lang === 'en'
        ? `${val.reasons.length} requirement(s) remaining`
        : `${val.reasons.length} syarat belum selesai`,
    progressPercent: progress,
    helpTips:
      lang === 'en'
        ? [
            ...val.reasons.slice(0, 3),
            needsRepairBench
              ? 'Use the Repair Table tools first to diagnose hidden faults.'
              : 'Use Workbench for hardware parts and PC Screen for BIOS/OS/Drivers/Network/Benchmark.',
          ]
        : [
            ...val.reasons.slice(0, 3),
            needsRepairBench
              ? 'Gunakan alat di Meja Perbaikan untuk melacak kerusakan tersembunyi.'
              : 'Gunakan Meja Perakitan untuk hardware dan Layar PC untuk BIOS/OS/Driver/Jaringan/Benchmark.',
          ],
    targetStation: needsRepairBench ? 'repair_table' : 'workbench',
  };
}
