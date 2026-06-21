import funcUrls from '../../backend/func2url.json';
import type { LevelStats } from './gameLogic';

const GAME_URL = (funcUrls as Record<string, string>).game;

async function call(action: string, payload: Record<string, unknown> = {}) {
  try {
    const res = await fetch(GAME_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface RemoteProgress {
  found: boolean;
  balance_w: number;
  balance_b: number;
  game_level: number;
  claimed_level: number;
  onboarding_done: boolean;
  level_stats: Partial<LevelStats>;
}

export async function getProgress(id: number): Promise<RemoteProgress | null> {
  const data = await call('get_progress', { id });
  if (!data?.ok) return null;
  return data as RemoteProgress;
}

export async function upsertProgress(p: {
  id: number;
  name: string;
  photo?: string | null;
  balance_w: number;
  balance_b: number;
  game_level: number;
  claimed_level: number;
  onboarding_done: boolean;
  level_stats: LevelStats;
}): Promise<boolean> {
  const data = await call('upsert_progress', p);
  return !!data?.ok;
}

export interface LeaderEntry {
  id: number;
  name: string;
  photo?: string | null;
  level: number;
  coins: number;
}

export async function getLeaderboard(limit = 100): Promise<LeaderEntry[]> {
  const data = await call('leaderboard', { limit });
  return data?.ok ? data.items : [];
}

export interface FriendEntry {
  id: number;
  name: string;
  photo?: string | null;
  rewardW: number;
  level: number;
  coins: number;
}

export async function getReferrals(id: number): Promise<FriendEntry[]> {
  const data = await call('referrals_my', { id });
  return data?.ok ? data.items : [];
}

export async function registerReferral(p: {
  inviter_id: number;
  friend_id: number;
  name: string;
  photo?: string | null;
}): Promise<{ shouldReward: boolean; rewardW: number }> {
  const data = await call('referral_register', p);
  if (!data?.ok) return { shouldReward: false, rewardW: 0 };
  return { shouldReward: !!data.shouldReward, rewardW: data.rewardW || 0 };
}
