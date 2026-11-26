import React, { useState } from 'react';
import {
  Award,
  FolderOpen,
  Globe,
  Info,
  Languages,
  Play,
  PlusCircle,
  Settings,
  Trophy,
  User,
} from 'lucide-react';
import { Difficulty, Language } from '../types/game';
import { SaveSlotSummary } from '../engine/saveManager';
import { COMPETITIVE_STARTING_CAPITAL_IDR, getStartingCapital } from '../engine/businessEngine';
import { formatIDR } from '../engine/hardwareDatabase';
import { getDifficultyLabel, t } from '../i18n/translations';

interface TitleScreenProps {
  lang: Language;
  hasContinueSave: boolean;
  saveSlots: SaveSlotSummary[];
  onChangeLanguage: (lang: Language) => void;
  onStartNewGame: (workshopName: string, playerUsername: string, difficulty: Difficulty) => void;
  onContinueGame: () => void;
  onLoadSlot: (slotId: string) => void;
  onOpenLeaderboard: (mode: 'local' | 'global') => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  defaultUsername: string;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  lang,
  hasContinueSave,
  saveSlots,
  onChangeLanguage,
  onStartNewGame,
  onContinueGame,
  onLoadSlot,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenProfile,
  defaultUsername,
}) => {
  const [subView, setSubView] = useState<'main' | 'new_game' | 'load_game' | 'credits'>('main');
  const [workshopName, setWorkshopName] = useState(
    lang === 'en' ? 'Garuda Tech Workshop' : 'Bengkel PC Garuda Tech'
  );
  const [playerUsername, setPlayerUsername] = useState(
    defaultUsername || (lang === 'en' ? 'Technician' : 'Teknisi')
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [formError, setFormError] = useState<string | null>(null);

  const handleLaunchNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workshopName.trim() || !playerUsername.trim()) {
      setFormError(t(lang, 'formMissingError'));
      return;
    }
    setFormError(null);
    onStartNewGame(workshopName.trim(), playerUsername.trim(), difficulty);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-start p-3 sm:p-10 pointer-events-none bg-gradient-to-r from-[#070b13]/92 via-[#070b13]/68 to-transparent">
      <div className="w-full max-w-lg max-h-[94dvh] overflow-y-auto modal-landscape-shell pointer-events-auto bg-[#0c1220]/95 border border-slate-700/70 rounded-xl p-4 sm:p-8 shadow-2xl">
        {/* Top Row: Brand + Quick Language Toggle */}
        <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3.5 min-w-0">
            <svg viewBox="0 0 56 56" className="w-11 h-11 sm:w-14 sm:h-14 shrink-0" aria-hidden="true">
              <rect x="4" y="6" width="48" height="44" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
              <rect x="12" y="14" width="20" height="28" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="22" cy="24" r="6" fill="none" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="22" cy="24" r="2" fill="#38bdf8" />
              <rect x="36" y="14" width="8" height="18" rx="2" fill="#0284c7" />
              <line x1="15" y1="36" x2="29" y2="36" stroke="#94a3b8" strokeWidth="2" />
              <line x1="36" y1="38" x2="44" y2="38" stroke="#38bdf8" strokeWidth="2.5" />
            </svg>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-slate-50 leading-tight">
                {t(lang, 'appTitle')}
              </h1>
              <p className="text-xs sm:text-sm text-sky-400 font-medium tracking-wide mt-0.5">
                {t(lang, 'appSubtitle')}
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label={t(lang, 'languageLabel')}
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-700 shrink-0"
          >
            <Languages className="w-3.5 h-3.5 text-sky-400 ml-1 hidden sm:block" />
            <button
              type="button"
              onClick={() => onChangeLanguage('id')}
              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                lang === 'id' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage('en')}
              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                lang === 'en' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {subView === 'main' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {hasContinueSave ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={onContinueGame}
                  className="touch-target col-span-1 sm:col-span-2 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-base transition-colors cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  {t(lang, 'continueWorkshop')}
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => onStartNewGame(workshopName, playerUsername, 'normal')}
                  className="touch-target col-span-1 sm:col-span-2 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-base transition-colors cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  {t(lang, 'startCareer')}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSubView('new_game')}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-sky-400" />
                {t(lang, 'newGameSetup')}
              </button>

              <button
                type="button"
                onClick={() => setSubView('load_game')}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                {t(lang, 'loadGame')}
              </button>

              <button
                type="button"
                onClick={() => onOpenLeaderboard('global')}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                {t(lang, 'globalLeaderboard')}
              </button>

              <button
                type="button"
                onClick={() => onOpenLeaderboard('local')}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-medium transition-colors cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-sky-400" />
                {t(lang, 'localLeaderboard')}
              </button>

              <button
                type="button"
                onClick={onOpenProfile}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-300" />
                {t(lang, 'playerProfile')}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="touch-target flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-300" />
                {t(lang, 'settings')}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>{t(lang, 'controlsHintTitle')}</span>
              <button
                type="button"
                onClick={() => setSubView('credits')}
                className="text-slate-300 hover:text-sky-400 underline underline-offset-2 cursor-pointer"
              >
                {t(lang, 'creditsAndControls')}
              </button>
            </div>
          </div>
        )}

        {subView === 'new_game' && (
          <form onSubmit={handleLaunchNew} className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t(lang, 'newWorkshopHeading')}
            </h2>

            <div>
              <label htmlFor="ws-name" className="block text-xs font-medium text-slate-300 mb-1">
                {t(lang, 'workshopNameLabel')}
              </label>
              <input
                id="ws-name"
                type="text"
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                maxLength={32}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label htmlFor="player-name" className="block text-xs font-medium text-slate-300 mb-1">
                {t(lang, 'ownerUsernameLabel')}
              </label>
              <input
                id="player-name"
                type="text"
                value={playerUsername}
                onChange={(e) => setPlayerUsername(e.target.value)}
                maxLength={24}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">
                {t(lang, 'difficultyLabel')}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      difficulty === d
                        ? 'bg-sky-600/20 border-sky-500 text-sky-100'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-semibold">{getDifficultyLabel(d, lang)}</div>
                    <div className="font-mono-num text-[11px] text-slate-400">
                      {formatIDR(getStartingCapital(d))}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {t(lang, 'competitiveStartNote', {
                  amount: formatIDR(COMPETITIVE_STARTING_CAPITAL_IDR),
                })}
              </p>
            </div>

            {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
              >
                {t(lang, 'back')}
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {t(lang, 'openWorkshop')}
              </button>
            </div>
          </form>
        )}

        {subView === 'load_game' && (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t(lang, 'loadSavedWorkshop')}
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {saveSlots.map((slot) => (
                <button
                  key={slot.slotId}
                  type="button"
                  disabled={!slot.savedAt || slot.corrupted}
                  onClick={() => onLoadSlot(slot.slotId)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-sky-500 disabled:opacity-45 disabled:cursor-not-allowed text-left cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {slot.slotId.toUpperCase()} · {slot.workshopName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {slot.corrupted
                        ? t(lang, 'corruptedSaveDetected')
                        : slot.savedAt
                        ? `${t(lang, 'dayLabel')} ${slot.day} · ${t(lang, 'levelShort')} ${slot.businessLevel} · ${slot.playerUsername}`
                        : t(lang, 'noSaveRecorded')}
                    </div>
                  </div>
                  {slot.savedAt && !slot.corrupted && (
                    <div className="font-mono-num text-xs text-emerald-400">{formatIDR(slot.netWorth)}</div>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSubView('main')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
            >
              {t(lang, 'back')}
            </button>
          </div>
        )}

        {subView === 'credits' && (
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-sky-400 font-display font-semibold text-base">
              <Info className="w-4 h-4" />
              {t(lang, 'aboutTitle')}
            </div>
            <p className="leading-relaxed text-xs text-slate-300">{t(lang, 'aboutDesc')}</p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• {t(lang, 'aboutCtrl1')}</li>
              <li>• {t(lang, 'aboutCtrl2')}</li>
              <li>• {t(lang, 'aboutCtrl3')}</li>
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-300">{t(lang, 'aboutPlatformBadge')}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubView('main')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
            >
              {t(lang, 'back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
