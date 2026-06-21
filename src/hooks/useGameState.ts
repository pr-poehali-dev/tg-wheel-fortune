import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyStats, mergeStats, isLevelRequirementMet, LEVELS, MAX_LEVEL,
  START_BALANCE_W, type LevelStats, type BoosterName,
} from '@/lib/gameLogic';
import { getProgress, upsertProgress } from '@/lib/gameApi';

const LS = {
  level: 'player_level_v1',
  claimed: 'player_level_claimed_v1',
  stats: 'level_stats_v1',
  balW: 'balance_w',
  balB: 'balance_b',
  inv: 'bonuses_inv',
  onboarding: 'onboarding_done_v1',
};

function num(key: string, def: number): number {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}

function loadStats(): LevelStats {
  try {
    const raw = localStorage.getItem(LS.stats);
    if (raw) return mergeStats(emptyStats(), JSON.parse(raw));
  } catch { /* noop */ }
  return emptyStats();
}

export interface GameUser {
  id: number | null;
  name: string;
  photo: string;
}

export function useGameState() {
  const [balanceW, setBalanceW] = useState<number>(() => {
    const v = num(LS.balW, -1);
    if (v >= 0) return Math.floor(v);
    localStorage.setItem(LS.balW, String(START_BALANCE_W));
    return START_BALANCE_W;
  });
  const [balanceB, setBalanceB] = useState<number>(() => Math.floor(num(LS.balB, 0)));
  const [playerLevel, setPlayerLevel] = useState<number>(() => Math.max(0, Math.floor(num(LS.level, 0))));
  const [claimedLevel, setClaimedLevel] = useState<number>(() => Math.max(0, Math.floor(num(LS.claimed, 0))));
  const [stats, setStats] = useState<LevelStats>(loadStats);
  const [inventory, setInventory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.inv) || '[]'); } catch { return []; }
  });
  const [user, setUser] = useState<GameUser>({ id: null, name: '', photo: '' });
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => localStorage.getItem(LS.onboarding) === '1');

  const balWRef = useRef(balanceW);
  const balBRef = useRef(balanceB);
  const statsRef = useRef(stats);
  const levelRef = useRef(playerLevel);
  const claimedRef = useRef(claimedLevel);
  const userRef = useRef(user);
  const invRef = useRef(inventory);
  const onbRef = useRef(onboardingDone);
  useEffect(() => { balWRef.current = balanceW; }, [balanceW]);
  useEffect(() => { balBRef.current = balanceB; }, [balanceB]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { levelRef.current = playerLevel; }, [playerLevel]);
  useEffect(() => { claimedRef.current = claimedLevel; }, [claimedLevel]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { invRef.current = inventory; }, [inventory]);
  useEffect(() => { onbRef.current = onboardingDone; }, [onboardingDone]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    const uid = userRef.current.id;
    if (!uid) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      upsertProgress({
        id: uid,
        name: userRef.current.name,
        photo: userRef.current.photo || null,
        balance_w: balWRef.current,
        balance_b: balBRef.current,
        game_level: levelRef.current,
        claimed_level: claimedRef.current,
        onboarding_done: onbRef.current,
        level_stats: statsRef.current,
      });
    }, 1200);
  }, []);

  const saveBalances = useCallback((w: number, b: number) => {
    const rw = Math.floor(w);
    const rb = Math.floor(b);
    balWRef.current = rw;
    balBRef.current = rb;
    setBalanceW(rw);
    setBalanceB(rb);
    try {
      localStorage.setItem(LS.balW, String(rw));
      localStorage.setItem(LS.balB, String(rb));
    } catch { /* noop */ }
    scheduleSync();
  }, [scheduleSync]);

  const bumpStats = useCallback((patch: Partial<LevelStats>) => {
    setStats((prev) => {
      const next = mergeStats(prev, patch);
      statsRef.current = next;
      try { localStorage.setItem(LS.stats, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    scheduleSync();
  }, [scheduleSync]);

  const persistLevel = useCallback((next: number) => {
    const v = Math.max(0, Math.min(MAX_LEVEL, Math.floor(next)));
    setPlayerLevel(v);
    levelRef.current = v;
    try { localStorage.setItem(LS.level, String(v)); } catch { /* noop */ }
    scheduleSync();
  }, [scheduleSync]);

  const setInv = useCallback((updater: (prev: string[]) => string[]) => {
    setInventory((prev) => {
      const next = updater(prev);
      invRef.current = next;
      try { localStorage.setItem(LS.inv, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const addBooster = useCallback((name: BoosterName) => {
    setInv((prev) => [...prev, name]);
    bumpStats({ boostersBought: { [name]: (statsRef.current.boostersBought[name] || 0) + 1 } });
  }, [setInv, bumpStats]);

  const useBoosterFromInv = useCallback((name: BoosterName): boolean => {
    const idx = invRef.current.indexOf(name);
    if (idx === -1) return false;
    setInv((prev) => {
      const copy = [...prev];
      const i = copy.indexOf(name);
      if (i !== -1) copy.splice(i, 1);
      return copy;
    });
    bumpStats({ boostersUsed: { [name]: (statsRef.current.boostersUsed[name] || 0) + 1 } });
    return true;
  }, [setInv, bumpStats]);

  const boosterCount = useCallback((name: BoosterName): number => {
    return invRef.current.filter((x) => x === name).length;
  }, []);

  const claimLevelReward = useCallback((level: number): { ok: boolean; msg: string } => {
    const lvl = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
    if (lvl <= 0) return { ok: false, msg: '' };
    if (lvl > levelRef.current) return { ok: false, msg: 'Сначала достигни этого уровня' };
    if (lvl <= claimedRef.current) return { ok: false, msg: 'Награда уже получена' };
    if (lvl !== claimedRef.current + 1) return { ok: false, msg: 'Сначала забери предыдущую награду' };
    const conf = LEVELS.find((x) => x.level === lvl);
    const reward = conf?.rewardW || 0;
    if (reward > 0) saveBalances(balWRef.current + reward, balBRef.current);
    setClaimedLevel(lvl);
    claimedRef.current = lvl;
    try { localStorage.setItem(LS.claimed, String(lvl)); } catch { /* noop */ }
    scheduleSync();
    return { ok: true, msg: reward > 0 ? `Награда: +${reward} W (ур. ${lvl})` : `Награда ур. ${lvl} получена` };
  }, [saveBalances, scheduleSync]);

  // Авто-повышение уровня при выполнении условий
  useEffect(() => {
    const next = Math.min(MAX_LEVEL, playerLevel + 1);
    if (next > playerLevel && isLevelRequirementMet(stats, next)) {
      const conf = LEVELS.find((x) => x.level === next);
      if (conf?.minInvites != null && stats.invites < conf.minInvites) return;
      persistLevel(next);
    }
  }, [stats, playerLevel, persistLevel]);

  const finishOnboarding = useCallback(() => {
    try { localStorage.setItem(LS.onboarding, '1'); } catch { /* noop */ }
    setOnboardingDone(true);
    onbRef.current = true;
    bumpStats({ onboardingDone: 1 });
    if (levelRef.current < 1) persistLevel(1);
    else scheduleSync();
  }, [bumpStats, persistLevel, scheduleSync]);

  const loadFromServer = useCallback(async (uid: number) => {
    const data = await getProgress(uid);
    if (!data || !data.found) return;
    saveBalances(data.balance_w, data.balance_b);
    persistLevel(data.game_level);
    if (data.claimed_level > claimedRef.current) {
      setClaimedLevel(data.claimed_level);
      claimedRef.current = data.claimed_level;
      try { localStorage.setItem(LS.claimed, String(data.claimed_level)); } catch { /* noop */ }
    }
    if (data.onboarding_done) {
      try { localStorage.setItem(LS.onboarding, '1'); } catch { /* noop */ }
      setOnboardingDone(true);
    }
    setStats((prev) => {
      const merged = mergeStats(prev, {});
      for (const [k, v] of Object.entries(data.level_stats || {})) {
        if (typeof v === 'number') (merged as Record<string, unknown>)[k] = Math.max((merged as Record<string, number>)[k] || 0, v);
        else if (v && typeof v === 'object') (merged as Record<string, unknown>)[k] = { ...(merged as Record<string, object>)[k], ...v };
      }
      statsRef.current = merged;
      try { localStorage.setItem(LS.stats, JSON.stringify(merged)); } catch { /* noop */ }
      return merged;
    });
  }, [saveBalances, persistLevel]);

  return {
    balanceW, balanceB, playerLevel, claimedLevel, stats, inventory, user, onboardingDone,
    balWRef, balBRef, statsRef,
    setUser, saveBalances, bumpStats, persistLevel,
    addBooster, useBoosterFromInv, boosterCount, claimLevelReward,
    finishOnboarding, loadFromServer, scheduleSync,
  };
}
