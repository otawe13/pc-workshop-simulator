import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Folder,
  Globe,
  HardDrive,
  Maximize2,
  Minimize2,
  Monitor,
  Power,
  RefreshCw,
  Search,
  Settings,
  Sliders,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { DriverState, Language, PCBuildState } from '../../types/game';
import { audioManager } from '../../engine/audioManager';
import { getHardwareItem } from '../../engine/hardwareDatabase';
import { runHardwareBenchmarks } from '../../engine/simulationEngine';
import {
  createDefaultNetworkConfig,
  evaluateNetworkHealth,
  executeVirtualCmdCommand,
  isValidIPv4,
  repairNetworkWithTroubleshooter,
} from '../../engine/virtualOsEngine';
import { t } from '../../i18n/translations';

export type VirtualAppId =
  | 'explorer'
  | 'cmd'
  | 'network'
  | 'drivers'
  | 'benchmark'
  | 'settings'
  | 'control_panel'
  | 'recycle_bin';

interface VirtualDesktopViewProps {
  lang: Language;
  build: PCBuildState;
  onUpdateBuild: (updater: (prev: PCBuildState) => PCBuildState) => void;
  onRebootToBios: () => void;
  onCmdUsed?: () => void;
  onNetworkConfigured?: () => void;
}

const WALLPAPERS = [
  'bg-gradient-to-br from-[#0b192e] via-[#0e294b] to-[#081322]',
  'bg-gradient-to-br from-[#121629] via-[#1f294d] to-[#0a0f1d]',
  'bg-gradient-to-br from-[#09201c] via-[#0d3b32] to-[#061311]',
];

export const VirtualDesktopView: React.FC<VirtualDesktopViewProps> = ({
  lang,
  build,
  onUpdateBuild,
  onRebootToBios,
  onCmdUsed,
  onNetworkConfigured,
}) => {
  const isEn = lang === 'en';
  const [openWindows, setOpenWindows] = useState<VirtualAppId[]>(['drivers', 'benchmark']);
  const [activeWin, setActiveWin] = useState<VirtualAppId | null>('drivers');
  const [minimizedWins, setMinimizedWins] = useState<Set<VirtualAppId>>(new Set());
  const [maximizedWin, setMaximizedWin] = useState<VirtualAppId | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runInput, setRunInput] = useState('cmd');
  const [wallpaperIdx, setWallpaperIdx] = useState(0);
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );

  // Explorer state
  const [explorerPath, setExplorerPath] = useState<'root' | 'desktop' | 'docs' | 'sys'>('root');
  // Recycle Bin state
  const [trashItems, setTrashItems] = useState<string[]>([
    'old_display_driver.inf',
    'win_setup_cache_01.tmp',
    'diag_snapshot_bak.txt',
  ]);
  // Benchmark state
  const [benchRunning, setBenchRunning] = useState<string | null>(null);

  // Virtual CMD state
  const hostname = build.osState.oobeComputerName || 'WORKSHOP-PC';
  const username = build.osState.oobeUsername || 'Teknisi';
  const [cmdLines, setCmdLines] = useState<string[]>([
    `Microsoft ${build.osState.installedOS ?? 'Windows 11'} [Virtual OS Shell v10.0]`,
    `(c) PC Workshop Simulator — Isolated Sandbox Environment.`,
    `Type HELP for supported commands (ipconfig, ping 8.8.8.8, dir, ver, whoami).`,
    '',
  ]);
  const [cmdInput, setCmdInput] = useState('');

  // Network editor state
  const net = build.networkConfig ?? createDefaultNetworkConfig(false);
  const netHealth = evaluateNetworkHealth(build);
  const [netMode, setNetMode] = useState<'dhcp' | 'static'>(net.mode);
  const [ipv4, setIpv4] = useState(net.ipv4Address);
  const [subnet, setSubnet] = useState(net.subnetMask);
  const [gateway, setGateway] = useState(net.gateway);
  const [dns1, setDns1] = useState(net.dnsPrimary);
  const [dns2, setDns2] = useState(net.dnsSecondary);
  const [netStatusMsg, setNetStatusMsg] = useState<string | null>(null);
  const [troubleshootSteps, setTroubleshootSteps] = useState<string[]>([]);

  useEffect(() => {
    setNetMode(net.mode);
    setIpv4(net.ipv4Address);
    setSubnet(net.subnetMask);
    setGateway(net.gateway);
    setDns1(net.dnsPrimary);
    setDns2(net.dnsSecondary);
  }, [net.mode, net.ipv4Address, net.subnetMask, net.gateway, net.dnsPrimary, net.dnsSecondary]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const openApp = (app: VirtualAppId) => {
    setStartMenuOpen(false);
    setOpenWindows((prev) => (prev.includes(app) ? prev : [...prev, app]));
    setMinimizedWins((prev) => {
      const next = new Set(prev);
      next.delete(app);
      return next;
    });
    setActiveWin(app);
    audioManager.playClick();
  };

  const closeApp = (app: VirtualAppId) => {
    setOpenWindows((prev) => prev.filter((w) => w !== app));
    if (maximizedWin === app) setMaximizedWin(null);
    if (activeWin === app) setActiveWin(null);
  };

  const toggleMinimize = (app: VirtualAppId) => {
    setMinimizedWins((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  };

  // Virtual OS keyboard shortcuts (Alt+R Run, Alt+E Explorer, Alt+I Settings, Alt+D Show Desktop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const inInput = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA');
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRunDialogOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'e' && !inInput) {
        e.preventDefault();
        openApp('explorer');
      } else if (e.altKey && e.key.toLowerCase() === 'i' && !inInput) {
        e.preventDefault();
        openApp('settings');
      } else if (e.altKey && e.key.toLowerCase() === 'd' && !inInput) {
        e.preventDefault();
        setMinimizedWins(new Set(openWindows));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openWindows]);

  const submitCmd = (commandStr: string) => {
    const res = executeVirtualCmdCommand(commandStr, build);
    onCmdUsed?.();
    if (res.closeWindow) {
      closeApp('cmd');
      return;
    }
    if (res.clearScreen) {
      setCmdLines([`C:\\Users\\${username}>`]);
      setCmdInput('');
      return;
    }
    setCmdLines((prev) => [...prev.slice(-80), `C:\\Users\\${username}> ${commandStr}`, ...res.outputLines, '']);
    setCmdInput('');
  };

  const handleRunCommand = () => {
    const val = runInput.trim().toLowerCase();
    setRunDialogOpen(false);
    if (val === 'cmd' || val === 'cmd.exe') openApp('cmd');
    else if (val === 'explorer' || val === 'explorer.exe') openApp('explorer');
    else if (val === 'control' || val === 'control.exe') openApp('control_panel');
    else if (val === 'ncpa.cpl') openApp('network');
    else if (val.startsWith('ms-settings')) openApp('settings');
    else if (val === 'dxdiag') openApp('benchmark');
    else openApp('cmd');
  };

  const applyNetworkSettings = () => {
    if (netMode === 'static') {
      if (!isValidIPv4(ipv4) || !isValidIPv4(subnet) || !isValidIPv4(gateway) || !isValidIPv4(dns1)) {
        setNetStatusMsg(isEn ? 'Invalid IPv4 / Gateway / DNS address format.' : 'Format IPv4 / Gateway / DNS tidak valid.');
        audioManager.playError();
        return;
      }
    }
    onUpdateBuild((prev) => {
      const nextNet =
        netMode === 'dhcp'
          ? createDefaultNetworkConfig(false)
          : {
              ...createDefaultNetworkConfig(false),
              mode: 'static' as const,
              ipv4Address: ipv4.trim(),
              subnetMask: subnet.trim(),
              gateway: gateway.trim(),
              dnsPrimary: dns1.trim(),
              dnsSecondary: dns2.trim(),
              linkStatus: 'Connected' as const,
            };
      return {
        ...prev,
        networkConfig: nextNet,
        faults: prev.faults.map((f) => (f.type === 'network_issue' ? { ...f, resolved: true } : f)),
      };
    });
    onNetworkConfigured?.();
    setNetStatusMsg(isEn ? 'Network configuration saved & active.' : 'Konfigurasi IP & DNS disimpan dan aktif.');
    audioManager.playConfirm();
  };

  const runTroubleshooter = () => {
    const { nextBuild, steps } = repairNetworkWithTroubleshooter(build);
    setTroubleshootSteps(steps);
    onUpdateBuild(() => nextBuild);
    onNetworkConfigured?.();
    setNetStatusMsg(isEn ? 'Network Troubleshooter resolved connectivity issues.' : 'Troubleshooter berhasil memulihkan jaringan!');
    audioManager.playConfirm();
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
    }, 600);
  };

  const appCatalog: { id: VirtualAppId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'drivers', label: isEn ? 'Driver Manager' : 'Manajer Driver', icon: <Wrench className="w-4 h-4" />, color: 'text-amber-400' },
    { id: 'benchmark', label: isEn ? 'Benchmark Suite' : 'Uji Benchmark', icon: <Activity className="w-4 h-4" />, color: 'text-emerald-400' },
    { id: 'cmd', label: 'Command Prompt', icon: <Terminal className="w-4 h-4" />, color: 'text-sky-400' },
    { id: 'network', label: isEn ? 'Network & IP' : 'Jaringan & IP', icon: <Globe className="w-4 h-4" />, color: 'text-cyan-400' },
    { id: 'explorer', label: 'File Explorer', icon: <Folder className="w-4 h-4" />, color: 'text-amber-300' },
    { id: 'settings', label: isEn ? 'Settings' : 'Pengaturan', icon: <Settings className="w-4 h-4" />, color: 'text-slate-200' },
    { id: 'control_panel', label: 'Control Panel', icon: <Sliders className="w-4 h-4" />, color: 'text-indigo-400' },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: <Trash2 className="w-4 h-4" />, color: 'text-slate-400' },
  ];

  const gpu = getHardwareItem(build.gpuId);
  const cpu = getHardwareItem(build.cpuId);
  const benchTests = isEn
    ? ['CPU & Thermal', 'GPU 3D Test', 'RAM & SSD', 'Full Stability']
    : ['Uji CPU & Suhu', 'Benchmark GPU 3D', 'Uji RAM & SSD', 'Stabilitas Penuh'];

  const visibleWindows = openWindows.filter((w) => !minimizedWins.has(w));
  const shownWindows = maximizedWin && visibleWindows.includes(maximizedWin) ? [maximizedWin] : visibleWindows;

  const renderWindowBody = (app: VirtualAppId) => {
    if (app === 'drivers') {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">{t(lang, 'driverTip')}</span>
            <button
              type="button"
              onClick={installAllDrivers}
              className="min-h-[36px] px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer shrink-0"
            >
              {t(lang, 'installAllDrivers')}
            </button>
          </div>
          <div className="space-y-1.5">
            {(
              [
                ['chipset', isEn ? 'Chipset & Motherboard Bus' : 'Driver Chipset & Motherboard'],
                ['graphics', `${isEn ? 'Graphics' : 'Grafis'} (${gpu?.manufacturer ?? 'Integrated'})`],
                ['audio', isEn ? 'HD Audio Controller' : 'Kontroler Audio HD'],
                ['network', isEn ? 'Gigabit Ethernet / Wi-Fi' : 'Jaringan LAN / Wi-Fi'],
                ['storage', isEn ? 'NVMe / AHCI Controller' : 'Kontroler Penyimpanan'],
                ['peripheral', isEn ? 'USB & HID Peripherals' : 'Perangkat USB & HID'],
              ] as [keyof DriverState, string][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-200">{label}</span>
                {build.drivers[key] ? (
                  <span className="text-emerald-400 font-medium">{t(lang, 'installedBadge')}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => installDriver(key)}
                    className="min-h-[34px] px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 font-medium cursor-pointer"
                  >
                    {t(lang, 'installBtn')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (app === 'benchmark') {
      return (
        <div className="space-y-3 text-xs">
          <div className="text-slate-400">{t(lang, 'benchmarkTip')}</div>
          <div className="grid grid-cols-2 gap-2">
            {benchTests.map((lbl) => (
              <button
                key={lbl}
                type="button"
                disabled={Boolean(benchRunning)}
                onClick={() => runSuite(lbl)}
                className="min-h-[40px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${benchRunning === lbl ? 'animate-spin text-sky-400' : ''}`} />
                {lbl}
              </button>
            ))}
          </div>
          {build.benchmarks ? (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">{t(lang, 'overallScore')}</span>
                <span className="font-mono-num text-lg font-bold text-sky-400">{build.benchmarks.overallScore}</span>
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
                <span className={build.benchmarks.stabilityPassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {build.benchmarks.stabilityPassed ? t(lang, 'stabilityPass') : t(lang, 'stabilityFail')}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-dashed border-slate-800 text-center text-slate-400">
              {t(lang, 'benchmarkEmptyHint')}
            </div>
          )}
        </div>
      );
    }

    if (app === 'cmd') {
      return (
        <div className="flex flex-col h-full min-h-[240px] bg-black rounded-lg border border-slate-800 p-2.5 font-mono-num text-[11px]">
          <div className="flex flex-wrap gap-1 mb-2 pb-1.5 border-b border-slate-800">
            {['ipconfig', 'ipconfig /all', 'ping 8.8.8.8', 'ping localhost', 'whoami', 'dir', 'help'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submitCmd(q)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 text-emerald-300 max-h-[210px] whitespace-pre-wrap">
            {cmdLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCmd(cmdInput);
            }}
            className="flex items-center gap-1.5 pt-2 border-t border-slate-800 mt-1"
          >
            <span className="text-sky-400 shrink-0">C:\Users\{username}&gt;</span>
            <input
              type="text"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="ipconfig / ping 8.8.8.8 / help"
              className="flex-1 bg-transparent text-slate-100 focus:outline-none"
            />
          </form>
        </div>
      );
    }

    if (app === 'network') {
      return (
        <div className="space-y-3 text-xs">
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
              netHealth.online
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {netHealth.online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>{isEn ? netHealth.reasonEn : netHealth.reasonId}</span>
            </div>
            <button
              type="button"
              onClick={runTroubleshooter}
              className="min-h-[36px] px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer shrink-0"
            >
              {isEn ? 'Troubleshoot' : 'Pulihkan Otomatis'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNetMode('dhcp')}
              className={`min-h-[38px] py-1.5 rounded border font-semibold cursor-pointer ${
                netMode === 'dhcp' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              DHCP (Auto IP)
            </button>
            <button
              type="button"
              onClick={() => setNetMode('static')}
              className={`min-h-[38px] py-1.5 rounded border font-semibold cursor-pointer ${
                netMode === 'static' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              Static IPv4 Manual
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono-num">
            <label className="block">
              <span className="text-[11px] text-slate-400">IPv4 Address</span>
              <input
                type="text"
                disabled={netMode === 'dhcp'}
                value={netMode === 'dhcp' ? '192.168.1.45 (Auto)' : ipv4}
                onChange={(e) => setIpv4(e.target.value)}
                className="w-full min-h-[38px] mt-0.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400">Subnet Mask</span>
              <input
                type="text"
                disabled={netMode === 'dhcp'}
                value={netMode === 'dhcp' ? '255.255.255.0' : subnet}
                onChange={(e) => setSubnet(e.target.value)}
                className="w-full min-h-[38px] mt-0.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400">Default Gateway</span>
              <input
                type="text"
                disabled={netMode === 'dhcp'}
                value={netMode === 'dhcp' ? '192.168.1.1' : gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="w-full min-h-[38px] mt-0.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400">DNS Server (Primary / Alt)</span>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="text"
                  disabled={netMode === 'dhcp'}
                  value={netMode === 'dhcp' ? '8.8.8.8' : dns1}
                  onChange={(e) => setDns1(e.target.value)}
                  className="w-1/2 min-h-[38px] px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 disabled:opacity-60"
                />
                <input
                  type="text"
                  disabled={netMode === 'dhcp'}
                  value={netMode === 'dhcp' ? '1.1.1.1' : dns2}
                  onChange={(e) => setDns2(e.target.value)}
                  className="w-1/2 min-h-[38px] px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 disabled:opacity-60"
                />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={applyNetworkSettings}
            className="w-full min-h-[40px] py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            {isEn ? 'Apply Network Configuration' : 'Simpan & Terapkan Konfigurasi Jaringan'}
          </button>

          {netStatusMsg && <div className="text-[11px] text-sky-300">{netStatusMsg}</div>}
          {troubleshootSteps.length > 0 && (
            <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5 text-[11px] font-mono-num text-emerald-300">
              {troubleshootSteps.map((st, idx) => (
                <div key={idx}>{st}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (app === 'explorer') {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['root', 'This PC'],
                ['desktop', 'Desktop'],
                ['docs', 'Documents'],
                ['sys', 'C:\\Windows'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setExplorerPath(k)}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  explorerPath === k ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {explorerPath === 'root' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {build.storageIds.map((id, i) => {
                const d = getHardwareItem(id);
                return (
                  <div key={`${id}_${i}`} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2.5">
                    <HardDrive className="w-5 h-5 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-100">
                        Local Disk ({String.fromCharCode(67 + i)}:)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {d?.model} · {d?.capacityGB} GB ({d?.storageInterface})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {explorerPath === 'desktop' && (
            <div className="space-y-1 text-slate-300 font-mono-num">
              <div>📄 workshop_order_checklist.txt</div>
              <div>🖥️ driver_installer_suite.exe</div>
              <div>⚡ benchmark_utility.exe</div>
            </div>
          )}
          {explorerPath === 'docs' && (
            <div className="space-y-1 text-slate-300 font-mono-num">
              <div>📄 client_build_report_{hostname}.pdf</div>
              <div>📄 thermal_stress_log.csv</div>
            </div>
          )}
          {explorerPath === 'sys' && (
            <div className="space-y-1 text-slate-300 font-mono-num">
              <div>📁 System32 ({Object.values(build.drivers).filter(Boolean).length}/6 drivers loaded)</div>
              <div>📁 Boot (EFI Partition Active)</div>
            </div>
          )}
        </div>
      );
    }

    if (app === 'settings') {
      return (
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-semibold text-sky-300">{isEn ? 'System Specifications' : 'Spesifikasi Sistem'}</div>
            <div>OS: {build.osState.installedOS ?? 'Windows 11'}</div>
            <div>Hostname: {hostname} · User: {username}</div>
            <div>CPU: {cpu?.model ?? '-'}</div>
            <div>GPU: {gpu?.model ?? 'Integrated'}</div>
          </div>
          <div className="space-y-1.5">
            <div className="font-semibold text-slate-300">{isEn ? 'Desktop Wallpaper' : 'Tema Latar Desktop'}</div>
            <div className="flex gap-2">
              {['Cyber Blue', 'Midnight Slate', 'Workshop Emerald'].map((lbl, idx) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setWallpaperIdx(idx)}
                  className={`px-3 py-1.5 rounded cursor-pointer border ${
                    wallpaperIdx === idx ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (app === 'control_panel') {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => openApp('network')}
            className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left cursor-pointer"
          >
            <div className="font-semibold text-cyan-300">Network & Sharing Center</div>
            <div className="text-[11px] text-slate-400">IPv4, DNS & Adapter</div>
          </button>
          <button
            type="button"
            onClick={() => openApp('drivers')}
            className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left cursor-pointer"
          >
            <div className="font-semibold text-amber-300">Device Manager</div>
            <div className="text-[11px] text-slate-400">Hardware Drivers ({Object.values(build.drivers).filter(Boolean).length}/6)</div>
          </button>
          <button
            type="button"
            onClick={() => openApp('settings')}
            className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left cursor-pointer"
          >
            <div className="font-semibold text-sky-300">System Properties</div>
            <div className="text-[11px] text-slate-400">{hostname}</div>
          </button>
          <button
            type="button"
            onClick={onRebootToBios}
            className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left cursor-pointer"
          >
            <div className="font-semibold text-rose-300">UEFI Firmware Reboot</div>
            <div className="text-[11px] text-slate-400">Restart to BIOS</div>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">{trashItems.length} file(s)</span>
          <button
            type="button"
            disabled={trashItems.length === 0}
            onClick={() => setTrashItems([])}
            className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white cursor-pointer disabled:opacity-40"
          >
            {isEn ? 'Empty Recycle Bin' : 'Kosongkan Tempat Sampah'}
          </button>
        </div>
        {trashItems.length === 0 ? (
          <div className="text-slate-500 italic">{isEn ? 'Recycle Bin is empty.' : 'Tempat sampah kosong.'}</div>
        ) : (
          <div className="space-y-1 font-mono-num text-slate-300">
            {trashItems.map((f) => (
              <div key={f} className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800">
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col min-h-[430px] rounded-xl overflow-hidden border border-slate-800 ${WALLPAPERS[wallpaperIdx]}`}>
      {/* Desktop Icons + Windows Area */}
      <div className="flex-1 p-3 flex flex-col lg:flex-row gap-3 overflow-y-auto">
        {/* Desktop Shortcut Icons */}
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-2 gap-1.5 lg:w-44 shrink-0 self-start">
          {appCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openApp(item.id)}
              className={`min-h-[54px] flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-colors cursor-pointer ${
                activeWin === item.id
                  ? 'bg-slate-900/90 border-sky-500/60 text-white'
                  : 'bg-slate-950/55 border-slate-800/70 hover:bg-slate-900/80 text-slate-200'
              }`}
            >
              <span className={item.color}>{item.icon}</span>
              <span className="text-[10px] leading-tight text-center line-clamp-2">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Open Application Windows Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
          {shownWindows.length === 0 ? (
            <div className="md:col-span-2 py-12 text-center text-xs text-slate-400">
              {isEn
                ? 'Click any Desktop icon or Start Menu app to open tools.'
                : 'Klik ikon Desktop atau tombol Start untuk membuka aplikasi sistem.'}
            </div>
          ) : (
            shownWindows.map((appId) => {
              const meta = appCatalog.find((a) => a.id === appId)!;
              const isMax = maximizedWin === appId;
              return (
                <div
                  key={appId}
                  onMouseDown={() => setActiveWin(appId)}
                  className={`flex flex-col rounded-xl bg-slate-900/95 border shadow-xl overflow-hidden ${
                    isMax ? 'md:col-span-2' : ''
                  } ${activeWin === appId ? 'border-sky-500/70' : 'border-slate-700'}`}
                >
                  {/* Window Titlebar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                      <span className={meta.color}>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Minimize"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMinimize(appId);
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 cursor-pointer"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Maximize"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMaximizedWin((m) => (m === appId ? null : appId));
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Close Window"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeApp(appId);
                        }}
                        className="p-1 rounded hover:bg-rose-700 text-slate-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 overflow-y-auto max-h-[340px]">{renderWindowBody(appId)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Start Menu Popover */}
      {startMenuOpen && (
        <div className="absolute bottom-12 left-2 z-20 w-72 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Search apps, cmd, network...' : 'Cari aplikasi, cmd, jaringan...'}
              className="w-full bg-transparent text-xs text-slate-100 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {appCatalog
              .filter((a) => a.label.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openApp(a.id)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-left cursor-pointer"
                >
                  <span className={a.color}>{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                setRunDialogOpen(true);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 cursor-pointer"
            >
              Run (Alt+R)
            </button>
            <button
              type="button"
              onClick={onRebootToBios}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" /> BIOS
            </button>
          </div>
        </div>
      )}

      {/* Run Dialog (Alt+R / Win+R replacement) */}
      {runDialogOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-slate-950 border border-sky-500/50 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-100">
              <span>Run Application (Alt+R)</span>
              <button type="button" onClick={() => setRunDialogOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-slate-400">
              Ketik: <code className="text-sky-300">cmd</code>, <code className="text-sky-300">explorer</code>,{' '}
              <code className="text-sky-300">ncpa.cpl</code>, <code className="text-sky-300">control</code>
            </div>
            <input
              type="text"
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
              className="w-full min-h-[38px] px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono-num"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleRunCommand}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Windows Taskbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/95 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStartMenuOpen((s) => !s)}
            className={`min-h-[34px] px-3 py-1 rounded-lg font-display font-bold flex items-center gap-1.5 cursor-pointer shrink-0 ${
              startMenuOpen ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-sky-300'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Start
          </button>

          {openWindows.map((w) => {
            const meta = appCatalog.find((a) => a.id === w)!;
            const isMin = minimizedWins.has(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() => (isMin ? openApp(w) : toggleMinimize(w))}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] cursor-pointer shrink-0 border ${
                  !isMin && activeWin === w
                    ? 'bg-sky-950/60 border-sky-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <span className={meta.color}>{meta.icon}</span>
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-300 font-mono-num">
          <button
            type="button"
            onClick={() => openApp('network')}
            className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer ${
              netHealth.online ? 'text-emerald-400 hover:bg-slate-800' : 'text-rose-400 hover:bg-slate-800'
            }`}
            title={netHealth.reasonId}
          >
            {netHealth.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </button>
          <span>{clockText}</span>
        </div>
      </div>
    </div>
  );
};
