import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Disc, HardDrive, Monitor, ShieldCheck, UserCheck } from 'lucide-react';
import { Language, OSType, PCBuildState } from '../../types/game';
import { getHardwareItem } from '../../engine/hardwareDatabase';
import { validatePartitionsForInstall } from '../../engine/simulationEngine';
import { audioManager } from '../../engine/audioManager';
import { t } from '../../i18n/translations';

interface WindowsInstallerViewProps {
  lang: Language;
  selectedOS: OSType;
  build: PCBuildState;
  onUpdateBuild: (updater: (prev: PCBuildState) => PCBuildState) => void;
  onCompleteToDesktop: () => void;
  onRebootToBios: () => void;
}

type SetupPhase = 'lang' | 'drive' | 'partition' | 'progress' | 'restarting' | 'oobe';

export const WindowsInstallerView: React.FC<WindowsInstallerViewProps> = ({
  lang,
  selectedOS,
  build,
  onUpdateBuild,
  onCompleteToDesktop,
  onRebootToBios,
}) => {
  const isEn = lang === 'en';
  const [step, setStep] = useState<SetupPhase>('lang');
  const [installError, setInstallError] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [oobeUser, setOobeUser] = useState(build.osState.oobeUsername || 'Teknisi');
  const [oobePcName, setOobePcName] = useState(build.osState.oobeComputerName || 'WORKSHOP-PC');
  const [oobePrivacy, setOobePrivacy] = useState(false);

  const hasStorageFault = build.faults.some((f) => !f.resolved && f.type === 'faulty_storage');
  const hasWorkingDrive = build.storageIds.length > 0 && build.storageCablesConnected && !hasStorageFault;

  const progressPhases = isEn
    ? [
        'Copying Windows installation files...',
        'Getting files ready for installation...',
        'Installing system features & kernel...',
        'Applying hardware & security updates...',
        'Finalizing boot configuration & EFI...',
      ]
    : [
        'Menyalin berkas instalasi sistem operasi...',
        'Menyiapkan berkas inti untuk instalasi...',
        'Memasang fitur sistem & kernel...',
        'Menerapkan pembaruan perangkat keras...',
        'Menyelesaikan konfigurasi boot & partisi EFI...',
      ];

  const currentPhaseIdx = Math.min(progressPhases.length - 1, Math.floor((pct / 100) * progressPhases.length));

  useEffect(() => {
    if (step !== 'progress') return;
    const timer = window.setInterval(() => {
      setPct((prev) => {
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
              setupCompleted: false,
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
          setStep('restarting');
          audioManager.playConfirm();
          return 100;
        }
        return prev + 10;
      });
    }, 220);
    return () => window.clearInterval(timer);
  }, [step, selectedOS, onUpdateBuild]);

  useEffect(() => {
    if (step !== 'restarting') return;
    const tmr = window.setTimeout(() => {
      setStep('oobe');
    }, 950);
    return () => window.clearTimeout(tmr);
  }, [step]);

  const handlePartitionAction = (action: 'create_efi' | 'create_sys' | 'format_sys' | 'delete_all') => {
    setInstallError(null);
    const driveCap = getHardwareItem(build.storageIds[0])?.capacityGB ?? 500;
    onUpdateBuild((prev) => {
      let parts = [...prev.osState.partitions];
      const unalloc = parts.find((p) => p.type === 'Unallocated');
      if (action === 'delete_all') {
        parts = [
          {
            id: 'p_unalloc',
            label: isEn ? 'Unallocated Space' : 'Ruang Belum Teralokasi',
            type: 'Unallocated',
            sizeGB: driveCap,
            formatted: false,
          },
        ];
      } else if (action === 'create_efi' && unalloc && unalloc.sizeGB >= 1) {
        unalloc.sizeGB -= 1;
        parts.unshift({ id: `efi_${Date.now()}`, label: 'EFI System', type: 'EFI', sizeGB: 1, formatted: true });
      } else if (action === 'create_sys' && unalloc && unalloc.sizeGB >= 60) {
        const alloc = unalloc.sizeGB;
        parts = parts.filter((p) => p.type !== 'Unallocated');
        parts.push({ id: `sys_${Date.now()}`, label: 'Primary OS (C:)', type: 'System', sizeGB: alloc, formatted: false });
      } else if (action === 'format_sys') {
        parts = parts.map((p) => (p.type === 'System' ? { ...p, formatted: true } : p));
      }
      return { ...prev, osState: { ...prev.osState, partitions: parts } };
    });
    audioManager.playClick();
  };

  const startInstall = () => {
    if (!hasWorkingDrive) {
      setInstallError(
        isEn
          ? 'Installation blocked: Storage drive missing, SATA cable unplugged, or drive hardware failed (SMART error).'
          : 'Instalasi gagal: Drive penyimpanan belum terpasang, kabel SATA lepas, atau drive rusak (bad sector).'
      );
      audioManager.playError();
      return;
    }
    const check = validatePartitionsForInstall(build.osState.partitions);
    if (!check.valid) {
      setInstallError(
        isEn
          ? check.error ?? 'Partition setup invalid.'
          : 'Konfigurasi partisi belum siap: buat partisi EFI + Sistem lalu klik "Format Partisi Sistem".'
      );
      audioManager.playError();
      return;
    }
    setInstallError(null);
    setPct(0);
    setStep('progress');
  };

  const finishOobe = () => {
    const cleanUser = oobeUser.trim() || 'Teknisi';
    const cleanPc = oobePcName.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'WORKSHOP-PC';
    onUpdateBuild((prev) => ({
      ...prev,
      osState: {
        ...prev.osState,
        installedOS: selectedOS,
        setupCompleted: true,
        oobeCompleted: true,
        oobeUsername: cleanUser,
        oobeComputerName: cleanPc,
        privacyTelemetry: oobePrivacy,
      },
    }));
    audioManager.playConfirm();
    onCompleteToDesktop();
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-5 rounded-xl bg-[#0d1729] border border-sky-600/40 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-sky-300 font-display font-bold text-sm">
          <Disc className="w-5 h-5" />
          {selectedOS} · {t(lang, 'osSetupTitle')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono-num">
            {step === 'lang' && '1/5 · Bahasa'}
            {step === 'drive' && '2/5 · Pilih Drive'}
            {step === 'partition' && '3/5 · Partisi'}
            {step === 'progress' && '4/5 · Instalasi'}
            {step === 'restarting' && 'Restart...'}
            {step === 'oobe' && '5/5 · OOBE'}
          </span>
          <button
            type="button"
            onClick={onRebootToBios}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
          >
            BIOS
          </button>
        </div>
      </div>

      {step === 'lang' && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">{t(lang, 'osSelectLang')}</label>
              <select
                value={build.osState.language}
                onChange={(e) =>
                  onUpdateBuild((p) => ({ ...p, osState: { ...p.osState, language: e.target.value } }))
                }
                className="w-full min-h-[42px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="English (US)">English (US)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1">
                {isEn ? 'Keyboard Input Method' : 'Tata Letak Keyboard'}
              </label>
              <select
                value={build.osState.keyboardLayout ?? 'US QWERTY'}
                onChange={(e) =>
                  onUpdateBuild((p) => ({ ...p, osState: { ...p.osState, keyboardLayout: e.target.value } }))
                }
                className="w-full min-h-[42px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="US QWERTY">US QWERTY</option>
                <option value="US International">US International</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('drive')}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
          >
            {isEn ? 'Install Now -> Select Storage' : 'Pasang Sekarang -> Pilih Drive'}
          </button>
        </div>
      )}

      {step === 'drive' && (
        <div className="space-y-3 text-xs">
          <div className="text-slate-300 font-semibold">
            {isEn ? 'Detected Storage Controllers & Drives:' : 'Pilih Drive Tujuan Instalasi:'}
          </div>

          {!hasWorkingDrive ? (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {hasStorageFault
                  ? isEn
                    ? 'Drive 0 failed S.M.A.R.T hardware check. Replace the faulty drive on the Workbench.'
                    : 'Drive 0 mengalami kerusakan S.M.A.R.T (Bad Sector). Ganti SSD/HDD di Meja Perakitan.'
                  : isEn
                  ? 'No functional storage drive found. Install an SSD/HDD and connect SATA data cable.'
                  : 'Tidak ada drive penyimpanan terdeteksi. Pasang SSD/HDD dan hubungkan kabel SATA.'}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {build.storageIds.map((id, i) => {
                const d = getHardwareItem(id);
                const selected = (build.osState.targetDriveId ?? build.storageIds[0]) === id;
                return (
                  <button
                    key={`${id}_${i}`}
                    type="button"
                    onClick={() =>
                      onUpdateBuild((p) => ({
                        ...p,
                        osState: { ...p.osState, targetDriveId: id },
                      }))
                    }
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left cursor-pointer ${
                      selected
                        ? 'bg-sky-950/50 border-sky-400 text-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="font-semibold">
                          Disk {i}: {d?.manufacturer} {d?.model}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {d?.storageFormFactor ?? d?.storageInterface} · {d?.capacityGB} GB · Health {d?.healthPct ?? 100}%
                        </div>
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('lang')}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              {isEn ? 'Back' : 'Kembali'}
            </button>
            <button
              type="button"
              disabled={!hasWorkingDrive}
              onClick={() => setStep('partition')}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer disabled:opacity-40"
            >
              {t(lang, 'nextPartitionStep')}
            </button>
          </div>
        </div>
      )}

      {step === 'partition' && (
        <div className="space-y-3 text-xs">
          <div className="text-slate-300">
            {t(lang, 'managePartitionsLabel')} ({getHardwareItem(build.osState.targetDriveId ?? build.storageIds[0])?.model ?? 'Storage'}):
          </div>

          <div className="border border-slate-800 rounded-lg overflow-x-auto">
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
              className="min-h-[40px] px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              {t(lang, 'btnCreateEfi')}
            </button>
            <button
              type="button"
              onClick={() => handlePartitionAction('create_sys')}
              className="min-h-[40px] px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              {t(lang, 'btnCreateSys')}
            </button>
            <button
              type="button"
              onClick={() => handlePartitionAction('format_sys')}
              className="min-h-[40px] px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              {t(lang, 'btnFormatSys')}
            </button>
            <button
              type="button"
              onClick={() => handlePartitionAction('delete_all')}
              className="min-h-[40px] px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
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
            onClick={startInstall}
            className="w-full min-h-[44px] py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
          >
            {t(lang, 'btnInstallOsNow', { os: selectedOS })}
          </button>
        </div>
      )}

      {step === 'progress' && (
        <div className="space-y-4 py-5 text-center">
          <div className="text-sm font-semibold text-sky-300">
            {t(lang, 'installingOsText', { os: selectedOS, pct })}
          </div>
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
            <div className="h-full bg-sky-500 transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-300">{progressPhases[currentPhaseIdx]}</div>
          <div className="space-y-1 text-[11px] text-slate-400 max-w-sm mx-auto text-left">
            {progressPhases.map((lbl, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={idx <= currentPhaseIdx ? 'text-emerald-400' : 'text-slate-600'}>
                  {idx < currentPhaseIdx ? '✓' : idx === currentPhaseIdx ? '●' : '○'}
                </span>
                <span className={idx <= currentPhaseIdx ? 'text-slate-200' : 'text-slate-500'}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'restarting' && (
        <div className="py-10 text-center space-y-3">
          <Monitor className="w-9 h-9 text-sky-400 mx-auto animate-pulse" />
          <div className="text-sm font-semibold text-slate-100">
            {isEn ? `Restarting into ${selectedOS} OOBE...` : `Memulai ulang ke konfigurasi awal ${selectedOS} (OOBE)...`}
          </div>
        </div>
      )}

      {step === 'oobe' && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <UserCheck className="w-4 h-4" />
            {isEn ? `${selectedOS} Out-of-Box Experience (OOBE)` : `Pengaturan Awal Pengguna ${selectedOS} (OOBE)`}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">
                {isEn ? 'Account Username' : 'Nama Pengguna PC'}
              </label>
              <input
                type="text"
                value={oobeUser}
                onChange={(e) => setOobeUser(e.target.value)}
                maxLength={24}
                className="w-full min-h-[42px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">
                {isEn ? 'Computer Host Name' : 'Nama Perangkat / Hostname'}
              </label>
              <input
                type="text"
                value={oobePcName}
                onChange={(e) => setOobePcName(e.target.value)}
                maxLength={20}
                className="w-full min-h-[42px] px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 uppercase font-mono-num"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={oobePrivacy}
              onChange={(e) => setOobePrivacy(e.target.checked)}
              className="w-4 h-4 accent-sky-500"
            />
            <span className="text-slate-300">
              {isEn
                ? 'Enable optional hardware telemetry diagnostics (Privacy Setting)'
                : 'Aktifkan diagnostik telemetri opsional (Pengaturan Privasi Dasar)'}
            </span>
          </label>

          <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {isEn
                ? 'OS Setup ready! Finish OOBE to boot straight to the Interactive Virtual Desktop.'
                : 'Instalasi inti selesai! Klik Selesaikan untuk masuk ke Desktop Windows Virtual.'}
            </span>
          </div>

          <button
            type="button"
            onClick={finishOobe}
            className="w-full min-h-[44px] py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            {isEn ? `Finish Setup & Boot ${selectedOS} Desktop` : `Selesaikan OOBE & Masuk Desktop ${selectedOS}`}
          </button>
        </div>
      )}
    </div>
  );
};
