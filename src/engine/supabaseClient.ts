import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GameState,
  Language,
  LeaderboardCategory,
  LeaderboardRecord,
  LeaderboardSeason,
} from '../types/game';
import { calculateNetWorth } from './businessEngine';
import { migrateLoadedGameState } from './saveManager';

const metaEnv = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>;

function stripWrappingQuotes(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return trimmed || undefined;
}

const rawSupabaseUrl = stripWrappingQuotes(metaEnv.VITE_SUPABASE_URL);
const rawSupabasePublicKey = stripWrappingQuotes(
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || metaEnv.VITE_SUPABASE_ANON_KEY
);

export interface SupabaseStatus {
  mode: 'offline' | 'online';
  configured: boolean;
  securityBlocked?: boolean;
  reason?: string;
  normalizedUrl?: string;
}

export function normalizeSupabaseUrl(
  rawUrl: string | undefined
): { url: string | null; error?: string } {
  const cleaned = stripWrappingQuotes(rawUrl);
  if (!cleaned) {
    return { url: null };
  }

  if (!/^https?:\/\/.+/i.test(cleaned)) {
    return {
      url: null,
      error:
        'Format VITE_SUPABASE_URL tidak valid. Gunakan URL proyek lengkap seperti https://xxxx.supabase.co.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {
      url: null,
      error: 'Format VITE_SUPABASE_URL rusak dan tidak dapat diproses.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      url: null,
      error: 'VITE_SUPABASE_URL harus menggunakan protokol http:// atau https://.',
    };
  }

  if (
    parsed.hostname === 'supabase.com' ||
    parsed.hostname.endsWith('.supabase.com') ||
    parsed.pathname.includes('/dashboard/project')
  ) {
    return {
      url: null,
      error:
        'VITE_SUPABASE_URL berisi URL Dashboard Supabase, bukan Project API URL. Gunakan URL dari Project Settings -> API (contoh: https://xxxx.supabase.co).',
    };
  }

  if (parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.supabase.in')) {
    return { url: parsed.origin };
  }

  const cleanedPath = parsed.pathname
    .replace(/\/(rest|auth|storage|realtime|functions)\/v1(\/.*)?$/i, '')
    .replace(/\/+$/, '');

  return { url: `${parsed.origin}${cleanedPath}` };
}

function isServiceRoleOrSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
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
      // Not a JWT
    }
  }
  return false;
}

export function validateFrontendSupabaseConfig(
  url: string | undefined,
  key: string | undefined
): SupabaseStatus {
  const cleanKey = stripWrappingQuotes(key);
  const urlResult = normalizeSupabaseUrl(url);

  if (!urlResult.url && !urlResult.error) {
    return {
      mode: 'offline',
      configured: false,
      reason:
        'Kredensial Supabase belum diisi. Game berjalan normal dalam Mode Offline (localStorage).',
    };
  }

  if (urlResult.error || !urlResult.url) {
    return {
      mode: 'offline',
      configured: false,
      reason: urlResult.error ?? 'Format VITE_SUPABASE_URL tidak valid. Mode Offline tetap aktif.',
    };
  }

  if (!cleanKey) {
    return {
      mode: 'offline',
      configured: false,
      reason:
        'VITE_SUPABASE_PUBLISHABLE_KEY belum diisi. Game berjalan normal dalam Mode Offline (localStorage).',
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

  return { mode: 'online', configured: true, normalizedUrl: urlResult.url };
}

export function formatSupabaseError(
  err: { code?: string; message?: string; details?: string; hint?: string } | unknown,
  lang: Language = 'id'
): string {
  const isEn = lang === 'en';
  if (!err) {
    return isEn ? 'Unknown Supabase error.' : 'Terjadi kesalahan tidak dikenal pada koneksi Supabase.';
  }

  const errObj =
    typeof err === 'object' && err !== null
      ? (err as { code?: string; message?: string; details?: string; hint?: string })
      : { message: String(err) };

  const code = errObj.code ?? '';
  const rawMsg = [errObj.message, errObj.details, errObj.hint].filter(Boolean).join(' ').trim();

  if (/invalid path specified in request url/i.test(rawMsg)) {
    return isEn
      ? 'Invalid Supabase request URL path ("Invalid path specified in request URL"). Ensure VITE_SUPABASE_URL is set strictly to your Project URL (e.g. https://xxxx.supabase.co) without /rest/v1 or extra paths, then redeploy.'
      : 'Path URL request Supabase tidak valid ("Invalid path specified in request URL"). Pastikan VITE_SUPABASE_URL hanya berisi Project URL utama (contoh: https://xxxx.supabase.co) tanpa akhiran /rest/v1 atau path tambahan, lalu deploy ulang.';
  }

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(rawMsg)
  ) {
    return isEn
      ? 'Supabase connected, but required tables have not been created yet. Run backend/supabase-schema.sql in your Supabase SQL Editor.'
      : 'Supabase terhubung, tetapi tabel belum dibuat. Jalankan script backend/supabase-schema.sql di Supabase SQL Editor.';
  }

  if (
    code === '42501' ||
    code === 'PGRST301' ||
    /invalid api key|jwt|permission denied|not authorized|unauthorized/i.test(rawMsg)
  ) {
    return isEn
      ? 'Supabase access denied or invalid Publishable Key. Check VITE_SUPABASE_PUBLISHABLE_KEY and Row Level Security policies.'
      : 'Akses Supabase ditolak atau Publishable Key tidak valid. Periksa VITE_SUPABASE_PUBLISHABLE_KEY dan policy RLS.';
  }

  if (/provider is not enabled/i.test(rawMsg)) {
    return isEn
      ? 'Google OAuth provider is not enabled yet in your Supabase project Authentication -> Providers.'
      : 'Provider Google OAuth belum diaktifkan di Supabase Dashboard (Authentication -> Providers -> Google).';
  }

  if (
    /failed to fetch|networkerror|load failed|fetcherror|network request failed|err_name_not_resolved|timeout/i.test(
      rawMsg
    )
  ) {
    return isEn
      ? 'Unable to connect to Supabase server right now. Check your internet connection or project status. Local Leaderboard remains available.'
      : 'Gagal terhubung ke server Supabase saat ini. Periksa koneksi internet atau status proyek Supabase Anda. Mode & Papan Peringkat Lokal tetap aktif.';
  }

  return (
    errObj.message ||
    (isEn ? 'Supabase request failed.' : 'Permintaan ke Supabase gagal diproses.')
  );
}

const configStatus = validateFrontendSupabaseConfig(rawSupabaseUrl, rawSupabasePublicKey);

let client: SupabaseClient | null = null;
if (configStatus.configured && configStatus.normalizedUrl && rawSupabasePublicKey) {
  try {
    client = createClient(configStatus.normalizedUrl, rawSupabasePublicKey);
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
      reason: 'Gagal menginisialisasi klien Supabase. Mode Offline tetap aktif.',
    };
  }
  return configStatus;
}

export interface OnlinePlayerAccount {
  id: string;
  email: string;
  username: string;
  workshopName: string;
  avatarUrl?: string;
}

export interface CloudSaveSummary {
  slotId: string;
  workshopName: string;
  day: number;
  updatedAt: string;
}

export async function getOnlineSession(): Promise<OnlinePlayerAccount | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;

    const fallbackName =
      (data.user.user_metadata?.username as string | undefined) ??
      (data.user.user_metadata?.full_name as string | undefined) ??
      data.user.email?.split('@')[0] ??
      'Teknisi';
    const fallbackWorkshop =
      (data.user.user_metadata?.workshop_name as string | undefined) ?? 'Online Workshop';
    const fallbackAvatar =
      (data.user.user_metadata?.avatar_url as string | undefined) ?? undefined;

    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('username, workshop_name, avatar_url')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profErr) {
      return {
        id: data.user.id,
        email: data.user.email ?? '',
        username: fallbackName,
        workshopName: fallbackWorkshop,
        avatarUrl: fallbackAvatar,
      };
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      username: profile?.username ?? fallbackName,
      workshopName: profile?.workshop_name ?? fallbackWorkshop,
      avatarUrl: profile?.avatar_url ?? fallbackAvatar,
    };
  } catch {
    return null;
  }
}

export function subscribeSupabaseAuthChange(
  onChanged: (account: OnlinePlayerAccount | null) => void
): () => void {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange(async () => {
    const acc = await getOnlineSession();
    onChanged(acc);
  });
  return () => data.subscription.unsubscribe();
}

export async function signUpOnline(
  email: string,
  password: string,
  username: string,
  workshopName: string,
  lang: Language = 'id'
): Promise<{ account: OnlinePlayerAccount | null; error?: string; info?: string }> {
  if (!client) return { account: null, error: getSupabaseStatus().reason };
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username, workshop_name: workshopName } },
    });
    if (error || !data.user) {
      return {
        account: null,
        error: error ? formatSupabaseError(error, lang) : lang === 'en' ? 'Registration failed.' : 'Pendaftaran akun gagal.',
      };
    }

    if (data.session) {
      await client.from('profiles').upsert({
        id: data.user.id,
        username,
        workshop_name: workshopName,
      });
    } else {
      return {
        account: null,
        info:
          lang === 'en'
            ? 'Account created! Verify your email address in your inbox, then sign in.'
            : 'Akun berhasil dibuat! Verifikasi email Anda melalui kotak masuk, lalu masuk kembali.',
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
  } catch (err) {
    return { account: null, error: formatSupabaseError(err, lang) };
  }
}

export async function signInOnline(
  email: string,
  password: string,
  lang: Language = 'id'
): Promise<{ account: OnlinePlayerAccount | null; error?: string }> {
  if (!client) return { account: null, error: getSupabaseStatus().reason };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return {
        account: null,
        error: error ? formatSupabaseError(error, lang) : lang === 'en' ? 'Login failed.' : 'Gagal masuk akun.',
      };
    }
    const account = await getOnlineSession();
    return { account };
  } catch (err) {
    return { account: null, error: formatSupabaseError(err, lang) };
  }
}

export async function signInWithGoogleOAuth(
  lang: Language = 'id'
): Promise<{ started: boolean; error?: string }> {
  if (!client) return { started: false, error: getSupabaseStatus().reason };
  try {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) {
      return { started: false, error: formatSupabaseError(error, lang) };
    }
    return { started: true };
  } catch (err) {
    return { started: false, error: formatSupabaseError(err, lang) };
  }
}

export async function updatePlayerProfile(
  username: string,
  workshopName: string,
  avatarUrl?: string,
  lang: Language = 'id'
): Promise<{ account: OnlinePlayerAccount | null; error?: string }> {
  if (!client) return { account: null, error: getSupabaseStatus().reason };
  try {
    const { data: userRes } = await client.auth.getUser();
    if (!userRes.user) {
      return {
        account: null,
        error: lang === 'en' ? 'Please sign in first.' : 'Silakan masuk akun terlebih dahulu.',
      };
    }
    const cleanUser = username.trim().slice(0, 24);
    const cleanShop = workshopName.trim().slice(0, 40);
    const { error } = await client.from('profiles').upsert({
      id: userRes.user.id,
      username: cleanUser,
      workshop_name: cleanShop,
      avatar_url: avatarUrl?.trim() || null,
    });
    if (error) {
      return { account: null, error: formatSupabaseError(error, lang) };
    }
    const account = await getOnlineSession();
    return { account };
  } catch (err) {
    return { account: null, error: formatSupabaseError(err, lang) };
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

export async function saveGameToCloud(
  state: GameState,
  slotId = 'cloud_slot_1',
  lang: Language = 'id'
): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return { ok: false, error: getSupabaseStatus().reason };
  }
  try {
    const { data: userRes } = await client.auth.getUser();
    if (!userRes.user) {
      return {
        ok: false,
        error:
          lang === 'en'
            ? 'Sign in first to save game progress to the cloud.'
            : 'Masuk akun online terlebih dahulu untuk menyimpan progres ke Cloud.',
      };
    }
    const { error } = await client.from('player_saves').upsert(
      {
        user_id: userRes.user.id,
        slot_id: slotId,
        workshop_name: state.workshopName,
        game_day: state.day,
        save_payload: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slot_id' }
    );
    if (error) {
      return { ok: false, error: formatSupabaseError(error, lang) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatSupabaseError(err, lang) };
  }
}

export async function listCloudSaves(
  lang: Language = 'id'
): Promise<{ saves: CloudSaveSummary[]; error?: string }> {
  if (!client) return { saves: [] };
  try {
    const { data: userRes } = await client.auth.getUser();
    if (!userRes.user) return { saves: [] };

    const { data, error } = await client
      .from('player_saves')
      .select('slot_id, workshop_name, game_day, updated_at')
      .eq('user_id', userRes.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      return { saves: [], error: formatSupabaseError(error, lang) };
    }
    return {
      saves: (data ?? []).map((row: Record<string, unknown>) => ({
        slotId: String(row.slot_id ?? 'cloud_slot_1'),
        workshopName: String(row.workshop_name ?? 'Bengkel PC'),
        day: Number(row.game_day ?? 1),
        updatedAt: String(row.updated_at ?? ''),
      })),
    };
  } catch (err) {
    return { saves: [], error: formatSupabaseError(err, lang) };
  }
}

export async function loadGameFromCloud(
  slotId = 'cloud_slot_1',
  lang: Language = 'id'
): Promise<{ state: GameState | null; error?: string }> {
  if (!client) {
    return { state: null, error: getSupabaseStatus().reason };
  }
  try {
    const { data: userRes } = await client.auth.getUser();
    if (!userRes.user) {
      return {
        state: null,
        error:
          lang === 'en'
            ? 'Sign in required to load cloud saves.'
            : 'Masuk akun terlebih dahulu untuk memuat save dari Cloud.',
      };
    }
    const { data, error } = await client
      .from('player_saves')
      .select('save_payload')
      .eq('user_id', userRes.user.id)
      .eq('slot_id', slotId)
      .maybeSingle();

    if (error) {
      return { state: null, error: formatSupabaseError(error, lang) };
    }
    if (!data?.save_payload) {
      return {
        state: null,
        error: lang === 'en' ? 'No cloud save found in this slot.' : 'Belum ada data simpanan Cloud pada slot ini.',
      };
    }
    return { state: migrateLoadedGameState(data.save_payload as GameState) };
  } catch (err) {
    return { state: null, error: formatSupabaseError(err, lang) };
  }
}

export async function syncLeaderboardToCloud(
  state: GameState,
  lang: Language = 'id'
): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return {
      ok: false,
      error:
        getSupabaseStatus().reason ??
        (lang === 'en' ? 'Offline mode active.' : 'Mode offline sedang aktif.'),
    };
  }
  try {
    const session = await getOnlineSession();
    if (!session) {
      return {
        ok: false,
        error:
          lang === 'en'
            ? 'Sign in required to submit online ranking.'
            : 'Silakan masuk akun online terlebih dahulu untuk mengirim skor ke Papan Peringkat Global.',
      };
    }

    const nw = calculateNetWorth(state);
    const avgSat =
      state.satisfactionHistory.length > 0
        ? Math.round(state.satisfactionHistory.reduce((a, b) => a + b, 0) / state.satisfactionHistory.length)
        : 80;

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
      return { ok: false, error: formatSupabaseError(error, lang) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatSupabaseError(err, lang) };
  }
}

function getOrderColumn(category: LeaderboardCategory): string {
  switch (category) {
    case 'total_revenue':
      return 'total_revenue';
    case 'net_profit':
      return 'net_profit';
    case 'completed_orders':
      return 'completed_orders';
    case 'satisfaction':
      return 'avg_satisfaction';
    case 'reputation':
      return 'reputation';
    case 'net_worth':
    default:
      return 'net_worth';
  }
}

export async function fetchGlobalLeaderboard(
  season: LeaderboardSeason,
  category: LeaderboardCategory = 'net_worth',
  lang: Language = 'id'
): Promise<{ records: LeaderboardRecord[]; configured: boolean; error?: string }> {
  if (!client) {
    return { records: [], configured: false };
  }

  const validSeason: LeaderboardSeason =
    season === 'weekly' || season === 'monthly' || season === 'all_time' ? season : 'weekly';
  const orderCol = getOrderColumn(category);

  try {
    let currentUserId: string | null = null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      currentUserId = sessionData.session?.user?.id ?? null;
    } catch {
      currentUserId = null;
    }

    const { data, error } = await client
      .from('leaderboard_statistics')
      .select(
        'id, user_id, username, workshop_name, net_worth, total_revenue, net_profit, completed_orders, avg_satisfaction, reputation, business_level, previous_rank, season, updated_at'
      )
      .eq('season', validSeason)
      .order(orderCol, { ascending: false })
      .limit(100);

    if (error) {
      return { records: [], configured: true, error: formatSupabaseError(error, lang) };
    }

    const records: LeaderboardRecord[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      username: String(row.username ?? 'Teknisi'),
      workshopName: String(row.workshop_name ?? 'Bengkel PC'),
      netWorth: Number(row.net_worth ?? 0),
      totalRevenue: Number(row.total_revenue ?? 0),
      netProfit: Number(row.net_profit ?? 0),
      completedOrders: Number(row.completed_orders ?? 0),
      avgSatisfaction: Number(row.avg_satisfaction ?? 80),
      reputation: Number(row.reputation ?? 20),
      businessLevel: Number(row.business_level ?? 1) as LeaderboardRecord['businessLevel'],
      previousRank: row.previous_rank ? Number(row.previous_rank) : undefined,
      season: (row.season as LeaderboardSeason) ?? validSeason,
      updatedAt: String(row.updated_at ?? ''),
      isCurrentPlayer: currentUserId ? row.user_id === currentUserId : false,
    }));

    return { records, configured: true };
  } catch (err) {
    return {
      records: [],
      configured: true,
      error: formatSupabaseError(err, lang),
    };
  }
}
