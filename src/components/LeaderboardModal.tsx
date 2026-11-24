import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Globe, Search, Trophy, X } from 'lucide-react';
import {
  Language,
  LeaderboardCategory,
  LeaderboardRecord,
  LeaderboardSeason,
} from '../types/game';
import { sortLeaderboardRecords } from '../engine/businessEngine';
import { formatIDR } from '../engine/hardwareDatabase';
import { fetchGlobalLeaderboard, getSupabaseStatus, isSupabaseConfigured } from '../engine/supabaseClient';
import { t } from '../i18n/translations';

interface LeaderboardModalProps {
  lang: Language;
  initialMode: 'local' | 'global';
  localRecords: LeaderboardRecord[];
  currentPlayerName: string;
  currentWorkshopName: string;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  lang,
  initialMode,
  localRecords,
  currentPlayerName,
  currentWorkshopName,
  onClose,
}) => {
  const [mode, setMode] = useState<'local' | 'global'>(initialMode);
  const [category, setCategory] = useState<LeaderboardCategory>('net_worth');
  const [season, setSeason] = useState<LeaderboardSeason>('weekly');
  const [search, setSearch] = useState('');
  const [globalRecords, setGlobalRecords] = useState<LeaderboardRecord[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const categories: { id: LeaderboardCategory; label: string }[] =
    lang === 'en'
      ? [
          { id: 'net_worth', label: 'Richest Owner (Net Worth)' },
          { id: 'total_revenue', label: 'Highest Revenue' },
          { id: 'net_profit', label: 'Highest Net Profit' },
          { id: 'completed_orders', label: 'Most Orders' },
          { id: 'satisfaction', label: 'Customer Satisfaction' },
          { id: 'reputation', label: 'Best Reputation' },
        ]
      : [
          { id: 'net_worth', label: 'Pemilik Terkaya (Total Kekayaan)' },
          { id: 'total_revenue', label: 'Pendapatan Tertinggi' },
          { id: 'net_profit', label: 'Laba Bersih Tertinggi' },
          { id: 'completed_orders', label: 'Pesanan Terbanyak' },
          { id: 'satisfaction', label: 'Kepuasan Pelanggan' },
          { id: 'reputation', label: 'Reputasi Terbaik' },
        ];

  useEffect(() => {
    if (mode !== 'global') return;
    let active = true;
    setLoadingGlobal(true);
    setGlobalError(null);
    fetchGlobalLeaderboard(season).then((res) => {
      if (!active) return;
      setLoadingGlobal(false);
      if (res.error) setGlobalError(res.error);
      setGlobalRecords(res.records);
    });
    return () => {
      active = false;
    };
  }, [mode, season]);

  const rawRecords = mode === 'local' ? localRecords : globalRecords;
  const sorted = sortLeaderboardRecords(rawRecords, category, season);
  const filtered = sorted.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.username.toLowerCase().includes(q) || r.workshopName.toLowerCase().includes(q);
  });

  const playerIndex = sorted.findIndex(
    (r) =>
      r.isCurrentPlayer ||
      (r.username.toLowerCase() === currentPlayerName.toLowerCase() &&
        r.workshopName.toLowerCase() === currentWorkshopName.toLowerCase())
  );

  const playerRec = playerIndex >= 0 ? sorted[playerIndex] : null;
  const aboveRec = playerIndex > 0 ? sorted[playerIndex - 1] : null;
  const belowRec = playerIndex >= 0 && playerIndex < sorted.length - 1 ? sorted[playerIndex + 1] : null;

  const formatMetric = (r: LeaderboardRecord): string => {
    switch (category) {
      case 'net_worth':
        return formatIDR(r.netWorth);
      case 'total_revenue':
        return formatIDR(r.totalRevenue);
      case 'net_profit':
        return formatIDR(r.netProfit);
      case 'completed_orders':
        return `${r.completedOrders} ${t(lang, 'orders').toLowerCase()}`;
      case 'satisfaction':
        return `${r.avgSatisfaction}%`;
      case 'reputation':
        return `${r.reputation}/100`;
    }
  };

  const seasonLabel = (s: LeaderboardSeason) => {
    if (s === 'weekly') return t(lang, 'seasonWeekly');
    if (s === 'monthly') return t(lang, 'seasonMonthly');
    return t(lang, 'seasonAllTime');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/75">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2">
              {mode === 'global' ? (
                <Globe className="w-5 h-5 text-emerald-400" />
              ) : (
                <Trophy className="w-5 h-5 text-sky-400" />
              )}
              {mode === 'global' ? t(lang, 'lbGlobalTitle') : t(lang, 'lbLocalTitle')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mode === 'global' ? t(lang, 'lbGlobalDesc') : t(lang, 'lbLocalDesc')}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Leaderboard"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode, Season & Search Controls */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('local')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  mode === 'local' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(lang, 'lbLocalTitle')}
              </button>
              <button
                type="button"
                onClick={() => setMode('global')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  mode === 'global' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(lang, 'lbGlobalTitle')}
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {(['weekly', 'monthly', 'all_time'] as LeaderboardSeason[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                    season === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {seasonLabel(s)}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(lang, 'searchPlayerPlaceholder')}
                aria-label={t(lang, 'searchPlayerPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  category === c.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mode === 'global' && !isSupabaseConfigured && (
            <div className="p-5 rounded-lg bg-slate-900 border border-amber-500/40 text-sm space-y-2">
              <div className="font-semibold text-amber-300">
                {lang === 'en'
                  ? 'Offline Mode Active — Global Online Backend Not Configured'
                  : 'Mode Offline Aktif — Backend Online Supabase Belum Dikonfigurasi'}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'en'
                  ? `${getSupabaseStatus().reason} Offline records are never mixed into the Global Online Leaderboard.`
                  : 'Rekor offline tidak pernah dicampur ke Papan Peringkat Global Online. Isi VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY lalu jalankan skema backend/supabase-schema.sql untuk mengaktifkan Peringkat Global.'}
              </p>
            </div>
          )}

          {mode === 'global' && loadingGlobal && (
            <div className="text-center py-8 text-sm text-slate-400">
              {lang === 'en' ? 'Loading global rankings...' : 'Memuat papan peringkat global...'}
            </div>
          )}

          {mode === 'global' && globalError && (
            <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              {globalError}
            </div>
          )}

          {/* Player Rank Summary & Wealth Deltas */}
          {playerRec && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-sky-950/30 border border-sky-500/40 text-xs">
              <div>
                <div className="text-slate-400">{t(lang, 'yourCurrentRank')}</div>
                <div className="font-mono-num text-lg font-bold text-sky-300">
                  #{playerIndex + 1} · {playerRec.workshopName}
                </div>
                {playerRec.previousRank && (
                  <div className="text-slate-400">
                    {lang === 'en' ? 'Previous' : 'Sebelumnya'}: #{playerRec.previousRank}
                  </div>
                )}
              </div>
              <div>
                <div className="text-slate-400">{t(lang, 'gapToAbove')}</div>
                <div className="font-mono-num text-sm font-semibold text-amber-300 mt-1">
                  {aboveRec
                    ? formatIDR(aboveRec.netWorth - playerRec.netWorth)
                    : lang === 'en'
                    ? 'Rank #1 Leader'
                    : 'Peringkat #1 Teratas'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">{t(lang, 'leadOverBelow')}</div>
                <div className="font-mono-num text-sm font-semibold text-emerald-400 mt-1">
                  {belowRec ? formatIDR(playerRec.netWorth - belowRec.netWorth) : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Top 3 Podium */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {filtered.slice(0, 3).map((rec, idx) => (
                <div
                  key={rec.id}
                  className={`p-3.5 rounded-lg border ${
                    idx === 0
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : idx === 1
                      ? 'bg-slate-800/70 border-slate-600/60'
                      : 'bg-orange-950/20 border-orange-700/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm text-slate-100">
                      #{idx + 1} {rec.username}
                    </span>
                    <span className="font-mono-num text-xs text-slate-400">
                      {t(lang, 'levelShort')} {rec.businessLevel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{rec.workshopName}</div>
                  <div className="font-mono-num text-base font-bold text-emerald-400 mt-2">{formatMetric(rec)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Ranking Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400 border border-dashed border-slate-800 rounded-lg">
              {mode === 'global' ? t(lang, 'noLbRecordsGlobal') : t(lang, 'noLbRecordsLocal')}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">{t(lang, 'colRank')}</th>
                    <th className="px-3 py-2.5">{t(lang, 'colPlayerWorkshop')}</th>
                    <th className="px-3 py-2.5">{t(lang, 'colLevel')}</th>
                    <th className="px-3 py-2.5">{t(lang, 'reputation')}</th>
                    <th className="px-3 py-2.5">{t(lang, 'colOrders')}</th>
                    <th className="px-3 py-2.5 text-right">{t(lang, 'colNetWorth')}</th>
                    <th className="px-3 py-2.5 text-right">{t(lang, 'colNetProfit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filtered.map((rec, idx) => {
                    const rank = idx + 1;
                    const delta = rec.previousRank ? rec.previousRank - rank : 0;
                    const highlight =
                      rec.isCurrentPlayer ||
                      (rec.username.toLowerCase() === currentPlayerName.toLowerCase() &&
                        rec.workshopName.toLowerCase() === currentWorkshopName.toLowerCase());

                    return (
                      <tr key={rec.id} className={highlight ? 'bg-sky-900/30 text-white' : 'hover:bg-slate-900/60'}>
                        <td className="px-3 py-2.5 font-mono-num font-bold">
                          <span className="inline-flex items-center gap-1">
                            #{rank}
                            {delta > 0 && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
                            {delta < 0 && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-100">{rec.username}</div>
                          <div className="text-slate-400">{rec.workshopName}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono-num">
                          {t(lang, 'levelShort')} {rec.businessLevel}
                        </td>
                        <td className="px-3 py-2.5 font-mono-num text-amber-400">{rec.reputation}</td>
                        <td className="px-3 py-2.5 font-mono-num">{rec.completedOrders}</td>
                        <td className="px-3 py-2.5 font-mono-num text-right font-semibold text-emerald-400">
                          {formatIDR(rec.netWorth)}
                        </td>
                        <td className="px-3 py-2.5 font-mono-num text-right text-sky-300">
                          {formatIDR(rec.netProfit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
