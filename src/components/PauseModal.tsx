import React from 'react';
import { Home, Play, Save, Settings } from 'lucide-react';
import { Language } from '../types/game';
import { formatIDR } from '../engine/hardwareDatabase';
import { t } from '../i18n/translations';

interface PauseModalProps {
  lang: Language;
  workshopName: string;
  day: number;
  cash: number;
  netWorth: number;
  onResume: () => void;
  onQuickSave: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  lang,
  workshopName,
  day,
  cash,
  netWorth,
  onResume,
  onQuickSave,
  onOpenSettings,
  onReturnTitle,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-black/75">
      <div className="w-full max-w-sm max-h-[92dvh] overflow-y-auto modal-landscape-shell bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-100">{t(lang, 'pausedTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {workshopName} · {t(lang, 'dayLabel')} {day}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'cash')}</div>
            <div className="font-mono-num font-bold text-emerald-400 mt-0.5">{formatIDR(cash)}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'colNetWorth')}</div>
            <div className="font-mono-num font-bold text-sky-400 mt-0.5">{formatIDR(netWorth)}</div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onResume}
            className="touch-target w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            {t(lang, 'resumeWorkshop')}
          </button>
          <button
            type="button"
            onClick={onQuickSave}
            className="touch-target w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {t(lang, 'saveProgressNow')}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="touch-target w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium cursor-pointer"
          >
            <Settings className="w-4 h-4 text-sky-400" />
            {t(lang, 'settings')}
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="touch-target w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium cursor-pointer"
          >
            <Home className="w-4 h-4" />
            {t(lang, 'mainMenu')}
          </button>
        </div>
      </div>
    </div>
  );
};
