import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Monitor,
  Power,
  ShieldCheck,
  Thermometer,
  Usb,
  X,
} from 'lucide-react';
import { Language, OSType, PCBuildState } from '../types/game';
import {
  calculateCpuTempC,
  determineBootOutcome,
  runPOST,
} from '../engine/simulationEngine';
import { getHardwareItem } from '../engine/hardwareDatabase';
import { audioManager } from '../engine/audioManager';
import { getEducationEntry } from '../i18n/hardwareEducation';
import { getLocalizedPostMessage, t } from '../i18n/translations';
import { WindowsInstallerView } from './monitor/WindowsInstallerView';
import { VirtualDesktopView } from './monitor/VirtualDesktopView';

interface PCMonitorModalProps {
  lang: Language;
  showHardwareEducation: boolean;
  build: PCBuildState;
  onUpdateBuild: (updater: (prev: PCBuildState) => PCBuildState) => void;
  onCmdUsed?: () => void;
  onNetworkConfigured?: () => void;
  onClose: () => void;
}

type MonitorMode = 'off' | 'post' | 'bios' | 'installer' | 'desktop';
type BIOSTab = 'main' | 'sysinfo' | 'cpu' | 'memory' | 'storage' | 'monitor' | 'boot' | 'security' | 'exit';

export const PCMonitorModal: React.FC<PCMonitorModalProps> = ({
  lang,
  showHardwareEducation,
  build,
  onUpdateBuild,
  onCmdUsed,
  onNetworkConfigured,
  onClose,
}) => {
  const [screenMode, setScreenMode] = useState<MonitorMode>(build.poweredOn ? 'post' : 'off');
  const [biosTab, setBiosTab] = useState<BIOSTab>('main');
  const [selectedOS, setSelectedOS] = useState<OSType>(build.usbBootMediaInserted ?? 'Windows 11');
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

  const handleContinueBoot = () => {
    if (!post.passed) {
      audioManager.playError();
      return;
    }
    if (bootOutcome.target === 'os_installer') {
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

  const cpu = getHardwareItem(build.cpuId);
  const mb = getHardwareItem(build.motherboardId);

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
      ? 'Next: Continue Boot to USB Installer, create EFI & formatted System partition, finish Windows Setup & OOBE.'
      : 'Panduan: Klik Lanjutkan Boot ke Installer USB, atur partisi EFI & Sistem, instal OS, dan selesaikan OOBE.'
    : !Object.values(build.drivers).every(Boolean)
    ? lang === 'en'
      ? 'Next: Boot to Virtual Desktop and click Install All in Driver Manager.'
      : 'Panduan: Pada Desktop Virtual, klik "Instal Semua" di Manajer Driver.'
    : !build.benchmarks?.stabilityPassed
    ? lang === 'en'
      ? 'Final Test: Run any Benchmark on Desktop to verify stability and thermals.'
      : 'Tahap Akhir: Jalankan Uji Benchmark di Desktop hingga muncul STABILITAS LULUS.'
    : lang === 'en'
    ? 'All OS, drivers, network & stability checks ready!'
    : 'Semua pengecekan POST, OS, Driver, dan Uji Stabilitas siap!';

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

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-1 sm:p-4 md:p-6 bg-black/80">
      <div className="modal-landscape-shell w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] flex flex-col bg-[#080c14] border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Monitor Physical Top Bezel */}
        <div className="modal-landscape-header flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Monitor className="w-4 h-4 text-sky-400" />
            <span className="font-display font-bold">{t(lang, 'monitorHeader')}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400 font-mono-num">
              {build.poweredOn ? `${t(lang, 'tempLabel')} ${calculateCpuTempC(build)}°C` : t(lang, 'powerOffLabel')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Bootable USB Prep Control */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
              <Usb className="w-3.5 h-3.5 text-sky-400 shrink-0" />
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
                className={`min-h-[30px] px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
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
                className="flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 font-medium cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t(lang, 'hardwareEduToggle')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePowerToggle}
              className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
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
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guided Hint Strip */}
        <div className="px-3 sm:px-4 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] text-sky-300 flex items-center justify-between gap-2 shrink-0">
          <span>{guidedNextHint}</span>
        </div>

        {showHardwareEducation && showEdu && (
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 space-y-1 shrink-0">
            <div className="font-semibold text-sky-300">{eduBios.title}</div>
            <p>{eduBios.functionDesc} {eduBios.compatibilityTip}</p>
          </div>
        )}

        {/* Monitor Screen Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#05080f] min-h-[260px]">
          {screenMode === 'off' && (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center space-y-3">
              <div className="text-slate-500 font-mono-num text-sm">{t(lang, 'noSignalTitle')}</div>
              <button
                type="button"
                onClick={handlePowerToggle}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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

              <div className="flex flex-wrap gap-3 pt-1">
                {post.passed && (
                  <>
                    <button
                      type="button"
                      onClick={() => setScreenMode('bios')}
                      className="min-h-[44px] px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold cursor-pointer"
                    >
                      {t(lang, 'enterBiosBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueBoot}
                      className="min-h-[44px] px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
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
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d1f3a] border border-sky-700/50 px-3 sm:px-4 py-2 rounded">
                <span className="font-display font-bold text-sky-300 text-sm">{t(lang, 'biosUtilityTitle')}</span>
                <div className="flex flex-wrap gap-1">
                  {biosTabs.map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBiosTab(id)}
                      className={`min-h-[34px] px-2.5 py-1 rounded text-xs cursor-pointer ${
                        biosTab === id ? 'bg-sky-500 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded border border-sky-900/60 bg-[#081224] text-xs space-y-3 min-h-[240px]">
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
                      className="min-h-[40px] px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white cursor-pointer"
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{lang === 'en' ? 'Fan Profile:' : 'Profil Kipas:'}</span>
                      {(['silent', 'standard', 'turbo'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            onUpdateBuild((p) => ({ ...p, biosSettings: { ...p.biosSettings, fanCurveMode: m } }))
                          }
                          className={`min-h-[34px] px-2.5 py-1 rounded capitalize cursor-pointer ${
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
                        className="min-h-[40px] px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white cursor-pointer"
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
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => moveBootPriority(idx, -1)}
                              className="min-h-[34px] px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              {lang === 'en' ? 'Up' : 'Naik'}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBootPriority(idx, 1)}
                              className="min-h-[34px] px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
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
                      className="min-h-[40px] px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
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
                        const resolvedBuild: PCBuildState = {
                          ...build,
                          biosSettings: { ...build.biosSettings, uefiMode: true },
                          faults: build.faults.map((f) => (f.type === 'bios_misconfig' ? { ...f, resolved: true } : f)),
                        };
                        onUpdateBuild(() => resolvedBuild);
                        audioManager.playConfirm();
                        const nextBoot = determineBootOutcome(resolvedBuild);
                        if (nextBoot.target === 'os_installer') {
                          setScreenMode('installer');
                        } else if (nextBoot.target === 'os_desktop') {
                          setScreenMode('desktop');
                        } else {
                          setScreenMode('post');
                        }
                      }}
                      className="min-h-[44px] px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
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

          {/* OPERATING SYSTEM INSTALLER + OOBE */}
          {screenMode === 'installer' && (
            <WindowsInstallerView
              lang={lang}
              selectedOS={selectedOS}
              build={build}
              onUpdateBuild={onUpdateBuild}
              onCompleteToDesktop={() => setScreenMode('desktop')}
              onRebootToBios={() => setScreenMode('bios')}
            />
          )}

          {/* INTERACTIVE VIRTUAL WINDOWS DESKTOP */}
          {screenMode === 'desktop' && (
            <VirtualDesktopView
              lang={lang}
              build={build}
              onUpdateBuild={onUpdateBuild}
              onRebootToBios={() => setScreenMode('bios')}
              onCmdUsed={onCmdUsed}
              onNetworkConfigured={onNetworkConfigured}
            />
          )}
        </div>
      </div>
    </div>
  );
};
