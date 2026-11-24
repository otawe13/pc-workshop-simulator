import React from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { GameState, Language, WorkshopOrder } from '../types/game';
import { formatIDR } from '../engine/hardwareDatabase';
import { validateOrderCompletion } from '../engine/businessEngine';
import {
  getArchetypeLabel,
  getOrderTypeLabel,
  getPersonalityLabel,
  t,
} from '../i18n/translations';

interface ReceptionModalProps {
  lang: Language;
  state: GameState;
  onAcceptOrder: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  onFocusOrderAtWorkbench: (orderId: string, station: 'workbench' | 'repair_table' | 'testing_station') => void;
  onDeliverOrder: (orderId: string) => void;
  onInviteNewCustomer: () => void;
  onClose: () => void;
}

export const ReceptionModal: React.FC<ReceptionModalProps> = ({
  lang,
  state,
  onAcceptOrder,
  onRejectOrder,
  onFocusOrderAtWorkbench,
  onDeliverOrder,
  onInviteNewCustomer,
  onClose,
}) => {
  const activeCount = state.orders.filter(
    (o) => o.status === 'Accepted' || o.status === 'In Progress' || o.status === 'Testing' || o.status === 'Completed'
  ).length;
  const maxActive = state.upgrades.some((u) => u.id === 'upg_storage_rack' && u.purchased) ? 6 : 3;

  const visibleOrders = state.orders.filter(
    (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
  );

  const renderOrderCard = (order: WorkshopOrder) => {
    const validation = order.status !== 'New' ? validateOrderCompletion(order, lang) : null;
    const isNew = order.status === 'New';
    const isActive = state.activeOrderId === order.id;

    return (
      <div
        key={order.id}
        className={`p-4 rounded-xl border transition-colors ${
          isActive ? 'bg-sky-950/30 border-sky-500/70' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-white shrink-0"
              style={{ backgroundColor: order.customer.avatarColor }}
            >
              {order.customer.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">
                {order.orderNumber} · {order.title}
              </div>
              <div className="text-xs text-slate-400">
                {order.customer.name} · {getArchetypeLabel(order.customer.archetype, lang)} ·{' '}
                {getPersonalityLabel(order.customer.personality, lang)} · {getOrderTypeLabel(order.type, lang)}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono-num text-sm font-bold text-emerald-400">
              {t(lang, 'laborLabel')} {formatIDR(order.laborReward)}
            </div>
            <div className="font-mono-num text-[11px] text-slate-400">
              {t(lang, 'budgetLabel')} {formatIDR(order.budget)} · {t(lang, 'dueDayLabel')} {order.deadlineDay}
            </div>
          </div>
        </div>

        <p className="text-xs text-sky-200/90 italic mt-2.5 bg-slate-950/60 px-3 py-2 rounded-lg">
          {order.dialogue}
        </p>

        <p className="text-xs text-slate-300 mt-2">{order.description}</p>

        {/* Technical Requirements Summary */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-slate-400">
          {order.requirements.minCpuScore && (
            <span>
              {t(lang, 'minCpuScore')}:{' '}
              <strong className="text-slate-200 font-mono-num">{order.requirements.minCpuScore}</strong>
            </span>
          )}
          {order.requirements.minGpuScore ? (
            <span>
              {t(lang, 'minGpuScore')}:{' '}
              <strong className="text-slate-200 font-mono-num">{order.requirements.minGpuScore}</strong>
            </span>
          ) : null}
          {order.requirements.minRamGB && (
            <span>
              {t(lang, 'minRam')}:{' '}
              <strong className="text-slate-200 font-mono-num">{order.requirements.minRamGB}GB</strong>
            </span>
          )}
          {order.requirements.minStorageGB && (
            <span>
              {t(lang, 'minStorage')}:{' '}
              <strong className="text-slate-200 font-mono-num">{order.requirements.minStorageGB}GB</strong>
            </span>
          )}
          {order.requirements.requiredOS && (
            <span>
              {t(lang, 'requiredOs')}: <strong className="text-slate-200">{order.requirements.requiredOS}</strong>
            </span>
          )}
          {order.requirements.fixAllFaults && <span>{t(lang, 'mustResolveFaults')}</span>}
        </div>

        {/* Validation Checklist for Accepted Orders */}
        {validation && !validation.ready && (
          <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-amber-300 space-y-0.5">
            <div className="font-semibold text-slate-200">{t(lang, 'remainingChecklist')}</div>
            {validation.reasons.slice(0, 4).map((r, i) => (
              <div key={i}>• {r}</div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800">
          {isNew ? (
            <>
              <button
                type="button"
                disabled={activeCount >= maxActive}
                onClick={() => onAcceptOrder(order.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {t(lang, 'acceptOrder')}
              </button>
              <button
                type="button"
                onClick={() => onRejectOrder(order.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                {t(lang, 'declineOrder')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onFocusOrderAtWorkbench(order.id, 'workbench')}
                className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 text-xs font-medium cursor-pointer"
              >
                {t(lang, 'openAtWorkbench')}
              </button>
              {(order.type === 'PC Repair' || order.type === 'Troubleshooting' || order.type === 'Maintenance') && (
                <button
                  type="button"
                  onClick={() => onFocusOrderAtWorkbench(order.id, 'repair_table')}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/40 text-amber-200 text-xs font-medium cursor-pointer"
                >
                  {t(lang, 'diagnoseAndRepair')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onFocusOrderAtWorkbench(order.id, 'testing_station')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                {t(lang, 'bootBiosOs')}
              </button>

              <button
                type="button"
                disabled={!validation?.ready}
                onClick={() => onDeliverOrder(order.id)}
                className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
              >
                {validation?.ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                {validation?.ready ? t(lang, 'deliverAndCollect') : t(lang, 'incompleteOrder')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/65">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#0c1220] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-sky-400" />
              {t(lang, 'receptionTitle')}
            </h2>
            <p className="text-xs text-slate-400">
              {t(lang, 'receptionSubtitle', { active: activeCount, max: maxActive })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onInviteNewCustomer}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {t(lang, 'callNextCustomer')}
            </button>
            <button
              type="button"
              aria-label="Close Reception"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleOrders.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-800 rounded-xl">
              {t(lang, 'noCustomersWaiting')}
            </div>
          ) : (
            visibleOrders.map(renderOrderCard)
          )}
        </div>
      </div>
    </div>
  );
};
