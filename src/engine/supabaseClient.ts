import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameState, LeaderboardRecord, LeaderboardSeason } from '../types/game';
import { calculateNetWorth } from './businessEngine';

const metaEnv = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>;

const supabaseUrl = metaEnv.VITE_SUPABASE_URL?.trim();
const supabasePublicKey = (
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || metaEnv.VITE_SUPABASE_ANON_KEY
)?.trim();

export interface SupabaseStatus {
  mode: 'offline' | 'online';
  configured: boolean;
  securityBlocked?: boolean;
  reason?: string;
}

function isServiceRoleOrSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  // Detect legacy JWT-based service_role key without transmitting it
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded =
        typeof atob === 'function'
          ? atob(padded)
          : Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(decoded) as { role?: string };
      if (payload.role === 'service_role') return true;
    } catch {
      // Not a JWT (e.g. modern sb_publishable_... key)
    }
  }
  return false;
}

export function validateFrontendSupabaseConfig(
  url: string | undefined,
  key: string | undefined
): SupabaseStatus {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();

  if (!cleanUrl || !cleanKey) {
    return {
      mode: 'offline',
      configured: false,
      reason: 'Supabase credentials are not set. Running cleanly in Offline Mode (localStorage).',
    };
  }

  if (!/^https?:\/\/.+/i.test(cleanUrl)) {
    return {
      mode: 'offline',
      configured: false,
      reason: 'Invalid VITE_SUPABASE_URL format. Offline Mode remains active.',
    };
  }

  if (isServiceRoleOrSecretKey(cleanKey)) {
    return {
      mode: 'offline',
      configured: false,
      securityBlocked: true,
      reason:
        'Security guard: secret or service_role keys are forbidden in frontend code. Use only the Supabase Publishable Key.',
    };
  }

  return { mode: 'online', configured: true };
}

function formatSupabaseError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Unknown Supabase error.';
  const msg = err.message ?? '';
  if (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(msg)
  ) {
    return 'Supabase connected, but required tables have not been created yet. Run backend/supabase-schema.sql in your Supabase SQL Editor.';
  }
  return msg || 'Supabase request failed.';
}

const configStatus = validateFrontendSupabaseConfig(supabaseUrl, supabasePublicKey);

let client: SupabaseClient | null = null;
if (configStatus.configured && supabaseUrl && supabasePublicKey) {
  try {
    client = createClient(supabaseUrl, supabasePublicKey);
  } catch {
    client = null;
  }
}

export const isSupabaseConfigured = Boolean(client);

export function getSupabaseStatus(): SupabaseStatus {
  if (!client && configStatus.configured) {
    return {
      mode: 'offline',
      configured: false,
      reason: 'Failed to initialize Supabase client. Offline Mode remains active.',
    };
  }
  return configStatus;
}

export interface OnlinePlayerAccount {
  id: string;
  email: string;
  username: string;
  workshopName: string;
}

export async function getOnlineSession(): Promise<OnlinePlayerAccount | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;

    const fallbackName =
      (data.user.user_metadata?.username as string | undefined) ??
      data.user.email?.split('@')[0] ??
      'Player';
    const fallbackWorkshop =
      (data.user.user_metadata?.workshop_name as string | undefined) ?? 'Online Workshop';

    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('username, workshop_name')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profErr) {
      return {
        id: data.user.id,
        email: data.user.email ?? '',
        username: fallbackName,
        workshopName: fallbackWorkshop,
      };
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      username: profile?.username ?? fallbackName,
      workshopName: profile?.workshop_name ?? fallbackWorkshop,
    };
  } catch {
    return null;
  }
}

export async function signUpOnline(
  email: string,
  password: string,
  username: string,
  workshopName: string
): Promise<{ account: OnlinePlayerAccount | null; error?: string; info?: string }> {
  if (!client) return { account: null, error: getSupabaseStatus().reason };
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username, workshop_name: workshopName } },
    });
    if (error || !data.user) {
      return { account: null, error: error?.message ?? 'Registration failed.' };
    }

    // Only attempt profile upsert if a live session exists (email confirm may defer session)
    if (data.session) {
      await client.from('profiles').upsert({
        id: data.user.id,
        username,
        workshop_name: workshopName,
      });
    } else {
      return {
        account: null,
        info: 'Account created! Verify your email address in your inbox, then sign in.',
      };
    }

    return {
      account: {
        id: data.user.id,
        email,
        username,
        workshopName,
      },
    };
  } catch {
    return { account: null, error: 'Network error contacting Supabase Auth.' };
  }
}

export async function signInOnline(
  email: string,
  password: string
): Promise<{ account: OnlinePlayerAccount | null; error?: string }> {
  if (!client) return { account: null, error: getSupabaseStatus().reason };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { account: null, error: error?.message ?? 'Login failed.' };
    }
    const account = await getOnlineSession();
    return { account };
  } catch {
    return { account: null, error: 'Network error contacting Supabase Auth.' };
  }
}

export async function signOutOnline(): Promise<void> {
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // ignore offline sign-out errors
  }
}

export async function syncLeaderboardToCloud(state: GameState): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: getSupabaseStatus().reason ?? 'Offline mode active.' };
  try {
    const session = await getOnlineSession();
    if (!session) return { ok: false, error: 'Sign in required to submit online ranking.' };

    const nw = calculateNetWorth(state);
    const avgSat =
      state.satisfactionHistory.length > 0
        ? Math.round(state.satisfactionHistory.reduce((a, b) => a + b, 0) / state.satisfactionHistory.length)
        : 80;

    // Protected RPC verified against auth.uid() & server-side net worth calculation
    const { error } = await client.rpc('submit_workshop_snapshot', {
      p_workshop_name: state.workshopName,
      p_cash_balance: nw.cash,
      p_inventory_value: nw.inventoryValue,
      p_equipment_value: nw.equipmentValue,
      p_upgrades_value: nw.upgradesValue,
      p_wip_value: nw.workInProgressValue,
      p_debt: nw.debt,
      p_total_revenue: Math.round(state.totalRevenue),
      p_total_expenses: Math.round(state.totalExpenses),
      p_completed_orders: state.completedOrdersCount,
      p_avg_satisfaction: avgSat,
      p_reputation: Math.round(state.reputation),
      p_business_level: state.businessLevel,
      p_game_day: state.day,
    });

    if (error) {
      return { ok: false, error: formatSupabaseError(error) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to reach Supabase right now. Your offline progress remains saved locally.' };
  }
}

export async function fetchGlobalLeaderboard(
  season: LeaderboardSeason
): Promise<{ records: LeaderboardRecord[]; configured: boolean; error?: string }> {
  if (!client) {
    return { records: [], configured: false };
  }
  try {
    const session = await getOnlineSession();

    const { data, error } = await client
      .from('leaderboard_statistics')
      .select(
        'id, user_id, username, workshop_name, net_worth, total_revenue, net_profit, completed_orders, avg_satisfaction, reputation, business_level, previous_rank, season, updated_at'
      )
      .eq('season', season)
      .order('net_worth', { ascending: false })
      .limit(100);

    if (error) {
      return { records: [], configured: true, error: formatSupabaseError(error) };
    }

    const records: LeaderboardRecord[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      username: String(row.username),
      workshopName: String(row.workshop_name),
      netWorth: Number(row.net_worth),
      totalRevenue: Number(row.total_revenue),
      netProfit: Number(row.net_profit),
      completedOrders: Number(row.completed_orders),
      avgSatisfaction: Number(row.avg_satisfaction),
      reputation: Number(row.reputation),
      businessLevel: Number(row.business_level) as LeaderboardRecord['businessLevel'],
      previousRank: row.previous_rank ? Number(row.previous_rank) : undefined,
      season: row.season as LeaderboardSeason,
      updatedAt: String(row.updated_at),
      isCurrentPlayer: session ? row.user_id === session.id : false,
    }));

    return { records, configured: true };
  } catch {
    return {
      records: [],
      configured: true,
      error: 'Unable to connect to Supabase right now. Offline Mode and Local Leaderboard remain available.',
    };
  }
}
