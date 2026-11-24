import React, { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  BarChart3,
  Globe,
  HardDriveDownload,
  Package,
  Save,
  ShoppingCart,
  Store,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ComponentCategory,
  GameState,
  HardwareItem,
  InventoryEntry,
  Language,
  LeaderboardRecord,
} from '../types/game';
import { formatIDR, getHardwareItem, HARDWARE_CATALOG } from '../engine/hardwareDatabase';
import { calculateNetWorth } from '../engine/businessEngine';
import { SaveSlotSummary } from '../engine/saveManager';
import {
  getSupabaseStatus,
  isSupabaseConfigured,
  OnlinePlayerAccount,
  signInOnline,
  signOutOnline,
  signUpOnline,
  syncLeaderboardToCloud,
} from '../engine/supabaseClient';
import {
  getBusinessLevelLabel,
  getCategoryLabelLocalized,
  getLocalizedUpgrade,
  t,
} from '../i18n/translations';

interface BusinessPCModalProps {
  lang: Language;
  initialTab?: 'store' | 'inventory' | 'finances' | 'upgrades' | 'leaderboard' | 'saves';
  state: GameState;
  saveSlots: SaveSlotSummary[];
  localLeaderboard: LeaderboardRecord[];
  onlineAccount: OnlinePlayerAccount | null;
  onOnlineAccountChanged: (acc: OnlinePlayerAccount | null) => void;
  onCheckoutCart: (items: InventoryEntry[], totalCost: number) => void;
  onSellInventoryItem: (itemId: string) => void;
  onPurchaseUpgrade: (upgradeId: string) => void;
  onSaveToSlot: (slotId: string) => void;
  onLoadFromSlot: (slotId: string) => void;
  onDeleteSaveSlot: (slotId: string) => void;
  onOpenFullLeaderboard: (mode: 'local' | 'global') => void;
  onClose: () => void;
}

const STORE_CATEGORIES: (ComponentCategory | 'all')[] = [
  'all',
  'cpu',
  'motherboard',
  'ram',
  'storage',
  'gpu',
  'psu',
  'case',
  'cooler',
  'consumable',
];

export const BusinessPCModal: React.FC<BusinessPCModalProps> = ({
  lang,
  initialTab = 'store',
  state,
  saveSlots,
  onlineAccount,
  onOnlineAccountChanged,
  onCheckoutCart,
  onSellInventoryItem,
  onPurchaseUpgrade,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSaveSlot,
  onOpenFullLeaderboard,
  onClose,
}) => {
  const [tab, setTab] = useState<'store' | 'inventory' | 'finances' | 'upgrades' | 'leaderboard' | 'saves'>(initialTab);
  const [catFilter, setCatFilter] = useState<ComponentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  const netWorth = useMemo(() => calculateNetWorth(state), [state]);

  const filteredCatalog = useMemo(() => {
    return HARDWARE_CATALOG.filter((item) => {
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.model.toLowerCase().includes(q) ||
          item.manufacturer.toLowerCase().includes(q) ||
          (item.socket?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [catFilter, search]);

  const cartEntries: { item: HardwareItem; qty: number }[] = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item: getHardwareItem(id)!, qty }))
    .filter((x) => Boolean(x.item));

  const cartSubtotal = cartEntries.reduce((s, e) => s + e.item.purchasePrice * e.qty, 0);
  const deliveryFee = cartEntries.length > 0 ? 35_000 : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  const addToCart = (itemId: string) => {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if ((next[itemId] ?? 0) <= 1) delete next[itemId];
      else next[itemId] -= 1;
      return next;
    });
  };

  const handleCheckout = () => {
    if (cartEntries.length === 0) return;
    if (state.cash < cartTotal) {
      setStatusMsg(
        lang === 'en' ? 'Insufficient cash balance for this purchase.' : 'Saldo uang tidak mencukupi untuk pesanan ini.'
      );
      return;
    }
    onCheckoutCart(
      cartEntries.map((e) => ({ itemId: e.item.id, quantity: e.qty })),
      cartTotal
    );
    setCart({});
    setStatusMsg(
      lang === 'en'
        ? 'Order confirmed! Parts are en route to your workshop.'
        : 'Pesanan dikonfirmasi! Kurir sedang mengantar komponen ke bengkelmu.'
    );
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    if (authMode === 'signup') {
      const res = await signUpOnline(email, password, state.playerUsername, state.workshopName);
      if (res.error) setAuthFeedback(res.error);
      else if (res.info) setAuthFeedback(res.info);
      else {
        onOnlineAccountChanged(res.account);
        setAuthFeedback(lang === 'en' ? 'Account created and linked!' : 'Akun online berhasil dibuat dan terhubung!');
      }
    } else {
      const res = await signInOnline(email, password);
      if (res.error) setAuthFeedback(res.error);
      else {
        onOnlineAccountChanged(res.account);
        setAuthFeedback(lang === 'en' ? 'Signed in successfully.' : 'Berhasil masuk akun online.');
      }
    }
  };

  const handleCloudSync = async () => {
    const res = await syncLeaderboardToCloud(state);
    setAuthFeedback(
      res.ok
        ? lang === 'en'
          ? 'Net worth & workshop stats synchronized to Global Leaderboard!'
          : 'Total Kekayaan & statistik bengkel berhasil disinkronkan ke Papan Peringkat Global!'
        : res.error ?? (lang === 'en' ? 'Sync failed.' : 'Sinkronisasi gagal.')
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-6 bg-black/75">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100">
              {state.workshopName} · {t(lang, 'bizTitle')}
            </h2>
            <div className="text-xs text-slate-400">
              {t(lang, 'cash')}: <strong className="font-mono-num text-emerald-400">{formatIDR(state.cash)}</strong> ·{' '}
              {t(lang, 'colNetWorth')}:{' '}
              <strong className="font-mono-num text-sky-400">{formatIDR(netWorth.totalNetWorth)}</strong> ·{' '}
              {getBusinessLevelLabel(state.businessLevel, lang)}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Business Computer"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 overflow-x-auto bg-slate-950/60">
          {(
            [
              ['store', t(lang, 'tabStore'), <Store className="w-3.5 h-3.5" />],
              ['inventory', t(lang, 'tabInventory'), <Package className="w-3.5 h-3.5" />],
              ['finances', t(lang, 'tabFinances'), <BarChart3 className="w-3.5 h-3.5" />],
              ['upgrades', t(lang, 'tabUpgrades'), <ArrowUpCircle className="w-3.5 h-3.5" />],
              ['leaderboard', t(lang, 'tabLeaderboard'), <Trophy className="w-3.5 h-3.5" />],
              ['saves', t(lang, 'tabSaves'), <Save className="w-3.5 h-3.5" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                tab === id ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {statusMsg && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-sky-950/50 border border-sky-500/40 text-xs text-sky-200 flex justify-between">
              <span>{statusMsg}</span>
              <button type="button" onClick={() => setStatusMsg(null)} className="cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* TAB: HARDWARE STORE */}
          {tab === 'store' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t(lang, 'searchStorePlaceholder')}
                    aria-label={t(lang, 'searchStorePlaceholder')}
                    className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {STORE_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatFilter(c)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                        catFilter === c
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {c === 'all' ? t(lang, 'allParts') : getCategoryLabelLocalized(c, lang)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[54vh] overflow-y-auto pr-1">
                  {filteredCatalog.map((item) => {
                    const locked = item.minBusinessLevel > state.businessLevel;
                    const inStock = state.inventory.find((i) => i.itemId === item.id)?.quantity ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-bold text-slate-100">
                              {item.manufacturer} {item.model}
                            </div>
                            <span className="font-mono-num text-[11px] text-slate-400">
                              {t(lang, 'stockShort')}: {inStock}
                            </span>
                          </div>
                          <div className="text-[11px] text-sky-400 mt-0.5">
                            {item.generation} {item.socket ? `· ${item.socket}` : ''} {item.ramType ? `· ${item.ramType}` : ''}{' '}
                            {item.wattage ? `· ${item.wattage}W` : ''} {item.lengthMm ? `· ${item.lengthMm}mm` : ''}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                          <div>
                            <div className="font-mono-num text-xs font-bold text-emerald-400">
                              {formatIDR(item.purchasePrice)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.supplier} · {item.deliveryMinutes}m
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => addToCart(item.id)}
                            className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            {locked ? `${t(lang, 'levelShort')} ${item.minBusinessLevel}` : '+ Keranjang'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cart & Pending Deliveries */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-sky-400" />
                    {t(lang, 'supplierCart')}
                  </div>

                  {cartEntries.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">{t(lang, 'cartEmpty')}</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {cartEntries.map(({ item, qty }) => (
                        <div key={item.id} className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded">
                          <div className="min-w-0 pr-2">
                            <div className="truncate font-medium">{item.model}</div>
                            <div className="font-mono-num text-[11px] text-slate-400">
                              {qty} × {formatIDR(item.purchasePrice)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => addToCart(item.id)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>{t(lang, 'subtotal')}</span>
                      <span className="font-mono-num">{formatIDR(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{t(lang, 'courierDelivery')}</span>
                      <span className="font-mono-num">{formatIDR(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-100 text-sm pt-1">
                      <span>{t(lang, 'total')}</span>
                      <span className="font-mono-num text-emerald-400">{formatIDR(cartTotal)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={cartEntries.length === 0 || state.cash < cartTotal}
                    onClick={handleCheckout}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t(lang, 'confirmPayOrder')}
                  </button>
                </div>

                {/* Pending Deliveries */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <HardDriveDownload className="w-4 h-4 text-amber-400" />
                    {t(lang, 'incomingDeliveries', { count: state.pendingDeliveries.length })}
                  </div>
                  {state.pendingDeliveries.length === 0 ? (
                    <div className="text-slate-500">{t(lang, 'noShipments')}</div>
                  ) : (
                    state.pendingDeliveries.map((d) => (
                      <div key={d.id} className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                        <span>{d.items.reduce((a, b) => a + b.quantity, 0)} item</span>
                        <span className="font-mono-num text-sky-400">
                          {t(lang, 'dayLabel')} {d.arrivalDay} · {String(Math.floor(d.arrivalMinute / 60)).padStart(2, '0')}:
                          {String(d.arrivalMinute % 60).padStart(2, '0')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: INVENTORY */}
          {tab === 'inventory' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {t(lang, 'totalInventoryVal')}{' '}
                  <strong className="font-mono-num text-sky-400">{formatIDR(netWorth.inventoryValue)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {state.inventory
                  .filter((e) => e.quantity > 0)
                  .map((entry) => {
                    const item = getHardwareItem(entry.itemId);
                    if (!item) return null;
                    return (
                      <div
                        key={entry.itemId}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex justify-between font-bold text-slate-100">
                            <span>
                              {item.manufacturer} {item.model}
                            </span>
                            <span className="font-mono-num text-sky-400">x{entry.quantity}</span>
                          </div>
                          <div className="text-slate-400 mt-0.5">{getCategoryLabelLocalized(item.category, lang)}</div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                          <span className="font-mono-num text-slate-300">
                            {t(lang, 'resaleLabel')} {formatIDR(Math.round(item.purchasePrice * 0.85))}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSellInventoryItem(item.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                          >
                            {t(lang, 'sell1x')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB: FINANCES & DAILY REPORTS */}
          {tab === 'finances' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">{t(lang, 'totalNetWorth')}</div>
                  <div className="font-mono-num text-base font-bold text-sky-400 mt-1">
                    {formatIDR(netWorth.totalNetWorth)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">{t(lang, 'totalRevenue')}</div>
                  <div className="font-mono-num text-base font-bold text-emerald-400 mt-1">
                    {formatIDR(state.totalRevenue)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">{t(lang, 'totalExpenses')}</div>
                  <div className="font-mono-num text-base font-bold text-rose-400 mt-1">
                    {formatIDR(state.totalExpenses)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">{t(lang, 'netProfit')}</div>
                  <div className="font-mono-num text-base font-bold text-amber-300 mt-1">
                    {formatIDR(state.totalRevenue - state.totalExpenses)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                <div className="font-semibold text-slate-200 mb-2">{t(lang, 'netWorthFormulaTitle')}</div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'Cash Balance' : 'Saldo Tunai'}</span>
                  <span className="font-mono-num">{formatIDR(netWorth.cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'Inventory Asset Value' : 'Nilai Aset Inventaris'}</span>
                  <span className="font-mono-num">{formatIDR(netWorth.inventoryValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'Starter Workbench & Tools' : 'Peralatan & Meja Awal'}</span>
                  <span className="font-mono-num">{formatIDR(netWorth.equipmentValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'Workshop Upgrades Value' : 'Nilai Aset Upgrade Bengkel'}</span>
                  <span className="font-mono-num">{formatIDR(netWorth.upgradesValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'en' ? 'Work-in-Progress Installed Hardware' : 'Nilai Komponen Terpasang (WIP)'}</span>
                  <span className="font-mono-num">{formatIDR(netWorth.workInProgressValue)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>{lang === 'en' ? 'Outstanding Debt' : 'Utang Berjalan'}</span>
                  <span className="font-mono-num">-{formatIDR(netWorth.debt)}</span>
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">{t(lang, 'ledgerDay')}</th>
                      <th className="px-3 py-2">{t(lang, 'ledgerDesc')}</th>
                      <th className="px-3 py-2 text-right">{t(lang, 'ledgerAmount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {state.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                          {t(lang, 'noTransactions')}
                        </td>
                      </tr>
                    ) : (
                      state.transactions.slice(0, 20).map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-3 py-2 font-mono-num text-slate-400">H{tx.day}</td>
                          <td className="px-3 py-2 text-slate-200">{tx.description}</td>
                          <td
                            className={`px-3 py-2 font-mono-num text-right font-semibold ${
                              tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatIDR(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: UPGRADES */}
          {tab === 'upgrades' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {state.upgrades.map((upg) => {
                const locked = upg.minLevel > state.businessLevel;
                const loc = getLocalizedUpgrade(upg, lang);
                return (
                  <div
                    key={upg.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-100">{loc.name}</span>
                        <span className="uppercase text-[10px] text-sky-400">{loc.categoryLabel}</span>
                      </div>
                      <p className="text-slate-400 mt-1">{loc.description}</p>
                      <div className="text-emerald-400 mt-1.5 font-medium">{loc.effectSummary}</div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="font-mono-num font-bold text-slate-200">{formatIDR(upg.cost)}</span>
                      {upg.purchased ? (
                        <span className="text-emerald-400 font-semibold">{t(lang, 'purchased')}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={locked || state.cash < upg.cost}
                          onClick={() => onPurchaseUpgrade(upg.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer"
                        >
                          {locked ? t(lang, 'requiresLevel', { lvl: upg.minLevel }) : t(lang, 'purchase')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: LEADERBOARD & CLOUD ACCOUNT */}
          {tab === 'leaderboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-sky-400" />
                  {t(lang, 'competitiveRankingsTitle')}
                </div>
                <p className="text-slate-400">{t(lang, 'competitiveRankingsDesc')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenFullLeaderboard('local')}
                    className="flex-1 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                  >
                    {t(lang, 'openLocalLb')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenFullLeaderboard('global')}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {t(lang, 'openGlobalLb')}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    {t(lang, 'operatingModeTitle')}
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      isSupabaseConfigured
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isSupabaseConfigured ? t(lang, 'modeOnline') : t(lang, 'modeOffline')}
                  </span>
                </div>

                {!isSupabaseConfigured ? (
                  <p className="text-slate-400 leading-relaxed">
                    {lang === 'en'
                      ? `${getSupabaseStatus().reason} Your career progress, inventory, finances, and local rankings continue saving automatically to browser storage.`
                      : 'Permainan berjalan lancar dalam Mode Offline menggunakan penyimpanan browser lokal (localStorage). Untuk mengaktifkan Papan Peringkat Global Online, isi VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY lalu terapkan backend/supabase-schema.sql.'}
                  </p>
                ) : onlineAccount ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded bg-slate-950 border border-slate-800 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-semibold text-slate-100">{onlineAccount.username}</div>
                        <div className="text-slate-400">{onlineAccount.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCloudSync}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                      >
                        {t(lang, 'syncSnapshot')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await signOutOnline();
                          onOnlineAccountChanged(null);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        {t(lang, 'signOut')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAuthSubmit} className="space-y-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className={`px-3 py-1 rounded ${authMode === 'login' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                      >
                        {t(lang, 'signIn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signup')}
                        className={`px-3 py-1 rounded ${authMode === 'signup' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                      >
                        {lang === 'en' ? 'Register' : 'Daftar'}
                      </button>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100"
                    />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Kata Sandi"
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                    >
                      {authMode === 'login' ? t(lang, 'signIn') : t(lang, 'createOnlineAccount')}
                    </button>
                  </form>
                )}

                {authFeedback && <div className="text-amber-300">{authFeedback}</div>}
              </div>
            </div>
          )}

          {/* TAB: SAVE / LOAD */}
          {tab === 'saves' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {saveSlots.map((slot) => (
                  <div
                    key={slot.slotId}
                    className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-100">
                        {slot.slotId.toUpperCase()} · {slot.workshopName}
                      </div>
                      <div className="text-slate-400">
                        {slot.savedAt
                          ? `${t(lang, 'dayLabel')} ${slot.day} · ${formatIDR(slot.netWorth)}`
                          : t(lang, 'noSaveRecorded')}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {slot.slotId !== 'autosave' && (
                        <button
                          type="button"
                          onClick={() => onSaveToSlot(slot.slotId)}
                          className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium cursor-pointer"
                        >
                          {lang === 'en' ? 'Save' : 'Simpan'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!slot.savedAt || slot.corrupted}
                        onClick={() => onLoadFromSlot(slot.slotId)}
                        className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
                      >
                        {lang === 'en' ? 'Load' : 'Muat'}
                      </button>
                      {slot.savedAt && (
                        <button
                          type="button"
                          onClick={() => onDeleteSaveSlot(slot.slotId)}
                          className="px-2 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
                        >
                          {lang === 'en' ? 'Del' : 'Hapus'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
