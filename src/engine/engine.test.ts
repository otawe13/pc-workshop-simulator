import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCompatibility } from './compatibilityEngine';
import {
  createEmptyPCBuild,
  determineBootOutcome,
  runHardwareBenchmarks,
  runPOST,
  validatePartitionsForInstall,
} from './simulationEngine';
import {
  calculateBusinessLevel,
  calculateDailyOperatingExpense,
  calculateNetWorth,
  createInitialGameState,
  generateCustomerOrder,
  getDynamicPurchasePrice,
  sortLeaderboardRecords,
  validateOrderCompletion,
} from './businessEngine';
import { buildCustomerBrokenPC, runDiagnosticTool } from './diagnosticsEngine';
import { HARDWARE_CATALOG } from './hardwareDatabase';
import {
  executeVirtualCmdCommand,
  evaluateNetworkHealth,
  isValidIPv4,
  repairNetworkWithTroubleshooter,
} from './virtualOsEngine';
import {
  formatSupabaseError,
  normalizeSupabaseUrl,
  validateFrontendSupabaseConfig,
} from './supabaseClient';
import { LeaderboardRecord } from '../types/game';

test('Compatibility engine catches CPU socket, DDR generation, GPU length, BIOS version, and PSU wattage', () => {
  const build = createEmptyPCBuild('case_budget_matx');
  build.motherboardId = 'mb_h510m'; // LGA1200, DDR4, mATX
  build.cpuId = 'cpu_r5_5600'; // AM4 -> socket mismatch
  build.ramIds = ['ram_ddr5_16']; // DDR5 -> DDR4 mismatch
  build.gpuId = 'gpu_rtx4080'; // 342mm -> > 265mm case clearance
  build.psuId = 'psu_450w'; // too weak for RTX 4080

  const report = evaluateCompatibility(build);
  assert.equal(report.compatible, false);
  const codes = report.issues.map((i) => i.code);
  assert.ok(codes.includes('CPU_SOCKET_MISMATCH'));
  assert.ok(codes.includes('RAM_TYPE_MISMATCH'));
  assert.ok(codes.includes('GPU_TOO_LONG'));
  assert.ok(codes.includes('PSU_INSUFFICIENT_WATTAGE'));

  // BIOS version check: i7-14700K on B660M BIOS 1.4 requires 2.0+
  const biosBuild = createEmptyPCBuild('case_airflow_atx');
  biosBuild.motherboardId = 'mb_b660m';
  biosBuild.cpuId = 'cpu_i7_14700k';
  const biosReport = evaluateCompatibility(biosBuild);
  assert.equal(biosReport.compatible, false);
  assert.ok(biosReport.issues.some((i) => i.code === 'CPU_BIOS_UNSUPPORTED'));
});

test('POST simulation enforces power connectors, CPU, RAM, and Display before booting', () => {
  const build = createEmptyPCBuild('case_airflow_atx');
  build.motherboardId = 'mb_b660m';
  build.cpuId = 'cpu_i5_12400f';
  build.coolerId = 'cool_tower_120';
  build.ramIds = ['ram_ddr4_8', 'ram_ddr4_8'];
  build.storageIds = ['sto_nvme_500'];
  build.gpuId = 'gpu_rtx3060';
  build.psuId = 'psu_650w';
  build.cpuRetentionClosed = true;
  build.coolerSecured = true;
  build.thermalPasteApplied = true;
  build.cpuFanConnected = true;

  // Missing front panel / 24-pin / 8-pin should fail POST
  let post = runPOST(build);
  assert.equal(post.passed, false);
  assert.equal(post.errorCode, 'ERR_POWER_SW');

  build.frontPanelConnected = true;
  build.atx24PinConnected = true;
  post = runPOST(build);
  assert.equal(post.passed, false);
  assert.equal(post.errorCode, 'ERR_CPU_8PIN');

  // Connect CPU 8-pin, GPU power & monitor -> POST passes
  build.cpu8PinConnected = true;
  build.gpuPowerConnected = true;
  build.monitorConnected = true;
  post = runPOST(build);
  assert.equal(post.passed, true);
  assert.equal(post.detectedRamGB, 16);
});

test('OS partition validation and boot priority affect boot outcome', () => {
  const build = createEmptyPCBuild('case_airflow_atx');
  build.motherboardId = 'mb_b660m';
  build.cpuId = 'cpu_i3_12100'; // has iGPU
  build.coolerId = 'cool_stock';
  build.ramIds = ['ram_ddr4_8', 'ram_ddr4_8'];
  build.storageIds = ['sto_nvme_500'];
  build.psuId = 'psu_450w';
  build.cpuRetentionClosed = true;
  build.coolerSecured = true;
  build.thermalPasteApplied = true;
  build.cpuFanConnected = true;
  build.frontPanelConnected = true;
  build.atx24PinConnected = true;
  build.cpu8PinConnected = true;
  build.monitorConnected = true;

  // No OS installed yet -> boot_error
  assert.equal(determineBootOutcome(build).target, 'boot_error');

  // Insert USB & set USB first in BIOS -> os_installer
  build.usbBootMediaInserted = 'Windows 11';
  build.biosSettings.bootPriority = ['usb', 'nvme', 'sata', 'hdd'];
  assert.equal(determineBootOutcome(build).target, 'os_installer');

  // Partition validation
  assert.equal(validatePartitionsForInstall(build.osState.partitions).valid, false);
  assert.equal(
    validatePartitionsForInstall([
      { id: '1', label: 'EFI', type: 'EFI', sizeGB: 1, formatted: true },
      { id: '2', label: 'System', type: 'System', sizeGB: 120, formatted: true },
    ]).valid,
    true
  );

  // Driver impact on benchmark
  const scoreWithoutDrivers = runHardwareBenchmarks(build).gpuScore;
  build.drivers = { chipset: true, graphics: true, audio: true, network: true, storage: true, peripheral: true };
  const scoreWithDrivers = runHardwareBenchmarks(build).gpuScore;
  assert.ok(scoreWithDrivers > scoreWithoutDrivers);
});

test('Diagnostics engine reveals fault clues only for matching tools and repair resolves order', () => {
  const pc = buildCustomerBrokenPC(['faulty_psu', 'overheating_paste'], 'budget');
  assert.equal(runPOST(pc).passed, false);

  const ramClues = runDiagnosticTool(pc, 'ram_tester');
  assert.ok(ramClues[0].includes('PASS'));

  const psuClues = runDiagnosticTool(pc, 'psu_tester');
  assert.ok(psuClues[0].includes('FAIL'));

  const thermalClues = runDiagnosticTool(pc, 'thermal_monitor');
  assert.ok(thermalClues[0].includes('101°C'));
});

test('Net worth, fair starter conditions, order completion guard, and leaderboard sorting', () => {
  const s1 = createInitialGameState('Alpha PC', 'Player1', 'normal');
  const s2 = createInitialGameState('Beta PC', 'Player2', 'normal');
  assert.equal(s1.cash, 15_000_000);
  assert.equal(s1.cash, s2.cash);

  const nw = calculateNetWorth(s1);
  assert.ok(nw.totalNetWorth > s1.cash);
  assert.equal(calculateBusinessLevel(50, 8), 3);

  // Unfinished order cannot be completed
  const assemblyOrder = s1.orders.find((o) => o.type === 'PC Assembly')!;
  assert.equal(validateOrderCompletion(assemblyOrder).ready, false);

  // Leaderboard sorting
  const records: LeaderboardRecord[] = [
    {
      id: 'a',
      username: 'A',
      workshopName: 'W1',
      netWorth: 20_000_000,
      totalRevenue: 5_000_000,
      netProfit: 2_000_000,
      completedOrders: 3,
      avgSatisfaction: 90,
      reputation: 40,
      businessLevel: 2,
      season: 'weekly',
      updatedAt: '',
    },
    {
      id: 'b',
      username: 'B',
      workshopName: 'W2',
      netWorth: 35_000_000,
      totalRevenue: 12_000_000,
      netProfit: 6_000_000,
      completedOrders: 7,
      avgSatisfaction: 85,
      reputation: 60,
      businessLevel: 3,
      season: 'weekly',
      updatedAt: '',
    },
  ];
  const byNetWorth = sortLeaderboardRecords(records, 'net_worth', 'weekly');
  assert.equal(byNetWorth[0].username, 'B');
  const bySat = sortLeaderboardRecords(records, 'satisfaction', 'weekly');
  assert.equal(bySat[0].username, 'A');
});

test('Supabase config defaults to offline mode cleanly and blocks secret/service_role keys', () => {
  const missing = validateFrontendSupabaseConfig(undefined, undefined);
  assert.equal(missing.mode, 'offline');
  assert.equal(missing.configured, false);

  const badUrl = validateFrontendSupabaseConfig('not-a-url', 'sb_publishable_12345');
  assert.equal(badUrl.mode, 'offline');
  assert.equal(badUrl.configured, false);

  const secretPrefix = validateFrontendSupabaseConfig('https://demo.supabase.co', 'sb_secret_abc123');
  assert.equal(secretPrefix.mode, 'offline');
  assert.equal(secretPrefix.securityBlocked, true);

  // Synthetic JWT with role: "service_role" must be blocked
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  const fakeServiceJwt = `${header}.${payload}.sig`;
  const blockedJwt = validateFrontendSupabaseConfig('https://demo.supabase.co', fakeServiceJwt);
  assert.equal(blockedJwt.mode, 'offline');
  assert.equal(blockedJwt.securityBlocked, true);

  const validPub = validateFrontendSupabaseConfig('https://demo.supabase.co', 'sb_publishable_safe_key');
  assert.equal(validPub.mode, 'online');
  assert.equal(validPub.configured, true);
  assert.equal(validPub.normalizedUrl, 'https://demo.supabase.co');

  // Normalize accidental /rest/v1 & /auth/v1 suffixes, trailing slashes, and wrapping quotes
  assert.equal(
    normalizeSupabaseUrl(' "https://demo.supabase.co/rest/v1/" ').url,
    'https://demo.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl(" 'https://demo.supabase.co/auth/v1/' ").url,
    'https://demo.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://demo.supabase.co/rest/v1/leaderboard_statistics').url,
    'https://demo.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://supa.example.com/custom/auth/v1/').url,
    'https://supa.example.com/custom'
  );
  const restCfg = validateFrontendSupabaseConfig(
    'https://demo.supabase.co/rest/v1',
    '"sb_publishable_safe_key"'
  );
  assert.equal(restCfg.mode, 'online');
  assert.equal(restCfg.normalizedUrl, 'https://demo.supabase.co');

  // Dashboard URL must be rejected cleanly
  const dashRes = normalizeSupabaseUrl('https://supabase.com/dashboard/project/demo');
  assert.equal(dashRes.url, null);
  assert.ok(dashRes.error?.includes('Dashboard'));

  // Error translator handles PostgREST "Invalid path specified in request URL"
  const pathErrMsg = formatSupabaseError({ message: 'Invalid path specified in request URL' }, 'id');
  assert.ok(pathErrMsg.includes('VITE_SUPABASE_URL'));
  assert.ok(pathErrMsg.includes('/rest/v1'));
});

import { DEFAULT_SETTINGS } from './saveManager';
import { evaluateTutorialProgress, getObjectiveSummary, TUTORIAL_TOTAL_CHAPTERS } from './tutorialEngine';
import { getBusinessLevelLabel, t } from '../i18n/translations';
import { getEducationEntry } from '../i18n/hardwareEducation';

test('Indonesian localization defaults, translations, and hardware education entries work properly', () => {
  assert.equal(DEFAULT_SETTINGS.language, 'id');
  assert.equal(DEFAULT_SETTINGS.dayDurationMinutes, 30);
  assert.equal(t('id', 'receptionTitle').includes('Resepsionis'), true);
  assert.equal(getBusinessLevelLabel(1, 'id'), 'Teknisi Pemula');
  assert.equal(getBusinessLevelLabel(5, 'id'), 'Bisnis PC Ternama');
  const cpuEdu = getEducationEntry('cpu', 'id');
  assert.ok(cpuEdu.title.includes('CPU'));
  assert.ok(cpuEdu.howToInstall.length > 10);
});

test('Interactive 11-chapter tutorial progresses cleanly and computes objective summaries', () => {
  assert.equal(TUTORIAL_TOTAL_CHAPTERS, 11);
  const state = createInitialGameState('Bengkel Uji', 'Teknisi', 'normal', 'id');
  assert.ok(state.tutorialState?.active);
  assert.equal(state.tutorialState?.chapterIndex, 0);

  // Chapter 0 -> Chapter 1 (parts_recognition) -> Chapter 2 (customer) when opening Reception
  state.tutorialState!.visitedStationCount = 1;
  let ev = evaluateTutorialProgress(state, 'reception');
  assert.equal(ev.tutorial.chapterIndex, 2);

  // Accept starter order -> Chapter 3 (assembly)
  state.orders[0].status = 'Accepted';
  state.activeOrderId = state.orders[0].id;
  state.tutorialState = ev.tutorial;
  ev = evaluateTutorialProgress(state, 'workbench');
  assert.equal(ev.tutorial.chapterIndex, 3);

  // Complete all hardware assembly steps -> Chapter 4 (compatibility) -> Chapter 5 (diagnostics)
  const b = state.orders[0].pcBuild;
  b.caseId = 'case_budget_matx';
  b.sidePanelOpen = true;
  b.motherboardId = 'mb_h510m';
  b.motherboardScrewsSecured = true;
  b.cpuId = 'cpu_i3_10100';
  b.cpuRetentionClosed = true;
  b.thermalPasteApplied = true;
  b.coolerId = 'cool_stock';
  b.coolerSecured = true;
  b.cpuFanConnected = true;
  b.ramIds = ['ram_ddr4_8', 'ram_ddr4_8'];
  b.storageIds = ['sto_sata_500'];
  b.storageCablesConnected = true;
  b.gpuId = 'gpu_gtx1650';
  b.gpuBracketSecured = true;
  b.gpuPowerConnected = true;
  b.psuId = 'psu_450w';
  b.atx24PinConnected = true;
  b.cpu8PinConnected = true;
  b.sataPowerConnected = true;
  b.frontPanelConnected = true;
  b.monitorConnected = true;
  b.keyboardConnected = true;

  state.tutorialState = ev.tutorial;
  ev = evaluateTutorialProgress(state, 'workbench');
  assert.equal(ev.tutorial.chapterIndex, 6); // compatibility & power_post readiness auto-advance cleanly

  // Power on -> Chapter 7 (os_install)
  b.poweredOn = true;
  state.tutorialState = ev.tutorial;
  ev = evaluateTutorialProgress(state, 'testing_station');
  assert.equal(ev.tutorial.chapterIndex, 7);

  const obj = getObjectiveSummary(state, 'overview', 'id');
  assert.ok(obj.title.includes('Bab 8'));
});

test('Customer generator spans all 10 diverse archetypes with valid gender metadata', () => {
  const base = createInitialGameState('Bengkel Ragam', 'Teknisi', 'normal', 'id');
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    base.day = 1 + Math.floor(i / 5);
    base.minuteOfDay = 480 + (i % 7) * 60;
    const ord = generateCustomerOrder(base, i, undefined, 'id');
    seen.add(ord.customer.archetype);
    assert.ok(ord.customer.gender === 'male' || ord.customer.gender === 'female');
  }
  assert.ok(seen.size >= 8);
});

test('Expanded hardware catalog preserves original IDs and spans all categories including addon & peripheral', () => {
  assert.ok(HARDWARE_CATALOG.length >= 70, `Expected >= 70 items, got ${HARDWARE_CATALOG.length}`);
  const categories = new Set(HARDWARE_CATALOG.map((i) => i.category));
  for (const req of ['cpu', 'motherboard', 'ram', 'storage', 'gpu', 'psu', 'case', 'cooler', 'addon', 'peripheral', 'consumable']) {
    assert.ok(categories.has(req as any), `Missing category: ${req}`);
  }
  for (const legacyId of ['cpu_i3_10100', 'mb_h510m', 'ram_ddr4_8', 'sto_sata_500', 'gpu_gtx1650', 'psu_450w', 'case_budget_matx', 'cool_stock']) {
    assert.ok(HARDWARE_CATALOG.some((i) => i.id === legacyId), `Missing legacy ID: ${legacyId}`);
  }
});

test('Compatibility checks catch Mini-ITX SFX PSU, radiator clearance, addon slots, and provide cause & fix suggestions', () => {
  const itxBuild = createEmptyPCBuild('case_mini_itx_sfx');
  itxBuild.psuId = 'psu_650w'; // ATX PSU does not fit SFX-only Mini-ITX
  itxBuild.coolerId = 'cool_aio_360'; // 360mm radiator unsupported by Mini-ITX
  itxBuild.motherboardId = 'mb_h510m'; // mATX in ITX + only 1 PCIe slot
  itxBuild.addonIds = ['addon_wifi_6e', 'addon_capture_card']; // 2 addons > 1 slot

  const report = evaluateCompatibility(itxBuild);
  assert.equal(report.compatible, false);
  const codes = report.issues.map((i) => i.code);
  assert.ok(codes.includes('CASE_PSU_FORM_FACTOR'));
  assert.ok(codes.includes('CASE_RADIATOR_UNSUPPORTED'));
  assert.ok(codes.includes('PCIE_SLOTS_CROWDED'));
  assert.ok(report.issues.every((i) => Boolean(i.cause) && Boolean(i.fixSuggestion)));
});

test('Virtual OS Engine executes CMD commands and repairs IPv4 network configuration safely', () => {
  const pc = createEmptyPCBuild('case_airflow_atx');
  pc.motherboardId = 'mb_b660m';
  pc.cpuId = 'cpu_i3_12100';
  pc.ramIds = ['ram_ddr4_8'];
  pc.storageIds = ['sto_nvme_500'];
  pc.psuId = 'psu_450w';
  pc.osState.installedOS = 'Windows 11';
  pc.osState.setupCompleted = true;
  pc.drivers.network = true;

  // Healthy default DHCP
  assert.equal(evaluateNetworkHealth(pc).online, true);
  assert.equal(isValidIPv4('192.168.1.50'), true);
  assert.equal(isValidIPv4('999.10.0.1'), false);

  const ipRes = executeVirtualCmdCommand('ipconfig', pc);
  assert.ok(ipRes.outputLines.some((l) => l.includes('IPv4 Address')));

  const pingRes = executeVirtualCmdCommand('ping 8.8.8.8', pc);
  assert.ok(pingRes.outputLines.some((l) => l.includes('TTL=')));

  // Break network with wrong static gateway & fault -> verify troubleshooter fixes it
  pc.networkConfig = {
    adapterName: 'Realtek PCIe 2.5GbE',
    linkStatus: 'Limited',
    mode: 'static',
    ipv4Address: '169.254.10.5',
    subnetMask: '255.255.0.0',
    gateway: '0.0.0.0',
    dnsPrimary: '0.0.0.0',
    dnsSecondary: '',
    linkSpeedMbps: 100,
    packetLossPct: 100,
  };
  pc.faults.push({
    id: 'f_net',
    type: 'network_issue',
    label: 'Static IP gateway mismatch',
    clueByTool: {},
    resolved: false,
  });
  assert.equal(evaluateNetworkHealth(pc).online, false);

  const repaired = repairNetworkWithTroubleshooter(pc);
  assert.equal(evaluateNetworkHealth(repaired.nextBuild).online, true);
  assert.equal(repaired.nextBuild.faults.every((f) => f.resolved), true);
});

test('Daily market prices fluctuate deterministically after Day 1 and daily expenses scale with shop growth', () => {
  const cpu = HARDWARE_CATALOG.find((i) => i.id === 'cpu_i5_12400f')!;
  assert.equal(getDynamicPurchasePrice(cpu, 1), cpu.purchasePrice);
  const day5Price = getDynamicPurchasePrice(cpu, 5);
  assert.ok(day5Price >= Math.round(cpu.purchasePrice * 0.85) && day5Price <= Math.round(cpu.purchasePrice * 1.15));

  const state = createInitialGameState('Bengkel Bisnis', 'Teknisi', 'normal', 'id');
  const expDay1 = calculateDailyOperatingExpense(state);
  assert.ok(expDay1 >= 65_000);
  state.businessLevel = 4;
  assert.ok(calculateDailyOperatingExpense(state) > expDay1);
});


