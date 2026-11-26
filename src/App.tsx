import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AssemblyStageId,
  CameraMode,
  ComponentCategory,
  DailyReport,
  Difficulty,
  GameScreenState,
  GameSettings,
  GameState,
  HardwareItem,
  InspectablePartKey,
  InventoryEntry,
  LeaderboardRecord,
  PCBuildState,
  StationId,
} from './types/game';
import { WorkshopSceneController } from './three/WorkshopScene';
import {
  calculateBusinessLevel,
  calculateDailyOperatingExpense,
  calculateNetWorth,
  createInitialGameState,
  generateCustomerOrder,
  validateOrderCompletion,
} from './engine/businessEngine';
import { formatIDR, getHardwareItem } from './engine/hardwareDatabase';
import {
  deleteSaveSlot,
  getLastSaveSlotId,
  listSaveSlots,
  loadGameFromSlot,
  loadLocalLeaderboard,
  loadSettings,
  recordLocalLeaderboardEntry,
  saveGameToSlot,
  saveSettings,
} from './engine/saveManager';
import {
  getOnlineSession,
  OnlinePlayerAccount,
  subscribeSupabaseAuthChange,
  syncLeaderboardToCloud,
} from './engine/supabaseClient';
import { audioManager } from './engine/audioManager';
import {
  createDefaultTutorialState,
  createTutorialStarterOrder,
  evaluateTutorialProgress,
  getObjectiveSummary,
  TUTORIAL_REWARD_CASH_IDR,
  TUTORIAL_REWARD_REPUTATION,
} from './engine/tutorialEngine';
import { TitleScreen } from './components/TitleScreen';
import { WorkshopHUD } from './components/WorkshopHUD';
import { TutorialOverlay } from './components/TutorialOverlay';
import { ReceptionModal } from './components/ReceptionModal';
import { WorkbenchPanel } from './components/WorkbenchPanel';
import { PCMonitorModal } from './components/PCMonitorModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { BusinessPCModal } from './components/BusinessPCModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SettingsModal } from './components/SettingsModal';
import { DailyReportModal } from './components/DailyReportModal';
import { PauseModal } from './components/PauseModal';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<WorkshopSceneController | null>(null);
  const visitedStationsRef = useRef<Set<StationId>>(new Set());

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const lang = settings.language ?? 'id';

  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [gameState, setGameState] = useState<GameState>(() => {
    const lastId = getLastSaveSlotId();
    if (lastId) {
      const loaded = loadGameFromSlot(lastId);
      if (loaded.state) return loaded.state;
    }
    return createInitialGameState('Bengkel PC Garuda Tech', 'Teknisi', 'normal', loadSettings().language);
  });

  const [activeStation, setActiveStation] = useState<StationId>('overview');
  const [assemblyStage, setAssemblyStage] = useState<AssemblyStageId>('preparation');
  const [explodedView, setExplodedView] = useState(0);
  const [inspectedPartKey, setInspectedPartKey] = useState<InspectablePartKey | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [fps, setFps] = useState(60);

  // Modals
  const [showMonitor, setShowMonitor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [leaderboardModalMode, setLeaderboardModalMode] = useState<'local' | 'global' | null>(null);
  const [businessTab, setBusinessTab] = useState<'store' | 'inventory' | 'finances' | 'upgrades' | 'leaderboard' | 'saves'>('store');
  const [dailyReportModal, setDailyReportModal] = useState<DailyReport | null>(null);
  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardRecord[]>(() => loadLocalLeaderboard());
  const [onlineAccount, setOnlineAccount] = useState<OnlinePlayerAccount | null>(null);
  const [saveSlots, setSaveSlots] = useState(() => listSaveSlots());

  const hasContinueSave = useMemo(() => {
    const last = getLastSaveSlotId();
    return Boolean(last && loadGameFromSlot(last).state);
  }, [saveSlots]);

  const currentPCBuild = useMemo<PCBuildState>(() => {
    if (gameState.activeOrderId) {
      const ord = gameState.orders.find((o) => o.id === gameState.activeOrderId);
      if (ord) return ord.pcBuild;
    }
    return gameState.sandboxPC;
  }, [gameState]);

  const tutorialEval = useMemo(
    () => evaluateTutorialProgress(gameState, activeStation),
    [gameState, activeStation]
  );

  const objectiveSummary = useMemo(
    () => getObjectiveSummary(gameState, activeStation, lang),
    [gameState, activeStation, lang]
  );

  // Mirror state to document.body.dataset.state & HTML lang
  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Sync audio, ambient music, graphics, language & camera control settings
  useEffect(() => {
    audioManager.updateSettings(settings);
    sceneRef.current?.applyGraphicsQuality(settings.graphicsQuality);
    sceneRef.current?.setLanguage(lang);
    sceneRef.current?.setControlSettings(
      settings.cameraSensitivity ?? 1,
      settings.cameraSpeed ?? 1
    );
    if (screenState === 'playing' && !settings.muted && (settings.musicVolume ?? 0.35) > 0.01) {
      audioManager.startAmbientMusic();
    } else {
      audioManager.stopAmbientMusic();
    }
  }, [settings, lang, screenState]);

  // Check Supabase session & subscribe to OAuth/auth changes (never blocks offline startup)
  useEffect(() => {
    getOnlineSession()
      .then((acc) => {
        if (acc) setOnlineAccount(acc);
      })
      .catch(() => {});
    const unsubscribe = subscribeSupabaseAuthChange((acc) => {
      setOnlineAccount(acc);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSelectStation = useCallback((station: StationId) => {
    audioManager.playClick();
    setActiveStation(station);
    setShowMonitor(false);
    if (station !== 'workbench') {
      setExplodedView(0);
      sceneRef.current?.setExplodedView(0);
    }

    if (station !== 'overview') {
      visitedStationsRef.current.add(station);
      const count = visitedStationsRef.current.size;
      setGameState((prev) => {
        const tut = prev.tutorialState;
        if (!tut || !tut.active || tut.completed || tut.skipped) return prev;
        const checkedBiz = tut.checkedBusinessPC || station === 'business_pc' || station === 'shelves';
        if (tut.visitedStationCount >= count && tut.checkedBusinessPC === checkedBiz) return prev;
        return {
          ...prev,
          tutorialState: {
            ...tut,
            visitedStationCount: Math.max(tut.visitedStationCount, count),
            checkedBusinessPC: checkedBiz,
          },
        };
      });
    }

    const camMap: Record<StationId, CameraMode> = {
      overview: 'overview',
      reception: 'reception',
      workbench: 'workbench',
      repair_table: 'repair_table',
      business_pc: 'business_pc',
      testing_station: 'testing_station',
      shelves: 'shelves',
    };
    sceneRef.current?.setCameraMode(camMap[station]);
    sceneRef.current?.setActiveStationFocus(station);

    if (station === 'testing_station') {
      setShowMonitor(true);
    } else if (station === 'shelves') {
      setBusinessTab('inventory');
    } else if (station === 'business_pc') {
      setBusinessTab('store');
    }
  }, []);

  const handleInspectPart = useCallback(
    (partKey: InspectablePartKey | null) => {
      setInspectedPartKey(partKey);
      if (partKey) {
        handleSelectStation('workbench');
      }
    },
    [handleSelectStation]
  );

  const handleCameraMoved = useCallback(() => {
    setGameState((prev) => {
      const tut = prev.tutorialState;
      if (!tut || !tut.active || tut.cameraMoved) return prev;
      return {
        ...prev,
        tutorialState: { ...tut, cameraMoved: true },
      };
    });
  }, []);

  // Stable Three.js ref callbacks
  const selectStationRef = useRef(handleSelectStation);
  selectStationRef.current = handleSelectStation;
  const inspectPartRef = useRef(handleInspectPart);
  inspectPartRef.current = handleInspectPart;
  const cameraMovedRef = useRef(handleCameraMoved);
  cameraMovedRef.current = handleCameraMoved;

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const ctrl = new WorkshopSceneController(
      canvasMountRef.current,
      {
        onSelectStation: (st) => selectStationRef.current(st),
        onInspectPart: (key) => inspectPartRef.current(key),
        onHoverStation: (lbl) => setHoveredLabel(lbl),
        onFpsUpdate: (val) => setFps(val),
        onCameraMoved: () => cameraMovedRef.current(),
      },
      settings.graphicsQuality
    );
    ctrl.setLanguage(settings.language ?? 'id');
    ctrl.setControlSettings(settings.cameraSensitivity ?? 1, settings.cameraSpeed ?? 1);
    sceneRef.current = ctrl;
    return () => {
      ctrl.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Persist automatic monotonic chapter progress for active tutorial
  useEffect(() => {
    const tut = gameState.tutorialState;
    if (!tut || !tut.active || tut.completed || tut.skipped) return;
    if (
      tutorialEval.tutorial.chapterIndex !== tut.chapterIndex ||
      tutorialEval.tutorial.checkedBusinessPC !== tut.checkedBusinessPC
    ) {
      setGameState((prev) => ({
        ...prev,
        tutorialState: tutorialEval.tutorial,
      }));
    }
  }, [gameState.tutorialState, tutorialEval.tutorial]);

  // Sync Three.js scene with PC Build, Upgrades, Stylized Customers, Owner Focus & Tutorial Beacon
  useEffect(() => {
    const ctrl = sceneRef.current;
    if (!ctrl) return;
    ctrl.setTitleShowcase(screenState === 'title');
    ctrl.syncPCBuild(currentPCBuild, activeStation === 'workbench' ? assemblyStage : undefined);
    ctrl.updateWorkshopUpgrades(gameState.upgrades, gameState.workshopName);
    ctrl.syncOrderCustomers(gameState.orders);
    ctrl.setActiveStationFocus(activeStation);

    const showBeacon =
      screenState === 'playing' &&
      Boolean(tutorialEval.tutorial.active && !tutorialEval.tutorial.completed && !tutorialEval.tutorial.skipped);
    ctrl.syncTutorialBeacon(showBeacon, tutorialEval.beaconWorldPos);
  }, [
    screenState,
    currentPCBuild,
    activeStation,
    assemblyStage,
    gameState.upgrades,
    gameState.workshopName,
    gameState.orders,
    tutorialEval.tutorial.active,
    tutorialEval.tutorial.completed,
    tutorialEval.tutorial.skipped,
    tutorialEval.beaconWorldPos,
  ]);

  // ?autostart=1 support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && screenState === 'title') {
      setScreenState('playing');
      document.body.dataset.state = 'playing';
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (inInput) return;

      if (screenState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setScreenState('playing');
        document.body.dataset.state = 'playing';
        audioManager.playConfirm();
        return;
      }

      if (screenState === 'playing' && e.key === 'Escape') {
        e.preventDefault();
        if (showSettings) {
          setShowSettings(false);
        } else if (leaderboardModalMode) {
          setLeaderboardModalMode(null);
        } else if (showMonitor) {
          setShowMonitor(false);
          if (activeStation === 'testing_station') handleSelectStation('overview');
        } else if (activeStation !== 'overview') {
          handleSelectStation('overview');
        } else {
          setScreenState('paused');
        }
      } else if (screenState === 'playing' && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setScreenState('paused');
      } else if (screenState === 'paused' && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setScreenState('playing');
      } else if (screenState === 'playing' && e.key.toLowerCase() === 'h') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenState, showSettings, leaderboardModalMode, showMonitor, activeStation, handleSelectStation]);

  const pushNotification = useCallback(
    (prev: GameState, title: string, message: string, kind: 'info' | 'success' | 'warning' | 'error'): GameState['notifications'] => {
      const hrs = Math.floor(prev.minuteOfDay / 60);
      const mins = Math.floor(prev.minuteOfDay % 60);
      return [
        {
          id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          title,
          message,
          kind,
          day: prev.day,
          timeStr: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
        },
        ...prev.notifications,
      ].slice(0, 12);
    },
    []
  );

  // Trigger End-of-Day report, deduct daily operating overhead, and pause clock
  const triggerEndOfDay = useCallback(
    (curr: GameState): { nextState: GameState; report: DailyReport } => {
      const opExpense = calculateDailyOperatingExpense(curr);
      const todayTxs = curr.transactions.filter((t) => t.day === curr.day);
      const rev = todayTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = todayTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) + opExpense;

      let repDelta = 0;
      const updatedOrders = curr.orders.map((o) => {
        if (o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'New' && curr.day >= o.deadlineDay) {
          repDelta -= 5;
          return { ...o, status: 'Cancelled' as const };
        }
        return o;
      });

      const newRep = Math.max(0, Math.min(100, curr.reputation + repDelta));
      const report: DailyReport = {
        day: curr.day,
        customersServed: curr.orders.filter((o) => o.status === 'Delivered' && o.createdDay <= curr.day).length,
        jobsCompleted: curr.completedOrdersCount,
        revenue: rev,
        expenses: exp,
        netProfit: rev - exp,
        reputationDelta: repDelta,
      };

      const nextState: GameState = {
        ...curr,
        cash: Math.max(0, curr.cash - opExpense),
        totalExpenses: curr.totalExpenses + opExpense,
        orders: updatedOrders,
        reputation: newRep,
        businessLevel: calculateBusinessLevel(newRep, curr.completedOrdersCount),
        dailyReports: [report, ...curr.dailyReports],
        transactions: [
          {
            id: `tx_op_${Date.now()}`,
            day: curr.day,
            minute: 1080,
            type: 'expense',
            category: 'workshop_expense',
            description:
              lang === 'en'
                ? `Day ${curr.day} electricity & shop utilities`
                : `Listrik & operasional bengkel Hari ${curr.day}`,
            amount: opExpense,
          },
          ...curr.transactions,
        ],
        timeSpeed: 0,
      };

      return { nextState, report };
    },
    [lang]
  );

  // In-game clock & delivery arrival loop (scaled by configurable dayDurationMinutes)
  useEffect(() => {
    if (screenState !== 'playing' || gameState.timeSpeed === 0 || dailyReportModal) return;

    const dayDurationMin = settings.dayDurationMinutes ?? 30;
    const intervalMs = Math.max(
      120,
      Math.round((dayDurationMin * 60 * 1000) / (600 * gameState.timeSpeed))
    );
    const timer = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.timeSpeed === 0) return prev;
        const nextMinute = prev.minuteOfDay + 1;

        let nextInventory = [...prev.inventory];
        let nextNotifs = prev.notifications;
        const remainingDeliveries = prev.pendingDeliveries.filter((del) => {
          const arrived =
            del.arrivalDay < prev.day ||
            (del.arrivalDay === prev.day && del.arrivalMinute <= nextMinute);
          if (arrived) {
            for (const entry of del.items) {
              const idx = nextInventory.findIndex((i) => i.itemId === entry.itemId);
              if (idx >= 0) {
                nextInventory[idx] = { ...nextInventory[idx], quantity: nextInventory[idx].quantity + entry.quantity };
              } else {
                nextInventory.push({ ...entry });
              }
            }
            nextNotifs = [
              {
                id: `del_${del.id}`,
                title: lang === 'en' ? 'Parts Delivered' : 'Paket Komponen Tiba',
                message:
                  lang === 'en'
                    ? 'Your supplier shipment has arrived in workshop inventory.'
                    : 'Kiriman komponen dari pemasok telah masuk ke inventaris bengkel.',
                kind: 'success' as const,
                day: prev.day,
                timeStr: `${String(Math.floor(nextMinute / 60)).padStart(2, '0')}:${String(nextMinute % 60).padStart(2, '0')}`,
              },
              ...nextNotifs,
            ].slice(0, 12);
            audioManager.playConfirm();
          }
          return !arrived;
        });

        if (nextMinute >= 1080) {
          const { nextState, report } = triggerEndOfDay({
            ...prev,
            minuteOfDay: 1080,
            inventory: nextInventory,
            pendingDeliveries: remainingDeliveries,
            notifications: nextNotifs,
          });
          setDailyReportModal(report);
          saveGameToSlot(nextState, 'autosave');
          setSaveSlots(listSaveSlots());
          return nextState;
        }

        let nextOrders = prev.orders;
        const activeWaiting = prev.orders.filter((o) => o.status === 'New').length;
        if (nextMinute % 150 === 0 && activeWaiting < 3) {
          const newOrd = generateCustomerOrder(prev, nextOrders.length + 1, undefined, lang);
          nextOrders = [...nextOrders, newOrd];
          audioManager.playCustomerArrival();
          nextNotifs = pushNotification(
            prev,
            lang === 'en' ? 'Customer Arrived' : 'Pelanggan Datang',
            lang === 'en'
              ? `${newOrd.customer.name} entered for ${newOrd.type}.`
              : `${newOrd.customer.name} tiba di resepsionis (${newOrd.title}).`,
            'info'
          );
        }

        return {
          ...prev,
          minuteOfDay: nextMinute,
          inventory: nextInventory,
          pendingDeliveries: remainingDeliveries,
          orders: nextOrders,
          notifications: nextNotifs,
        };
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    screenState,
    gameState.timeSpeed,
    settings.dayDurationMinutes,
    dailyReportModal,
    triggerEndOfDay,
    pushNotification,
    lang,
  ]);

  // Handlers
  const startNewGame = (workshopName: string, playerUsername: string, difficulty: Difficulty) => {
    const fresh = createInitialGameState(workshopName, playerUsername, difficulty, lang);
    visitedStationsRef.current.clear();
    setGameState(fresh);
    saveGameToSlot(fresh, 'autosave');
    const lb = recordLocalLeaderboardEntry(fresh);
    setLocalLeaderboard(lb);
    setSaveSlots(listSaveSlots());
    setActiveStation('overview');
    sceneRef.current?.setCameraMode('overview');
    setScreenState('playing');
    document.body.dataset.state = 'playing';
    audioManager.playConfirm();
  };

  const continueGame = () => {
    const last = getLastSaveSlotId();
    if (last) {
      const res = loadGameFromSlot(last);
      if (res.state) {
        setGameState(res.state);
      }
    }
    setActiveStation('overview');
    sceneRef.current?.setCameraMode('overview');
    setScreenState('playing');
    document.body.dataset.state = 'playing';
    audioManager.playConfirm();
  };

  const loadSlot = (slotId: string) => {
    const res = loadGameFromSlot(slotId);
    if (!res.state) {
      audioManager.playError();
      return;
    }
    setGameState(res.state);
    setActiveStation('overview');
    sceneRef.current?.setCameraMode('overview');
    setScreenState('playing');
    document.body.dataset.state = 'playing';
    audioManager.playConfirm();
  };

  const updateCurrentPCBuild = useCallback((updater: (prev: PCBuildState) => PCBuildState) => {
    setGameState((prev) => {
      if (prev.activeOrderId) {
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === prev.activeOrderId
              ? { ...o, status: o.status === 'Accepted' ? 'In Progress' : o.status, pcBuild: updater(o.pcBuild) }
              : o
          ),
        };
      }
      return { ...prev, sandboxPC: updater(prev.sandboxPC) };
    });
  }, []);

  const consumeInventoryItem = useCallback((itemId: string): boolean => {
    let success = false;
    setGameState((prev) => {
      const idx = prev.inventory.findIndex((i) => i.itemId === itemId);
      if (idx < 0 || prev.inventory[idx].quantity <= 0) return prev;
      success = true;
      const nextInv = [...prev.inventory];
      nextInv[idx] = { ...nextInv[idx], quantity: nextInv[idx].quantity - 1 };
      return { ...prev, inventory: nextInv };
    });
    return success;
  }, []);

  const installFromInventory = useCallback(
    (item: HardwareItem): string | null => {
      const entry = gameState.inventory.find((i) => i.itemId === item.id);
      if (!entry || entry.quantity <= 0) {
        return lang === 'en' ? 'Item out of stock in inventory.' : 'Stok komponen ini habis di inventaris.';
      }

      let returnOldId: string | null = null;
      const b = currentPCBuild;

      if (item.category === 'ram') {
        const mb = getHardwareItem(b.motherboardId);
        const maxSlots = mb?.ramSlots ?? 4;
        if (b.ramIds.length >= maxSlots) {
          return lang === 'en'
            ? `All ${maxSlots} RAM slots are occupied.`
            : `Semua ${maxSlots} slot RAM sudah terisi.`;
        }
      }
      if (item.category === 'storage' && b.storageIds.length >= 4) {
        return lang === 'en' ? 'Maximum storage bays reached.' : 'Kapasitas slot penyimpanan sudah penuh.';
      }
      if (item.category === 'addon' && (b.addonIds ?? []).length >= 4) {
        return lang === 'en' ? 'Maximum 4 expansion cards reached.' : 'Maksimal 4 kartu ekspansi terpasang.';
      }
      if (item.category === 'peripheral' && (b.peripheralIds ?? []).length >= 6) {
        return lang === 'en' ? 'Maximum 6 peripherals reached.' : 'Maksimal 6 periferal meja kerja terpasang.';
      }

      if (item.category === 'case') returnOldId = b.caseId;
      if (item.category === 'motherboard') returnOldId = b.motherboardId;
      if (item.category === 'cpu') returnOldId = b.cpuId;
      if (item.category === 'cooler') returnOldId = b.coolerId;
      if (item.category === 'gpu') returnOldId = b.gpuId;
      if (item.category === 'psu') returnOldId = b.psuId;

      audioManager.playInstallPart();

      setGameState((prev) => {
        const nextInv = prev.inventory.map((e) => ({ ...e }));
        const target = nextInv.find((e) => e.itemId === item.id);
        if (!target || target.quantity <= 0) return prev;
        target.quantity -= 1;

        if (returnOldId) {
          const oldEntry = nextInv.find((e) => e.itemId === returnOldId);
          if (oldEntry) oldEntry.quantity += 1;
          else nextInv.push({ itemId: returnOldId, quantity: 1 });
        }

        const applyPart = (build: PCBuildState): PCBuildState => {
          const next = { ...build };
          if (item.category === 'case') next.caseId = item.id;
          else if (item.category === 'motherboard') next.motherboardId = item.id;
          else if (item.category === 'cpu') {
            next.cpuId = item.id;
            next.cpuRetentionClosed = false;
          } else if (item.category === 'cooler') {
            next.coolerId = item.id;
            next.faults = next.faults.map((f) => (f.type === 'cooler_failure' ? { ...f, resolved: true } : f));
          } else if (item.category === 'ram') {
            next.ramIds = [...next.ramIds, item.id];
            const mb = getHardwareItem(next.motherboardId);
            const allCompat = mb ? next.ramIds.every((rid) => getHardwareItem(rid)?.ramType === mb.ramType) : true;
            next.faults = next.faults.map((f) =>
              f.type === 'missing_ram' || (f.type === 'incompatible_ram' && allCompat)
                ? { ...f, resolved: true }
                : f
            );
          } else if (item.category === 'storage') {
            next.storageIds = [...next.storageIds, item.id];
            next.faults = next.faults.map((f) => (f.type === 'faulty_storage' ? { ...f, resolved: true } : f));
          } else if (item.category === 'gpu') {
            next.gpuId = item.id;
            next.faults = next.faults.map((f) => (f.type === 'faulty_gpu' ? { ...f, resolved: true } : f));
          } else if (item.category === 'psu') {
            next.psuId = item.id;
            next.faults = next.faults.map((f) => (f.type === 'faulty_psu' ? { ...f, resolved: true } : f));
          } else if (item.category === 'addon') {
            next.addonIds = [...(next.addonIds ?? []), item.id];
          } else if (item.category === 'peripheral') {
            next.peripheralIds = [...(next.peripheralIds ?? []), item.id];
            if (item.peripheralType === 'monitor') next.monitorConnected = true;
            if (item.peripheralType === 'keyboard') next.keyboardConnected = true;
          }
          return next;
        };

        if (prev.activeOrderId) {
          return {
            ...prev,
            inventory: nextInv,
            orders: prev.orders.map((o) =>
              o.id === prev.activeOrderId
                ? { ...o, status: 'In Progress', pcBuild: applyPart(o.pcBuild) }
                : o
            ),
          };
        }
        return { ...prev, inventory: nextInv, sandboxPC: applyPart(prev.sandboxPC) };
      });

      return null;
    },
    [gameState.inventory, currentPCBuild, lang]
  );

  const removeToInventory = useCallback((category: ComponentCategory, index = 0) => {
    audioManager.playClick();
    setGameState((prev) => {
      const build = prev.activeOrderId
        ? prev.orders.find((o) => o.id === prev.activeOrderId)?.pcBuild ?? prev.sandboxPC
        : prev.sandboxPC;

      let removedId: string | null = null;
      const nextBuild = { ...build };

      if (category === 'case') {
        removedId = nextBuild.caseId;
        nextBuild.caseId = null;
      } else if (category === 'motherboard') {
        removedId = nextBuild.motherboardId;
        nextBuild.motherboardId = null;
      } else if (category === 'cpu') {
        removedId = nextBuild.cpuId;
        nextBuild.cpuId = null;
      } else if (category === 'cooler') {
        removedId = nextBuild.coolerId;
        nextBuild.coolerId = null;
      } else if (category === 'gpu') {
        removedId = nextBuild.gpuId;
        nextBuild.gpuId = null;
      } else if (category === 'psu') {
        removedId = nextBuild.psuId;
        nextBuild.psuId = null;
      } else if (category === 'ram') {
        removedId = nextBuild.ramIds[index] ?? null;
        nextBuild.ramIds = nextBuild.ramIds.filter((_, i) => i !== index);
        const mb = getHardwareItem(nextBuild.motherboardId);
        if (
          nextBuild.ramIds.length > 0 &&
          mb &&
          nextBuild.ramIds.every((rid) => getHardwareItem(rid)?.ramType === mb.ramType)
        ) {
          nextBuild.faults = nextBuild.faults.map((f) =>
            f.type === 'incompatible_ram' ? { ...f, resolved: true } : f
          );
        }
      } else if (category === 'storage') {
        removedId = nextBuild.storageIds[index] ?? null;
        nextBuild.storageIds = nextBuild.storageIds.filter((_, i) => i !== index);
      } else if (category === 'addon') {
        removedId = (nextBuild.addonIds ?? [])[index] ?? null;
        nextBuild.addonIds = (nextBuild.addonIds ?? []).filter((_, i) => i !== index);
      } else if (category === 'peripheral') {
        removedId = (nextBuild.peripheralIds ?? [])[index] ?? null;
        nextBuild.peripheralIds = (nextBuild.peripheralIds ?? []).filter((_, i) => i !== index);
      }

      if (!removedId) return prev;
      const nextInv = prev.inventory.map((e) => ({ ...e }));
      const existing = nextInv.find((e) => e.itemId === removedId);
      if (existing) existing.quantity += 1;
      else nextInv.push({ itemId: removedId, quantity: 1 });

      if (prev.activeOrderId) {
        return {
          ...prev,
          inventory: nextInv,
          orders: prev.orders.map((o) => (o.id === prev.activeOrderId ? { ...o, pcBuild: nextBuild } : o)),
        };
      }
      return { ...prev, inventory: nextInv, sandboxPC: nextBuild };
    });
  }, []);

  const handleDeliverOrder = (orderId: string) => {
    const order = gameState.orders.find((o) => o.id === orderId);
    if (!order) return;
    const validation = validateOrderCompletion(order, lang);
    if (!validation.ready) {
      audioManager.playError();
      return;
    }

    const totalPayout = order.laborReward + validation.actualPartsCost;
    const onTimeBonus = gameState.day <= order.deadlineDay ? 5 : -4;
    const upgradeBonus = gameState.upgrades.some((u) => u.id === 'upg_testing_rig' && u.purchased)
      ? Math.round(order.laborReward * 0.1)
      : 0;
    const finalPayment = totalPayout + upgradeBonus;

    audioManager.playPayment();
    sceneRef.current?.triggerOwnerCelebration();

    setGameState((prev) => {
      const newRep = Math.min(100, Math.max(0, prev.reputation + onTimeBonus + 4));
      const newCompleted = prev.completedOrdersCount + 1;
      const nextLevel = calculateBusinessLevel(newRep, newCompleted);
      const nextState: GameState = {
        ...prev,
        cash: prev.cash + finalPayment,
        totalRevenue: prev.totalRevenue + finalPayment,
        reputation: newRep,
        businessLevel: nextLevel,
        completedOrdersCount: newCompleted,
        satisfactionHistory: [...prev.satisfactionHistory, 92],
        activeOrderId: prev.activeOrderId === orderId ? null : prev.activeOrderId,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status: 'Delivered', finalQuote: finalPayment, rating: 5 } : o
        ),
        transactions: [
          {
            id: `tx_${Date.now()}`,
            day: prev.day,
            minute: prev.minuteOfDay,
            type: 'income',
            category: 'order_payment',
            description: `${order.orderNumber} (${order.customer.name})`,
            amount: finalPayment,
          },
          ...prev.transactions,
        ],
        notifications: pushNotification(
          prev,
          lang === 'en' ? 'Payment Received' : 'Pembayaran Diterima',
          lang === 'en'
            ? `Earned ${formatIDR(finalPayment)} for ${order.orderNumber}!`
            : `Menerima ${formatIDR(finalPayment)} dari pesanan ${order.orderNumber}!`,
          'success'
        ),
      };

      const lb = recordLocalLeaderboardEntry(nextState);
      setLocalLeaderboard(lb);
      saveGameToSlot(nextState, 'autosave');
      setSaveSlots(listSaveSlots());
      if (onlineAccount) void syncLeaderboardToCloud(nextState, lang);
      return nextState;
    });
  };

  const handleCheckoutCart = (items: InventoryEntry[], totalCost: number) => {
    if (gameState.cash < totalCost) {
      audioManager.playError();
      return;
    }
    audioManager.playPayment();
    setGameState((prev) => {
      const arrivalMin = prev.minuteOfDay + 15;
      const arrivalDay = arrivalMin >= 1080 ? prev.day + 1 : prev.day;
      const normalizedMin = arrivalMin >= 1080 ? 500 : arrivalMin;

      const nextState: GameState = {
        ...prev,
        cash: prev.cash - totalCost,
        totalExpenses: prev.totalExpenses + totalCost,
        pendingDeliveries: [
          ...prev.pendingDeliveries,
          {
            id: `ship_${Date.now()}`,
            items,
            orderedAtDay: prev.day,
            orderedAtMinute: prev.minuteOfDay,
            arrivalDay,
            arrivalMinute: normalizedMin,
            totalCost,
          },
        ],
        transactions: [
          {
            id: `tx_buy_${Date.now()}`,
            day: prev.day,
            minute: prev.minuteOfDay,
            type: 'expense',
            category: 'parts_purchase',
            description:
              lang === 'en'
                ? `Purchased ${items.reduce((a, b) => a + b.quantity, 0)} component(s)`
                : `Beli ${items.reduce((a, b) => a + b.quantity, 0)} komponen dari pemasok`,
            amount: totalCost,
          },
          ...prev.transactions,
        ],
        notifications: pushNotification(
          prev,
          lang === 'en' ? 'Order Placed' : 'Pesanan Stok Dikirim',
          lang === 'en' ? 'Courier shipment scheduled for delivery.' : 'Paket komponen sedang dikirim kurir.',
          'info'
        ),
      };
      const lb = recordLocalLeaderboardEntry(nextState);
      setLocalLeaderboard(lb);
      saveGameToSlot(nextState, 'autosave');
      return nextState;
    });
  };

  const handleSellInventoryItem = (itemId: string) => {
    const item = getHardwareItem(itemId);
    if (!item) return;
    const resale = Math.round(item.purchasePrice * 0.85);
    audioManager.playPayment();

    setGameState((prev) => {
      const nextInv = prev.inventory.map((e) =>
        e.itemId === itemId && e.quantity > 0 ? { ...e, quantity: e.quantity - 1 } : e
      );
      const nextState: GameState = {
        ...prev,
        cash: prev.cash + resale,
        totalRevenue: prev.totalRevenue + resale,
        inventory: nextInv,
        transactions: [
          {
            id: `tx_sell_${Date.now()}`,
            day: prev.day,
            minute: prev.minuteOfDay,
            type: 'income',
            category: 'component_sale',
            description: lang === 'en' ? `Sold ${item.model}` : `Jual ${item.model}`,
            amount: resale,
          },
          ...prev.transactions,
        ],
      };
      setLocalLeaderboard(recordLocalLeaderboardEntry(nextState));
      return nextState;
    });
  };

  const handlePurchaseUpgrade = (upgradeId: string) => {
    const upg = gameState.upgrades.find((u) => u.id === upgradeId);
    if (!upg || upg.purchased || gameState.cash < upg.cost) {
      audioManager.playError();
      return;
    }
    audioManager.playConfirm();
    setGameState((prev) => {
      const nextState: GameState = {
        ...prev,
        cash: prev.cash - upg.cost,
        totalExpenses: prev.totalExpenses + upg.cost,
        upgrades: prev.upgrades.map((u) => (u.id === upgradeId ? { ...u, purchased: true } : u)),
        transactions: [
          {
            id: `tx_upg_${Date.now()}`,
            day: prev.day,
            minute: prev.minuteOfDay,
            type: 'expense',
            category: 'upgrade',
            description: `Upgrade Bengkel: ${upg.name}`,
            amount: upg.cost,
          },
          ...prev.transactions,
        ],
        notifications: pushNotification(
          prev,
          lang === 'en' ? 'Upgrade Installed' : 'Upgrade Bengkel Aktif',
          lang === 'en' ? `${upg.name} is now active!` : `${upg.name} kini terpasang di bengkel!`,
          'success'
        ),
      };
      setLocalLeaderboard(recordLocalLeaderboardEntry(nextState));
      saveGameToSlot(nextState, 'autosave');
      return nextState;
    });
  };

  const handleClaimTutorialReward = () => {
    audioManager.playPayment();
    sceneRef.current?.triggerOwnerCelebration();
    setGameState((prev) => {
      const tut = prev.tutorialState ?? createDefaultTutorialState(true);
      if (tut.rewardClaimed) return prev;
      const nextRep = Math.min(100, prev.reputation + TUTORIAL_REWARD_REPUTATION);
      const nextState: GameState = {
        ...prev,
        cash: prev.cash + TUTORIAL_REWARD_CASH_IDR,
        totalRevenue: prev.totalRevenue + TUTORIAL_REWARD_CASH_IDR,
        reputation: nextRep,
        businessLevel: calculateBusinessLevel(nextRep, prev.completedOrdersCount),
        tutorialState: {
          ...tut,
          active: false,
          completed: true,
          rewardClaimed: true,
        },
        transactions: [
          {
            id: `tx_tut_${Date.now()}`,
            day: prev.day,
            minute: prev.minuteOfDay,
            type: 'income',
            category: 'order_payment',
            description:
              lang === 'en'
                ? 'Interactive Tutorial Completion Bonus'
                : 'Bonus Penyelesaian Tutorial Bengkel',
            amount: TUTORIAL_REWARD_CASH_IDR,
          },
          ...prev.transactions,
        ],
        notifications: pushNotification(
          prev,
          lang === 'en' ? 'Tutorial Completed!' : 'Tutorial Selesai!',
          lang === 'en'
            ? `Received ${formatIDR(TUTORIAL_REWARD_CASH_IDR)} & +${TUTORIAL_REWARD_REPUTATION} Reputation!`
            : `Bonus ${formatIDR(TUTORIAL_REWARD_CASH_IDR)} & +${TUTORIAL_REWARD_REPUTATION} Reputasi diterima!`,
          'success'
        ),
      };
      setLocalLeaderboard(recordLocalLeaderboardEntry(nextState));
      saveGameToSlot(nextState, 'autosave');
      return nextState;
    });
  };

  const handleSkipTutorial = () => {
    audioManager.playClick();
    setGameState((prev) => ({
      ...prev,
      tutorialState: {
        ...(prev.tutorialState ?? createDefaultTutorialState(false)),
        active: false,
        skipped: true,
      },
    }));
  };

  const handleReplayTutorial = () => {
    audioManager.playConfirm();
    visitedStationsRef.current.clear();
    setActiveStation('overview');
    sceneRef.current?.setCameraMode('overview');
    setGameState((prev) => {
      const hasStarter = prev.orders.some(
        (o) => o.isTutorialOrder && o.status !== 'Delivered' && o.status !== 'Cancelled'
      );
      const nextOrders = hasStarter
        ? prev.orders
        : [createTutorialStarterOrder(prev.day, lang), ...prev.orders];
      return {
        ...prev,
        orders: nextOrders,
        tutorialState: {
          ...createDefaultTutorialState(true),
          rewardClaimed: prev.tutorialState?.rewardClaimed ?? false,
        },
      };
    });
    if (screenState === 'paused') setScreenState('playing');
  };

  const netWorthNow = useMemo(() => calculateNetWorth(gameState).totalNetWorth, [gameState]);
  const uiScaleClass = `ui-scale-${settings.uiScale ?? 'normal'}`;

  const showFloatingTutorial =
    screenState === 'playing' &&
    Boolean(tutorialEval.tutorial.active && !tutorialEval.tutorial.completed && !tutorialEval.tutorial.skipped) &&
    !dailyReportModal &&
    !showMonitor &&
    !showSettings &&
    !leaderboardModalMode &&
    (activeStation === 'overview' || activeStation === 'workbench');

  return (
    <div className={`relative w-screen h-[100dvh] overflow-hidden bg-[#090d16] select-none ${uiScaleClass}`}>
      {/* Dedicated Isolated WebGL Three.js Container */}
      <div
        ref={canvasMountRef}
        data-testid="workshop-canvas-container"
        className="fixed inset-0 w-full h-full"
      />

      {/* Title Screen */}
      {screenState === 'title' && (
        <TitleScreen
          lang={lang}
          hasContinueSave={hasContinueSave}
          saveSlots={saveSlots}
          defaultUsername={gameState.playerUsername}
          onChangeLanguage={(nextLang) => {
            const next = { ...settings, language: nextLang };
            setSettings(next);
            saveSettings(next);
          }}
          onStartNewGame={startNewGame}
          onContinueGame={continueGame}
          onLoadSlot={loadSlot}
          onOpenLeaderboard={(mode) => setLeaderboardModalMode(mode)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => {
            setBusinessTab('leaderboard');
            setScreenState('playing');
            handleSelectStation('business_pc');
          }}
        />
      )}

      {/* Active Playing HUD */}
      {screenState === 'playing' && (
        <>
          <WorkshopHUD
            lang={lang}
            state={gameState}
            activeStation={activeStation}
            hoveredLabel={hoveredLabel}
            dockCollapsed={dockCollapsed}
            fps={fps}
            showFps={settings.showFps}
            muted={settings.muted}
            showObjectives={settings.showObjectives ?? true}
            showHints={settings.showHints ?? true}
            objective={objectiveSummary}
            onToggleMute={() => {
              const next = { ...settings, muted: !settings.muted };
              setSettings(next);
              saveSettings(next);
            }}
            onToggleDock={() => setDockCollapsed((c) => !c)}
            onSelectStation={handleSelectStation}
            onFocusObjectiveTarget={(st) => handleSelectStation(st)}
            onNudgeCamera={(dx, dz) => sceneRef.current?.nudgeCamera(dx, dz)}
            onSetSpeed={(spd) => setGameState((p) => ({ ...p, timeSpeed: spd }))}
            onEndDay={() => {
              const { nextState, report } = triggerEndOfDay(gameState);
              setGameState(nextState);
              setDailyReportModal(report);
            }}
            onOpenPause={() => setScreenState('paused')}
            onOpenSettings={() => setShowSettings(true)}
            onDismissNotification={(id) =>
              setGameState((p) => ({ ...p, notifications: p.notifications.filter((n) => n.id !== id) }))
            }
          />

          {/* Non-Blocking Interactive Tutorial Overlay */}
          {showFloatingTutorial && (
            <TutorialOverlay
              lang={lang}
              evaluation={tutorialEval}
              activeStation={activeStation}
              onGoToTarget={(st, suggestedStage) => {
                if (suggestedStage) setAssemblyStage(suggestedStage);
                handleSelectStation(st);
              }}
              onClaimReward={handleClaimTutorialReward}
              onSkip={handleSkipTutorial}
            />
          )}

          {/* Station Views */}
          {activeStation === 'reception' && (
            <ReceptionModal
              lang={lang}
              state={gameState}
              onAcceptOrder={(id) => {
                audioManager.playConfirm();
                setGameState((p) => ({
                  ...p,
                  activeOrderId: id,
                  orders: p.orders.map((o) => (o.id === id ? { ...o, status: 'Accepted' } : o)),
                }));
              }}
              onRejectOrder={(id) => {
                audioManager.playClick();
                setGameState((p) => ({
                  ...p,
                  orders: p.orders.map((o) => (o.id === id ? { ...o, status: 'Cancelled' } : o)),
                }));
              }}
              onFocusOrderAtWorkbench={(id, st) => {
                setGameState((p) => ({ ...p, activeOrderId: id }));
                handleSelectStation(st);
              }}
              onDeliverOrder={handleDeliverOrder}
              onInviteNewCustomer={() => {
                audioManager.playCustomerArrival();
                setGameState((p) => ({
                  ...p,
                  orders: [...p.orders, generateCustomerOrder(p, p.orders.length + 1, undefined, lang)],
                }));
              }}
              onClose={() => handleSelectStation('overview')}
            />
          )}

          {activeStation === 'workbench' && (
            <WorkbenchPanel
              lang={lang}
              showHardwareEducation={settings.showHardwareEducation ?? true}
              state={gameState}
              currentBuild={currentPCBuild}
              activeStage={assemblyStage}
              explodedView={explodedView}
              inspectedPartKey={inspectedPartKey}
              onChangeExplodedView={(val) => {
                setExplodedView(val);
                sceneRef.current?.setExplodedView(val);
              }}
              onClearInspectedPart={() => setInspectedPartKey(null)}
              onChangeStage={setAssemblyStage}
              onUpdateBuild={updateCurrentPCBuild}
              onInstallFromInventory={installFromInventory}
              onRemoveToInventory={removeToInventory}
              onCameraPreset={(mode) => sceneRef.current?.setCameraMode(mode)}
              onOpenMonitor={() => setShowMonitor(true)}
              onSelectActiveOrder={(id) => setGameState((p) => ({ ...p, activeOrderId: id }))}
              onClose={() => handleSelectStation('overview')}
            />
          )}

          {activeStation === 'repair_table' && (
            <DiagnosticsModal
              lang={lang}
              showHardwareEducation={settings.showHardwareEducation ?? true}
              state={gameState}
              onSelectOrder={(id) => setGameState((p) => ({ ...p, activeOrderId: id }))}
              onUpdateOrder={(id, updater) =>
                setGameState((p) => ({ ...p, orders: p.orders.map((o) => (o.id === id ? updater(o) : o)) }))
              }
              onConsumeInventoryItem={consumeInventoryItem}
              onOpenMonitorForOrder={(id) => {
                setGameState((p) => ({ ...p, activeOrderId: id }));
                setShowMonitor(true);
              }}
              onCameraPreset={(mode) => sceneRef.current?.setCameraMode(mode)}
              onClose={() => handleSelectStation('overview')}
            />
          )}

          {(activeStation === 'business_pc' || activeStation === 'shelves') && (
            <BusinessPCModal
              lang={lang}
              initialTab={businessTab}
              state={gameState}
              saveSlots={saveSlots}
              localLeaderboard={localLeaderboard}
              onlineAccount={onlineAccount}
              onOnlineAccountChanged={setOnlineAccount}
              onUpdatePlayerIdentity={(username, workshopName) =>
                setGameState((p) => ({
                  ...p,
                  playerUsername: username,
                  workshopName,
                }))
              }
              onLoadCloudState={(loadedState) => {
                setGameState(loadedState);
                saveGameToSlot(loadedState, 'autosave');
                setSaveSlots(listSaveSlots());
                audioManager.playConfirm();
              }}
              onCheckoutCart={handleCheckoutCart}
              onSellInventoryItem={handleSellInventoryItem}
              onPurchaseUpgrade={handlePurchaseUpgrade}
              onSaveToSlot={(slotId) => {
                saveGameToSlot(gameState, slotId);
                setSaveSlots(listSaveSlots());
                audioManager.playConfirm();
              }}
              onLoadFromSlot={loadSlot}
              onDeleteSaveSlot={(slotId) => {
                deleteSaveSlot(slotId);
                setSaveSlots(listSaveSlots());
              }}
              onOpenFullLeaderboard={(mode) => setLeaderboardModalMode(mode)}
              onClose={() => handleSelectStation('overview')}
            />
          )}

          {showMonitor && (
            <PCMonitorModal
              lang={lang}
              showHardwareEducation={settings.showHardwareEducation ?? true}
              build={currentPCBuild}
              onUpdateBuild={updateCurrentPCBuild}
              onCmdUsed={() =>
                setGameState((p) =>
                  p.tutorialState
                    ? { ...p, tutorialState: { ...p.tutorialState, ranCmdCommand: true } }
                    : p
                )
              }
              onNetworkConfigured={() =>
                setGameState((p) =>
                  p.tutorialState
                    ? { ...p, tutorialState: { ...p.tutorialState, configuredNetwork: true } }
                    : p
                )
              }
              onClose={() => {
                setShowMonitor(false);
                if (activeStation === 'testing_station') handleSelectStation('overview');
              }}
            />
          )}
        </>
      )}

      {/* Pause Modal */}
      {screenState === 'paused' && (
        <PauseModal
          lang={lang}
          workshopName={gameState.workshopName}
          day={gameState.day}
          cash={gameState.cash}
          netWorth={netWorthNow}
          onResume={() => setScreenState('playing')}
          onQuickSave={() => {
            saveGameToSlot(gameState, gameState.saveSlotId || 'slot_1');
            setSaveSlots(listSaveSlots());
            audioManager.playConfirm();
          }}
          onOpenSettings={() => setShowSettings(true)}
          onReturnTitle={() => {
            saveGameToSlot(gameState, 'autosave');
            setSaveSlots(listSaveSlots());
            setActiveStation('overview');
            setScreenState('title');
          }}
        />
      )}

      {/* Daily Report Modal */}
      {dailyReportModal && (
        <DailyReportModal
          lang={lang}
          report={dailyReportModal}
          netWorth={netWorthNow}
          onStartNextDay={() => {
            setDailyReportModal(null);
            setGameState((p) => ({
              ...p,
              day: p.day + 1,
              minuteOfDay: 480,
              timeSpeed: 1,
              orders: [...p.orders, generateCustomerOrder(p, 1, undefined, lang)],
            }));
            audioManager.playConfirm();
          }}
        />
      )}

      {/* Leaderboard Modal */}
      {leaderboardModalMode && (
        <LeaderboardModal
          lang={lang}
          initialMode={leaderboardModalMode}
          localRecords={localLeaderboard}
          currentPlayerName={gameState.playerUsername}
          currentWorkshopName={gameState.workshopName}
          onClose={() => setLeaderboardModalMode(null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          lang={lang}
          settings={settings}
          onUpdateSettings={(next) => {
            setSettings(next);
            saveSettings(next);
          }}
          onReplayTutorial={screenState !== 'title' ? handleReplayTutorial : undefined}
          onResetCareer={
            screenState !== 'title'
              ? () => {
                  setShowSettings(false);
                  startNewGame(gameState.workshopName, gameState.playerUsername, gameState.difficulty);
                }
              : undefined
          }
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
