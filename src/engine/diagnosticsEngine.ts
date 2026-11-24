import {
  DiagnosticToolId,
  FaultType,
  PCBuildState,
  PCFault,
} from '../types/game';
import { getHardwareItem } from './hardwareDatabase';
import { calculateCpuTempC, createEmptyPCBuild } from './simulationEngine';

export interface DiagnosticToolMeta {
  id: DiagnosticToolId;
  name: string;
  shortDesc: string;
  requiresUpgradeId?: string;
}

export const DIAGNOSTIC_TOOLS: DiagnosticToolMeta[] = [
  {
    id: 'screwdriver',
    name: 'Precision Screwdriver',
    shortDesc: 'Open chassis, inspect physical seating, cables, and cooler mount.',
  },
  {
    id: 'psu_tester',
    name: 'PSU Rail Tester',
    shortDesc: 'Test +12V, +5V, +3.3V ATX rails and standby power.',
  },
  {
    id: 'multimeter',
    name: 'Digital Multimeter',
    shortDesc: 'Check motherboard voltage delivery and damaged connectors.',
  },
  {
    id: 'ram_tester',
    name: 'RAM Slot & DIMM Tester',
    shortDesc: 'Probe memory channels, SPD detection, and loose sticks.',
  },
  {
    id: 'thermal_monitor',
    name: 'IR Thermal Probe',
    shortDesc: 'Read live CPU/VRM temperatures and thermal paste transfer.',
  },
  {
    id: 'diagnostic_usb',
    name: 'Diagnostic Boot USB',
    shortDesc: 'Scan SMART drive health, OS integrity, and driver status.',
  },
  {
    id: 'recovery_media',
    name: 'EFI Recovery Media',
    shortDesc: 'Inspect bootloader, EFI partition table, and BIOS boot flags.',
  },
];

export function createFaultRecord(type: FaultType, idx = 0): PCFault {
  const map: Record<FaultType, { label: string; clueByTool: Partial<Record<DiagnosticToolId, string>> }> = {
    faulty_psu: {
      label: 'Faulty Power Supply Unit',
      clueByTool: {
        psu_tester: 'PSU TESTER FAIL: +12V rail reads 0.00V, +5VSB unstable (3.1V). PSU must be replaced.',
        multimeter: 'MULTIMETER: No DC output on 24-pin ATX harness under load.',
        screwdriver: 'Visual check: Burnt capacitor smell near PSU exhaust.',
      },
    },
    missing_ram: {
      label: 'Missing Memory Module',
      clueByTool: {
        screwdriver: 'Visual check: All DIMM slots on the motherboard are empty!',
        ram_tester: 'RAM TESTER: 0 modules detected in Channel A/B.',
      },
    },
    loose_ram: {
      label: 'Unseated / Loose RAM Stick',
      clueByTool: {
        screwdriver: 'Visual check: RAM module latch on DIMM_A2 is half-open and tilted.',
        ram_tester: 'RAM TESTER: Intermittent contact on DIMM_A2 pins — reseat module.',
      },
    },
    faulty_storage: {
      label: 'Degraded / Failed Storage Drive',
      clueByTool: {
        diagnostic_usb: 'DIAG USB SMART: Drive 0 reports 1,420 reallocated sectors — Critical Failure.',
        multimeter: 'MULTIMETER: Storage controller draws abnormal current spike.',
      },
    },
    overheating_paste: {
      label: 'Dried Thermal Paste',
      clueByTool: {
        thermal_monitor: 'THERMAL PROBE: CPU idle at 74°C, hits 101°C under light load! Heat transfer poor.',
        screwdriver: 'Removed cooler: Original thermal compound is completely dried and cracked.',
      },
    },
    cooler_failure: {
      label: 'Seized CPU Cooler Fan / Pump',
      clueByTool: {
        thermal_monitor: 'THERMAL PROBE: CPU temperature climbing rapidly past 96°C, fan RPM = 0.',
        screwdriver: 'Visual check: CPU cooler fan motor seized and blades not spinning.',
        multimeter: 'MULTIMETER: 12V present at CPU_FAN header, zero current draw from cooler.',
      },
    },
    faulty_gpu: {
      label: 'Faulty Graphics Card',
      clueByTool: {
        multimeter: 'MULTIMETER: Shorted Vcore rail on discrete GPU PCIe card.',
        diagnostic_usb: 'DIAG USB (via iGPU/log): PCIe x16 VGA device failed initialization (Code 43).',
      },
    },
    loose_cables: {
      label: 'Loose Power Cables',
      clueByTool: {
        screwdriver: 'Visual check: 8-pin EPS CPU power plug is half-unplugged from motherboard.',
        multimeter: 'MULTIMETER: Open circuit on CPU VRM 12V input pins.',
      },
    },
    damaged_connector: {
      label: 'Corroded Front Panel / Power Header',
      clueByTool: {
        screwdriver: 'Visual check: Front panel PWR_SW jumper detached from JFP1 pins.',
        multimeter: 'MULTIMETER: Continuity test on power switch header failed.',
      },
    },
    corrupted_os: {
      label: 'Corrupted Operating System',
      clueByTool: {
        diagnostic_usb: 'DIAG USB: System32 kernel files corrupted (NTOSKRNL checksum mismatch). Reinstall OS.',
        recovery_media: 'RECOVERY: OS volume unreadable; clean OS installation recommended.',
      },
    },
    missing_drivers: {
      label: 'Missing Critical Drivers',
      clueByTool: {
        diagnostic_usb: 'DIAG USB: Chipset, Graphics, and Audio devices using generic basic drivers.',
      },
    },
    bios_misconfig: {
      label: 'Incorrect BIOS Boot Configuration',
      clueByTool: {
        recovery_media: 'RECOVERY: BIOS set to Legacy CSM while disk uses GPT/UEFI. Fix in BIOS.',
        diagnostic_usb: 'DIAG USB: Boot failure caused by misconfigured BIOS boot mode.',
      },
    },
    bootloader_failure: {
      label: 'Corrupted EFI Bootloader',
      clueByTool: {
        recovery_media: 'RECOVERY: Boot Configuration Data (BCD) / EFI partition missing.',
        diagnostic_usb: 'DIAG USB: Hardware healthy, but OS fails at boot handoff (0xc000000f).',
      },
    },
    partition_issue: {
      label: 'Unformatted / Broken Partition Table',
      clueByTool: {
        recovery_media: 'RECOVERY: Primary drive partition table unallocated or unformatted.',
        diagnostic_usb: 'DIAG USB: Storage hardware healthy, zero active boot partitions.',
      },
    },
  };

  const entry = map[type];
  return {
    id: `fault_${type}_${idx}`,
    type,
    label: entry.label,
    clueByTool: entry.clueByTool,
    resolved: false,
  };
}

export function runDiagnosticTool(build: PCBuildState, toolId: DiagnosticToolId): string[] {
  const findings: string[] = [];
  const cpu = getHardwareItem(build.cpuId);
  const psu = getHardwareItem(build.psuId);
  const unresolved = build.faults.filter((f) => !f.resolved);

  for (const fault of unresolved) {
    const clue = fault.clueByTool[toolId];
    if (clue) findings.push(clue);
  }

  if (findings.length === 0) {
    if (toolId === 'thermal_monitor') {
      const temp = calculateCpuTempC(build, false);
      findings.push(`THERMAL PROBE: CPU idle temperature ${temp}°C — within normal range.`);
    } else if (toolId === 'psu_tester') {
      findings.push(
        psu
          ? `PSU TESTER PASS: ${psu.model} (+12V: 12.04V, +5V: 5.01V, +3.3V: 3.31V).`
          : 'PSU TESTER: No power supply installed.'
      );
    } else if (toolId === 'ram_tester') {
      findings.push(
        build.ramIds.length > 0
          ? `RAM TESTER PASS: ${build.ramIds.length} module(s) seated cleanly, SPD OK.`
          : 'RAM TESTER: No RAM modules installed.'
      );
    } else if (toolId === 'diagnostic_usb') {
      findings.push(
        cpu
          ? `DIAG USB: CPU ${cpu.model} OK. Installed OS: ${build.osState.installedOS ?? 'None'}.`
          : 'DIAG USB: System unable to boot USB diagnostics.'
      );
    } else if (toolId === 'recovery_media') {
      findings.push(
        build.osState.bootloaderBroken
          ? 'RECOVERY: EFI bootloader damaged.'
          : 'RECOVERY: EFI partition and boot sectors appear intact.'
      );
    } else if (toolId === 'multimeter') {
      findings.push('MULTIMETER: Motherboard VRM & standby rails nominal.');
    } else {
      findings.push('INSPECTION: Physical chassis, screws, and cabling look normal.');
    }
  }

  return findings;
}

export function buildCustomerBrokenPC(faultTypes: FaultType[], tier: 'budget' | 'mid' | 'high'): PCBuildState {
  const pc = createEmptyPCBuild(tier === 'high' ? 'case_airflow_atx' : 'case_budget_matx');
  pc.motherboardId = tier === 'high' ? 'mb_b550' : 'mb_h510m';
  pc.cpuId = tier === 'high' ? 'cpu_r5_5600' : 'cpu_i3_10100';
  pc.coolerId = 'cool_stock';
  pc.ramIds = faultTypes.includes('missing_ram') ? [] : ['ram_ddr4_8', 'ram_ddr4_8'];
  pc.storageIds = ['sto_sata_500'];
  pc.gpuId = tier === 'high' ? 'gpu_rtx3060' : 'gpu_gtx1650';
  pc.psuId = tier === 'high' ? 'psu_650w' : 'psu_450w';

  pc.motherboardScrewsSecured = true;
  pc.cpuSocketOpen = false;
  pc.cpuRetentionClosed = true;
  pc.thermalPasteApplied = !faultTypes.includes('overheating_paste');
  pc.coolerSecured = true;
  pc.cpuFanConnected = !faultTypes.includes('cooler_failure');
  pc.storageCablesConnected = true;
  pc.gpuBracketSecured = true;
  pc.gpuPowerConnected = true;
  pc.atx24PinConnected = true;
  pc.cpu8PinConnected = !faultTypes.includes('loose_cables');
  pc.sataPowerConnected = true;
  pc.frontPanelConnected = !faultTypes.includes('damaged_connector');
  pc.usbHeaderConnected = true;
  pc.audioHeaderConnected = true;
  pc.caseFansConnected = true;
  pc.monitorConnected = true;
  pc.keyboardConnected = true;

  pc.osState = {
    installedOS: 'Windows 10',
    corrupted: faultTypes.includes('corrupted_os'),
    bootloaderBroken: faultTypes.includes('bootloader_failure'),
    partitions: faultTypes.includes('partition_issue')
      ? [{ id: 'p_unalloc', label: 'Unallocated Space', type: 'Unallocated', sizeGB: 500, formatted: false }]
      : [
          { id: 'p_efi', label: 'EFI System', type: 'EFI', sizeGB: 1, formatted: true },
          { id: 'p_sys', label: 'Windows C:', type: 'System', sizeGB: 499, formatted: true },
        ],
    language: 'English (US)',
    targetDriveId: 'sto_sata_500',
    installProgress: faultTypes.includes('corrupted_os') ? 0 : 100,
    setupCompleted: !faultTypes.includes('corrupted_os') && !faultTypes.includes('partition_issue'),
  };

  pc.drivers = {
    chipset: !faultTypes.includes('missing_drivers'),
    graphics: !faultTypes.includes('missing_drivers'),
    audio: !faultTypes.includes('missing_drivers'),
    network: !faultTypes.includes('missing_drivers'),
    storage: !faultTypes.includes('missing_drivers'),
    peripheral: !faultTypes.includes('missing_drivers'),
  };

  if (faultTypes.includes('bios_misconfig')) {
    pc.biosSettings.uefiMode = false;
    pc.biosSettings.bootPriority = ['hdd', 'usb', 'nvme', 'sata'];
  }

  pc.faults = faultTypes.map((ft, idx) => createFaultRecord(ft, idx));
  return pc;
}
