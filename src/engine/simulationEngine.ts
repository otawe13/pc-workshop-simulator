import {
  BenchmarkResults,
  DriverState,
  OSType,
  PCBuildState,
  POSTResult,
  PartitionEntry,
} from '../types/game';
import { evaluateCompatibility } from './compatibilityEngine';
import { getHardwareItem } from './hardwareDatabase';
import { createDefaultNetworkConfig } from './virtualOsEngine';

export function createEmptyPCBuild(caseId: string | null = null): PCBuildState {
  return {
    caseId,
    motherboardId: null,
    cpuId: null,
    coolerId: null,
    ramIds: [],
    storageIds: [],
    gpuId: null,
    psuId: null,
    addonIds: [],
    peripheralIds: [],
    fanCount: 2,
    sidePanelOpen: false,
    selectedTool: 'none',
    dustLevel: 0,
    motherboardScrewsSecured: false,
    cpuSocketOpen: false,
    cpuRetentionClosed: false,
    thermalPasteApplied: false,
    coolerSecured: false,
    cpuFanConnected: false,
    storageCablesConnected: false,
    gpuBracketSecured: false,
    gpuPowerConnected: false,
    atx24PinConnected: false,
    cpu8PinConnected: false,
    sataPowerConnected: false,
    frontPanelConnected: false,
    usbHeaderConnected: false,
    audioHeaderConnected: false,
    caseFansConnected: false,
    monitorConnected: false,
    keyboardConnected: false,
    poweredOn: false,
    usbBootMediaInserted: null,
    faults: [],
    biosSettings: {
      bootPriority: ['nvme', 'sata', 'usb', 'hdd'],
      uefiMode: true,
      xmpEnabled: false,
      fanCurveMode: 'standard',
      secureBoot: true,
      biosCorrupted: false,
    },
    osState: {
      installedOS: null,
      corrupted: false,
      bootloaderBroken: false,
      partitions: [
        {
          id: 'part_unalloc',
          label: 'Unallocated Space',
          type: 'Unallocated',
          sizeGB: 500,
          formatted: false,
        },
      ],
      language: 'Indonesian / English',
      keyboardLayout: 'US QWERTY',
      targetDriveId: null,
      installProgress: 0,
      setupCompleted: false,
      oobeCompleted: false,
      oobeUsername: 'Teknisi',
      oobeComputerName: 'WORKSHOP-PC',
      privacyTelemetry: false,
    },
    drivers: {
      chipset: false,
      graphics: false,
      audio: false,
      network: false,
      storage: false,
      peripheral: false,
    },
    networkConfig: createDefaultNetworkConfig(false),
    benchmarks: null,
  };
}

export function calculateCpuTempC(build: PCBuildState, underLoad = false): number {
  const cpu = getHardwareItem(build.cpuId);
  const cooler = getHardwareItem(build.coolerId);
  const tdp = cpu?.tdpW ?? 65;
  const coolingCap = cooler?.coolingCapacityW ?? 70;
  const hasCoolingFault = build.faults.some((f) => !f.resolved && f.type === 'cooler_failure');
  const hasPasteFault = build.faults.some((f) => !f.resolved && f.type === 'overheating_paste');
  const hasDustFault = build.faults.some((f) => !f.resolved && f.type === 'dust_clogged');
  const dustPenalty = Math.round(((build.dustLevel ?? 0) / 100) * 14) + (hasDustFault ? 12 : 0);

  let baseIdle = 34;
  if (!cooler || !build.coolerSecured || hasCoolingFault) {
    baseIdle += 38;
  } else {
    const ratio = tdp / Math.max(40, coolingCap);
    baseIdle += Math.round(ratio * 14);
  }
  if (!build.thermalPasteApplied || hasPasteFault) {
    baseIdle += 18;
  }
  if (!build.cpuFanConnected) {
    baseIdle += 15;
  }
  baseIdle += dustPenalty;

  if (build.biosSettings.fanCurveMode === 'turbo') {
    baseIdle -= 4;
  } else if (build.biosSettings.fanCurveMode === 'silent') {
    baseIdle += 3;
  }

  const loadDelta = underLoad ? Math.round((tdp / Math.max(60, coolingCap)) * 34) + 12 : 0;
  return Math.min(108, Math.max(28, baseIdle + loadDelta));
}

export function runPOST(build: PCBuildState): POSTResult {
  const details: string[] = [];
  const mb = getHardwareItem(build.motherboardId);
  const cpu = getHardwareItem(build.cpuId);
  const psu = getHardwareItem(build.psuId);
  const gpu = getHardwareItem(build.gpuId);
  const rams = build.ramIds.map((id) => getHardwareItem(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const storages = build.storageIds.map((id) => getHardwareItem(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const compat = evaluateCompatibility(build);

  const unresolvedFault = (type: string) => build.faults.find((f) => !f.resolved && f.type === type);

  if (!psu || unresolvedFault('faulty_psu')) {
    return {
      passed: false,
      beepCount: 0,
      errorCode: 'ERR_NO_POWER',
      message: 'POWER ERROR: NO PSU OUTPUT DETECTED.',
      details: ['Power supply is missing or failed standby +5VSB rail check.'],
      detectedCpu: null,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: 25,
    };
  }
  if (!build.frontPanelConnected || unresolvedFault('damaged_connector')) {
    return {
      passed: false,
      beepCount: 0,
      errorCode: 'ERR_POWER_SW',
      message: 'POWER ERROR: FRONT PANEL POWER SWITCH NOT CONNECTED.',
      details: ['Connect JFP1 front panel power header on the motherboard.'],
      detectedCpu: null,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: 25,
    };
  }
  if (!build.atx24PinConnected) {
    return {
      passed: false,
      beepCount: 0,
      errorCode: 'ERR_ATX_24PIN',
      message: 'POWER ERROR: 24-PIN MOTHERBOARD POWER MISSING.',
      details: ['Motherboard receives no main DC power rails.'],
      detectedCpu: null,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: 25,
    };
  }
  if (!build.cpu8PinConnected || unresolvedFault('loose_cables')) {
    return {
      passed: false,
      beepCount: 0,
      errorCode: 'ERR_CPU_8PIN',
      message: 'POWER ERROR: CPU POWER CONNECTOR MISSING.',
      details: ['EPS 8-pin CPU power rail disconnected or loose.'],
      detectedCpu: null,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: 25,
    };
  }

  if (!mb || !cpu || !build.cpuRetentionClosed) {
    return {
      passed: false,
      beepCount: 5,
      errorCode: 'ERR_CPU_MISSING',
      message: 'POST ERROR: CPU NOT DETECTED OR SOCKET OPEN.',
      details: ['Install a compatible processor and close the socket retention bracket.'],
      detectedCpu: null,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: 25,
    };
  }

  if (!compat.compatible || unresolvedFault('incompatible_ram')) {
    const firstErr = compat.issues.find((i) => i.severity === 'error');
    return {
      passed: false,
      beepCount: 4,
      errorCode: firstErr?.code ?? 'ERR_COMPATIBILITY',
      message: `POST HALT: ${firstErr?.message ?? 'Hardware incompatibility detected (RAM/Component).'}`,
      details: compat.issues.length > 0 ? compat.issues.map((i) => i.message) : ['Incompatible memory timing or generation fault.'],
      detectedCpu: cpu.model,
      detectedRamGB: compat.totalRamGB,
      detectedStorageCount: storages.length,
      detectedGpu: gpu?.model ?? null,
      cpuTempC: calculateCpuTempC(build),
    };
  }

  if (rams.length === 0 || unresolvedFault('missing_ram') || unresolvedFault('loose_ram')) {
    return {
      passed: false,
      beepCount: 3,
      errorCode: 'ERR_NO_RAM',
      message: 'POST ERROR: MEMORY NOT DETECTED.',
      details: ['3 long beeps: No functional memory sticks seated in DIMM slots.'],
      detectedCpu: cpu.model,
      detectedRamGB: 0,
      detectedStorageCount: 0,
      detectedGpu: null,
      cpuTempC: calculateCpuTempC(build),
    };
  }

  const hasGpuPower = !gpu || (gpu.pciePowerPins ?? 0) === 0 || build.gpuPowerConnected;
  const hasFaultyGpu = Boolean(unresolvedFault('faulty_gpu'));
  const hasDisplaySource = (Boolean(gpu) && hasGpuPower && !hasFaultyGpu) || Boolean(cpu.hasIntegratedGraphics);

  if (!hasDisplaySource || !build.monitorConnected) {
    return {
      passed: false,
      beepCount: 2,
      errorCode: 'ERR_NO_DISPLAY',
      message: 'NO DISPLAY: CHECK GPU CONNECTION.',
      details: [
        !build.monitorConnected
          ? 'DisplayPort/HDMI cable is not connected to a monitor.'
          : hasFaultyGpu
          ? 'Discrete GPU failed VGA initialization.'
          : 'No graphics adapter or PCIe power detected.',
      ],
      detectedCpu: cpu.model,
      detectedRamGB: compat.totalRamGB,
      detectedStorageCount: storages.length,
      detectedGpu: null,
      cpuTempC: calculateCpuTempC(build),
    };
  }

  const cpuTempC = calculateCpuTempC(build);
  if (cpuTempC >= 98) {
    return {
      passed: false,
      beepCount: 4,
      errorCode: 'ERR_CPU_OVERHEAT',
      message: 'THERMAL SHUTDOWN: CPU OVER TEMPERATURE ERROR!',
      details: [`CPU reached ${cpuTempC}°C during POST. Check cooler mount, fan header, dust clogging, and thermal paste.`],
      detectedCpu: cpu.model,
      detectedRamGB: compat.totalRamGB,
      detectedStorageCount: storages.length,
      detectedGpu: gpu ? gpu.model : 'Integrated Graphics',
      cpuTempC,
    };
  }

  const workingStorages = storages.filter((_, idx) => !(idx === 0 && unresolvedFault('faulty_storage')));
  if (workingStorages.length === 0) {
    details.push('Warning: No bootable storage drive detected.');
  } else {
    details.push(`Detected ${workingStorages.length} storage device(s) totaling ${compat.totalStorageGB}GB.`);
  }

  if (build.biosSettings.biosCorrupted || unresolvedFault('bios_misconfig')) {
    details.push('Warning: BIOS configuration checksum mismatch. Check boot order & UEFI settings.');
  }

  details.unshift('POST Completed Successfully (1 Short Beep).');

  return {
    passed: true,
    beepCount: 1,
    errorCode: null,
    message: 'POST SUCCESS: SYSTEM READY FOR BOOT / BIOS.',
    details,
    detectedCpu: cpu.model,
    detectedRamGB: compat.totalRamGB,
    detectedStorageCount: workingStorages.length,
    detectedGpu: gpu ? gpu.model : `${cpu.manufacturer} Integrated Graphics`,
    cpuTempC,
  };
}

export function determineBootOutcome(build: PCBuildState): {
  target: 'bios_required' | 'os_installer' | 'os_desktop' | 'boot_error';
  message: string;
} {
  const post = runPOST(build);
  if (!post.passed) {
    return { target: 'boot_error', message: post.message };
  }

  const hasStorageFault = build.faults.some((f) => !f.resolved && f.type === 'faulty_storage');
  const hasBootloaderFault = build.faults.some((f) => !f.resolved && f.type === 'bootloader_failure');
  const hasCorruptOS = build.osState.corrupted || build.faults.some((f) => !f.resolved && f.type === 'corrupted_os');
  const hasBiosMisconfig = build.faults.some((f) => !f.resolved && f.type === 'bios_misconfig');
  const hasPartitionFault = build.faults.some((f) => !f.resolved && f.type === 'partition_issue');

  const topBoot = build.biosSettings.bootPriority[0];
  const hasWorkingStorage = build.storageIds.length > 0 && !hasStorageFault && build.storageCablesConnected;

  if (hasBiosMisconfig) {
    return {
      target: 'boot_error',
      message: 'BOOT ERROR: Invalid BIOS Boot Mode / Legacy CSM mismatch. Enter BIOS to fix.',
    };
  }

  if (topBoot === 'usb' && build.usbBootMediaInserted) {
    return {
      target: 'os_installer',
      message: `Booting ${build.usbBootMediaInserted} Setup from USB...`,
    };
  }

  if (!hasWorkingStorage) {
    return {
      target: 'boot_error',
      message:
        !build.storageCablesConnected && build.storageIds.length > 0
          ? 'BOOTMGR ERROR: Storage SATA/M.2 cable not connected at Workbench.'
          : 'BOOTMGR ERROR: No bootable storage device found. Insert bootable USB and set USB first in BIOS.',
    };
  }

  if (hasBootloaderFault || hasPartitionFault) {
    return {
      target: 'boot_error',
      message: 'EFI BOOTLOADER ERROR: Missing or corrupted EFI System Partition (0xc000000f).',
    };
  }

  if (hasCorruptOS) {
    return {
      target: 'boot_error',
      message: 'SYSTEM RECOVERY: Operating system kernel corrupted. Reinstall OS via Bootable USB.',
    };
  }

  if (!build.osState.installedOS || !build.osState.setupCompleted) {
    return {
      target: 'boot_error',
      message: 'REBOOT AND SELECT PROPER BOOT DEVICE: No Operating System installed on drive.',
    };
  }

  return {
    target: 'os_desktop',
    message: `Booting ${build.osState.installedOS}...`,
  };
}

export function validatePartitionsForInstall(partitions: PartitionEntry[]): {
  valid: boolean;
  error?: string;
} {
  const sysPart = partitions.find((p) => p.type === 'System');
  if (!sysPart) {
    return {
      valid: false,
      error: 'No System partition found. Create a System partition (min 60 GB) from Unallocated space.',
    };
  }
  if (sysPart.sizeGB < 60) {
    return {
      valid: false,
      error: `System partition (${sysPart.sizeGB} GB) is too small. Minimum 60 GB required.`,
    };
  }
  if (!sysPart.formatted) {
    return {
      valid: false,
      error: 'Selected System partition is not formatted. Format it before installation.',
    };
  }
  return { valid: true };
}

export function runHardwareBenchmarks(build: PCBuildState): BenchmarkResults {
  const cpu = getHardwareItem(build.cpuId);
  const gpu = getHardwareItem(build.gpuId);
  const compat = evaluateCompatibility(build);
  const drivers: DriverState = build.drivers;

  const cpuTemp = calculateCpuTempC(build, true);
  const thermalThrottleFactor = cpuTemp >= 92 ? 0.68 : cpuTemp >= 84 ? 0.88 : 1.0;

  const chipsetMod = drivers.chipset ? 1.0 : 0.82;
  const gpuDriverMod = drivers.graphics ? 1.0 : 0.48;
  const storageDriverMod = drivers.storage ? 1.0 : 0.72;
  const dualChannelMod = compat.dualChannelActive ? 1.18 : 1.0;
  const xmpMod = build.biosSettings.xmpEnabled ? 1.08 : 1.0;

  const cpuScore = Math.round((cpu?.performanceScore ?? 2000) * chipsetMod * thermalThrottleFactor);
  const rawGpu = gpu?.performanceScore ?? (cpu?.hasIntegratedGraphics ? 1400 : 800);
  const gpuScore = Math.round(rawGpu * gpuDriverMod * (cpuTemp >= 95 ? 0.85 : 1.0));
  const ramScore = Math.round(
    (build.ramIds.reduce((s, id) => s + (getHardwareItem(id)?.performanceScore ?? 3000), 0) /
      Math.max(1, build.ramIds.length)) *
      dualChannelMod *
      xmpMod
  );
  const primaryStorage = getHardwareItem(build.storageIds[0]);
  const storageScore = Math.round((primaryStorage?.performanceScore ?? 2000) * storageDriverMod);

  const maxGpuTempC = gpu ? Math.min(92, Math.round(56 + (gpu.tdpW ?? 120) * 0.08)) : 45;
  const stabilityPassed = cpuTemp < 95 && compat.compatible && !build.faults.some((f) => !f.resolved);
  const overallScore = Math.round(cpuScore * 0.35 + gpuScore * 0.4 + ramScore * 0.15 + storageScore * 0.1);

  return {
    cpuScore,
    gpuScore,
    ramScore,
    storageScore,
    maxCpuTempC: cpuTemp,
    maxGpuTempC,
    stabilityPassed,
    overallScore,
    timestamp: Date.now(),
  };
}

export function getInstalledOSCountLabel(os: OSType | null): string {
  return os ?? 'None Installed';
}
