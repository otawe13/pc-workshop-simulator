import React, { useState } from 'react';
import { Clock, Compass, Languages, Monitor, RotateCcw, Sparkles, UserCheck, Volume2, X } from 'lucide-react';
import { DayDurationOption, GameSettings, GraphicsQuality, Language, UIScale } from '../types/game';
import { t } from '../i18n/translations';

interface SettingsModalProps {
  lang: Language;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onReplayTutorial?: () => void;
  onResetCareer?: () => void;
  onClose: () => void;
}

const DAY_DURATIONS: DayDurationOption[] = [10, 20, 30, 45, 60];
const AVATAR_CHOICES = ['🔧', '💻', '⚡', '🛠️', '🖥️', '🎮'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  lang,
  settings,
  onUpdateSettings,
  onReplayTutorial,
  onResetCareer,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const toggleRow = (
    label: string,
    active: boolean,
    onToggle: () => void
  ) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-200 font-medium">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`touch-target px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
          active ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
        }`}
      >
        {active ? t(lang, 'onLabel') : t(lang, 'offLabel')}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-black/75">
      <div className="w-full max-w-lg max-h-[90vh] modal-landscape-shell flex flex-col bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 modal-landscape-header border-b border-slate-800">
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">{t(lang, 'settingsTitle')}</h2>
          <button
            type="button"
            aria-label={t(lang, 'settingsTitle')}
            onClick={onClose}
            className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {/* Language Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Languages className="w-4 h-4 text-sky-400" />
              {t(lang, 'languageLabel')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['id', 'Bahasa Indonesia'],
                  ['en', 'English'],
                ] as [Language, string][]
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, language: code })}
                  className={`touch-target py-2 rounded-lg border font-semibold cursor-pointer ${
                    settings.language === code
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Game Day Duration (10 - 60 minutes) */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Clock className="w-4 h-4 text-emerald-400" />
              {t(lang, 'dayDurationLabel')}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {DAY_DURATIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, dayDurationMinutes: mins })}
                  className={`touch-target py-2 rounded-lg border font-mono-num font-semibold cursor-pointer ${
                    (settings.dayDurationMinutes ?? 30) === mins
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Technician Avatar */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <UserCheck className="w-4 h-4 text-sky-400" />
              {t(lang, 'avatarLabel')}
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {AVATAR_CHOICES.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, playerAvatar: icon })}
                  className={`touch-target py-2 rounded-lg border text-base cursor-pointer ${
                    (settings.playerAvatar ?? '🔧') === icon
                      ? 'bg-sky-600/30 border-sky-400'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Graphics Quality */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Monitor className="w-4 h-4 text-sky-400" />
              {t(lang, 'graphicsQualityLabel')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, graphicsQuality: q })}
                  className={`touch-target py-2 rounded-lg border font-medium cursor-pointer ${
                    settings.graphicsQuality === q
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  {q === 'low'
                    ? t(lang, 'qualityLow')
                    : q === 'medium'
                    ? t(lang, 'qualityMedium')
                    : t(lang, 'qualityHigh')}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-200">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                {t(lang, 'audioLabel')}
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
                className={`touch-target px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  settings.muted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                {settings.muted ? t(lang, 'mutedLabel') : t(lang, 'activeLabel')}
              </button>
            </div>

            <div>
              <label htmlFor="master-vol" className="flex justify-between text-slate-400 mb-1">
                <span>{t(lang, 'masterVol')}</span>
                <span className="font-mono-num">{Math.round(settings.masterVolume * 100)}%</span>
              </label>
              <input
                id="master-vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => onUpdateSettings({ ...settings, masterVolume: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label htmlFor="sfx-vol" className="flex justify-between text-slate-400 mb-1">
                <span>{t(lang, 'sfxVol')}</span>
                <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
              </label>
              <input
                id="sfx-vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => onUpdateSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label htmlFor="music-vol" className="flex justify-between text-slate-400 mb-1">
                <span>{t(lang, 'musicVol')}</span>
                <span className="font-mono-num">{Math.round((settings.musicVolume ?? 0.35) * 100)}%</span>
              </label>
              <input
                id="music-vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume ?? 0.35}
                onChange={(e) => onUpdateSettings({ ...settings, musicVolume: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>
          </div>

          {/* Camera & Display Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Compass className="w-4 h-4 text-sky-400" />
              {t(lang, 'cameraControlsLabel')}
            </div>

            <div>
              <label htmlFor="cam-sens" className="flex justify-between text-slate-400 mb-1">
                <span>{t(lang, 'camSensitivity')}</span>
                <span className="font-mono-num">{(settings.cameraSensitivity ?? 1).toFixed(1)}x</span>
              </label>
              <input
                id="cam-sens"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.cameraSensitivity ?? 1}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, cameraSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label htmlFor="cam-speed" className="flex justify-between text-slate-400 mb-1">
                <span>{t(lang, 'camSpeed')}</span>
                <span className="font-mono-num">{(settings.cameraSpeed ?? 1).toFixed(1)}x</span>
              </label>
              <input
                id="cam-speed"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.cameraSpeed ?? 1}
                onChange={(e) => onUpdateSettings({ ...settings, cameraSpeed: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-slate-300 font-medium">{t(lang, 'uiScaleLabel')}</span>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'large'] as UIScale[]).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, uiScale: sc })}
                    className={`touch-target py-1.5 rounded-lg border font-medium cursor-pointer ${
                      (settings.uiScale ?? 'normal') === sc
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {sc === 'compact'
                      ? t(lang, 'scaleCompact')
                      : sc === 'large'
                      ? t(lang, 'scaleLarge')
                      : t(lang, 'scaleNormal')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Learning & HUD Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            {toggleRow(t(lang, 'toggleObjectives'), settings.showObjectives ?? true, () =>
              onUpdateSettings({ ...settings, showObjectives: !(settings.showObjectives ?? true) })
            )}
            {toggleRow(t(lang, 'toggleHints'), settings.showHints ?? true, () =>
              onUpdateSettings({ ...settings, showHints: !(settings.showHints ?? true) })
            )}
            {toggleRow(t(lang, 'toggleHardwareEdu'), settings.showHardwareEducation ?? true, () =>
              onUpdateSettings({
                ...settings,
                showHardwareEducation: !(settings.showHardwareEducation ?? true),
              })
            )}
            {toggleRow(t(lang, 'toggleFps'), settings.showFps, () =>
              onUpdateSettings({ ...settings, showFps: !settings.showFps })
            )}
          </div>

          {/* Replay Tutorial & Reset */}
          {(onReplayTutorial || onResetCareer) && (
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              {onReplayTutorial && (
                <button
                  type="button"
                  onClick={() => {
                    onReplayTutorial();
                    onClose();
                  }}
                  className="touch-target w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 font-semibold cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  {t(lang, 'replayTutorial')}
                </button>
              )}

              {onResetCareer &&
                (!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="touch-target w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t(lang, 'resetCareerBtn')}
                  </button>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg bg-rose-950/40 border border-rose-500/50">
                    <div className="text-rose-200 font-medium">{t(lang, 'confirmResetMsg')}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmReset(false);
                          onResetCareer();
                        }}
                        className="touch-target flex-1 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                      >
                        {t(lang, 'yesReset')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="touch-target flex-1 py-1.5 rounded bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        {t(lang, 'cancel')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
