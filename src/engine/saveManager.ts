import {
  GameSettings,
  GameState,
  LeaderboardRecord,
  LeaderboardSeason,
} from '../types/game';
import { calculateNetWorth } from './businessEngine';

const SAVE_PREFIX = 'pcws_save_';
const SETTINGS_KEY = 'pcws_settings_v1';
const LOCAL_LB_KEY = 'pcws_local_leaderboard_v1';

export interface SaveSlotSummary {
  slotId: string;
  workshopName: string;
  playerUsername: string;
  day: number;
  cash: number;
  netWorth: number;
  businessLevel: number;
  savedAt: string;
  corrupted?: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: 'medium',
  masterVolume: 0.7,
  sfxVolume: 0.85,
  musicVolume: 0.35,
  muted: false,
  showFps: false,
  language: 'id',
  cameraSensitivity: 1,
  cameraSpeed: 1,
  uiScale: 'normal',
  showHints: true,
  showObjectives: true,
  showHardwareEducation: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      language: parsed.language === 'en' ? 'en' : 'id',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function saveGameToSlot(state: GameState, slotId: string): boolean {
  try {
    const payload = {
      ...state,
      saveSlotId: slotId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${SAVE_PREFIX}${slotId}`, JSON.stringify(payload));
    localStorage.setItem(`${SAVE_PREFIX}last_slot`, slotId);
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromSlot(slotId: string): { state: GameState | null; error?: string } {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${slotId}`);
    if (!raw) return { state: null, error: 'Slot simpanan kosong.' };
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed.cash !== 'number' || !Array.isArray(parsed.inventory)) {
      return { state: null, error: 'Data simpanan gagal diverifikasi.' };
    }
    // Backward compatibility: preserve existing saves cleanly
    if (!parsed.tutorialState) {
      parsed.tutorialState = {
        active: false,
        completed: true,
        skipped: false,
        chapterIndex: 6,
        rewardClaimed: true,
        cameraMoved: true,
        visitedStationCount: 5,
        checkedBusinessPC: true,
      };
    }
    return { state: parsed };
  } catch {
    return { state: null, error: 'File simpanan rusak terdeteksi.' };
  }
}

export function getLastSaveSlotId(): string | null {
  try {
    return localStorage.getItem(`${SAVE_PREFIX}last_slot`);
  } catch {
    return null;
  }
}

export function listSaveSlots(): SaveSlotSummary[] {
  const slotIds = ['autosave', 'slot_1', 'slot_2', 'slot_3'];
  return slotIds.map((slotId) => {
    try {
      const raw = localStorage.getItem(`${SAVE_PREFIX}${slotId}`);
      if (!raw) {
        return {
          slotId,
          workshopName: 'Empty Slot',
          playerUsername: '',
          day: 0,
          cash: 0,
          netWorth: 0,
          businessLevel: 1,
          savedAt: '',
        };
      }
      const parsed = JSON.parse(raw) as GameState & { savedAt?: string };
      if (!parsed || typeof parsed.cash !== 'number') {
        return {
          slotId,
          workshopName: 'Corrupted Save',
          playerUsername: '',
          day: 0,
          cash: 0,
          netWorth: 0,
          businessLevel: 1,
          savedAt: '',
          corrupted: true,
        };
      }
      const nw = calculateNetWorth(parsed).totalNetWorth;
      return {
        slotId,
        workshopName: parsed.workshopName,
        playerUsername: parsed.playerUsername,
        day: parsed.day,
        cash: parsed.cash,
        netWorth: nw,
        businessLevel: parsed.businessLevel,
        savedAt: parsed.savedAt ?? '',
      };
    } catch {
      return {
        slotId,
        workshopName: 'Corrupted Save',
        playerUsername: '',
        day: 0,
        cash: 0,
        netWorth: 0,
        businessLevel: 1,
        savedAt: '',
        corrupted: true,
      };
    }
  });
}

export function deleteSaveSlot(slotId: string): void {
  try {
    localStorage.removeItem(`${SAVE_PREFIX}${slotId}`);
  } catch {
    // ignore
  }
}

export function recordLocalLeaderboardEntry(state: GameState): LeaderboardRecord[] {
  const nw = calculateNetWorth(state).totalNetWorth;
  const avgSat =
    state.satisfactionHistory.length > 0
      ? Math.round(
          state.satisfactionHistory.reduce((a, b) => a + b, 0) / state.satisfactionHistory.length
        )
      : 80;

  const currentRecords = loadLocalLeaderboard();
  const seasons: LeaderboardSeason[] = ['weekly', 'monthly', 'all_time'];

  for (const season of seasons) {
    const id = `local_${state.playerUsername}_${state.workshopName}_${season}`.toLowerCase();
    const existingIdx = currentRecords.findIndex((r) => r.id === id);
    const entry: LeaderboardRecord = {
      id,
      username: state.playerUsername,
      workshopName: state.workshopName,
      netWorth: nw,
      totalRevenue: Math.round(state.totalRevenue),
      netProfit: Math.round(state.totalRevenue - state.totalExpenses),
      completedOrders: state.completedOrdersCount,
      avgSatisfaction: avgSat,
      reputation: Math.round(state.reputation),
      businessLevel: state.businessLevel,
      season,
      updatedAt: new Date().toISOString(),
      isCurrentPlayer: true,
    };
    if (existingIdx >= 0) {
      currentRecords[existingIdx] = entry;
    } else {
      currentRecords.push(entry);
    }
  }

  try {
    localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(currentRecords));
  } catch {
    // ignore
  }
  return currentRecords;
}

export function loadLocalLeaderboard(): LeaderboardRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_LB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
