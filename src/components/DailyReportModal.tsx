import React from 'react';
import { CalendarCheck, TrendingUp } from 'lucide-react';
import { DailyReport, Language } from '../types/game';
import { formatIDR } from '../engine/hardwareDatabase';
import { t } from '../i18n/translations';

interface DailyReportModalProps {
  lang: Language;
  report: DailyReport;
  netWorth: number;
  onStartNextDay: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  lang,
  report,
  netWorth,
  onStartNextDay,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-black/75">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto modal-landscape-shell bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-600/20 text-sky-400">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">
              {t(lang, 'dailyReportTitle', { day: report.day })}
            </h2>
            <p className="text-xs text-slate-400 landscape-hide">{t(lang, 'dailyReportSub')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'customersServed')}</div>
            <div className="font-mono-num text-lg font-bold text-slate-100 mt-0.5">
              {report.customersServed}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'jobsCompleted')}</div>
            <div className="font-mono-num text-lg font-bold text-sky-400 mt-0.5">
              {report.jobsCompleted}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'dayRevenue')}</div>
            <div className="font-mono-num text-base font-bold text-emerald-400 mt-0.5">
              {formatIDR(report.revenue)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-slate-400">{t(lang, 'dayExpenses')}</div>
            <div className="font-mono-num text-base font-bold text-rose-400 mt-0.5">
              {formatIDR(report.expenses)}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'dayNetProfit')}</span>
            <span
              className={`font-mono-num font-bold ${
                report.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatIDR(report.netProfit)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'repChange')}</span>
            <span className="font-mono-num font-semibold text-amber-400">
              {report.reputationDelta >= 0 ? `+${report.reputationDelta}` : report.reputationDelta}
            </span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-800">
            <span className="text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> {t(lang, 'currentNetWorth')}
            </span>
            <span className="font-mono-num font-bold text-sky-400">{formatIDR(netWorth)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartNextDay}
          className="touch-target w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm cursor-pointer"
        >
          {t(lang, 'startNextDayBtn', { day: report.day + 1 })}
        </button>
      </div>
    </div>
  );
};
