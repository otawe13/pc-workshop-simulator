import {
  DiagnosticToolId,
  FaultType,
  PCBuildState,
  PCFault,
} from '../types/game';
import { getHardwareItem } from './hardwareDatabase';
import { calculateCpuTempC, createEmptyPCBuild } from './simulationEngine';
import { createDefaultNetworkConfig, evaluateNetworkHealth } from './virtualOsEngine';

export interface DiagnosticToolMeta {
  id: DiagnosticToolId;
  name: string;
  shortDesc: string;
  requiresUpgradeId?: string;
}

export const DIAGNOSTIC_TOOLS: DiagnosticToolMeta[] = [
  {
    id: 'screwdriver',
    name: 'Obeng Presisi / Screwdriver',
    shortDesc: 'Buka casing, cek baut, dudukan RAM/GPU, serta kabel konektor.',
  },
  {
    id: 'air_blower',
    name: 'Air Blower (Penghisap Debu)',
    shortDesc: 'Periksa & bersihkan tumpukan debu tebal di radiator, heatsink, dan kipas.',
  },
  {
    id: 'cleaning_brush',
    name: 'Kuas Pembersih Anti-Statis',
    shortDesc: 'Bersihkan debu halus di pin slot DIMM, PCIe, dan konektor yang teroksidasi.',
  },
  {
    id: 'cable_tester',
    name: 'Cable & LAN Tester',
    shortDesc: 'Uji kabel ATX 24-pin, EPS 8-pin, SATA data, dan konektivitas RJ45/LAN.',
  },
  {
    id: 'psu_tester',
    name: 'PSU Rail Tester',
    shortDesc: 'Uji tegangan rel +12V, +5V, +3.3V dan daya standby +5VSB.',
  },
  {
    id: 'multimeter',
    name: 'Multimeter Digital',
    shortDesc: 'Ukur kontinuitas jalur VRM motherboard, GPU Vcore, dan port.',
  },
  {
    id: 'ram_tester',
    name: 'RAM Slot & DIMM Tester',
    shortDesc: 'Deteksi modul RAM longgar, profil SPD, atau tipe DDR tidak cocok.',
  },
  {
    id: 'thermal_monitor',
    name: 'IR Thermal Probe',
    shortDesc: 'Pantau suhu idle CPU/VRM dan kualitas transfer panas pasta termal.',
  },
  {
    id: 'diagnostic_usb',
    name: 'Diagnostic Boot USB',
    shortDesc: 'Pindai kesehatan S.M.A.R.T drive, kernel OS, dan status driver.',
  },
  {
    id: 'recovery_media',
    name: 'Media Pemulihan EFI',
    shortDesc: 'Periksa bootloader EFI, tabel partisi GPT, dan pengaturan BIOS.',
  },
];

export function createFaultRecord(type: FaultType, idx = 0): PCFault {
  const map: Record<FaultType, { label: string; clueByTool: Partial<Record<DiagnosticToolId, string>> }> = {
    faulty_psu: {
      label: 'Power Supply (PSU) Rusak',
      clueByTool: {
        psu_tester: 'PSU TESTER FAIL: +12V rail reads 0.00V, +5VSB unstable (3.1V). PSU must be replaced.',
        multimeter: 'MULTIMETER: No DC output on 24-pin ATX harness under load.',
        screwdriver: 'Visual check: Burnt capacitor smell near PSU exhaust.',
      },
    },
    missing_ram: {
      label: 'Modul RAM Hilang / Kosong',
      clueByTool: {
        screwdriver: 'Visual check: All DIMM slots on the motherboard are empty!',
        ram_tester: 'RAM TESTER: 0 modules detected in Channel A/B.',
      },
    },
    loose_ram: {
      label: 'Keping RAM Longgar / Kotor',
      clueByTool: {
        screwdriver: 'Visual check: RAM module latch on DIMM_A2 is half-open and tilted.',
        ram_tester: 'RAM TESTER: Intermittent contact on DIMM_A2 pins — reseat module.',
        cleaning_brush: 'BRUSH CHECK: Debu menumpuk di pin emas slot DIMM_A2.',
      },
    },
    incompatible_ram: {
      label: 'Profil / Modul RAM Tidak Cocok',
      clueByTool: {
        ram_tester: 'RAM TESTER: Timing SPD & voltase RAM bermasalah — ganti atau atur ulang modul.',
        diagnostic_usb: 'DIAG USB: Memory training gagal (POST beep 4x).',
      },
    },
    faulty_storage: {
      label: 'Drive Penyimpanan Rusak (Bad Sector)',
      clueByTool: {
        diagnostic_usb: 'DIAG USB SMART: Drive 0 reports 1,420 reallocated sectors — Critical Failure.',
        multimeter: 'MULTIMETER: Storage controller draws abnormal current spike.',
      },
    },
    overheating_paste: {
      label: 'Pasta Termal Kering (Overheat)',
      clueByTool: {
        thermal_monitor: 'THERMAL PROBE: CPU idle at 74°C, hits 101°C under light load! Heat transfer poor.',
        screwdriver: 'Removed cooler: Original thermal compound is completely dried and cracked.',
      },
    },
    cooler_failure: {
      label: 'Kipas / Pompa CPU Cooler Mati',
      clueByTool: {
        thermal_monitor: 'THERMAL PROBE: CPU temperature climbing rapidly past 96°C, fan RPM = 0.',
        screwdriver: 'Visual check: CPU cooler fan motor seized and blades not spinning.',
        multimeter: 'MULTIMETER: 12V present at CPU_FAN header, zero current draw from cooler.',
      },
    },
    dust_clogged: {
      label: 'Tumpukan Debu Tebal di Heatsink & Kipas',
      clueByTool: {
        air_blower: 'AIR BLOWER: Debu tebal menyumbat sirip heatsink & filter depan! Bersihkan dengan Air Blower.',
        cleaning_brush: 'CLEANING BRUSH: Kipas casing & bilah GPU tertutup debu tebal.',
        thermal_monitor: 'THERMAL PROBE: Suhu naik +20°C karena aliran udara tersumbat debu.',
      },
    },
    faulty_gpu: {
      label: 'Kartu Grafis (GPU) Rusak',
      clueByTool: {
        multimeter: 'MULTIMETER: Shorted Vcore rail on discrete GPU PCIe card.',
        diagnostic_usb: 'DIAG USB (via iGPU/log): PCIe x16 VGA device failed initialization (Code 43).',
      },
    },
    loose_cables: {
      label: 'Kabel Daya / Data Longgar',
      clueByTool: {
        screwdriver: 'Visual check: 8-pin EPS CPU power plug is half-unplugged from motherboard.',
        cable_tester: 'CABLE TESTER: Kabel 8-pin EPS CPU / SATA putus kontak.',
        multimeter: 'MULTIMETER: Open circuit on CPU VRM 12V input pins.',
      },
    },
    damaged_connector: {
      label: 'Header Tombol Power JFP1 Terlepas / Terkorosi',
      clueByTool: {
        screwdriver: 'Visual check: Front panel PWR_SW jumper detached from JFP1 pins.',
        cleaning_brush: 'CLEANING BRUSH: Kontak pin panel depan kotor, perlu dibersihkan dan dipasang ulang.',
        multimeter: 'MULTIMETER: Continuity test on power switch header failed.',
      },
    },
    corrupted_os: {
      label: 'Sistem Operasi (OS) Rusak',
      clueByTool: {
        diagnostic_usb: 'DIAG USB: System32 kernel files corrupted (NTOSKRNL checksum mismatch). Reinstall OS.',
        recovery_media: 'RECOVERY: OS volume unreadable; clean OS installation recommended.',
      },
    },
    missing_drivers: {
      label: 'Driver Hardware Belum Terpasang',
      clueByTool: {
        diagnostic_usb: 'DIAG USB: Chipset, Graphics, and Audio devices using generic basic drivers.',
      },
    },
    bios_misconfig: {
      label: 'Salah Konfigurasi Mode Boot BIOS',
      clueByTool: {
        recovery_media: 'RECOVERY: BIOS set to Legacy CSM while disk uses GPT/UEFI. Fix in BIOS.',
        diagnostic_usb: 'DIAG USB: Boot failure caused by misconfigured BIOS boot mode.',
      },
    },
    bootloader_failure: {
      label: 'Bootloader EFI Rusak (0xc000000f)',
      clueByTool: {
        recovery_media: 'RECOVERY: Boot Configuration Data (BCD) / EFI partition missing.',
        diagnostic_usb: 'DIAG USB: Hardware healthy, but OS fails at boot handoff (0xc000000f).',
      },
    },
    partition_issue: {
      label: 'Tabel Partisi Belum Diformat / Rusak',
      clueByTool: {
        recovery_media: 'RECOVERY: Primary drive partition table unallocated or unformatted.',
        diagnostic_usb: 'DIAG USB: Storage hardware healthy, zero active boot partitions.',
      },
    },
    network_issue: {
      label: 'Gangguan Konfigurasi IP / Jaringan LAN',
      clueByTool: {
        cable_tester: 'CABLE TESTER: Link fisik LAN terdeteksi, namun paket DNS / IPv4 gagal keluar.',
        diagnostic_usb: 'DIAG USB: Adapter menggunakan IP APIPA 169.254.x.x & Gateway 0.0.0.0 — perbaiki di Network Settings Desktop OS.',
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
    } else if (toolId === 'air_blower' || toolId === 'cleaning_brush') {
      const dust = build.dustLevel ?? 0;
      findings.push(
        dust > 25
          ? `CLEANING CHECK: Ditemukan debu ringan-sedang (${dust}%). Gunakan tombol Bersihkan Debu agar suhu optimal.`
          : 'CLEANING CHECK: Interior casing, sirip cooler, dan pin konektor dalam kondisi bersih.'
      );
    } else if (toolId === 'cable_tester') {
      const net = evaluateNetworkHealth(build);
      findings.push(
        build.atx24PinConnected && build.cpu8PinConnected
          ? `CABLE TESTER PASS: Jalur daya 24-pin, 8-pin EPS, dan SATA normal. Jaringan: ${net.online ? 'ONLINE' : net.reasonId}`
          : 'CABLE TESTER: Kabel daya utama atau SATA belum terhubung lengkap.'
      );
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
  pc.dustLevel = faultTypes.includes('dust_clogged') ? 85 : 10;

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
    language: 'Indonesian / English',
    keyboardLayout: 'US QWERTY',
    targetDriveId: 'sto_sata_500',
    installProgress: faultTypes.includes('corrupted_os') ? 0 : 100,
    setupCompleted: !faultTypes.includes('corrupted_os') && !faultTypes.includes('partition_issue'),
    oobeCompleted: !faultTypes.includes('corrupted_os') && !faultTypes.includes('partition_issue'),
    oobeUsername: 'Pelanggan',
    oobeComputerName: 'CLIENT-PC',
    privacyTelemetry: false,
  };

  pc.drivers = {
    chipset: !faultTypes.includes('missing_drivers'),
    graphics: !faultTypes.includes('missing_drivers'),
    audio: !faultTypes.includes('missing_drivers'),
    network: !faultTypes.includes('missing_drivers'),
    storage: !faultTypes.includes('missing_drivers'),
    peripheral: !faultTypes.includes('missing_drivers'),
  };

  pc.networkConfig = createDefaultNetworkConfig(faultTypes.includes('network_issue'));

  if (faultTypes.includes('bios_misconfig')) {
    pc.biosSettings.uefiMode = false;
    pc.biosSettings.bootPriority = ['hdd', 'usb', 'nvme', 'sata'];
  }

  pc.faults = faultTypes.map((ft, idx) => createFaultRecord(ft, idx));
  return pc;
}
