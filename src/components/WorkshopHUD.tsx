import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Cpu,
  FastForward,
  HelpCircle,
  Monitor,
  Package,
  Pause,
  Play,
  Settings,
  ShoppingBag,
  Sun,
  Target,
  Users,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { GameNotification, GameState, Language, StationId } from '../types/game';
import { formatIDR } from '../engine/hardwareDatabase';
import { CurrentObjectiveSummary } from '../engine/tutorialEngine';
import { getBusinessLevelLabel, getStationLabel, t } from '../i18n/translations';

interface WorkshopHUDProps {
  lang: Language;
  state: GameState;
  activeStation: StationId;
  hoveredLabel: string | null;
  dockCollapsed: boolean;
  fps: number;
  showFps: boolean;
  muted: boolean;
  showObjectives: boolean;
  showHints: boolean;
  objective: CurrentObjectiveSummary;
  onToggleMute: () => void;
  onToggleDock: () => void;
  onSelectStation: (station: StationId) => void;
  onFocusObjectiveTarget: (station: StationId) => void;
  onNudgeCamera: (dx: number, dz: number) => void;
  onSetSpeed: (speed: 0 | 1 | 2) => void;
  onEndDay: () => void;
  onOpenPause: () => void;
  onOpenSettings: () => void;
  onDismissNotification: (id: string) => void;
}

function formatGameClock(minuteOfDay: number): string {
  const hrs = Math.floor(minuteOfDay / 60);
  const mins = Math.floor(minuteOfDay % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export const WorkshopHUD: React.FC<WorkshopHUDProps> = ({
  lang,
  state,
  activeStation,
  hoveredLabel,
  dockCollapsed,
  fps,
  showFps,
  muted,
  showObjectives,
  showHints,
  objective,
  onToggleMute,
  onToggleDock,
  onSelectStation,
  onFocusObjectiveTarget,
  onNudgeCamera,
  onSetSpeed,
  onEndDay,
  onOpenPause,
  onOpenSettings,
  onDismissNotification,
}) => {
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [objCollapsed, setObjCollapsed] = useState(false);

  const activeOrders = state.orders.filter(
    (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
  );
  const newCustomers = state.orders.filter((o) => o.status === 'New').length;
  const latestNotif: GameNotification | undefined = state.notifications[0];

  const stations: { id: StationId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: getStationLabel('overview', lang), icon: <Sun className="w-4 h-4" /> },
    {
      id: 'reception',
      label: getStationLabel('reception', lang),
      icon: <Users className="w-4 h-4" />,
      badge: newCustomers || undefined,
    },
    { id: 'workbench', label: getStationLabel('workbench', lang), icon: <Cpu className="w-4 h-4" /> },
    { id: 'repair_table', label: getStationLabel('repair_table', lang), icon: <Wrench className="w-4 h-4" /> },
    { id: 'testing_station', label: getStationLabel('testing_station', lang), icon: <Monitor className="w-4 h-4" /> },
    { id: 'business_pc', label: getStationLabel('business_pc', lang), icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'shelves', label: getStationLabel('shelves', lang), icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-4">
      {/* Top Perimeter HUD Bar + Below-Bar Objective / Hover / Notification Flow */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-1.5 sm:gap-2">
          {/* Left: Workshop Cash, Day/Time & Reputation */}
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-[#0c1220]/95 border border-slate-700/70 shadow-lg">
            <div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-medium leading-none">
                {t(lang, 'cash')}
              </div>
              <div className="font-mono-num text-sm sm:text-lg font-bold text-emerald-400 leading-tight mt-0.5">
                {formatIDR(state.cash)}
              </div>
            </div>

            <div className="h-6 w-px bg-slate-700/70 hidden sm:block" />

            <div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-medium leading-none">
                {t(lang, 'dayLabel')} {state.day} · {t(lang, 'levelShort')} {state.businessLevel}
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-100 mt-0.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400" />
                <span className="font-mono-num">{formatGameClock(state.minuteOfDay)}</span>
                <span className="text-slate-400 hidden md:inline">
                  · {getBusinessLevelLabel(state.businessLevel, lang)}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-700/70 hidden sm:block" />

            <div className="flex items-center gap-2.5 sm:gap-3 text-xs">
              <div>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 leading-none">
                  {t(lang, 'reputation')}
                </div>
                <div className="font-mono-num font-semibold text-amber-400 mt-0.5">
                  {Math.round(state.reputation)}
                </div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 leading-none">
                  {t(lang, 'orders')}
                </div>
                <div className="font-mono-num font-semibold text-sky-400 mt-0.5">{activeOrders.length}</div>
              </div>
            </div>
          </div>

          {/* Right: Speed Controls, Utility Buttons & Optional FPS */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#0c1220]/95 border border-slate-700/70 shadow-lg">
            {showFps && (
              <span className="font-mono-num text-xs text-sky-400 px-1.5 sm:px-2 border-r border-slate-700/70">
                {fps} FPS
              </span>
            )}

            <button
              type="button"
              aria-label="Pause simulation clock"
              onClick={() => onSetSpeed(0)}
              className={`p-1.5 sm:p-2 rounded-md transition-colors cursor-pointer ${
                state.timeSpeed === 0 ? 'bg-amber-500/25 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              aria-label="Normal simulation speed"
              onClick={() => onSetSpeed(1)}
              className={`p-1.5 sm:p-2 rounded-md transition-colors cursor-pointer ${
                state.timeSpeed === 1 ? 'bg-sky-600/30 text-sky-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              aria-label="Fast forward simulation speed"
              onClick={() => onSetSpeed(2)}
              className={`p-1.5 sm:p-2 rounded-md transition-colors cursor-pointer ${
                state.timeSpeed === 2 ? 'bg-sky-600/30 text-sky-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FastForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={onEndDay}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              {t(lang, 'endDay')}
            </button>

            <div className="h-4 w-px bg-slate-700/70 mx-0.5 hidden sm:block" />

            <button
              type="button"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              onClick={onToggleMute}
              className="p-1.5 sm:p-2 rounded-md text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
            <button
              type="button"
              aria-label={t(lang, 'settings')}
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-md text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              aria-label={t(lang, 'menu')}
              onClick={onOpenPause}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-medium cursor-pointer"
            >
              {t(lang, 'menu')}
            </button>
          </div>
        </div>

        {/* Below-Bar Stack: Objective Tracker (Overview) + Hover Label + Notifications */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1.5 max-w-full">
            {showObjectives && activeStation === 'overview' && (
              <div
                data-testid="objective-tracker"
                className="pointer-events-auto w-full max-w-[295px] sm:max-w-xs rounded-lg bg-[#0c1220]/95 border border-slate-700/80 shadow-lg overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 min-w-0">
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t(lang, 'currentObjective')}</span>
                    <span className="font-mono-num text-slate-300">· {objective.progressPercent}%</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {showHints && (
                      <button
                        type="button"
                        onClick={() => setHelpExpanded((h) => !h)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300 font-medium cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>{helpExpanded ? t(lang, 'hideHelpBtn') : t(lang, 'helpBtn')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Toggle objective panel"
                      onClick={() => setObjCollapsed((c) => !c)}
                      className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                    >
                      {objCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {!objCollapsed && (
                  <div className="px-2.5 py-2 space-y-1.5 text-[11px]">
                    <div className="font-semibold text-slate-100 leading-tight">{objective.title}</div>
                    <p className="text-slate-300 leading-snug line-clamp-2">{objective.stepText}</p>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${objective.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>{objective.remainingText}</span>
                      <button
                        type="button"
                        onClick={() => onFocusObjectiveTarget(objective.targetStation)}
                        className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                      >
                        <Compass className="w-3 h-3" />
                        <span>{getStationLabel(objective.targetStation, lang)}</span>
                      </button>
                    </div>

                    {showHints && helpExpanded && objective.helpTips.length > 0 && (
                      <ul className="pt-1.5 mt-1 border-t border-slate-800 space-y-1 text-[10px] text-slate-300">
                        {objective.helpTips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {hoveredLabel && activeStation === 'overview' && (
              <div className="px-3 py-1 rounded-md bg-[#0c1220]/95 border border-sky-500/50 text-xs font-medium text-sky-200 shadow-lg">
                {t(lang, 'clickToFocus')}: {hoveredLabel}
              </div>
            )}

            {latestNotif && activeStation === 'overview' && (
              <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0c1220]/95 border border-slate-700/80 text-xs max-w-md shadow-lg">
                <div className="flex-1 leading-snug">
                  <span
                    className={`font-semibold mr-1.5 ${
                      latestNotif.kind === 'success'
                        ? 'text-emerald-400'
                        : latestNotif.kind === 'error'
                        ? 'text-rose-400'
                        : latestNotif.kind === 'warning'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {latestNotif.title}:
                  </span>
                  <span className="text-slate-300">{latestNotif.message}</span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => onDismissNotification(latestNotif.id)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-1 py-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Mobile Touch Camera Pan Pad (overview only, compact) */}
          {activeStation === 'overview' && (
            <div className="pointer-events-auto md:hidden grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0c1220]/92 border border-slate-700/70 shadow-lg">
              <div />
              <button
                type="button"
                aria-label={`${t(lang, 'cameraMoveLabel')} +`}
                onClick={() => onNudgeCamera(0, -1)}
                className="p-2 rounded bg-slate-800 active:bg-sky-600 text-slate-200 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <div />
              <button
                type="button"
                aria-label={`${t(lang, 'cameraMoveLabel')} L`}
                onClick={() => onNudgeCamera(-1, 0)}
                className="p-2 rounded bg-slate-800 active:bg-sky-600 text-slate-200 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label={`${t(lang, 'cameraMoveLabel')} -`}
                onClick={() => onNudgeCamera(0, 1)}
                className="p-2 rounded bg-slate-800 active:bg-sky-600 text-slate-200 cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label={`${t(lang, 'cameraMoveLabel')} R`}
                onClick={() => onNudgeCamera(1, 0)}
                className="p-2 rounded bg-slate-800 active:bg-sky-600 text-slate-200 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Workstation Dock */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto hidden sm:flex items-center gap-1.5 px-3 py-0.5 rounded-t-lg bg-[#0c1220]/95 border border-b-0 border-slate-700/70 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {dockCollapsed ? t(lang, 'showWorkstations') : t(lang, 'hideDock')}
        </button>

        {!dockCollapsed && (
          <nav
            aria-label="Workshop Workstations"
            className="pointer-events-auto flex items-center gap-1 p-1 sm:p-1.5 rounded-xl bg-[#0c1220]/95 border border-slate-700/80 shadow-2xl max-w-[96vw] overflow-x-auto"
          >
            {stations.map((st) => {
              const active = activeStation === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectStation(st.id)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {st.icon}
                  <span>{st.label}</span>
                  {st.badge !== undefined && (
                    <span className="ml-0.5 font-mono-num text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-bold">
                      {st.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};
