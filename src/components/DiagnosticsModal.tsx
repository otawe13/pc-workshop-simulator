import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Monitor,
  Stethoscope,
  Wrench,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  CameraMode,
  DiagnosticToolId,
  GameState,
  Language,
  PCBuildState,
  WorkshopOrder,
} from '../types/game';
import { DIAGNOSTIC_TOOLS, runDiagnosticTool } from '../engine/diagnosticsEngine';
import { getHardwareItem } from '../engine/hardwareDatabase';
import { runPOST } from '../engine/simulationEngine';
import { audioManager } from '../engine/audioManager';
import { getEducationEntry } from '../i18n/hardwareEducation';
import {
  getCategoryLabelLocalized,
  getLocalizedClueText,
  getLocalizedPostMessage,
  getLocalizedToolMeta,
  t,
} from '../i18n/translations';

interface DiagnosticsModalProps {
  lang: Language;
  showHardwareEducation: boolean;
  state: GameState;
  onSelectOrder: (orderId: string) => void;
  onUpdateOrder: (orderId: string, updater: (o: WorkshopOrder) => WorkshopOrder) => void;
  onConsumeInventoryItem: (itemId: string) => boolean;
  onOpenMonitorForOrder: (orderId: string) => void;
  onCameraPreset?: (mode: CameraMode) => void;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  lang,
  showHardwareEducation,
  state,
  onSelectOrder,
  onUpdateOrder,
  onConsumeInventoryItem,
  onOpenMonitorForOrder,
  onCameraPreset,
  onClose,
}) => {
  const [actionMessage, setActionMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [closeup, setCloseup] = useState(false);
  const [showEdu, setShowEdu] = useState(false);

  const repairOrders = state.orders.filter(
    (o) => o.status !== 'New' && o.status !== 'Delivered' && o.status !== 'Cancelled'
  );

  const currentOrder =
    repairOrders.find((o) => o.id === state.activeOrderId) ?? repairOrders[0] ?? null;

  const handleRunTool = (toolId: DiagnosticToolId) => {
    if (!currentOrder) return;
    audioManager.playClick();
    const findings = runDiagnosticTool(currentOrder.pcBuild, toolId);
    onUpdateOrder(currentOrder.id, (ord) => {
      const used = ord.usedDiagnosticTools.includes(toolId)
        ? ord.usedDiagnosticTools
        : [...ord.usedDiagnosticTools, toolId];
      const clues = Array.from(new Set([...ord.discoveredClues, ...findings]));
      return {
        ...ord,
        usedDiagnosticTools: used,
        discoveredClues: clues,
        status: ord.status === 'Accepted' ? 'In Progress' : ord.status,
      };
    });
    const toolMeta = DIAGNOSTIC_TOOLS.find((x) => x.id === toolId);
    const localizedName = toolMeta ? getLocalizedToolMeta(toolId, toolMeta.name, toolMeta.shortDesc, lang).name : toolId;
    setActionMessage({
      kind: 'ok',
      text: lang === 'en' ? `Diagnostic tool ${localizedName} completed.` : `Pemeriksaan dengan ${localizedName} selesai.`,
    });
  };

  const applyBuildFix = (
    label: string,
    buildUpdater: (b: PCBuildState) => PCBuildState,
    consumeItemId?: string
  ) => {
    if (!currentOrder) return;
    if (consumeItemId) {
      const ok = onConsumeInventoryItem(consumeItemId);
      if (!ok) {
        audioManager.playError();
        const modelName = getHardwareItem(consumeItemId)?.model ?? consumeItemId;
        setActionMessage({
          kind: 'err',
          text:
            lang === 'en'
              ? `Insufficient stock of ${modelName}. Buy from Business PC Store.`
              : `Stok ${modelName} habis! Beli terlebih dahulu di Toko Komputer Bisnis.`,
        });
        return;
      }
    }
    audioManager.playScrewdriver();
    onUpdateOrder(currentOrder.id, (ord) => ({
      ...ord,
      status: 'In Progress',
      pcBuild: buildUpdater(ord.pcBuild),
    }));
    setActionMessage({ kind: 'ok', text: label });
  };

  const stockForCategory = (cat: 'psu' | 'storage' | 'gpu' | 'cooler' | 'ram') =>
    state.inventory
      .filter((e) => e.quantity > 0)
      .map((e) => ({ item: getHardwareItem(e.itemId), qty: e.quantity }))
      .filter((x) => x.item && x.item.category === cat);

  const postStatus = currentOrder ? runPOST(currentOrder.pcBuild) : null;
  const eduPsu = getEducationEntry('psu', lang);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/70">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-amber-400" />
              {t(lang, 'diagTitle')}
            </h2>
            <p className="text-xs text-slate-400">{t(lang, 'diagSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {onCameraPreset && (
              <button
                type="button"
                onClick={() => {
                  const next = !closeup;
                  setCloseup(next);
                  onCameraPreset(next ? 'repair_closeup' : 'repair_table');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 font-medium cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                {closeup ? t(lang, 'overviewCameraBtn') : t(lang, 'closeupCameraBtn')}
              </button>
            )}
            {showHardwareEducation && (
              <button
                type="button"
                onClick={() => setShowEdu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-emerald-300 font-medium cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t(lang, 'hardwareEduToggle')}
              </button>
            )}
            <button
              type="button"
              aria-label="Close Diagnostics"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showHardwareEducation && showEdu && (
          <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-sky-300">{eduPsu.title} · {eduPsu.subtitle}</div>
            <div>{eduPsu.compatibilityTip} {eduPsu.commonMistake}</div>
          </div>
        )}

        {!currentOrder ? (
          <div className="p-10 text-center text-sm text-slate-400">{t(lang, 'noRepairOrders')}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Order Select & Diagnostic Tools */}
            <div className="space-y-3">
              <div>
                <label htmlFor="diag-order-sel" className="block text-xs text-slate-400 mb-1">
                  {t(lang, 'activeBenchPc')}
                </label>
                <select
                  id="diag-order-sel"
                  value={currentOrder.id}
                  onChange={(e) => onSelectOrder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                >
                  {repairOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} · {o.title} ({o.customer.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-200">{t(lang, 'customerSymptomReport')}</div>
                <p className="text-sky-200 italic">{currentOrder.dialogue}</p>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">{t(lang, 'selectDiagTool')}</div>
                {DIAGNOSTIC_TOOLS.map((tool) => {
                  const used = currentOrder.usedDiagnosticTools.includes(tool.id);
                  const meta = getLocalizedToolMeta(tool.id, tool.name, tool.shortDesc, lang);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleRunTool(tool.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        used
                          ? 'bg-sky-950/30 border-sky-500/40 text-slate-100'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{meta.name}</span>
                        {used && <span className="text-[10px] text-sky-400">{t(lang, 'testedTag')}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{meta.shortDesc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Investigation Log & POST Status */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-sky-400" />
                {t(lang, 'toolCluesTitle')}
              </div>

              {actionMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs border ${
                    actionMessage.kind === 'ok'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 min-h-[190px] max-h-[260px] overflow-y-auto space-y-2 text-xs font-mono-num">
                {currentOrder.discoveredClues.length === 0 ? (
                  <div className="text-slate-500">{t(lang, 'runToolHint')}</div>
                ) : (
                  currentOrder.discoveredClues.map((clue, i) => {
                    const isWarning =
                      clue.includes('FAIL') ||
                      clue.includes('101°C') ||
                      clue.includes('corrupted') ||
                      clue.includes('Open') ||
                      clue.includes('half') ||
                      clue.includes('0 modules') ||
                      clue.includes('Missing') ||
                      clue.includes('Legacy');
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded border ${
                          isWarning
                            ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-emerald-300'
                        }`}
                      >
                        {getLocalizedClueText(clue, lang)}
                      </div>
                    );
                  })
                )}
              </div>

              {postStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    postStatus.passed
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <div className="font-semibold">{t(lang, 'livePostCheck')}</div>
                  <div className="mt-0.5 font-mono-num">
                    {getLocalizedPostMessage(postStatus.errorCode, postStatus.message, lang)}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => onOpenMonitorForOrder(currentOrder.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                {t(lang, 'openPcScreenBtn')}
              </button>
            </div>

            {/* Column 3: Repair Actions */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                {t(lang, 'handsOnRepairsTitle')}
              </div>

              <button
                type="button"
                onClick={() =>
                  applyBuildFix(
                    lang === 'en'
                      ? 'Reseated RAM modules firmly into DIMM slots.'
                      : 'Modul RAM dipasang ulang dengan rapat ke slot DIMM.',
                    (b) => ({
                      ...b,
                      faults: b.faults.map((f) => (f.type === 'loose_ram' ? { ...f, resolved: true } : f)),
                    })
                  )
                }
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-100 cursor-pointer"
              >
                {t(lang, 'actReseatRam')}
              </button>

              <button
                type="button"
                onClick={() =>
                  applyBuildFix(
                    lang === 'en'
                      ? 'Cleaned dried compound & applied fresh thermal paste.'
                      : 'Pasta termal lama dibersihkan & pasta baru dioleskan.',
                    (b) => ({
                      ...b,
                      thermalPasteApplied: true,
                      faults: b.faults.map((f) => (f.type === 'overheating_paste' ? { ...f, resolved: true } : f)),
                    }),
                    'cons_paste'
                  )
                }
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-100 cursor-pointer"
              >
                {t(lang, 'actReapplyPaste')}
              </button>

              <button
                type="button"
                onClick={() =>
                  applyBuildFix(
                    lang === 'en'
                      ? 'Reseated 8-pin EPS, 24-pin ATX, and Front Panel PWR_SW headers.'
                      : 'Kabel daya 8-pin EPS, 24-pin ATX & panel depan dipasang ulang.',
                    (b) => ({
                      ...b,
                      cpu8PinConnected: true,
                      atx24PinConnected: true,
                      frontPanelConnected: true,
                      faults: b.faults.map((f) =>
                        f.type === 'loose_cables' || f.type === 'damaged_connector'
                          ? { ...f, resolved: true }
                          : f
                      ),
                    })
                  )
                }
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-100 cursor-pointer"
              >
                {t(lang, 'actReconnectCables')}
              </button>

              <button
                type="button"
                onClick={() =>
                  applyBuildFix(
                    lang === 'en'
                      ? 'Repaired EFI Bootloader & BCD via Recovery Media.'
                      : 'Bootloader EFI & BCD berhasil dipulihkan.',
                    (b) => ({
                      ...b,
                      osState: { ...b.osState, bootloaderBroken: false },
                      faults: b.faults.map((f) =>
                        f.type === 'bootloader_failure' ? { ...f, resolved: true } : f
                      ),
                    })
                  )
                }
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-100 cursor-pointer"
              >
                {t(lang, 'actFixBootloader')}
              </button>

              {/* Part Replacements from Inventory */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-slate-300">{t(lang, 'replaceFaultyPartsTitle')}</div>

                {(['psu', 'cooler', 'ram', 'storage', 'gpu'] as const).map((cat) => {
                  const options = stockForCategory(cat);
                  const first = options[0]?.item;
                  return (
                    <div key={cat} className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-300">
                        {getCategoryLabelLocalized(cat, lang)}:{' '}
                        {first ? `${first.model} (${options[0].qty})` : t(lang, 'outOfStockShort')}
                      </span>
                      <button
                        type="button"
                        disabled={!first}
                        onClick={() => {
                          if (!first) return;
                          applyBuildFix(
                            lang === 'en'
                              ? `Installed replacement ${first.model}.`
                              : `Berhasil memasang pengganti ${first.model}.`,
                            (b) => {
                              const next = { ...b };
                              if (cat === 'psu') {
                                next.psuId = first.id;
                                next.faults = next.faults.map((f) => (f.type === 'faulty_psu' ? { ...f, resolved: true } : f));
                              } else if (cat === 'cooler') {
                                next.coolerId = first.id;
                                next.cpuFanConnected = true;
                                next.faults = next.faults.map((f) => (f.type === 'cooler_failure' ? { ...f, resolved: true } : f));
                              } else if (cat === 'ram') {
                                next.ramIds = [...next.ramIds, first.id];
                                next.faults = next.faults.map((f) => (f.type === 'missing_ram' ? { ...f, resolved: true } : f));
                              } else if (cat === 'storage') {
                                next.storageIds = [first.id, ...next.storageIds.slice(1)];
                                next.faults = next.faults.map((f) => (f.type === 'faulty_storage' ? { ...f, resolved: true } : f));
                              } else if (cat === 'gpu') {
                                next.gpuId = first.id;
                                next.faults = next.faults.map((f) => (f.type === 'faulty_gpu' ? { ...f, resolved: true } : f));
                              }
                              return next;
                            },
                            first.id
                          );
                        }}
                        className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-medium shrink-0 cursor-pointer"
                      >
                        {t(lang, 'installSwapBtn')}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Fault resolution indicator */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {t(lang, 'repairedItemsCount', {
                    done: currentOrder.pcBuild.faults.filter((f) => f.resolved).length,
                    total: currentOrder.pcBuild.faults.length,
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
