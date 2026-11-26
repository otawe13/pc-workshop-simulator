import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Cable,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Monitor,
  Power,
  Sparkles,
  Trash2,
  Wind,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  AssemblyStageId,
  CameraMode,
  ComponentCategory,
  GameState,
  HardwareItem,
  InspectablePartKey,
  Language,
  PCBuildState,
} from '../types/game';
import { evaluateCompatibility } from '../engine/compatibilityEngine';
import { formatIDR, formatItemSpecsSummary, getHardwareItem } from '../engine/hardwareDatabase';
import { EducationTopic, getEducationEntry } from '../i18n/hardwareEducation';
import { getLocalizedCompatIssueMessage, t } from '../i18n/translations';

interface WorkbenchPanelProps {
  lang: Language;
  showHardwareEducation: boolean;
  state: GameState;
  currentBuild: PCBuildState;
  activeStage: AssemblyStageId;
  explodedView: number;
  inspectedPartKey: InspectablePartKey | null;
  onChangeExplodedView: (val: number) => void;
  onClearInspectedPart: () => void;
  onChangeStage: (stage: AssemblyStageId) => void;
  onUpdateBuild: (updater: (prev: PCBuildState) => PCBuildState) => void;
  onInstallFromInventory: (item: HardwareItem) => string | null;
  onRemoveToInventory: (category: ComponentCategory, index?: number) => void;
  onCameraPreset: (mode: CameraMode) => void;
  onOpenMonitor: () => void;
  onSelectActiveOrder: (orderId: string | null) => void;
  onClose: () => void;
}

const STAGE_DEFS: {
  id: AssemblyStageId;
  num: number;
  labelId: string;
  labelEn: string;
  category?: ComponentCategory;
  cameraMode: CameraMode;
  eduTopic: EducationTopic;
}[] = [
  { id: 'preparation', num: 1, labelId: 'Persiapan & Casing', labelEn: 'Prep & Case', category: 'case', cameraMode: 'pc_closeup', eduTopic: 'case' },
  { id: 'motherboard', num: 2, labelId: 'Motherboard', labelEn: 'Motherboard', category: 'motherboard', cameraMode: 'pc_closeup', eduTopic: 'motherboard' },
  { id: 'cpu', num: 3, labelId: 'CPU', labelEn: 'CPU', category: 'cpu', cameraMode: 'pc_socket', eduTopic: 'cpu' },
  { id: 'cooling', num: 4, labelId: 'Pasta & Cooler', labelEn: 'Thermal & Cooler', category: 'cooler', cameraMode: 'pc_socket', eduTopic: 'cooler' },
  { id: 'ram', num: 5, labelId: 'Memori (RAM)', labelEn: 'Memory (RAM)', category: 'ram', cameraMode: 'pc_ram', eduTopic: 'ram' },
  { id: 'storage', num: 6, labelId: 'Penyimpanan', labelEn: 'Storage', category: 'storage', cameraMode: 'pc_storage', eduTopic: 'storage' },
  { id: 'gpu', num: 7, labelId: 'Grafis (GPU)', labelEn: 'Graphics (GPU)', category: 'gpu', cameraMode: 'pc_gpu', eduTopic: 'gpu' },
  { id: 'psu', num: 8, labelId: 'Power Supply', labelEn: 'Power Supply', category: 'psu', cameraMode: 'pc_psu', eduTopic: 'psu' },
  { id: 'cables', num: 9, labelId: 'Kabel & Add-on', labelEn: 'Cables & Add-on', category: 'addon', cameraMode: 'pc_cables', eduTopic: 'addon' },
  { id: 'inspection', num: 10, labelId: 'Inspeksi', labelEn: 'Inspection', cameraMode: 'workbench', eduTopic: 'case' },
  { id: 'first_boot', num: 11, labelId: 'Peripheral & Boot', labelEn: 'Peripherals & Boot', category: 'peripheral', cameraMode: 'workbench', eduTopic: 'peripheral' },
];

export const WorkbenchPanel: React.FC<WorkbenchPanelProps> = ({
  lang,
  showHardwareEducation,
  state,
  currentBuild,
  activeStage,
  explodedView,
  inspectedPartKey,
  onChangeExplodedView,
  onClearInspectedPart,
  onChangeStage,
  onUpdateBuild,
  onInstallFromInventory,
  onRemoveToInventory,
  onCameraPreset,
  onOpenMonitor,
  onSelectActiveOrder,
  onClose,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dragItem, setDragItem] = useState<HardwareItem | null>(null);
  const [eduOpen, setEduOpen] = useState(false);
  const [mobileCompact, setMobileCompact] = useState(false);

  const compat = useMemo(() => evaluateCompatibility(currentBuild), [currentBuild]);
  const activeOrder = state.orders.find((o) => o.id === state.activeOrderId) ?? null;
  const acceptedOrders = state.orders.filter(
    (o) => o.status === 'Accepted' || o.status === 'In Progress' || o.status === 'Testing'
  );

  const stageMeta = STAGE_DEFS.find((s) => s.id === activeStage) ?? STAGE_DEFS[0];
  const stageLabel = lang === 'en' ? stageMeta.labelEn : stageMeta.labelId;
  const eduEntry = getEducationEntry(stageMeta.eduTopic, lang);

  const availableInventory = useMemo(() => {
    if (!stageMeta.category) return [];
    return state.inventory
      .filter((entry) => entry.quantity > 0)
      .map((entry) => ({
        item: getHardwareItem(entry.itemId),
        qty: entry.quantity,
      }))
      .filter((x): x is { item: HardwareItem; qty: number } => Boolean(x.item && x.item.category === stageMeta.category));
  }, [state.inventory, stageMeta.category]);

  const inspectedItem = useMemo(() => {
    if (!inspectedPartKey) return null;
    if (inspectedPartKey === 'case') return getHardwareItem(currentBuild.caseId);
    if (inspectedPartKey === 'motherboard') return getHardwareItem(currentBuild.motherboardId);
    if (inspectedPartKey === 'cpu') return getHardwareItem(currentBuild.cpuId);
    if (inspectedPartKey === 'cooler') return getHardwareItem(currentBuild.coolerId);
    if (inspectedPartKey === 'gpu') return getHardwareItem(currentBuild.gpuId);
    if (inspectedPartKey === 'psu') return getHardwareItem(currentBuild.psuId);
    if (inspectedPartKey === 'ram') return getHardwareItem(currentBuild.ramIds[0]);
    if (inspectedPartKey === 'storage') return getHardwareItem(currentBuild.storageIds[0]);
    if (inspectedPartKey === 'addon') return getHardwareItem(currentBuild.addonIds?.[0]);
    if (inspectedPartKey === 'peripheral') return getHardwareItem(currentBuild.peripheralIds?.[0]);
    return null;
  }, [inspectedPartKey, currentBuild]);

  const pasteStock = state.inventory.find((i) => i.itemId === 'cons_paste')?.quantity ?? 0;

  const handleStageSelect = (st: (typeof STAGE_DEFS)[number]) => {
    onChangeStage(st.id);
    onCameraPreset(st.cameraMode);
  };

  const handleInstall = (item: HardwareItem) => {
    if (item.category !== 'case' && item.category !== 'peripheral' && !currentBuild.caseId) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Select and place a PC Case first in Stage 1.'
          : 'Pilih dan pasang Casing PC terlebih dahulu di Tahap 1.',
      });
      return;
    }
    if (item.category !== 'case' && item.category !== 'peripheral' && !currentBuild.sidePanelOpen) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Open the PC side panel before installing internal hardware.'
          : 'Buka panel samping casing sebelum memasang komponen internal.',
      });
      return;
    }
    if (item.category === 'cpu' && !currentBuild.motherboardId) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Install a Motherboard before installing the CPU.'
          : 'Pasang Motherboard terlebih dahulu sebelum memasang CPU.',
      });
      return;
    }
    if (item.category === 'cpu' && !currentBuild.cpuSocketOpen) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Open the CPU socket retention lever before seating the CPU.'
          : 'Buka tuas pengunci soket CPU terlebih dahulu sebelum menaruh CPU.',
      });
      return;
    }
    if (item.category === 'cooler' && !currentBuild.cpuId) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Install the CPU before mounting a cooler.'
          : 'Pasang CPU terlebih dahulu sebelum memasang pendingin (cooler).',
      });
      return;
    }

    const err = onInstallFromInventory(item);
    if (err) {
      setFeedback({ type: 'err', text: err });
    } else {
      setFeedback({
        type: 'ok',
        text: lang === 'en'
          ? `Installed ${item.manufacturer} ${item.model}.`
          : `Berhasil memasang ${item.manufacturer} ${item.model}.`,
      });
    }
  };

  const handleDropOnTarget = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItem) {
      handleInstall(dragItem);
      setDragItem(null);
    }
  };

  const toggleFlag = (key: keyof PCBuildState, label: string, requiresTool?: 'screwdriver') => {
    if (requiresTool && currentBuild.selectedTool !== requiresTool) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Select the Screwdriver tool first to secure or unscrew hardware.'
          : 'Pilih alat Obeng terlebih dahulu untuk mengencangkan atau membuka baut.',
      });
      return;
    }
    onUpdateBuild((prev) => ({ ...prev, [key]: !prev[key] }));
    setFeedback({
      type: 'ok',
      text: lang === 'en' ? `${label} updated.` : `${label} diperbarui.`,
    });
  };

  const applyPaste = () => {
    if (!currentBuild.cpuId || !currentBuild.cpuRetentionClosed) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Install CPU and close socket retention bracket before applying thermal paste.'
          : 'Pasang CPU dan tutup pengunci soket sebelum mengoleskan pasta termal.',
      });
      return;
    }
    if (pasteStock <= 0 && !currentBuild.thermalPasteApplied) {
      setFeedback({
        type: 'err',
        text: lang === 'en'
          ? 'Out of Thermal Paste! Purchase more from the Business PC Store.'
          : 'Stok Pasta Termal habis! Beli lagi lewat Toko Komputer Bisnis.',
      });
      return;
    }
    onUpdateBuild((prev) => ({
      ...prev,
      thermalPasteApplied: true,
      faults: prev.faults.map((f) => (f.type === 'overheating_paste' ? { ...f, resolved: true } : f)),
    }));
    setFeedback({
      type: 'ok',
      text: lang === 'en'
        ? 'Thermal paste applied cleanly onto CPU IHS.'
        : 'Pasta termal berhasil dioleskan rata di atas CPU.',
    });
  };

  const cleanDustQuick = () => {
    onUpdateBuild((prev) => ({
      ...prev,
      dustLevel: 0,
      faults: prev.faults.map((f) => (f.type === 'dust_clogged' ? { ...f, resolved: true } : f)),
    }));
    setFeedback({
      type: 'ok',
      text:
        lang === 'en'
          ? 'Compressed air cleared all dust from heatsinks and case fans.'
          : 'Debu di sirip heatsink dan kipas berhasil dibersihkan total dengan Air Blower.',
    });
  };

  const toolLabel = (tool: PCBuildState['selectedTool']) => {
    if (tool === 'none') return t(lang, 'toolHands');
    if (tool === 'screwdriver') return t(lang, 'toolScrewdriver');
    if (tool === 'thermal_paste') return t(lang, 'toolPaste');
    return t(lang, 'toolAntistatic');
  };

  const cameraPresets: [CameraMode, string][] = [
    ['workbench', t(lang, 'cameraBench')],
    ['pc_closeup', t(lang, 'cameraCloseUp')],
    ['pc_socket', t(lang, 'cameraSocket')],
    ['pc_ram', t(lang, 'cameraRam')],
    ['pc_storage', t(lang, 'cameraStorage')],
    ['pc_gpu', t(lang, 'cameraGpu')],
    ['pc_psu', t(lang, 'cameraPsu')],
    ['pc_cables', t(lang, 'cameraCables')],
  ];

  return (
    <div
      className={`fixed z-20 flex flex-col bg-[#0c1220]/96 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden workbench-landscape-drawer left-2 right-2 md:left-auto md:right-4 bottom-16 md:bottom-20 md:w-[440px] ${
        mobileCompact ? 'max-h-[58px]' : 'max-h-[56dvh] md:max-h-none md:top-16'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-800 shrink-0">
        <div className="min-w-0">
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 truncate">
            <Cpu className="w-4 h-4 text-sky-400 shrink-0" />
            {t(lang, 'workbenchTitle')}
          </h2>
          <div className="text-[11px] text-slate-400 truncate">
            {activeOrder ? `${activeOrder.orderNumber} · ${activeOrder.customer.name}` : t(lang, 'sandboxBuild')}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={mobileCompact ? 'Expand Workbench' : 'Collapse Workbench'}
            onClick={() => setMobileCompact((v) => !v)}
            className="md:hidden touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            {mobileCompact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            aria-label="Close Workbench"
            onClick={onClose}
            className="touch-target p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!mobileCompact && (
        <>
          {/* Active Order Selector, Exploded View & Camera Close-up Bar */}
          <div className="px-3 sm:px-4 py-2 bg-slate-900/70 border-b border-slate-800 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <label htmlFor="wb-order-select" className="text-[11px] text-slate-400 shrink-0">
                {t(lang, 'targetPcLabel')}
              </label>
              <select
                id="wb-order-select"
                value={state.activeOrderId ?? 'sandbox'}
                onChange={(e) => onSelectActiveOrder(e.target.value === 'sandbox' ? null : e.target.value)}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-100"
              >
                <option value="sandbox">{t(lang, 'sandboxBuild')}</option>
                {acceptedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Exploded View 3D Slider + Dust Indicator */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <label htmlFor="wb-exploded-slider" className="flex items-center gap-1 text-sky-300 font-medium shrink-0">
                <Layers className="w-3.5 h-3.5" />
                {t(lang, 'explodedViewLabel')}
              </label>
              <input
                id="wb-exploded-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodedView}
                onChange={(e) => onChangeExplodedView(parseFloat(e.target.value))}
                className="flex-1 accent-sky-500 max-w-[140px]"
              />
              <button
                type="button"
                onClick={() => onChangeExplodedView(explodedView > 0.1 ? 0 : 1)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono-num text-[10px] text-slate-200 cursor-pointer"
              >
                {Math.round(explodedView * 100)}%
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <ZoomIn className="w-3.5 h-3.5 text-sky-400 shrink-0 mr-1" />
              {cameraPresets.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onCameraPreset(mode)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 11-Stage Horizontal Stepper */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-800 overflow-x-auto bg-slate-950/50 shrink-0">
            {STAGE_DEFS.map((st) => {
              const isCurrent = st.id === activeStage;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStageSelect(st)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {st.num}. {lang === 'en' ? st.labelEn : st.labelId}
                </button>
              );
            })}
          </div>

          {/* Stage Workspace Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {/* Clicked 3D Part Spec Inspector */}
            {inspectedPartKey && (
              <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/60 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sky-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {t(lang, 'partInspectorTitle')} · {inspectedPartKey.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    aria-label="Clear inspected component"
                    onClick={onClearInspectedPart}
                    className="text-slate-400 hover:text-white px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                {inspectedItem ? (
                  <div>
                    <div className="font-semibold text-slate-100">
                      {inspectedItem.manufacturer} {inspectedItem.model}
                    </div>
                    <div className="text-[11px] text-sky-200">
                      {formatItemSpecsSummary(inspectedItem, lang).join(' · ')}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-300">
                    {lang === 'en'
                      ? `Slot ${inspectedPartKey} is currently empty. Install a compatible part below.`
                      : `Slot ${inspectedPartKey} masih kosong. Pasang komponen yang sesuai dari daftar di bawah.`}
                  </div>
                )}
              </div>
            )}

            {/* Feedback Banner */}
            {feedback && (
              <div
                className={`px-3 py-2 rounded-lg text-xs border ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Compatibility Issues with Root Cause & Fix Suggestion */}
            {compat.issues.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/40 space-y-2">
                {compat.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`space-y-0.5 text-[11px] ${
                      issue.severity === 'error' ? 'text-rose-300' : 'text-amber-300'
                    }`}
                  >
                    <div className="flex items-start gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{getLocalizedCompatIssueMessage(issue.code, issue.message, lang)}</span>
                    </div>
                    {issue.cause && <div className="pl-5 text-slate-400">{issue.cause}</div>}
                    {issue.fixSuggestion && (
                      <div className="pl-5 text-sky-300">
                        {lang === 'en' ? 'Fix: ' : 'Solusi: '}
                        {issue.fixSuggestion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Tool Selector + Hardware Education Button */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-1">{t(lang, 'toolLabel')}</span>
                {(['none', 'screwdriver', 'thermal_paste', 'antistatic'] as PCBuildState['selectedTool'][]).map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => onUpdateBuild((p) => ({ ...p, selectedTool: tool }))}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      currentBuild.selectedTool === tool
                        ? 'bg-amber-500/25 border border-amber-400 text-amber-200'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {toolLabel(tool)}
                  </button>
                ))}
              </div>

              {showHardwareEducation && (
                <button
                  type="button"
                  onClick={() => setEduOpen((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
                    eduOpen
                      ? 'bg-sky-600/25 border-sky-400 text-sky-200'
                      : 'bg-slate-900 border-slate-700 text-sky-300 hover:border-sky-500/60'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{t(lang, 'hardwareEduToggle')}</span>
                </button>
              )}
            </div>

            {/* Collapsible Hardware Education Card */}
            {showHardwareEducation && eduOpen && (
              <div className="p-3 rounded-lg bg-slate-900/95 border border-sky-500/40 text-[11px] space-y-1.5 text-slate-300">
                <div className="font-bold text-sky-300">{eduEntry.title} · {eduEntry.subtitle}</div>
                <p>{eduEntry.functionDesc}</p>
                <div><strong className="text-slate-100">{lang === 'en' ? 'Specs:' : 'Spesifikasi:'}</strong> {eduEntry.keySpecs}</div>
                <div><strong className="text-emerald-300">{lang === 'en' ? 'Install:' : 'Cara Pasang:'}</strong> {eduEntry.howToInstall}</div>
                <div><strong className="text-amber-300">{lang === 'en' ? 'Avoid:' : 'Kesalahan Umum:'}</strong> {eduEntry.commonMistake}</div>
              </div>
            )}

            {/* STAGE 1: PREPARATION */}
            {activeStage === 'preparation' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{t(lang, 'sidePanelLabel')}</div>
                    <div className="text-[11px] text-slate-400">
                      {currentBuild.sidePanelOpen ? t(lang, 'sidePanelOpen') : t(lang, 'sidePanelClosed')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFlag('sidePanelOpen', t(lang, 'sidePanelLabel'))}
                    className="touch-target px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer shrink-0"
                  >
                    {currentBuild.sidePanelOpen ? t(lang, 'closeSidePanel') : t(lang, 'openSidePanel')}
                  </button>
                </div>

                {(currentBuild.dustLevel ?? 0) > 15 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs">
                    <span className="text-amber-200">
                      {t(lang, 'dustLevelLabel')}: <strong className="font-mono-num">{currentBuild.dustLevel}%</strong>
                    </span>
                    <button
                      type="button"
                      onClick={cleanDustQuick}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <Wind className="w-3.5 h-3.5" />
                      {t(lang, 'cleanDustQuickBtn')}
                    </button>
                  </div>
                )}

                {currentBuild.caseId && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <span>
                      {t(lang, 'installedCase')} <strong>{getHardwareItem(currentBuild.caseId)?.model}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveToInventory('case')}
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t(lang, 'remove')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 2: MOTHERBOARD */}
            {activeStage === 'motherboard' && (
              <div className="space-y-2.5">
                {currentBuild.motherboardId && (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-100">
                        {getHardwareItem(currentBuild.motherboardId)?.model}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveToInventory('motherboard')}
                        className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                      >
                        {t(lang, 'remove')}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFlag('motherboardScrewsSecured', t(lang, 'motherboardScrewsSecured'), 'screwdriver')}
                      className={`touch-target w-full py-1.5 rounded text-xs font-medium cursor-pointer ${
                        currentBuild.motherboardScrewsSecured
                          ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-600/25 text-amber-200 border border-amber-500/40'
                      }`}
                    >
                      {currentBuild.motherboardScrewsSecured
                        ? t(lang, 'motherboardScrewsSecured')
                        : t(lang, 'secureMotherboardScrews')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 3: CPU */}
            {activeStage === 'cpu' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFlag('cpuSocketOpen', t(lang, 'openSocketLever'))}
                    className={`touch-target p-2 rounded-lg text-xs font-medium border cursor-pointer ${
                      currentBuild.cpuSocketOpen
                        ? 'bg-sky-600/25 border-sky-500 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {currentBuild.cpuSocketOpen ? t(lang, 'socketOpenReady') : t(lang, 'openSocketLever')}
                  </button>
                  <button
                    type="button"
                    disabled={!currentBuild.cpuId}
                    onClick={() =>
                      onUpdateBuild((p) => ({ ...p, cpuRetentionClosed: !p.cpuRetentionClosed, cpuSocketOpen: false }))
                    }
                    className={`touch-target p-2 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-40 ${
                      currentBuild.cpuRetentionClosed
                        ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {currentBuild.cpuRetentionClosed ? t(lang, 'retentionClosed') : t(lang, 'closeRetentionBracket')}
                  </button>
                </div>
                {currentBuild.cpuId && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <span>
                      CPU: <strong>{getHardwareItem(currentBuild.cpuId)?.model}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveToInventory('cpu')}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      {t(lang, 'remove')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 4: COOLING */}
            {activeStage === 'cooling' && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={applyPaste}
                  className={`touch-target w-full p-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    currentBuild.thermalPasteApplied
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-sky-600/20 border-sky-500/40 text-sky-200'
                  }`}
                >
                  {currentBuild.thermalPasteApplied
                    ? t(lang, 'thermalPasteApplied')
                    : t(lang, 'applyThermalPaste', { stock: pasteStock })}
                </button>

                {currentBuild.coolerId && (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{getHardwareItem(currentBuild.coolerId)?.model}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveToInventory('cooler')}
                        className="text-rose-400 cursor-pointer"
                      >
                        {t(lang, 'remove')}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFlag('coolerSecured', t(lang, 'tightenScrews'), 'screwdriver')}
                        className={`touch-target py-1.5 rounded border cursor-pointer ${
                          currentBuild.coolerSecured
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        {currentBuild.coolerSecured ? t(lang, 'screwsTightened') : t(lang, 'tightenScrews')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag('cpuFanConnected', 'CPU_FAN')}
                        className={`touch-target py-1.5 rounded border cursor-pointer ${
                          currentBuild.cpuFanConnected
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        {currentBuild.cpuFanConnected ? t(lang, 'cpuFanConnected') : t(lang, 'plugCpuFan')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 5: RAM */}
            {activeStage === 'ram' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300 flex items-center justify-between">
                  <span>
                    {t(lang, 'installedRam')} <strong>{compat.totalRamGB} GB</strong>
                  </span>
                  <span className={compat.dualChannelActive ? 'text-emerald-400' : 'text-amber-300'}>
                    {compat.dualChannelActive ? t(lang, 'dualChannelActive') : t(lang, 'singleChannel')}
                  </span>
                </div>
                {currentBuild.ramIds.map((rid, idx) => (
                  <div
                    key={`${rid}_${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <span>
                      DIMM {idx + 1}: {getHardwareItem(rid)?.model}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveToInventory('ram', idx)}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      {t(lang, 'remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* STAGE 6: STORAGE */}
            {activeStage === 'storage' && (
              <div className="space-y-2">
                {currentBuild.storageIds.map((sid, idx) => (
                  <div
                    key={`${sid}_${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <span>
                      Drive {idx + 1}: {getHardwareItem(sid)?.model}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveToInventory('storage', idx)}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      {t(lang, 'remove')}
                    </button>
                  </div>
                ))}
                {currentBuild.storageIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleFlag('storageCablesConnected', t(lang, 'sataCablesConnected'))}
                    className={`touch-target w-full py-2 rounded-lg text-xs font-medium border cursor-pointer ${
                      currentBuild.storageCablesConnected
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    {currentBuild.storageCablesConnected ? t(lang, 'sataCablesConnected') : t(lang, 'connectSataCable')}
                  </button>
                )}
              </div>
            )}

            {/* STAGE 7: GPU */}
            {activeStage === 'gpu' && currentBuild.gpuId && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{getHardwareItem(currentBuild.gpuId)?.model}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveToInventory('gpu')}
                    className="text-rose-400 cursor-pointer"
                  >
                    {t(lang, 'remove')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFlag('gpuBracketSecured', t(lang, 'secureBracket'), 'screwdriver')}
                    className={`touch-target py-1.5 rounded border cursor-pointer ${
                      currentBuild.gpuBracketSecured
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    {currentBuild.gpuBracketSecured ? t(lang, 'bracketScrewed') : t(lang, 'secureBracket')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFlag('gpuPowerConnected', t(lang, 'plugGpuPower'))}
                    className={`touch-target py-1.5 rounded border cursor-pointer ${
                      currentBuild.gpuPowerConnected
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    {currentBuild.gpuPowerConnected ? t(lang, 'pciePowerPlugged') : t(lang, 'plugGpuPower')}
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 8: PSU */}
            {activeStage === 'psu' && (
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between">
                  <span>
                    {t(lang, 'estLoad')} <strong className="font-mono-num">{compat.estimatedWattage}W</strong>
                  </span>
                  <span>
                    {t(lang, 'recommendedPsu')}{' '}
                    <strong className="font-mono-num text-sky-400">{compat.recommendedPsuWattage}W</strong>
                  </span>
                </div>
                {currentBuild.psuId && (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{getHardwareItem(currentBuild.psuId)?.model}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveToInventory('psu')}
                        className="text-rose-400 cursor-pointer"
                      >
                        {t(lang, 'remove')}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFlag('atx24PinConnected', '24-Pin ATX')}
                        className={`touch-target py-1.5 rounded border cursor-pointer ${
                          currentBuild.atx24PinConnected
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {currentBuild.atx24PinConnected ? t(lang, 'atx24Connected') : t(lang, 'connectAtx24')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag('cpu8PinConnected', '8-Pin EPS CPU')}
                        className={`touch-target py-1.5 rounded border cursor-pointer ${
                          currentBuild.cpu8PinConnected
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {currentBuild.cpu8PinConnected ? t(lang, 'cpu8Connected') : t(lang, 'connectCpu8')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag('sataPowerConnected', 'SATA Power')}
                        className={`touch-target py-1.5 rounded border cursor-pointer ${
                          currentBuild.sataPowerConnected
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {currentBuild.sataPowerConnected ? t(lang, 'sataPowerConnected') : t(lang, 'connectSataPower')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 9: CASE CONNECTIONS + INSTALLED ADD-ONS */}
            {activeStage === 'cables' && (
              <div className="space-y-2 text-xs">
                {(
                  [
                    ['frontPanelConnected', t(lang, 'hdrFrontPanel')],
                    ['usbHeaderConnected', t(lang, 'hdrUsb')],
                    ['audioHeaderConnected', t(lang, 'hdrAudio')],
                    ['caseFansConnected', t(lang, 'hdrCaseFans')],
                  ] as [keyof PCBuildState, string][]
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleFlag(k, lbl)}
                    className={`touch-target w-full flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer ${
                      currentBuild[k]
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Cable className="w-3.5 h-3.5" /> {lbl}
                    </span>
                    <span>{currentBuild[k] ? t(lang, 'connected') : t(lang, 'connect')}</span>
                  </button>
                ))}

                {(currentBuild.addonIds ?? []).length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400">
                      {lang === 'en' ? 'Installed Add-ons:' : 'Kartu Ekspansi / Add-on Terpasang:'}
                    </div>
                    {(currentBuild.addonIds ?? []).map((aid, idx) => (
                      <div
                        key={`${aid}_${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <span>{getHardwareItem(aid)?.model}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveToInventory('addon', idx)}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          {t(lang, 'remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STAGE 10: FINAL INSPECTION */}
            {activeStage === 'inspection' && (
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-100">{t(lang, 'preBootVerification')}</div>
                  <div>Motherboard: {currentBuild.motherboardId ? t(lang, 'statusOk') : t(lang, 'statusMissing')}</div>
                  <div>
                    CPU: {currentBuild.cpuId && currentBuild.cpuRetentionClosed ? t(lang, 'statusOk') : t(lang, 'statusIncomplete')}
                  </div>
                  <div>
                    Cooler & Pasta:{' '}
                    {currentBuild.coolerId && currentBuild.thermalPasteApplied ? t(lang, 'statusOk') : t(lang, 'statusIncomplete')}
                  </div>
                  <div>RAM: {compat.totalRamGB > 0 ? `${compat.totalRamGB} GB` : t(lang, 'statusMissing')}</div>
                  <div>
                    {lang === 'en' ? 'Power Cables' : 'Kabel Daya'}:{' '}
                    {currentBuild.atx24PinConnected && currentBuild.cpu8PinConnected
                      ? t(lang, 'statusOk')
                      : t(lang, 'statusIncomplete')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFlag('sidePanelOpen', t(lang, 'sidePanelLabel'))}
                  className="touch-target w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                >
                  {currentBuild.sidePanelOpen ? t(lang, 'closeSidePanelForTest') : t(lang, 'sidePanelClosedReady')}
                </button>
              </div>
            )}

            {/* STAGE 11: PERIPHERALS & FIRST BOOT */}
            {activeStage === 'first_boot' && (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFlag('monitorConnected', t(lang, 'monitorConnected'))}
                    className={`touch-target py-2 rounded-lg border cursor-pointer ${
                      currentBuild.monitorConnected
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {currentBuild.monitorConnected ? t(lang, 'monitorConnected') : t(lang, 'connectMonitor')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFlag('keyboardConnected', t(lang, 'keyboardConnected'))}
                    className={`touch-target py-2 rounded-lg border cursor-pointer ${
                      currentBuild.keyboardConnected
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {currentBuild.keyboardConnected ? t(lang, 'keyboardConnected') : t(lang, 'connectKeyboard')}
                  </button>
                </div>

                {(currentBuild.peripheralIds ?? []).length > 0 && (
                  <div className="space-y-1">
                    {(currentBuild.peripheralIds ?? []).map((pid, idx) => (
                      <div
                        key={`${pid}_${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <span>{getHardwareItem(pid)?.model}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveToInventory('peripheral', idx)}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          {t(lang, 'remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onOpenMonitor}
                  className="touch-target w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  {t(lang, 'powerOnAndOpenMonitor')}
                </button>
              </div>
            )}

            {/* Drag-and-Drop / Tap Installation Target + Inventory Picker */}
            {stageMeta.category && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropOnTarget}
                  className="p-2.5 rounded-lg border border-dashed border-sky-500/50 bg-sky-950/20 text-center text-xs text-sky-200"
                >
                  {t(lang, 'dragOrTapPart', { label: stageLabel })}
                </div>

                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t(lang, 'availableInInventory', { count: availableInventory.length })}
                </div>

                {availableInventory.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
                    {t(lang, 'outOfStockNote', { label: stageLabel })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {availableInventory.map(({ item, qty }) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDragItem(item)}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-500/60"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {item.manufacturer} {item.model}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {formatItemSpecsSummary(item, lang).slice(0, 2).join(' · ')} ·{' '}
                            {t(lang, 'stockShort')}: {qty} · {formatIDR(item.sellingPrice)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInstall(item)}
                          className="touch-target px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          {t(lang, 'installBtn')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Quick Power Button */}
          <div className="px-3 sm:px-4 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs shrink-0">
            <span className={compat.compatible ? 'text-emerald-400 flex items-center gap-1' : 'text-rose-400 flex items-center gap-1'}>
              {compat.compatible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {compat.compatible ? t(lang, 'compatibleLabel') : t(lang, 'checkWarningsLabel')}
            </span>
            <button
              type="button"
              onClick={onOpenMonitor}
              className="touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              {t(lang, 'openTestMonitor')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
