import {
  AssemblyStageId,
  GameState,
  Language,
  StationId,
  TutorialChapterId,
  TutorialState,
  WorkshopOrder,
} from '../types/game';
import { validateOrderCompletion } from './businessEngine';
import { createEmptyPCBuild, runPOST } from './simulationEngine';

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
      id: 'Bab 1: Mengenal Bengkel',
      en: 'Chapter 1: Know Your Workshop',
    },
    instruction: {
      id: 'Putar atau geser kamera (drag layar / WASD) lalu kunjungi Meja Resepsionis atau stasiun lain untuk mengenal area bengkelmu.',
      en: 'Orbit or pan the camera (drag / WASD) and click Reception or another workstation to explore your shop.',
    },
    whyItMatters: {
      id: 'Bengkelmu punya area Resepsionis, Meja Perakitan, Meja Perbaikan, Layar Uji PC, dan Komputer Bisnis.',
      en: 'Your shop has dedicated areas for Reception, Assembly, Repair, Testing, and Business management.',
    },
    targetStation: 'reception',
    beaconWorldPos: [-3.6, 2.0, 2.2],
  },
  {
    index: 1,
    id: 'customer',
    title: {
      id: 'Bab 2: Menerima Pelanggan',
      en: 'Chapter 2: Receiving Customers',
    },
    instruction: {
      id: 'Buka Meja Resepsionis dan terima pesanan tutorial pertama dari pelanggan pertamamu (klik "Terima Pesanan" lalu "Buka di Meja Rakit").',
      en: 'Open the Reception Desk and accept your starter customer order, then open it at the Workbench.',
    },
    whyItMatters: {
      id: 'Setiap pesanan mencantumkan anggaran, kebutuhan spesifikasi, dan sistem operasi yang diminta pelanggan.',
      en: 'Each order specifies the client budget, minimum hardware specs, and required operating system.',
    },
    targetStation: 'reception',
    beaconWorldPos: [-3.6, 2.0, 2.2],
  },
  {
    index: 2,
    id: 'assembly',
    title: {
      id: 'Bab 3: Merakit PC',
      en: 'Chapter 3: Assembling the PC',
    },
    instruction: {
      id: 'Di Meja Perakitan, pasang Casing, buka panel samping, lalu pasang Motherboard, CPU, Pasta & Cooler, RAM (2x), Penyimpanan, GPU, PSU, dan hubungkan kabel utama.',
      en: 'At the Workbench, install Case, open side panel, then mount Motherboard, CPU, Paste & Cooler, 2x RAM, Storage, GPU, PSU, and cables.',
    },
    whyItMatters: {
      id: 'Urutan perakitan yang benar (membuka tuas soket, pasta termal, kabel 24-pin & 8-pin) mencegah kegagalan saat dinyalakan.',
      en: 'Correct installation order (socket lever, thermal paste, 24-pin & 8-pin cables) prevents boot failure.',
    },
    targetStation: 'workbench',
    beaconWorldPos: [0.45, 1.9, -0.35],
  },
  {
    index: 3,
    id: 'power_post',
    title: {
      id: 'Bab 4: Menyalakan PC & POST',
      en: 'Chapter 4: Power On & POST',
    },
    instruction: {
      id: 'Pada Tahap 11 (Uji Nyala), hubungkan kabel Monitor & Keyboard lalu tekan "Nyalakan PC & Buka Layar Uji" untuk lolos cek POST.',
      en: 'On Stage 11 (First Boot), connect Monitor & Keyboard cables and power on the PC to pass POST.',
    },
    whyItMatters: {
      id: 'POST (Power-On Self-Test) memeriksa apakah CPU, RAM, GPU, dan suhu dalam keadaan sehat sebelum masuk BIOS.',
      en: 'POST verifies CPU, RAM, GPU, and thermal readiness before entering BIOS or booting an OS.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [0.45, 1.9, -0.35],
    hintAssemblyStage: 'first_boot',
  },
  {
    index: 4,
    id: 'os_install',
    title: {
      id: 'Bab 5: Instalasi Sistem Operasi',
      en: 'Chapter 5: Installing OS & Drivers',
    },
    instruction: {
      id: 'Pasang USB Windows 11 di Layar Uji, atur USB ke urutan Boot #1 di BIOS (atau klik Lanjutkan Boot), buat partisi EFI & System lalu format, instal OS, dan instal seluruh Driver.',
      en: 'Insert the Windows 11 USB, set USB #1 in BIOS if needed, create EFI & System partitions, format System, install OS, and install all drivers.',
    },
    whyItMatters: {
      id: 'Tanpa partisi terformat, sistem operasi, dan driver lengkap, PC pelanggan belum siap dipakai bekerja maupun bermain game.',
      en: 'Formatted partitions, a clean OS install, and all 6 drivers are required for full PC performance.',
    },
    targetStation: 'testing_station',
    beaconWorldPos: [3.8, 2.0, -2.8],
  },
  {
    index: 5,
    id: 'complete_order',
    title: {
      id: 'Bab 6: Uji Benchmark & Serahkan Pesanan',
      en: 'Chapter 6: Benchmark & Deliver Order',
    },
    instruction: {
      id: 'Jalankan Uji Stabilitas Benchmark di Desktop OS, tutup panel samping casing di Tahap 10, lalu serahkan pesanan di Resepsionis untuk menerima bayaran.',
      en: 'Run a Stability Benchmark on the OS Desktop, close the case side panel, and deliver the PC at Reception.',
    },
    whyItMatters: {
      id: 'Uji benchmark memastikan suhu aman dan semua komponen stabil sebelum diserahkan ke pelanggan.',
      en: 'Stability benchmarks prove thermals and performance meet client standards before delivery.',
    },
    targetStation: 'reception',
    beaconWorldPos: [-3.6, 2.0, 2.2],
  },
  {
    index: 6,
    id: 'business',
    title: {
      id: 'Bab 7: Mengelola Bisnis',
      en: 'Chapter 7: Managing Your Business',
    },
    instruction: {
      id: 'Buka Komputer Bisnis untuk melihat Toko Komponen, Keuangan (Net Worth), Upgrade Bengkel, serta Papan Peringkat.',
      en: 'Open the Business Computer to inspect the Hardware Store, Finances (Net Worth), Upgrades, and Leaderboards.',
    },
    whyItMatters: {
      id: 'Mengelola stok komponen, keuntungan, dan upgrade bengkel menentukan pertumbuhan reputasi dan kekayaanmu.',
      en: 'Managing inventory, profit margins, and workshop upgrades drives your business growth.',
    },
    targetStation: 'business_pc',
    beaconWorldPos: [-3.4, 2.0, -2.8],
  },
];

export function createDefaultTutorialState(active = true): TutorialState {
  return {
    active,
    completed: !active,
    skipped: false,
    chapterIndex: active ? 0 : 6,
    rewardClaimed: !active,
    cameraMoved: !active,
    visitedStationCount: active ? 0 : 5,
    checkedBusinessPC: !active,
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
      ? 'Build a complete PC using your starter workshop stock: 16GB RAM, 500GB SSD, GTX 1650 GPU, Windows 11, all drivers, and passing benchmark.'
      : 'Rakit PC lengkap memakai stok komponen awal bengkel: RAM 16GB, SSD 500GB, GPU GTX 1650, Windows 11, seluruh driver, dan lolos benchmark.',
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

  // Determine the tutorial order or any active assembly order
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
  const osReady = Boolean(
    activeBuild.osState.setupCompleted &&
      activeBuild.osState.installedOS &&
      !activeBuild.osState.corrupted &&
      driversComplete
  );
  const benchmarkAndClosed = Boolean(
    activeBuild.benchmarks?.stabilityPassed && !activeBuild.sidePanelOpen
  );

  // Automatic monotonic progression while tutorial is active & uncompleted
  let nextChapter = tut.chapterIndex;
  if (tut.active && !tut.completed && !tut.skipped) {
    if (nextChapter === 0 && (tut.visitedStationCount >= 1 || orderAccepted)) {
      nextChapter = 1;
    }
    if (nextChapter === 1 && orderAccepted) {
      nextChapter = 2;
    }
    if (nextChapter === 2 && assemblyReadyForPower) {
      nextChapter = 3;
    }
    if (nextChapter === 3 && postPassed && activeBuild.poweredOn) {
      nextChapter = 4;
    }
    if (nextChapter === 4 && osReady) {
      nextChapter = 5;
    }
    if (nextChapter === 5 && orderDelivered) {
      nextChapter = 6;
    }
  }

  const chapterMeta = TUTORIAL_CHAPTERS[Math.min(6, Math.max(0, nextChapter))];

  // Granular assembly hint when in Chapter 3 (index 2)
  let suggestedStage: AssemblyStageId | undefined = chapterMeta.hintAssemblyStage;
  let subHintId = chapterMeta.instruction.id;
  let subHintEn = chapterMeta.instruction.en;

  if (nextChapter === 2) {
    if (!activeBuild.caseId || !activeBuild.sidePanelOpen) {
      suggestedStage = 'preparation';
      subHintId = !activeBuild.caseId
        ? 'Tahap 1: Pasang Casing PC dari inventaris di bagian bawah panel Meja Perakitan.'
        : 'Tahap 1: Klik "Buka Panel Samping" agar komponen dalam bisa dipasang.';
      subHintEn = !activeBuild.caseId
        ? 'Stage 1: Install the PC Case from inventory at the bottom of the Workbench.'
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
        ? 'Tahap 4: Klik "Oleskan Pasta Termal", lalu pasang CPU Cooler dan kencangkan baut + colok kabel CPU_FAN.'
        : !activeBuild.coolerId
        ? 'Tahap 4: Pasang CPU Cooler dari inventaris.'
        : 'Tahap 4: Kencangkan baut cooler (Obeng) dan hubungkan kabel CPU_FAN.';
      subHintEn = 'Stage 4: Apply thermal paste, install CPU Cooler, tighten screws, and plug CPU_FAN.';
    } else if (activeBuild.ramIds.length < 2) {
      suggestedStage = 'ram';
      subHintId = `Tahap 5: Pasang 2 keping RAM DDR4 (terpasang ${activeBuild.ramIds.length}/2) untuk mengaktifkan Dual-Channel 16GB.`;
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
        ? 'Tahap 7: Pasang Kartu Grafis (GPU) GTX 1650 karena CPU i3-10100F tidak memiliki grafis terintegrasi.'
        : 'Tahap 7: Baut bracket GPU (Obeng) dan colok kabel daya GPU.';
      subHintEn = 'Stage 7: Install the GTX 1650 GPU, screw bracket, and plug PCIe power.';
    } else if (!activeBuild.psuId || !activeBuild.atx24PinConnected || !activeBuild.cpu8PinConnected) {
      suggestedStage = 'psu';
      subHintId = !activeBuild.psuId
        ? 'Tahap 8: Pasang Power Supply (PSU) 450W.'
        : 'Tahap 8: Pasang kabel daya 24-Pin ATX, 8-Pin CPU, dan Daya SATA.';
      subHintEn = 'Stage 8: Install 450W PSU and connect 24-Pin ATX, 8-Pin CPU, and SATA power.';
    } else {
      suggestedStage = 'cables';
      subHintId = 'Tahap 9: Hubungkan Kabel Tombol Power/Reset (JFP1) dan kabel kipas casing.';
      subHintEn = 'Stage 9: Connect Front Panel Power/Reset (JFP1) and case fan headers.';
    }
  } else if (nextChapter === 3) {
    subHintId = !activeBuild.monitorConnected
      ? 'Tahap 11: Hubungkan Kabel Monitor & Keyboard, lalu klik "Nyalakan PC & Buka Layar Uji".'
      : 'Tekan tombol "Nyalakan PC" di kanan atas Layar Pengujian untuk menjalankan POST.';
    subHintEn = !activeBuild.monitorConnected
      ? 'Stage 11: Connect Monitor & Keyboard cables, then click Power On & Open Monitor.'
      : 'Click "Power On" in the Monitor screen to run POST.';
  } else if (nextChapter === 4) {
    if (!activeBuild.usbBootMediaInserted) {
      subHintId = 'Langkah OS 1/4: Pilih "Windows 11 USB" di bar atas layar uji, lalu klik "Pasang USB".';
      subHintEn = 'OS Step 1/4: Select "Windows 11 USB" at the top of the monitor and click Insert USB.';
    } else if (activeBuild.biosSettings.bootPriority[0] !== 'usb' && !activeBuild.osState.setupCompleted) {
      subHintId = 'Langkah OS 2/4: Masuk ke BIOS -> tab Boot -> naikkan USB Flash ke urutan #1, lalu Simpan & Restart (F10).';
      subHintEn = 'OS Step 2/4: Enter BIOS -> Boot tab -> move USB Flash to #1, then Save & Reboot (F10).';
    } else if (!activeBuild.osState.setupCompleted) {
      subHintId = 'Langkah OS 3/4: Pada Installer OS, buat partisi EFI & Sistem, klik "Format Partisi Sistem", lalu Instal Windows 11.';
      subHintEn = 'OS Step 3/4: In OS Setup, create EFI & System partitions, Format System, and Install Windows 11.';
    } else {
      subHintId = 'Langkah OS 4/4: Setelah masuk Desktop, klik "Instal Semua" pada Manajer Driver.';
      subHintEn = 'OS Step 4/4: On Desktop, click "Install All" in Driver Manager.';
    }
  } else if (nextChapter === 5) {
    if (!activeBuild.benchmarks?.stabilityPassed) {
      subHintId = 'Jalankan salah satu Uji Benchmark di kanan layar Desktop OS hingga muncul status STABILITAS LULUS.';
      subHintEn = 'Run any Benchmark test on the OS Desktop until STABILITY PASS appears.';
    } else if (activeBuild.sidePanelOpen) {
      subHintId = 'Tutup Layar Uji lalu buka Tahap 10 (Inspeksi) di Meja Perakitan dan tutup Panel Samping casing.';
      subHintEn = 'Close Monitor, open Stage 10 at Workbench, and close the PC side panel.';
    } else {
      subHintId = 'Buka Meja Resepsionis dan klik tombol hijau "Serahkan & Terima Bayaran"!';
      subHintEn = 'Open Reception Desk and click "Deliver & Collect Payment"!';
    }
  }

  const readyToClaimReward =
    nextChapter === 6 &&
    (tut.checkedBusinessPC || activeStation === 'business_pc' || activeStation === 'shelves') &&
    !tut.rewardClaimed;

  const doneCount = nextChapter + (readyToClaimReward || tut.completed ? 1 : 0);
  const progressPercent = Math.min(100, Math.round((doneCount / TUTORIAL_CHAPTERS.length) * 100));

  const nextTutState: TutorialState = {
    ...tut,
    chapterIndex: nextChapter,
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

  // Career objective tracker when tutorial is completed/skipped
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

  const val = validateOrderCompletion(activeOrder);
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
              : 'Use Workbench for hardware parts and PC Screen for BIOS/OS/Drivers/Benchmark.',
          ]
        : [
            ...val.reasons.slice(0, 3),
            needsRepairBench
              ? 'Gunakan alat di Meja Perbaikan untuk melacak kerusakan tersembunyi.'
              : 'Gunakan Meja Perakitan untuk hardware dan Layar PC untuk BIOS/OS/Driver/Benchmark.',
          ],
    targetStation: needsRepairBench ? 'repair_table' : 'workbench',
  };
}
