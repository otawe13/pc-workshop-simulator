export type Difficulty = 'easy' | 'normal' | 'hard';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';
export type Language = 'id' | 'en';
export type UIScale = 'compact' | 'normal' | 'large';

export type CameraMode =
  | 'overview'
  | 'reception'
  | 'workbench'
  | 'pc_closeup'
  | 'pc_socket'
  | 'pc_ram'
  | 'pc_storage'
  | 'pc_gpu'
  | 'pc_psu'
  | 'pc_cables'
  | 'business_pc'
  | 'testing_station'
  | 'repair_table'
  | 'repair_closeup'
  | 'shelves';

export type StationId =
  | 'overview'
  | 'reception'
  | 'workbench'
  | 'repair_table'
  | 'business_pc'
  | 'testing_station'
  | 'shelves';

export type ComponentCategory =
  | 'cpu'
  | 'motherboard'
  | 'ram'
  | 'storage'
  | 'gpu'
  | 'psu'
  | 'case'
  | 'cooler'
  | 'fan'
  | 'consumable';

export type SocketType = 'LGA1200' | 'LGA1700' | 'AM4' | 'AM5';
export type RamType = 'DDR3' | 'DDR4' | 'DDR5';
export type FormFactor = 'ITX' | 'mATX' | 'ATX';
export type StorageInterface = 'NVMe' | 'SATA';
export type OSType = 'Windows 10' | 'Windows 11' | 'Linux Mint' | 'Ubuntu';

export interface HardwareItem {
  id: string;
  manufacturer: string;
  model: string;
  category: ComponentCategory;
  generation: string;
  socket?: SocketType;
  chipset?: string;
  supportedSockets?: SocketType[];
  supportedGenerations?: string[];
  biosVersion?: string;
  minBiosVersion?: string;
  ramType?: RamType;
  ramSlots?: number;
  maxRamGB?: number;
  capacityGB?: number;
  speedMHz?: number;
  modules?: number;
  pcieSlots?: number;
  m2Slots?: number;
  sataPorts?: number;
  formFactor?: FormFactor;
  supportedFormFactors?: FormFactor[];
  storageInterface?: StorageInterface;
  lengthMm?: number;
  heightMm?: number;
  maxGpuLengthMm?: number;
  maxCoolerHeightMm?: number;
  tdpW?: number;
  wattage?: number;
  coolingCapacityW?: number;
  pciePowerPins?: number;
  hasIntegratedGraphics?: boolean;
  performanceScore: number;
  purchasePrice: number; // IDR
  sellingPrice: number; // IDR
  supplier: string;
  deliveryMinutes: number;
  minBusinessLevel: number;
  description: string;
  accentColor?: string;
  isLiquidCooler?: boolean;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface PendingDelivery {
  id: string;
  items: InventoryEntry[];
  orderedAtDay: number;
  orderedAtMinute: number;
  arrivalDay: number;
  arrivalMinute: number;
  totalCost: number;
}

export interface CompatibilityIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  involvedCategories: ComponentCategory[];
}

export interface CompatibilityReport {
  compatible: boolean;
  issues: CompatibilityIssue[];
  estimatedWattage: number;
  recommendedPsuWattage: number;
  dualChannelActive: boolean;
  totalRamGB: number;
  totalStorageGB: number;
}

export type AssemblyStageId =
  | 'preparation'
  | 'motherboard'
  | 'cpu'
  | 'cooling'
  | 'ram'
  | 'storage'
  | 'gpu'
  | 'psu'
  | 'cables'
  | 'inspection'
  | 'first_boot';

export interface PCBuildState {
  caseId: string | null;
  motherboardId: string | null;
  cpuId: string | null;
  coolerId: string | null;
  ramIds: string[];
  storageIds: string[];
  gpuId: string | null;
  psuId: string | null;
  fanCount: number;

  // Physical assembly details
  sidePanelOpen: boolean;
  selectedTool: 'none' | 'screwdriver' | 'thermal_paste' | 'antistatic';
  motherboardScrewsSecured: boolean;
  cpuSocketOpen: boolean;
  cpuRetentionClosed: boolean;
  thermalPasteApplied: boolean;
  coolerSecured: boolean;
  cpuFanConnected: boolean;
  storageCablesConnected: boolean;
  gpuBracketSecured: boolean;
  gpuPowerConnected: boolean;
  atx24PinConnected: boolean;
  cpu8PinConnected: boolean;
  sataPowerConnected: boolean;
  frontPanelConnected: boolean;
  usbHeaderConnected: boolean;
  audioHeaderConnected: boolean;
  caseFansConnected: boolean;
  monitorConnected: boolean;
  keyboardConnected: boolean;
  poweredOn: boolean;
  usbBootMediaInserted: OSType | null;

  // Fault / repair overrides
  faults: PCFault[];
  biosSettings: BIOSSettings;
  osState: OSState;
  drivers: DriverState;
  benchmarks: BenchmarkResults | null;
}

export interface BIOSSettings {
  bootPriority: ('usb' | 'nvme' | 'sata' | 'hdd')[];
  uefiMode: boolean;
  xmpEnabled: boolean;
  fanCurveMode: 'silent' | 'standard' | 'turbo';
  secureBoot: boolean;
  biosCorrupted?: boolean;
}

export interface PartitionEntry {
  id: string;
  label: string;
  type: 'EFI' | 'System' | 'Data' | 'Unallocated';
  sizeGB: number;
  formatted: boolean;
}

export interface OSState {
  installedOS: OSType | null;
  corrupted: boolean;
  bootloaderBroken: boolean;
  partitions: PartitionEntry[];
  language: string;
  targetDriveId: string | null;
  installProgress: number;
  setupCompleted: boolean;
}

export interface DriverState {
  chipset: boolean;
  graphics: boolean;
  audio: boolean;
  network: boolean;
  storage: boolean;
  peripheral: boolean;
}

export interface BenchmarkResults {
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  storageScore: number;
  maxCpuTempC: number;
  maxGpuTempC: number;
  stabilityPassed: boolean;
  overallScore: number;
  timestamp: number;
}

export interface POSTResult {
  passed: boolean;
  beepCount: number;
  errorCode: string | null;
  message: string;
  details: string[];
  detectedCpu: string | null;
  detectedRamGB: number;
  detectedStorageCount: number;
  detectedGpu: string | null;
  cpuTempC: number;
}

export type FaultType =
  | 'faulty_psu'
  | 'missing_ram'
  | 'loose_ram'
  | 'faulty_storage'
  | 'overheating_paste'
  | 'cooler_failure'
  | 'faulty_gpu'
  | 'loose_cables'
  | 'damaged_connector'
  | 'corrupted_os'
  | 'missing_drivers'
  | 'bios_misconfig'
  | 'bootloader_failure'
  | 'partition_issue';

export type DiagnosticToolId =
  | 'screwdriver'
  | 'psu_tester'
  | 'multimeter'
  | 'ram_tester'
  | 'thermal_monitor'
  | 'diagnostic_usb'
  | 'recovery_media';

export interface PCFault {
  id: string;
  type: FaultType;
  label: string;
  clueByTool: Partial<Record<DiagnosticToolId, string>>;
  resolved: boolean;
}

export type CustomerArchetype =
  | 'Office Worker'
  | 'Student'
  | 'Casual Gamer'
  | 'Professional Gamer'
  | 'Content Creator'
  | 'Business Owner'
  | 'PC Enthusiast'
  | 'Budget Customer'
  | 'Older Customer'
  | 'Female Customer';

export type OrderType =
  | 'PC Assembly'
  | 'PC Repair'
  | 'Hardware Upgrade'
  | 'OS Installation'
  | 'Troubleshooting'
  | 'Maintenance'
  | 'Custom Gaming PC';

export type OrderStatus =
  | 'New'
  | 'Accepted'
  | 'In Progress'
  | 'Waiting for Parts'
  | 'Testing'
  | 'Completed'
  | 'Delivered'
  | 'Cancelled';

export interface CustomerProfile {
  id: string;
  name: string;
  archetype: CustomerArchetype;
  avatarColor: string;
  personality: 'Patient' | 'Impatient' | 'Detail-Oriented' | 'Friendly' | 'Frugal';
  technicalKnowledge: 'Low' | 'Medium' | 'High';
  patience: number;
  satisfaction: number;
  gender?: 'male' | 'female';
  appearanceVariant?: number;
}

export interface OrderRequirements {
  minCpuScore?: number;
  minGpuScore?: number;
  minRamGB?: number;
  minStorageGB?: number;
  requiredOS?: OSType;
  requireDrivers?: boolean;
  requireBenchmark?: boolean;
  fixAllFaults?: boolean;
  specificCategory?: ComponentCategory;
}

export interface WorkshopOrder {
  id: string;
  orderNumber: string;
  customer: CustomerProfile;
  type: OrderType;
  title: string;
  description: string;
  dialogue: string;
  requirements: OrderRequirements;
  budget: number;
  laborReward: number;
  partsAllowance: number;
  deadlineDay: number;
  createdDay: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: OrderStatus;
  pcBuild: PCBuildState;
  usedDiagnosticTools: DiagnosticToolId[];
  discoveredClues: string[];
  finalQuote?: number;
  rating?: number;
  isTutorialOrder?: boolean;
}

export interface FinancialTransaction {
  id: string;
  day: number;
  minute: number;
  type: 'income' | 'expense';
  category: 'order_payment' | 'component_sale' | 'parts_purchase' | 'upgrade' | 'workshop_expense' | 'delivery';
  description: string;
  amount: number;
}

export interface DailyReport {
  day: number;
  customersServed: number;
  jobsCompleted: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  reputationDelta: number;
}

export interface WorkshopUpgrade {
  id: string;
  name: string;
  category: 'tools' | 'workshop' | 'business';
  description: string;
  cost: number;
  assetValue: number;
  minLevel: number;
  purchased: boolean;
  effectSummary: string;
}

export type BusinessLevel = 1 | 2 | 3 | 4 | 5;

export type LeaderboardCategory =
  | 'net_worth'
  | 'total_revenue'
  | 'net_profit'
  | 'completed_orders'
  | 'satisfaction'
  | 'reputation';

export type LeaderboardSeason = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardRecord {
  id: string;
  username: string;
  workshopName: string;
  netWorth: number;
  totalRevenue: number;
  netProfit: number;
  completedOrders: number;
  avgSatisfaction: number;
  reputation: number;
  businessLevel: BusinessLevel;
  previousRank?: number;
  season: LeaderboardSeason;
  updatedAt: string;
  isCurrentPlayer?: boolean;
}

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  showFps: boolean;
  language: Language;
  cameraSensitivity: number;
  cameraSpeed: number;
  uiScale: UIScale;
  showHints: boolean;
  showObjectives: boolean;
  showHardwareEducation: boolean;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  day: number;
  timeStr: string;
}

export type TutorialChapterId =
  | 'welcome'
  | 'customer'
  | 'assembly'
  | 'power_post'
  | 'os_install'
  | 'complete_order'
  | 'business';

export interface TutorialState {
  active: boolean;
  completed: boolean;
  skipped: boolean;
  chapterIndex: number; // 0..6
  rewardClaimed: boolean;
  cameraMoved: boolean;
  visitedStationCount: number;
  checkedBusinessPC: boolean;
}

export interface GameState {
  version: number;
  saveSlotId: string;
  workshopName: string;
  playerUsername: string;
  difficulty: Difficulty;

  // Economy & Progress
  cash: number;
  totalRevenue: number;
  totalExpenses: number;
  outstandingDebt: number;
  reputation: number;
  businessLevel: BusinessLevel;
  completedOrdersCount: number;
  satisfactionHistory: number[];

  // Time
  day: number;
  minuteOfDay: number;
  timeSpeed: 0 | 1 | 2;

  // Workshop Entities
  inventory: InventoryEntry[];
  pendingDeliveries: PendingDelivery[];
  orders: WorkshopOrder[];
  activeOrderId: string | null;
  upgrades: WorkshopUpgrade[];
  transactions: FinancialTransaction[];
  dailyReports: DailyReport[];
  notifications: GameNotification[];

  // Standalone custom workbench PC when not tied to an order
  sandboxPC: PCBuildState;

  // Interactive tutorial state (optional for backward compatibility)
  tutorialState?: TutorialState;
}
