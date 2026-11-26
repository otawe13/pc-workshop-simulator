import React, { useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Compass,
  HelpCircle,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { AssemblyStageId, Language, StationId } from '../types/game';
import { TutorialEvaluation, TUTORIAL_CHAPTERS } from '../engine/tutorialEngine';
import { t } from '../i18n/translations';

interface TutorialOverlayProps {
  lang: Language;
  evaluation: TutorialEvaluation;
  activeStation: StationId;
  onGoToTarget: (station: StationId, suggestedStage?: AssemblyStageId) => void;
  onClaimReward: () => void;
  onSkip: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  lang,
  evaluation,
  activeStation,
  onGoToTarget,
  onClaimReward,
  onSkip,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const { currentChapter, subHintId, subHintEn, targetStation, suggestedAssemblyStage, progressPercent, readyToClaimReward } =
    evaluation;
  const totalChapters = TUTORIAL_CHAPTERS.length;
  const stepText = lang === 'en' ? subHintEn : subHintId;

  // On small screens (< sm), hide tutorial card while workbench bottom drawer is open so user has clear 3D + panel view
  const visibilityClass = activeStation === 'workbench' ? 'hidden md:block' : '';
  const positionClass = 'bottom-16 sm:bottom-20 left-2 sm:left-4 tutorial-landscape-compact';

  if (collapsed) {
    return (
      <div className={`fixed ${positionClass} ${visibilityClass} z-20 pointer-events-auto max-w-[calc(100vw-16px)]`}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="touch-target flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0c1220]/95 border border-sky-500/60 text-xs font-semibold text-sky-100 shadow-2xl cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="truncate max-w-[180px] sm:max-w-[260px]">
            {currentChapter.index + 1}/{totalChapters} · {currentChapter.title[lang]}
          </span>
          <span className="font-mono-num text-sky-300">{progressPercent}%</span>
          <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t(lang, 'tutorialBadge')}
      data-testid="tutorial-overlay"
      className={`fixed ${positionClass} ${visibilityClass} z-20 pointer-events-auto w-[calc(100vw-16px)] sm:w-[376px] bg-[#0c1220]/96 border border-sky-500/60 rounded-xl shadow-2xl overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-900/90 border-b border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              {t(lang, 'tutorialBadge')} · {t(lang, 'tutorialChapterPrefix')} {currentChapter.index + 1}/{totalChapters}
            </span>
          </div>
          <h3 className="font-display text-sm font-bold text-slate-50 truncate mt-0.5">
            {currentChapter.index === 0 ? t(lang, 'tutorialHeader') : currentChapter.title[lang]}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Minimize tutorial"
            onClick={() => setCollapsed(true)}
            className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Strip */}
      <div className="h-1.5 bg-slate-900 w-full">
        <div
          className="h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Body */}
      <div className="p-3 sm:p-3.5 space-y-2 text-xs">
        {currentChapter.index === 0 && (
          <div className="font-semibold text-sky-200">{currentChapter.title[lang]}</div>
        )}

        <p className="text-slate-100 leading-relaxed">{stepText}</p>

        {showWhy && (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
            {currentChapter.whyItMatters[lang]}
          </div>
        )}

        {confirmSkip ? (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/40 space-y-2">
            <div className="font-semibold text-amber-200">{t(lang, 'tutorialConfirmSkipTitle')}</div>
            <p className="text-[11px] text-slate-300">{t(lang, 'tutorialConfirmSkipBody')}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmSkip(false);
                  onSkip();
                }}
                className="touch-target flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                {t(lang, 'tutorialConfirmSkipYes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="touch-target flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                {t(lang, 'tutorialConfirmSkipNo')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {readyToClaimReward ? (
              <button
                type="button"
                onClick={onClaimReward}
                className="touch-target w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
              >
                <Award className="w-4 h-4 shrink-0" />
                <span>{t(lang, 'tutorialClaimReward')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onGoToTarget(targetStation, suggestedAssemblyStage)}
                className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>{t(lang, 'tutorialGoToTarget')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="touch-target flex items-center gap-1 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              title={t(lang, 'tutorialNextHint')}
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">{t(lang, 'helpBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              className="touch-target flex items-center gap-1 py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>{t(lang, 'tutorialSkip')}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
