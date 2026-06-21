// Ядро игровой логики: типы, уровни, статистика, проверки условий

export type GameMode = 'normal' | 'pyramid' | 'allin';
export type Currency = 'W' | 'B';
export type BoosterName = 'Heart' | 'Battery' | 'Rocket';

export const BONUS_WHEEL_UNLOCK_LEVEL = 5;
export const MAX_LEVEL = 50;
export const START_BALANCE_W = 10000;

export const BOOSTER_LABELS: BoosterName[] = ['Heart', 'Battery', 'Rocket'];
export const BOOSTER_RU: Record<BoosterName, string> = {
  Heart: 'Сердце',
  Battery: 'Батарейка',
  Rocket: 'Ракета',
};
export const BOOSTER_DESC: Record<BoosterName, string> = {
  Heart: 'Возвращает ставку при проигрыше',
  Battery: 'Даёт дополнительное вращение',
  Rocket: 'Удваивает выигрыш',
};
export const BOOSTER_EMOJI: Record<BoosterName, string> = {
  Heart: '❤️',
  Battery: '🔋',
  Rocket: '🚀',
};

export interface LevelStats {
  spinsTotal: number;
  spinsX2: number;
  spinsX5: number;
  spins3of10: number;
  spinsW: number;
  spinsB: number;
  spinsX2B: number;
  spinsX5B: number;
  spins3of10B: number;
  streakX2: number;
  streakX5: number;
  winsX2: number;
  winsX5: number;
  wins3of10: number;
  winsX2B: number;
  winsX5B: number;
  wins3of10B: number;
  dailyClaims: number;
  tasksClaimed: number;
  tasksClaimedB: number;
  daily7Cycles: number;
  invites: number;
  boostersBought: Record<string, number>;
  boostersUsed: Record<string, number>;
  spinsBetAtLeast10000B: number;
  spinsX5WithBooster: number;
  exchangedBtoW_times: number;
  exchangedBtoW_totalW: number;
  exchangedWtoB_times: number;
  purchasedBTotal: number;
  onboardingDone: number;
  series3of10Completed: number;
}

export function emptyStats(): LevelStats {
  return {
    spinsTotal: 0, spinsX2: 0, spinsX5: 0, spins3of10: 0, spinsW: 0, spinsB: 0,
    spinsX2B: 0, spinsX5B: 0, spins3of10B: 0, streakX2: 0, streakX5: 0,
    winsX2: 0, winsX5: 0, wins3of10: 0, winsX2B: 0, winsX5B: 0, wins3of10B: 0,
    dailyClaims: 0, tasksClaimed: 0, tasksClaimedB: 0, daily7Cycles: 0, invites: 0,
    boostersBought: {}, boostersUsed: {}, spinsBetAtLeast10000B: 0, spinsX5WithBooster: 0,
    exchangedBtoW_times: 0, exchangedBtoW_totalW: 0, exchangedWtoB_times: 0,
    purchasedBTotal: 0, onboardingDone: 0, series3of10Completed: 0,
  };
}

export function mergeStats(base: LevelStats, patch: Partial<LevelStats>): LevelStats {
  return {
    ...base,
    ...patch,
    boostersBought: patch.boostersBought
      ? { ...base.boostersBought, ...patch.boostersBought }
      : base.boostersBought,
    boostersUsed: patch.boostersUsed
      ? { ...base.boostersUsed, ...patch.boostersUsed }
      : base.boostersUsed,
  };
}

export interface LevelConfig {
  level: number;
  action: string;
  how: string;
  unlocks: string[];
  rewardW: number;
  minInvites?: number;
}

export const LEVELS: LevelConfig[] = [
  { level: 0, action: 'Регистрация', how: 'Стартовый уровень после регистрации.', unlocks: ['доступ к игре'], rewardW: 10000 },
  { level: 1, action: 'Сыграть одну игру', how: 'Сыграй 1 игру в любом режиме.', unlocks: ['ежедневные задания'], rewardW: 1000 },
  { level: 2, action: 'Забрать ежедневный бонус', how: 'Открой «Заходи каждый день» и нажми «Забрать».', unlocks: ['бонусные задания'], rewardW: 1000 },
  { level: 3, action: 'Выполнить бонусное задание', how: 'Открой «Получай WCOIN» и забери награду.', unlocks: ['рефералка'], rewardW: 1000 },
  { level: 4, action: 'Пригласить 1 друга', how: 'Пригласи 1 друга в игру.', unlocks: ['актив. счёт'], rewardW: 1000 },
  { level: 5, action: 'Сыграть режим 3/10', how: 'Сыграй 1 серию «3 из 10».', unlocks: ['бонусный барабан'], rewardW: 5000, minInvites: 1 },
  { level: 6, action: '10 игр подряд в x2', how: 'Сыграй 10 игр подряд в режиме x2.', unlocks: ['магазин'], rewardW: 1000, minInvites: 1 },
  { level: 7, action: 'Купить бустер «Сердце»', how: 'Купи бустер «Сердце» в магазине.', unlocks: ['бустер «Батарейка»'], rewardW: 1000, minInvites: 1 },
  { level: 8, action: 'Сыграть с «Сердцем»', how: 'Сыграй игру, выбрав «Сердце».', unlocks: ['бустер «Ракета»'], rewardW: 1000, minInvites: 1 },
  { level: 9, action: '3 игры подряд в x5', how: 'Сыграй 3 игры подряд в режиме x5.', unlocks: ['подъём актив. счёта'], rewardW: 1000, minInvites: 1 },
  { level: 10, action: 'Пригласить +1 друга', how: 'Пригласи ещё 1 друга (всего 2).', unlocks: ['рейтинг игроков'], rewardW: 5000, minInvites: 1 },
];

const lvl = (s: LevelStats, n: number): boolean => {
  switch (n) {
    case 0: return true;
    case 1: return s.spinsTotal >= 1;
    case 2: return s.dailyClaims >= 1;
    case 3: return s.tasksClaimed >= 1;
    case 4: return s.invites >= 1;
    case 5: return s.series3of10Completed >= 1;
    case 6: return s.streakX2 >= 10;
    case 7: return (s.boostersBought['Heart'] || 0) >= 1;
    case 8: return (s.boostersUsed['Heart'] || 0) >= 1;
    case 9: return s.streakX5 >= 3;
    case 10: return s.invites >= 2;
    default: return s.spinsTotal >= Math.max(10, n * 5);
  }
};

export function isLevelRequirementMet(stats: LevelStats, targetLevel: number): boolean {
  const conf = LEVELS.find((x) => x.level === targetLevel);
  if (conf?.minInvites != null && stats.invites < conf.minInvites) return false;
  return lvl(stats, targetLevel);
}

export function getLevelProgress(stats: LevelStats, targetLevel: number): { current: number; required: number; text: string } {
  const s = stats;
  const mk = (cur: number, req: number) => ({ current: Math.min(req, cur), required: req, text: `${Math.min(req, cur)}/${req}` });
  switch (targetLevel) {
    case 0: return mk(1, 1);
    case 1: return mk(s.spinsTotal, 1);
    case 2: return mk(s.dailyClaims, 1);
    case 3: return mk(s.tasksClaimed, 1);
    case 4: return mk(s.invites, 1);
    case 5: return mk(s.series3of10Completed, 1);
    case 6: return mk(s.streakX2, 10);
    case 7: return mk(s.boostersBought['Heart'] || 0, 1);
    case 8: return mk(s.boostersUsed['Heart'] || 0, 1);
    case 9: return mk(s.streakX5, 3);
    case 10: return mk(s.invites, 2);
    default: return mk(s.spinsTotal, Math.max(10, targetLevel * 5));
  }
}

export function getMultiplier(m: GameMode): number {
  return m === 'normal' ? 2 : m === 'allin' ? 5 : 0;
}

export function getLimits(m: GameMode): { min: number; max: number } {
  const max = 100_000;
  let min = 100;
  if (m === 'pyramid') min = 10_000;
  else if (m === 'allin') min = 1000;
  return { min, max };
}

export const MODE_LABEL: Record<GameMode, string> = {
  normal: 'x2',
  pyramid: '3 из 10',
  allin: 'x5',
};
