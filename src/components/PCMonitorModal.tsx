import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Cpu,
  Disc,
  HardDrive,
  Monitor,
  Power,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Usb,
  X,
} from 'lucide-react';
import { DriverState, Language, OSType, PCBuildState } from '../types/game';
import {
  calculateCpuTempC,
  determineBootOutcome,
  runHardwareBenchmarks,
  runPOST,
  validatePartitionsForInstall,
} from '../engine/simulationEngine';
import { getHardwareItem } from '../engine/hardwareDatabase';
import { audioManager } from '../engine/audioManager';
import { getEducationEntry } from '../i18n/hardwareEducation';
import { getLocalizedPostMessage, t } from '../i18n/translations';

interface PCMonitorModalProps {
  lang: Language;
  showHardwareEducation: boolean;
  build: PCBuildState;
  onUpdateBuild: (updater: (prev: PCBuildState) => PCBuildState) => void;
  onClose: () => void;
}

type MonitorMode = 'off' | 'post' | 'bios' | 'installer' | 'desktop';
type BIOSTab = 'main' | 'sysinfo' | 'cpu' | 'memory' | 'storage' | 'monitor' | 'boot' | 'security' | 'exit';

export const PCMonitorModal: React.FC<PCMonitorModalProps> = ({
  lang,
  showHardwareEducation,
  build,
  onUpdateBuild,
  onClose,
}) => {
  const [screenMode, setScreenMode] = useState<MonitorMode>(build.poweredOn ? 'post' : 'off');
  const [biosTab, setBiosTab] = useState<BIOSTab>('main');
  const [installStep, setInstallStep] = useState<'usb' | 'lang' | 'partition' | 'progress' | 'done'>('usb');
  const [selectedOS, setSelectedOS] = useState<OSType>(build.usbBootMediaInserted ?? 'Windows 11');
  const [installError, setInstallError] = useState<string | null>(null);
  const [installingPct, setInstallingPct] = useState(0);
  const [benchRunning, setBenchRunning] = useState<string | null>(null);
  const [showEdu, setShowEdu] = useState(false);

  const post = runPOST(build);
  const bootOutcome = determineBootOutcome(build);
  const eduBios = getEducationEntry('bios_uefi', lang);

  const handlePowerToggle = () => {
    const nextPower = !build.poweredOn;
    onUpdateBuild((p) => ({ ...p, poweredOn: nextPower }));
    if (nextPower) {
      audioManager.playPowerOn();
      const res = runPOST({ ...build, poweredOn: true });
      audioManager.playPostBeeps(res.beepCount);
      audioManager.setFanHum(true);
      setScreenMode('post');
    } else {
      audioManager.setFanHum(false);
      setScreenMode('off');
    }
  };

  useEffect(() => {
    return () => {
      audioManager.setFanHum(false);
    };
  }, []);

  // Installer progress timer
  useEffect(() => {
    if (screenMode !== 'installer' || installStep !== 'progress') return;
    const timer = window.setInterval(() => {
      setInstallingPct((prev) => {
        if (prev >= 100) {
          window.clearInterval(timer);
          onUpdateBuild((b) => ({
            ...b,
            osState: {
              ...b.osState,
              installedOS: selectedOS,
              corrupted: false,
              bootloaderBroken: false,
              installProgress: 100,
              setupCompleted: true,
            },
            biosSettings: {
              ...b.biosSettings,
              bootPriority: ['nvme', 'sata', 'usb', 'hdd'],
            },
            faults: b.faults.map((f) =>
              f.type === 'corrupted_os' || f.type === 'bootloader_failure' || f.type === 'partition_issue'
                ? { ...f, resolved: true }
                : f
            ),
          }));
          setInstallStep('done');
          audioManager.playConfirm();
          return 100;
        }
        return prev + 20;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [screenMode, installStep, selectedOS, onUpdateBuild]);

  const handleContinueBoot = () => {
    if (!post.passed) {
      audioManager.playError();
      return;
    }
    if (bootOutcome.target === 'os_installer') {
      setInstallStep('lang');
      setScreenMode('installer');
    } else if (bootOutcome.target === 'os_desktop') {
      setScreenMode('desktop');
    } else {
      audioManager.playError();
    }
  };

  const moveBootPriority = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= build.biosSettings.bootPriority.length) return;
    onUpdateBuild((p) => {
      const next = [...p.biosSettings.bootPriority];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...p, biosSettings: { ...p.biosSettings, bootPriority: next } };
    });
    audioManager.playClick();
  };

  const handlePartitionAction = (action: 'create_efi' | 'create_sys' | 'format_sys' | 'delete_all') => {
    setInstallError(null);
    onUpdateBuild((prev) => {
      let parts = [...prev.osState.partitions];
      const unalloc = parts.find((p) => p.type === 'Unallocated');
      if (action === 'delete_all') {
        parts = [
          {
            id: 'p_unalloc',
            label: lang === 'en' ? 'Unallocated Space' : 'Ruang Belum Teralokasi',
            type: 'Unallocated',
            sizeGB: 500,
            formatted: false,
          },
        ];
      } else if (action === 'create_efi' && unalloc && unalloc.sizeGB >= 1) {
        unalloc.sizeGB -= 1;
        parts.unshift({ id: `efi_${Date.now()}`, label: 'EFI System', type: 'EFI', sizeGB: 1, formatted: true });
      } else if (action === 'create_sys' && unalloc && unalloc.sizeGB >= 60) {
        const alloc = unalloc.sizeGB;
        parts = parts.filter((p) => p.type !== 'Unallocated');
        parts.push({ id: `sys_${Date.now()}`, label: 'Primary OS', type: 'System', sizeGB: alloc, formatted: false });
      } else if (action === 'format_sys') {
        parts = parts.map((p) => (p.type === 'System' ? { ...p, formatted: true } : p));
      }
      return { ...prev, osState: { ...prev.osState, partitions: parts } };
    });
    audioManager.playClick();
  };

  const startOSInstall = () => {
    const check = validatePartitionsForInstall(build.osState.partitions);
    if (!check.valid) {
      setInstallError(
        lang === 'id'
          ? 'Konfigurasi partisi belum siap: pastikan terdapat partisi EFI dan partisi Sistem yang sudah diformat.'
          : check.error ?? 'Partition configuration invalid.'
      );
      audioManager.playError();
      return;
    }
    setInstallError(null);
    setInstallingPct(0);
    setInstallStep('progress');
  };

  const installDriver = (key: keyof DriverState) => {
    audioManager.playInstallPart();
    onUpdateBuild((prev) => {
      const nextDrivers = { ...prev.drivers, [key]: true };
      const allDone = Object.values(nextDrivers).every(Boolean);
      return {
        ...prev,
        drivers: nextDrivers,
        faults: allDone
          ? prev.faults.map((f) => (f.type === 'missing_drivers' ? { ...f, resolved: true } : f))
          : prev.faults,
      };
    });
  };

  const installAllDrivers = () => {
    audioManager.playConfirm();
    onUpdateBuild((prev) => ({
      ...prev,
      drivers: { chipset: true, graphics: true, audio: true, network: true, storage: true, peripheral: true },
      faults: prev.faults.map((f) => (f.type === 'missing_drivers' ? { ...f, resolved: true } : f)),
    }));
  };

  const runSuite = (testName: string) => {
    setBenchRunning(testName);
    window.setTimeout(() => {
      const res = runHardwareBenchmarks(build);
      onUpdateBuild((p) => ({ ...p, benchmarks: res }));
      setBenchRunning(null);
      if (res.stabilityPassed) audioManager.playConfirm();
      else audioManager.playError();
    }, 650);
  };

  const cpu = getHardwareItem(build.cpuId);
  const mb = getHardwareItem(build.motherboardId);
  const gpu = getHardwareItem(build.gpuId);

  const guidedNextHint = !build.poweredOn
    ? lang === 'en'
      ? 'Step 1: Click Power On to execute POST hardware diagnostics.'
      : 'Panduan: Klik "Nyalakan PC" untuk menjalankan diagnosa POST.'
    : !post.passed
    ? lang === 'en'
      ? 'Fix the POST error reported below at the Workbench or Repair Table.'
      : 'Perbaiki pesan galat POST di bawah melalui Meja Perakitan atau Meja Perbaikan.'
    : !build.osState.setupCompleted && !build.usbBootMediaInserted
    ? lang === 'en'
      ? 'Next: Select an OS USB above and click Insert USB.'
      : 'Panduan: Pilih OS pada kontrol USB di atas lalu klik "Pasang USB".'
    : !build.osState.setupCompleted && build.biosSettings.bootPriority[0] !== 'usb'
    ? lang === 'en'
      ? 'Next: Enter BIOS -> Boot -> Move USB Flash to Option #1 -> Save & Reboot.'
      : 'Panduan: Masuk Pengaturan BIOS -> tab Boot -> naikkan USB ke urutan #1 -> Simpan & Restart.'
    : !build.osState.setupCompleted
    ? lang === 'en'
      ? 'Next: Continue Boot to USB Installer, create EFI & formatted System partition, and install OS.'
      : 'Panduan: Klik Lanjutkan Boot ke Installer USB, buat partisi EFI & Sistem, format, lalu instal OS.'
    : !Object.values(build.drivers).every(Boolean)
    ? lang === 'en'
      ? 'Next: Boot to OS Desktop and click Install All in Driver Manager.'
      : 'Panduan: Pada Desktop OS, klik "Instal Semua" di Manajer Driver.'
    : !build.benchmarks?.stabilityPassed
    ? lang === 'en'
      ? 'Final Test: Run any Benchmark on Desktop to verify stability and thermals.'
      : 'Tahap Akhir: Jalankan Uji Benchmark di Desktop hingga muncul STABILITAS LULUS.'
    : lang === 'en'
    ? 'All OS, drivers, and stability checks passed!'
    : 'Semua pengecekan POST, OS, Driver, dan Uji Stabilitas telah LULUS!';

  const biosTabs: [BIOSTab, string][] =
    lang === 'en'
      ? [
          ['main', 'Main'],
          ['sysinfo', 'System'],
          ['cpu', 'CPU'],
          ['memory', 'Memory'],
          ['storage', 'Storage'],
          ['monitor', 'HW Monitor'],
          ['boot', 'Boot'],
          ['security', 'Security'],
          ['exit', 'Save & Exit'],
        ]
      : [
          ['main', 'Utama'],
          ['sysinfo', 'Sistem'],
          ['cpu', 'CPU'],
          ['memory', 'Memori'],
          ['storage', 'Penyimpanan'],
          ['monitor', 'Monitor HW'],
          ['boot', 'Boot'],
          ['security', 'Keamanan'],
          ['exit', 'Simpan & Keluar'],
        ];

  const benchTests =
    lang === 'en'
      ? ['CPU & Thermal Test', 'GPU 3D Benchmark', 'RAM & Storage Test', 'Full System Stability']
      : ['Uji CPU & Suhu', 'Benchmark GPU 3D', 'Uji RAM & SSD', 'Stabilitas Penuh'];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-6 bg-black/75">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#080c14] border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Monitor Physical Top Bezel */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Monitor className="w-4 h-4 text-sky-400" />
            <span className="font-display font-bold">{t(lang, 'monitorHeader')}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400 font-mono-num">
              {build.poweredOn ? `${t(lang, 'tempLabel')} ${calculateCpuTempC(build)}°C` : t(lang, 'powerOffLabel')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bootable USB Prep Control */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
              <Usb className="w-3.5 h-3.5 text-sky-400" />
              <select
                aria-label="Bootable USB OS Selection"
                value={selectedOS}
                onChange={(e) => setSelectedOS(e.target.value as OSType)}
                className="bg-transparent text-[11px] text-slate-200 focus:outline-none"
              >
                <option value="Windows 11">Windows 11 USB</option>
                <option value="Windows 10">Windows 10 USB</option>
                <option value="Ubuntu">Ubuntu 24.04 USB</option>
                <option value="Linux Mint">Linux Mint USB</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const inserting = build.usbBootMediaInserted !== selectedOS;
                  onUpdateBuild((p) => ({
                    ...p,
                    usbBootMediaInserted: inserting ? selectedOS : null,
                  }));
                  audioManager.playClick();
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                  build.usbBootMediaInserted === selectedOS ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
                }`}
              >
                {build.usbBootMediaInserted === selectedOS ? t(lang, 'usbInserted') : t(lang, 'insertUsb')}
              </button>
            </div>

            {showHardwareEducation && (
              <button
                type="button"
                onClick={() => setShowEdu((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 font-medium cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t(lang, 'hardwareEduToggle')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePowerToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                build.poweredOn ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {build.poweredOn ? t(lang, 'powerOffBtn') : t(lang, 'powerOnBtn')}
            </button>

            <button
              type="button"
              aria-label="Close Monitor"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guided Hint Strip + Optional BIOS/OS Education */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 text-[11px] text-sky-300 flex items-center justify-between gap-2">
          <span>{guidedNextHint}</span>
        </div>

        {showHardwareEducation && showEdu && (
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-sky-300">{eduBios.title}</div>
            <p>{eduBios.functionDesc} {eduBios.compatibilityTip}</p>
          </div>
        )}

        {/* Monitor Screen Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#05080f] min-h-[410px]">
          {screenMode === 'off' && (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center space-y-3">
              <div className="text-slate-500 font-mono-num text-sm">{t(lang, 'noSignalTitle')}</div>
              <button
                type="button"
                onClick={handlePowerToggle}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
              >
                {t(lang, 'pressPowerBtn')}
              </button>
            </div>
          )}

          {/* POST SCREEN */}
          {screenMode === 'post' && (
            <div className="font-mono-num text-xs space-y-4 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-sky-400 font-bold text-sm">{t(lang, 'postHeader')}</span>
                <span>
                  {t(lang, 'beepsLabel')}: {post.beepCount}
                </span>
              </div>

              <div className="space-y-1">
                <div>CPU: {post.detectedCpu ?? (lang === 'en' ? 'NOT DETECTED' : 'TIDAK TERDETEKSI')}</div>
                <div>
                  RAM:{' '}
                  {post.detectedRamGB > 0
                    ? `${post.detectedRamGB} GB`
                    : lang === 'en'
                    ? 'NONE'
                    : 'TIDAK ADA'}
                </div>
                <div>GPU: {post.detectedGpu ?? (lang === 'en' ? 'NONE' : 'TIDAK ADA')}</div>
                <div>
                  {lang === 'en' ? 'Storage Devices' : 'Perangkat Penyimpanan'}: {post.detectedStorageCount}
                </div>
                <div>
                  Bootable USB: {build.usbBootMediaInserted ?? (lang === 'en' ? 'Not Inserted' : 'Belum Dipasang')}
                </div>
                <div>
                  {lang === 'en' ? 'CPU Temp' : 'Suhu CPU'}: {post.cpuTempC}°C
                </div>
              </div>

              <div
                className={`p-3 rounded border ${
                  post.passed
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                }`}
              >
                <div className="font-bold">{getLocalizedPostMessage(post.errorCode, post.message, lang)}</div>
                {post.details.map((d, i) => (
                  <div key={i} className="mt-1 text-[11px]">
                    {d}
                  </div>
                ))}
              </div>

              {post.passed && bootOutcome.target === 'boot_error' && (
                <div className="p-3 rounded bg-amber-950/30 border border-amber-500/40 text-amber-300">
                  {lang === 'id'
                    ? 'Belum ada OS yang bisa diboot. Pasang USB Bootable, atur USB sebagai Boot #1 di BIOS, atau pulihkan Bootloader.'
                    : bootOutcome.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {post.passed && (
                  <>
                    <button
                      type="button"
                      onClick={() => setScreenMode('bios')}
                      className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold cursor-pointer"
                    >
                      {t(lang, 'enterBiosBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueBoot}
                      className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                    >
                      {t(lang, 'continueBootBtn')} (
                      {bootOutcome.target === 'os_installer'
                        ? t(lang, 'bootTargetInstaller')
                        : bootOutcome.target === 'os_desktop'
                        ? t(lang, 'bootTargetDesktop')
                        : t(lang, 'bootTargetCheck')}
                      )
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* INTERACTIVE UEFI BIOS */}
          {screenMode === 'bios' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d1f3a] border border-sky-700/50 px-4 py-2 rounded">
                <span className="font-display font-bold text-sky-300 text-sm">{t(lang, 'biosUtilityTitle')}</span>
                <div className="flex flex-wrap gap-1">
                  {biosTabs.map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBiosTab(id)}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                        biosTab === id ? 'bg-sky-500 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded border border-sky-900/60 bg-[#081224] text-xs space-y-3 min-h-[260px]">
                {biosTab === 'main' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'BIOS Overview' : 'Ringkasan BIOS'}
                    </div>
                    <div>
                      Motherboard: {mb?.manufacturer} {mb?.model} (BIOS v{mb?.biosVersion})
                    </div>
                    <div>
                      {lang === 'en' ? 'Processor' : 'Prosesor'}: {cpu?.manufacturer} {cpu?.model}
                    </div>
                    <div>
                      {lang === 'en' ? 'Total Memory' : 'Total Memori'}: {post.detectedRamGB} GB{' '}
                      {build.biosSettings.xmpEnabled ? '(XMP/EXPO ON)' : '(JEDEC Default)'}
                    </div>
                    <div>Boot Mode: {build.biosSettings.uefiMode ? 'UEFI Native' : 'Legacy CSM'}</div>
                  </div>
                )}

                {biosTab === 'sysinfo' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'System Information' : 'Informasi Sistem'}
                    </div>
                    <div>Manufacturer: PC Workshop Custom Build</div>
                    <div>Chipset: {mb?.chipset ?? '-'}</div>
                    <div>BIOS Version: {mb?.biosVersion ?? '1.0'}</div>
                  </div>
                )}

                {biosTab === 'cpu' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'CPU Configuration' : 'Konfigurasi CPU'}
                    </div>
                    <div>Model: {cpu?.model ?? '-'}</div>
                    <div>Soket: {cpu?.socket ?? '-'}</div>
                    <div>TDP: {cpu?.tdpW ?? 0} W</div>
                    <div>
                      {lang === 'en' ? 'Integrated Graphics' : 'Grafis Terintegrasi (iGPU)'}:{' '}
                      {cpu?.hasIntegratedGraphics
                        ? lang === 'en'
                          ? 'Enabled'
                          : 'Aktif'
                        : lang === 'en'
                        ? 'Not Present'
                        : 'Tidak Ada'}
                    </div>
                  </div>
                )}

                {biosTab === 'memory' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'Memory Information' : 'Informasi Memori (RAM)'}
                    </div>
                    <div>
                      {lang === 'en' ? 'Detected Modules' : 'Modul Terdeteksi'}: {build.ramIds.length}
                    </div>
                    <div>
                      {lang === 'en' ? 'Total Capacity' : 'Total Kapasitas'}: {post.detectedRamGB} GB
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBuild((p) => ({
                          ...p,
                          biosSettings: { ...p.biosSettings, xmpEnabled: !p.biosSettings.xmpEnabled },
                        }))
                      }
                      className="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white cursor-pointer"
                    >
                      XMP / EXPO:{' '}
                      {build.biosSettings.xmpEnabled ? t(lang, 'onLabel') : t(lang, 'offLabel')}
                    </button>
                  </div>
                )}

                {biosTab === 'storage' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'Detected Storage Devices' : 'Perangkat Penyimpanan Terdeteksi'}
                    </div>
                    {build.storageIds.length === 0 ? (
                      <div className="text-amber-300">
                        {lang === 'en' ? 'No drives detected.' : 'Tidak ada SSD/HDD terdeteksi.'}
                      </div>
                    ) : (
                      build.storageIds.map((id, i) => {
                        const d = getHardwareItem(id);
                        return (
                          <div key={i}>
                            Port {i}: {d?.manufacturer} {d?.model} ({d?.capacityGB} GB · {d?.storageInterface})
                          </div>
                        );
                      })
                    )}
                    <div>
                      USB Bootable: {build.usbBootMediaInserted ?? (lang === 'en' ? 'Not Attached' : 'Belum Dipasang')}
                    </div>
                  </div>
                )}

                {biosTab === 'monitor' && (
                  <div className="space-y-3">
                    <div className="text-sky-300 font-semibold text-sm flex items-center gap-2">
                      <Thermometer className="w-4 h-4" /> {lang === 'en' ? 'Hardware Monitor' : 'Pemantau Hardware'}
                    </div>
                    <div>
                      {lang === 'en' ? 'CPU Package Temp' : 'Suhu CPU'}:{' '}
                      <span className="font-mono-num text-amber-300">{calculateCpuTempC(build)}°C</span>
                    </div>
                    <div>
                      {lang === 'en' ? 'CPU Fan Speed' : 'Kecepatan Kipas CPU'}:{' '}
                      <span className="font-mono-num">{build.cpuFanConnected ? '1,420 RPM' : '0 RPM (GALAT)'}</span>
                    </div>
                    <div>+12V Rail: 12.048 V · +5V Rail: 5.012 V · Vcore: 1.240 V</div>
                    <div className="flex items-center gap-2">
                      <span>{lang === 'en' ? 'Fan Profile:' : 'Profil Kipas:'}</span>
                      {(['silent', 'standard', 'turbo'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            onUpdateBuild((p) => ({ ...p, biosSettings: { ...p.biosSettings, fanCurveMode: m } }))
                          }
                          className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                            build.biosSettings.fanCurveMode === m
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {biosTab === 'boot' && (
                  <div className="space-y-3">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'Boot Priority & UEFI Mode' : 'Urutan Boot & Mode UEFI'}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBuild((p) => ({
                            ...p,
                            biosSettings: { ...p.biosSettings, uefiMode: !p.biosSettings.uefiMode },
                            faults: p.faults.map((f) => (f.type === 'bios_misconfig' ? { ...f, resolved: true } : f)),
                          }))
                        }
                        className="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white cursor-pointer"
                      >
                        Mode Boot: {build.biosSettings.uefiMode ? 'UEFI (Direkomendasikan)' : 'Legacy CSM'}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {build.biosSettings.bootPriority.map((dev, idx) => (
                        <div
                          key={dev}
                          className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded border border-slate-800"
                        >
                          <span className="uppercase font-mono-num">
                            Boot #{idx + 1}:{' '}
                            {dev === 'usb'
                              ? `USB Flash (${build.usbBootMediaInserted ?? (lang === 'en' ? 'Empty' : 'Kosong')})`
                              : `${dev.toUpperCase()} Drive`}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveBootPriority(idx, -1)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              {lang === 'en' ? 'Up' : 'Naik'}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBootPriority(idx, 1)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              {lang === 'en' ? 'Down' : 'Turun'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {biosTab === 'security' && (
                  <div className="space-y-2">
                    <div className="text-sky-300 font-semibold text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> {lang === 'en' ? 'Security & TPM' : 'Keamanan & TPM 2.0'}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBuild((p) => ({
                          ...p,
                          biosSettings: { ...p.biosSettings, secureBoot: !p.biosSettings.secureBoot },
                        }))
                      }
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
                    >
                      Secure Boot: {build.biosSettings.secureBoot ? t(lang, 'onLabel') : t(lang, 'offLabel')}
                    </button>
                  </div>
                )}

                {biosTab === 'exit' && (
                  <div className="space-y-3">
                    <div className="text-sky-300 font-semibold text-sm">
                      {lang === 'en' ? 'Save Configuration & Reboot' : 'Simpan Pengaturan & Restart'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBuild((p) => ({
                          ...p,
                          faults: p.faults.map((f) => (f.type === 'bios_misconfig' ? { ...f, resolved: true } : f)),
                        }));
                        audioManager.playConfirm();
                        const nextBoot = determineBootOutcome(build);
                        if (nextBoot.target === 'os_installer') {
                          setInstallStep('lang');
                          setScreenMode('installer');
                        } else if (nextBoot.target === 'os_desktop') {
                          setScreenMode('desktop');
                        } else {
                          setScreenMode('post');
                        }
                      }}
                      className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                    >
                      {lang === 'en'
                        ? 'Save Changes & Reboot System (F10)'
                        : 'Simpan Perubahan & Restart PC (F10)'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPERATING SYSTEM INSTALLER */}
          {screenMode === 'installer' && (
            <div className="max-w-2xl mx-auto p-5 rounded-xl bg-[#0d1729] border border-sky-600/40 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sky-300 font-display font-bold">
                  <Disc className="w-5 h-5" />
                  {selectedOS} · {t(lang, 'osSetupTitle')}
                </div>
                <span className="text-xs text-slate-400">UEFI Mode</span>
              </div>

              {installStep === 'lang' && (
                <div className="space-y-3 text-xs">
                  <label className="block text-slate-300">{t(lang, 'osSelectLang')}</label>
                  <select
                    value={build.osState.language}
                    onChange={(e) =>
                      onUpdateBuild((p) => ({ ...p, osState: { ...p.osState, language: e.target.value } }))
                    }
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
                  >
                    <option>Bahasa Indonesia</option>
                    <option>English (US)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setInstallStep('partition')}
                    className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                  >
                    {t(lang, 'nextPartitionStep')}
                  </button>
                </div>
              )}

              {installStep === 'partition' && (
                <div className="space-y-3 text-xs">
                  <div className="text-slate-300">
                    {t(lang, 'managePartitionsLabel')} ({getHardwareItem(build.storageIds[0])?.model ?? 'Storage'}):
                  </div>

                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="px-3 py-2">{t(lang, 'partColName')}</th>
                          <th className="px-3 py-2">{t(lang, 'partColType')}</th>
                          <th className="px-3 py-2">{t(lang, 'partColSize')}</th>
                          <th className="px-3 py-2">{t(lang, 'partColFormatted')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {build.osState.partitions.map((part) => (
                          <tr key={part.id}>
                            <td className="px-3 py-2 font-medium text-slate-100">{part.label}</td>
                            <td className="px-3 py-2 text-sky-300">{part.type}</td>
                            <td className="px-3 py-2 font-mono-num">{part.sizeGB} GB</td>
                            <td className="px-3 py-2">
                              {part.formatted ? t(lang, 'partFormattedYes') : t(lang, 'partFormattedNo')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handlePartitionAction('create_efi')}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      {t(lang, 'btnCreateEfi')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePartitionAction('create_sys')}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      {t(lang, 'btnCreateSys')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePartitionAction('format_sys')}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      {t(lang, 'btnFormatSys')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePartitionAction('delete_all')}
                      className="px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
                    >
                      {t(lang, 'btnDeleteParts')}
                    </button>
                  </div>

                  {installError && (
                    <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300">
                      {installError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={startOSInstall}
                    className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                  >
                    {t(lang, 'btnInstallOsNow', { os: selectedOS })}
                  </button>
                </div>
              )}

              {installStep === 'progress' && (
                <div className="space-y-3 py-6 text-center">
                  <div className="text-sm font-semibold text-sky-300">
                    {t(lang, 'installingOsText', { os: selectedOS, pct: installingPct })}
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${installingPct}%` }} />
                  </div>
                  <div className="text-xs text-slate-400">{t(lang, 'installingOsSub')}</div>
                </div>
              )}

              {installStep === 'done' && (
                <div className="space-y-4 py-4 text-center">
                  <div className="text-emerald-400 font-semibold text-sm">
                    {t(lang, 'installSuccessText', { os: selectedOS })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenMode('desktop')}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t(lang, 'rebootToDesktop', { os: selectedOS })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* OS DESKTOP: DRIVER MANAGER & BENCHMARK SUITE */}
          {screenMode === 'desktop' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Driver Manager */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-sm text-slate-100">
                      {t(lang, 'driverManagerTitle')} ({build.osState.installedOS})
                    </div>
                    <div className="text-[11px] text-slate-400">{t(lang, 'driverTip')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={installAllDrivers}
                    className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t(lang, 'installAllDrivers')}
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  {(
                    [
                      ['chipset', lang === 'en' ? 'Chipset & Motherboard Bus' : 'Driver Chipset & Motherboard'],
                      ['graphics', `${lang === 'en' ? 'Graphics' : 'Grafis'} (${gpu?.manufacturer ?? 'Integrated'})`],
                      ['audio', lang === 'en' ? 'HD Audio Controller' : 'Kontroler Audio HD'],
                      ['network', lang === 'en' ? 'Gigabit Ethernet / Wi-Fi' : 'Jaringan LAN / Wi-Fi'],
                      ['storage', lang === 'en' ? 'NVMe / AHCI Storage Controller' : 'Kontroler Penyimpanan NVMe/AHCI'],
                      ['peripheral', lang === 'en' ? 'USB & HID Peripherals' : 'Perangkat USB & HID'],
                    ] as [keyof DriverState, string][]
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
                    >
                      <span className="text-slate-200">{label}</span>
                      {build.drivers[key] ? (
                        <span className="text-emerald-400 font-medium">{t(lang, 'installedBadge')}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => installDriver(key)}
                          className="px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 font-medium cursor-pointer"
                        >
                          {t(lang, 'installBtn')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Benchmark & Stress Testing Suite */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      {t(lang, 'benchmarkSuiteTitle')}
                    </div>
                    <div className="text-[11px] text-slate-400">{t(lang, 'benchmarkTip')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {benchTests.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      disabled={Boolean(benchRunning)}
                      onClick={() => runSuite(lbl)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${benchRunning === lbl ? 'animate-spin text-sky-400' : ''}`} />
                      {lbl}
                    </button>
                  ))}
                </div>

                {build.benchmarks ? (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">{t(lang, 'overallScore')}</span>
                      <span className="font-mono-num text-lg font-bold text-sky-400">
                        {build.benchmarks.overallScore}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono-num">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-sky-400" /> CPU: {build.benchmarks.cpuScore}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-emerald-400" /> GPU: {build.benchmarks.gpuScore}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" /> RAM: {build.benchmarks.ramScore}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Disk: {build.benchmarks.storageScore}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 gap-2">
                      <span className="font-mono-num text-amber-300">
                        {t(lang, 'peakLoadTemp')}: {build.benchmarks.maxCpuTempC}°C / {build.benchmarks.maxGpuTempC}°C
                      </span>
                      <span
                        className={
                          build.benchmarks.stabilityPassed
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {build.benchmarks.stabilityPassed ? t(lang, 'stabilityPass') : t(lang, 'stabilityFail')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    {t(lang, 'benchmarkEmptyHint')}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setScreenMode('bios')}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                >
                  {t(lang, 'rebootToBios')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
