import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import FortuneWheel, { type FortuneWheelRef } from './FortuneWheel';
import BottomSheet from './BottomSheet';
import DailyBonus from './DailyBonus';
import TasksPanel from './TasksPanel';
import ShopPanel from './ShopPanel';
import InvitePanel from './InvitePanel';
import LeaderboardPanel from './LeaderboardPanel';
import LevelsPanel from './LevelsPanel';
import { useGameState } from '@/hooks/useGameState';
import { getReferrals, registerReferral, type FriendEntry } from '@/lib/gameApi';
import {
  BONUS_WHEEL_UNLOCK_LEVEL, BOOSTER_LABELS, BOOSTER_EMOJI, BOOSTER_RU,
  getLimits, getMultiplier, MODE_LABEL, type GameMode, type Currency, type BoosterName,
} from '@/lib/gameLogic';

type Sheet = 'daily' | 'tasks' | 'shop' | 'invite' | 'leaderboard' | 'levels' | null;
type RandomBonus = { type: 'bonus'; name: BoosterName } | { type: 'money'; amount: number };

const SECTOR_TO_BONUS: (BoosterName | null)[] = [
  'Rocket', null, 'Battery', null, 'Heart', null, 'Rocket', null, 'Heart', null,
];

function genSectorBonuses(): RandomBonus[] {
  const weighted: { b: RandomBonus; w: number }[] = [
    { b: { type: 'money', amount: 100 }, w: 55 },
    { b: { type: 'money', amount: 1000 }, w: 30 },
    { b: { type: 'money', amount: 10000 }, w: 10 },
    { b: { type: 'money', amount: 100000 }, w: 2 },
    { b: { type: 'bonus', name: 'Rocket' }, w: 1 },
    { b: { type: 'bonus', name: 'Heart' }, w: 1 },
    { b: { type: 'bonus', name: 'Battery' }, w: 1 },
  ];
  const total = weighted.reduce((s, o) => s + o.w, 0);
  const out: RandomBonus[] = [];
  for (let i = 0; i < 10; i++) {
    let r = Math.random() * total;
    for (const o of weighted) { r -= o.w; if (r <= 0) { out.push(o.b); break; } }
  }
  return out;
}

const GameScreen = () => {
  const g = useGameState();
  const [tab, setTab] = useState<'tasks' | 'wheel' | 'shop'>('wheel');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [mode, setMode] = useState<GameMode>('normal');
  const [currency, setCurrency] = useState<Currency>('W');
  const [bet, setBet] = useState(100);
  const [pickedDigit, setPickedDigit] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedBooster, setSelectedBooster] = useState<BoosterName | null>(null);
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [sectorBonuses, setSectorBonuses] = useState<RandomBonus[]>(genSectorBonuses);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [boosterPickerOpen, setBoosterPickerOpen] = useState(false);

  const wheelRef = useRef<FortuneWheelRef>(null);
  const betTakenRef = useRef(false);
  const heartActiveRef = useRef(false);

  const showToast = useCallback((t: string) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const bonusWheelUnlocked = g.playerLevel >= BONUS_WHEEL_UNLOCK_LEVEL;

  // Онбординг и Telegram-инициализация
  useEffect(() => {
    if (!g.onboardingDone) setShowOnboarding(true);
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; initDataUnsafe?: { user?: { id?: number; username?: string; first_name?: string; last_name?: string; photo_url?: string }; start_param?: string } } } }).Telegram?.WebApp;
    tg?.ready?.();
    const u = tg?.initDataUnsafe?.user;
    if (u?.id) {
      const name = u.username || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Игрок';
      g.setUser({ id: Number(u.id), name, photo: u.photo_url || '' });
      g.loadFromServer(Number(u.id));
      getReferrals(Number(u.id)).then(setFriends);
      const sp = tg?.initDataUnsafe?.start_param;
      if (sp && sp.startsWith('ref_')) {
        const inviter = Number(sp.slice(4));
        if (inviter && inviter !== Number(u.id)) {
          registerReferral({ inviter_id: inviter, friend_id: Number(u.id), name, photo: u.photo_url || null })
            .then((r) => { if (r.shouldReward && r.rewardW > 0) { g.saveBalances(g.balWRef.current + r.rewardW, g.balBRef.current); showToast(`+${r.rewardW} W за приглашение`); } });
        }
      }
    } else {
      g.setUser({ id: 1, name: 'Игрок', photo: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сброс ставки при смене режима
  useEffect(() => {
    setBet(getLimits(mode).min);
    setSelectedSector(null);
    betTakenRef.current = false;
  }, [mode]);

  const recordSpinStart = useCallback((m: GameMode, cur: Currency, b: number) => {
    const s = g.statsRef.current;
    const isB = cur === 'B';
    g.bumpStats({
      spinsTotal: s.spinsTotal + 1,
      spinsW: s.spinsW + (cur === 'W' ? 1 : 0),
      spinsB: s.spinsB + (cur === 'B' ? 1 : 0),
      spinsX2: s.spinsX2 + (m === 'normal' ? 1 : 0),
      spinsX5: s.spinsX5 + (m === 'allin' ? 1 : 0),
      spins3of10: s.spins3of10 + (m === 'pyramid' ? 1 : 0),
      spinsX2B: s.spinsX2B + (m === 'normal' && isB ? 1 : 0),
      spinsX5B: s.spinsX5B + (m === 'allin' && isB ? 1 : 0),
      spins3of10B: s.spins3of10B + (m === 'pyramid' && isB ? 1 : 0),
      spinsBetAtLeast10000B: s.spinsBetAtLeast10000B + (isB && b >= 10000 ? 1 : 0),
      spinsX5WithBooster: s.spinsX5WithBooster + (m === 'allin' && selectedBooster ? 1 : 0),
      streakX2: m === 'normal' ? s.streakX2 + 1 : 0,
      streakX5: m === 'allin' ? s.streakX5 + 1 : 0,
    });
  }, [g, selectedBooster]);

  const onBeforeSpin = useCallback((): boolean | number => {
    if (spinning) return false;
    const { min, max } = getLimits(mode);
    const b = Math.max(min, Math.min(max, Math.floor(bet)));
    if (b !== bet) setBet(b);
    const curW = g.balWRef.current;
    const curB = g.balBRef.current;
    if (bonusWheelUnlocked && selectedSector == null) {
      showToast('Выбери бонусный сектор');
      return false;
    }
    if (currency === 'W' ? curW < b : curB < b) {
      showToast(`Недостаточно ${currency}`);
      return false;
    }
    // Применяем Heart/Battery на старте (для pyramid и общий учёт)
    heartActiveRef.current = false;
    if (selectedBooster === 'Heart' && g.boosterCount('Heart') > 0) {
      heartActiveRef.current = true;
    }
    if (currency === 'W') g.saveBalances(curW - b, curB);
    else g.saveBalances(curW, curB - b);
    recordSpinStart(mode, currency, b);
    return true;
  }, [spinning, mode, bet, currency, g, bonusWheelUnlocked, selectedSector, selectedBooster, recordSpinStart, showToast]);

  const onResult = useCallback((index: number, label: string) => {
    const b = Math.max(getLimits(mode).min, Math.floor(bet));
    const numCorrect = String(pickedDigit) === label;
    let curW = g.balWRef.current;
    let curB = g.balBRef.current;

    // Бонус сектора (только при попадании в выбранный сектор)
    const sectorBonus = bonusWheelUnlocked && selectedSector === index ? sectorBonuses[index] : null;
    let sectorMoney = sectorBonus && sectorBonus.type === 'money' ? sectorBonus.amount : 0;
    if (sectorBonus && sectorBonus.type === 'bonus') {
      g.addBooster(sectorBonus.name);
      showToast(`Получен бустер: ${BOOSTER_RU[sectorBonus.name]}`);
    }

    // Выигрыш по цифре
    let delta = 0;
    if (mode === 'normal' || mode === 'allin') {
      if (numCorrect) delta = b * getMultiplier(mode);
    }

    // Применение выбранного бустера
    let rocket = 1;
    let savedByHeart = false;
    let extraSpin = false;
    if (selectedBooster && g.boosterCount(selectedBooster) > 0) {
      if (selectedBooster === 'Rocket' && (numCorrect || sectorMoney > 0)) rocket = 2;
      else if (selectedBooster === 'Heart' && !numCorrect && delta === 0) savedByHeart = true;
      else if (selectedBooster === 'Battery' && !numCorrect) extraSpin = true;
    }
    if (rocket > 1) sectorMoney *= rocket;

    let finalDelta = delta * rocket;
    if (sectorMoney > 0) finalDelta += sectorMoney;
    if (savedByHeart) finalDelta += b;

    if (currency === 'W') curW += finalDelta;
    else curB += finalDelta;
    g.saveBalances(curW, curB);

    // Учёт побед
    if (delta > 0) {
      const s = g.statsRef.current;
      g.bumpStats({
        winsX2: s.winsX2 + (mode === 'normal' && currency === 'W' ? 1 : 0),
        winsX5: s.winsX5 + (mode === 'allin' && currency === 'W' ? 1 : 0),
        winsX2B: s.winsX2B + (mode === 'normal' && currency === 'B' ? 1 : 0),
        winsX5B: s.winsX5B + (mode === 'allin' && currency === 'B' ? 1 : 0),
      });
    }

    // Списываем использованный бустер
    if (selectedBooster && (rocket > 1 || savedByHeart || extraSpin)) {
      g.useBoosterFromInv(selectedBooster);
    }

    // Сообщение
    if (delta > 0) showToast(`Победа! +${delta * rocket} ${currency}${rocket > 1 ? ' (Ракета x2)' : ''}`);
    else if (savedByHeart) showToast(`Сердце спасло! Ставка возвращена`);
    else if (sectorMoney > 0) showToast(`Бонус сектора +${sectorMoney} ${currency}`);
    else if (extraSpin) showToast('Батарейка: доп. вращение!');
    else showToast(`Промах (${label})`);

    setSectorBonuses(genSectorBonuses());
    setSelectedBooster(null);
    setSelectedSector(null);

    // Задания: счётчик прокрутов
    try {
      const uid = g.user.id;
      const key = uid ? `task_spins_${uid}` : 'task_spins';
      const spins = Number(localStorage.getItem(key) || '0') + 1;
      localStorage.setItem(key, String(spins));
    } catch { /* noop */ }

    // Доп. вращение от батарейки
    if (extraSpin) {
      setTimeout(() => wheelRef.current?.spin(), 700);
    }
  }, [mode, bet, pickedDigit, g, bonusWheelUnlocked, selectedSector, sectorBonuses, selectedBooster, currency, showToast]);

  // pyramid режим (3 из 10): упрощённая серия из 3 уникальных вращений
  const pyramidResultsRef = useRef<number[]>([]);
  const [pyramidResults, setPyramidResults] = useState<number[]>([]);
  const [pyramidActive, setPyramidActive] = useState(false);

  const onPyramidResult = useCallback((index: number) => {
    let r = index;
    while (pyramidResultsRef.current.includes(r)) r = (r + 1) % 10;
    const next = [...pyramidResultsRef.current, r];
    pyramidResultsRef.current = next;
    setPyramidResults(next);
    if (next.length < 3) {
      showToast(`Вращение ${next.length}: ${r}`);
      setTimeout(() => wheelRef.current?.spin(), 1200);
    } else {
      // Финал серии
      const hitIndex = next.indexOf(pickedDigit);
      const pbet = Math.max(getLimits('pyramid').min, Math.floor(bet));
      let win = 0;
      if (hitIndex === 0) win = Math.floor(pbet * 2);
      else if (hitIndex === 1) win = Math.floor(pbet * 1.5);
      else if (hitIndex === 2) win = Math.floor(pbet * 1.25);
      if (win > 0 && selectedBooster === 'Rocket' && g.boosterCount('Rocket') > 0) {
        win *= 2; g.useBoosterFromInv('Rocket');
      }
      if (win > 0) {
        if (currency === 'W') g.saveBalances(g.balWRef.current + win, g.balBRef.current);
        else g.saveBalances(g.balWRef.current, g.balBRef.current + win);
        showToast(`Выигрыш! +${win} ${currency}`);
        const s = g.statsRef.current;
        g.bumpStats({
          wins3of10: s.wins3of10 + (currency === 'W' ? 1 : 0),
          wins3of10B: s.wins3of10B + (currency === 'B' ? 1 : 0),
        });
      } else if (heartActiveRef.current && g.boosterCount('Heart') > 0) {
        g.useBoosterFromInv('Heart');
        if (currency === 'W') g.saveBalances(g.balWRef.current + pbet, g.balBRef.current);
        else g.saveBalances(g.balWRef.current, g.balBRef.current + pbet);
        showToast(`Сердце спасло! Ставка возвращена`);
      } else {
        showToast(`Проигрыш. Выпало: ${next.join(', ')}`);
      }
      const s = g.statsRef.current;
      g.bumpStats({ series3of10Completed: s.series3of10Completed + 1 });
      betTakenRef.current = false;
      heartActiveRef.current = false;
      setSelectedBooster(null);
      setSelectedSector(null);
    }
  }, [pickedDigit, bet, currency, g, selectedBooster, showToast]);

  const onPyramidBefore = useCallback((): boolean | number => {
    if (spinning) {
      // авто-вращения серии
      if (betTakenRef.current && pyramidResultsRef.current.length < 3) return true;
      return false;
    }
    const { min, max } = getLimits('pyramid');
    const b = Math.max(min, Math.min(max, Math.floor(bet)));
    if (b !== bet) setBet(b);
    if (bonusWheelUnlocked && selectedSector == null) { showToast('Выбери бонусный сектор'); return false; }
    if (currency === 'W' ? g.balWRef.current < b : g.balBRef.current < b) { showToast(`Недостаточно ${currency}`); return false; }
    if (currency === 'W') g.saveBalances(g.balWRef.current - b, g.balBRef.current);
    else g.saveBalances(g.balWRef.current, g.balBRef.current - b);
    heartActiveRef.current = selectedBooster === 'Heart' && g.boosterCount('Heart') > 0;
    betTakenRef.current = true;
    pyramidResultsRef.current = [];
    setPyramidResults([]);
    recordSpinStart('pyramid', currency, b);
    return true;
  }, [spinning, bet, currency, g, bonusWheelUnlocked, selectedSector, selectedBooster, recordSpinStart, showToast]);

  const handleBet = (delta: number) => {
    if (mode === 'pyramid' && betTakenRef.current) return;
    setBet((prev) => {
      const { min, max } = getLimits(mode);
      return Math.max(min, Math.min(max, prev + delta));
    });
  };

  const cycleMode = (dir: 1 | -1) => {
    if (spinning) return;
    const order: GameMode[] = ['normal', 'pyramid', 'allin'];
    const i = order.indexOf(mode);
    setMode(order[(i + dir + order.length) % order.length]);
    setPyramidResults([]);
    pyramidResultsRef.current = [];
    setPyramidActive(false);
  };

  const inviteUrl = (() => {
    const bot = (import.meta as unknown as { env?: { VITE_TG_BOT?: string } }).env?.VITE_TG_BOT || 'TestCodeTg_bot';
    const uid = g.user.id;
    return `https://t.me/${bot}?startapp=${uid ? `ref_${uid}` : 'invite'}`;
  })();

  const doShare = () => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    const share = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Присоединяйся в игру!')}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(share);
    else { navigator.clipboard?.writeText(inviteUrl); showToast('Ссылка скопирована'); }
  };

  const sectorEmojis = bonusWheelUnlocked
    ? sectorBonuses.map((b) => (b.type === 'bonus' ? BOOSTER_EMOJI[b.name] : null))
    : [];

  return (
    <div className="min-h-screen w-full flex justify-center wheel-bg">
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        {/* Шапка */}
        <header className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(180deg,#8b9dff,#6a5af9)', border: '3px solid #fff' }}>
            {g.user.photo ? <img src={g.user.photo} alt="" className="w-full h-full object-cover" /> : (g.user.name[0] || 'И').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="game-title text-xl font-black text-white truncate">{g.user.name || 'Игрок'}</h1>
            <span className="inline-block mt-0.5 px-3 py-0.5 rounded-full text-xs font-black text-[#244a96]"
              style={{ background: '#FFE38A', border: '2px solid #fff' }}>{g.playerLevel} lvl</span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="game-coin px-3 h-8 min-w-[120px] justify-start text-sm">🪙 <span className="tabular-nums ml-1">{g.balanceW.toLocaleString('ru-RU')}</span></div>
            <div className="game-coin px-3 h-8 min-w-[120px] justify-start text-sm">₿ <span className="tabular-nums ml-1">{g.balanceB.toLocaleString('ru-RU')}</span></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-2">
          {tab === 'wheel' && (
            <div className="mx-3 mt-2 rounded-3xl p-4 animate-fade-in"
              style={{ background: 'rgba(0,0,0,0.12)', border: '2px solid rgba(255,255,255,0.25)' }}>
              {/* Режим */}
              <div className="flex items-center gap-2 mb-2.5 relative">
                <button onClick={() => cycleMode(-1)} className="game-pill w-12 h-11"><Icon name="ChevronLeft" size={22} className="text-[#FF6B35]" /></button>
                <div className="game-pill flex-1 h-11 text-lg" style={{ background: 'linear-gradient(180deg,#cfe1ff,#a9caff)', color: '#244a96' }}>{MODE_LABEL[mode]}</div>
                <button onClick={() => cycleMode(1)} className="game-pill w-12 h-11"><Icon name="ChevronRight" size={22} className="text-[#FF6B35]" /></button>
              </div>
              {/* Валюта */}
              <div className="flex gap-2 mb-2.5">
                <button onClick={() => !spinning && setCurrency('W')} className="game-pill flex-1 h-11 text-lg" style={currency === 'W' ? { background: '#fff', color: '#244a96' } : {}}>W</button>
                <button onClick={() => !spinning && setCurrency('B')} className="game-pill flex-1 h-11 text-lg" style={currency === 'B' ? { background: '#fff', color: '#244a96' } : {}}>B</button>
              </div>
              {/* Ставка */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => handleBet(-100)} className="game-pill w-12 h-11 text-2xl text-[#FF6B35]">−</button>
                <div className="game-pill flex-1 h-11 text-lg" style={{ background: 'linear-gradient(180deg,#cfe1ff,#a9caff)', color: '#244a96' }}>{bet.toLocaleString('ru-RU')}</div>
                <button onClick={() => handleBet(100)} className="game-pill w-12 h-11 text-2xl text-[#4CB944]">+</button>
              </div>

              {/* Выбор бустера */}
              {g.playerLevel >= 6 && (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button onClick={() => setBoosterPickerOpen(true)} className="game-pill px-4 h-9 text-sm flex items-center gap-1">
                    {selectedBooster ? `${BOOSTER_EMOJI[selectedBooster]} ${BOOSTER_RU[selectedBooster]}` : 'Выбрать бустер'}
                  </button>
                  {selectedBooster && <button onClick={() => setSelectedBooster(null)} className="text-white/80"><Icon name="X" size={20} /></button>}
                </div>
              )}

              {/* Колесо */}
              <div className="flex justify-center mt-2 relative">
                <FortuneWheel
                  ref={wheelRef}
                  size={290}
                  spinning={spinning}
                  selectedIndex={pickedDigit}
                  onSelectIndex={setPickedDigit}
                  onBeforeSpin={mode === 'pyramid' ? onPyramidBefore : onBeforeSpin}
                  onResult={mode === 'pyramid' ? onPyramidResult : onResult}
                  onSpinningChange={(v) => { setSpinning(v); if (v) { setPyramidActive(mode === 'pyramid'); } }}
                  sectorBonusEmojis={sectorEmojis}
                  disableSelection={mode === 'pyramid' && betTakenRef.current}
                />
              </div>

              {/* Подсказка бонус-сектора */}
              {bonusWheelUnlocked && (
                <p className="mt-3 text-center text-white/85 text-xs font-bold">
                  {selectedSector == null ? 'Нажми на сектор колеса — выбери бонус-сектор' : `Бонус-сектор: ${selectedSector}`}
                </p>
              )}
              {bonusWheelUnlocked && (
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button key={i} onClick={() => !spinning && setSelectedSector(i)}
                      className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center"
                      style={selectedSector === i ? { background: '#34c759', color: '#fff' } : { background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{i}</button>
                  ))}
                </div>
              )}

              {/* Результаты pyramid */}
              {mode === 'pyramid' && pyramidResults.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  {pyramidResults.map((n, i) => (
                    <div key={i} className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white"
                      style={{ background: n === pickedDigit ? 'linear-gradient(180deg,#22c55e,#16a34a)' : 'linear-gradient(180deg,#3d74c6,#2b66b9)', border: n === pickedDigit ? '2px solid #ffe27a' : 'none' }}>{n}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="px-3 pt-2 grid gap-2 animate-fade-in">
              <MenuItem icon="Gift" title="Заходи каждый день" subtitle="Ежедневные награды" onClick={() => setSheet('daily')} />
              <MenuItem icon="ListChecks" title="Получай WCOIN" subtitle="Выполняй задания" onClick={() => setSheet('tasks')} />
              <MenuItem icon="Users" title="Пригласи друзей" subtitle="+5000 W за друга" onClick={() => setSheet('invite')} />
              <MenuItem icon="Trophy" title="Рейтинг игроков" subtitle="Топ по монетам" onClick={() => setSheet('leaderboard')} />
              <MenuItem icon="TrendingUp" title="Повысил уровень?" subtitle="Забирай бонусы!" onClick={() => setSheet('levels')} />
            </div>
          )}

          {tab === 'shop' && (
            <div className="px-3 pt-2 animate-fade-in">
              <ShopPanel balanceW={g.balanceW} boosterCount={g.boosterCount}
                onBuyBooster={(name) => {
                  if (g.balWRef.current < 1000) { showToast('Недостаточно W'); return; }
                  g.saveBalances(g.balWRef.current - 1000, g.balBRef.current);
                  g.addBooster(name);
                  showToast(`Куплено: ${BOOSTER_RU[name]}`);
                }}
                onBuyStars={(stars, toB) => showToast(`Оплата ${stars}⭐ → ${toB} B (демо)`)} />
            </div>
          )}
        </main>

        {/* Навигация */}
        <nav className="sticky bottom-0 flex gap-2 px-3 py-3" style={{ background: 'rgba(20,50,110,0.4)', backdropFilter: 'blur(6px)' }}>
          <NavBtn active={tab === 'tasks'} onClick={() => setTab('tasks')} icon="ClipboardList" />
          <NavBtn active={tab === 'wheel'} onClick={() => setTab('wheel')} icon="Landmark" />
          <NavBtn active={tab === 'shop'} onClick={() => setTab('shop')} icon="Store" />
        </nav>

        {/* Sheets */}
        <BottomSheet open={sheet === 'daily'} title="Ежедневная награда" onClose={() => setSheet(null)}>
          <DailyBonus userId={g.user.id} onClaim={(amount) => {
            g.saveBalances(g.balWRef.current + amount, g.balBRef.current);
            const s = g.statsRef.current;
            g.bumpStats({ dailyClaims: s.dailyClaims + 1 });
            showToast(`+${amount} W за вход`);
          }} />
        </BottomSheet>
        <BottomSheet open={sheet === 'tasks'} title="Задания" onClose={() => setSheet(null)}>
          <TasksPanel userId={g.user.id} onShare={doShare} onReward={(rw) => {
            g.saveBalances(g.balWRef.current + (rw.W || 0), g.balBRef.current + (rw.B || 0));
            const s = g.statsRef.current;
            g.bumpStats({ tasksClaimed: s.tasksClaimed + 1, tasksClaimedB: s.tasksClaimedB + ((rw.B || 0) > 0 ? 1 : 0) });
            if (rw.W) showToast(`+${rw.W} W`); else if (rw.B) showToast(`+${rw.B} B`);
          }} />
        </BottomSheet>
        <BottomSheet open={sheet === 'invite'} title="Друзья" onClose={() => setSheet(null)}>
          <InvitePanel friends={friends} inviteUrl={inviteUrl} onShare={doShare} />
        </BottomSheet>
        <BottomSheet open={sheet === 'leaderboard'} title="Рейтинг" onClose={() => setSheet(null)}>
          <LeaderboardPanel userId={g.user.id} />
        </BottomSheet>
        <BottomSheet open={sheet === 'levels'} title="Уровни" onClose={() => setSheet(null)}>
          <LevelsPanel playerLevel={g.playerLevel} claimedLevel={g.claimedLevel} stats={g.stats}
            onClaim={(lvl) => { const r = g.claimLevelReward(lvl); if (r.msg) showToast(r.msg); }} />
        </BottomSheet>

        {/* Выбор бустера */}
        <BottomSheet open={boosterPickerOpen} title="Выбор бустера" onClose={() => setBoosterPickerOpen(false)}>
          <div className="grid grid-cols-3 gap-2">
            {BOOSTER_LABELS.map((name) => {
              const cnt = g.boosterCount(name);
              return (
                <button key={name} onClick={() => { if (cnt === 0) { showToast(`${BOOSTER_RU[name]} нет в наличии`); return; } setSelectedBooster(name); setBoosterPickerOpen(false); showToast(`Выбран: ${BOOSTER_RU[name]}`); }}
                  className="game-card grid place-items-center gap-1 py-3"
                  style={selectedBooster === name ? { boxShadow: 'inset 0 0 0 3px #34c759' } : {}}>
                  <span className="text-3xl">{BOOSTER_EMOJI[name]}</span>
                  <span className="text-xs font-black">{BOOSTER_RU[name]}</span>
                  <span className="text-xs font-bold text-white/80">x{cnt}</span>
                </button>
              );
            })}
          </div>
        </BottomSheet>

        {/* Онбординг */}
        {showOnboarding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-fade-in" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm rounded-3xl p-6 text-center grid gap-4"
              style={{ background: 'linear-gradient(180deg,#2a67b7,#143778)', boxShadow: 'inset 0 0 0 3px #0b2f68' }}>
              <div className="text-5xl">🎡</div>
              <h2 className="game-title text-2xl font-black text-white">Добро пожаловать!</h2>
              <p className="text-white/90 text-sm font-semibold">
                Выбирай число, делай ставку и крути колесо. Угадал — забирай выигрыш!
                Повышай уровень, приглашай друзей и собирай бустеры.
              </p>
              <button onClick={() => { g.finishOnboarding(); setShowOnboarding(false); showToast('Поехали! 🚀'); }}
                className="game-tile w-full text-lg">Начать игру</button>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed left-1/2 bottom-24 z-[70] -translate-x-1/2 px-4 py-2 rounded-xl font-bold text-white text-sm text-center max-w-[90%]"
            style={{ background: 'rgba(11,47,104,0.95)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'toastUp 220ms ease-out' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: string }) => (
  <button onClick={onClick} className="game-tile flex-1 h-14 flex items-center justify-center"
    style={active ? { background: 'linear-gradient(180deg,#5b9bf0,#3f7fe0)', borderColor: '#bcd8ff' } : {}}>
    <Icon name={icon} size={28} className="text-white" />
  </button>
);

const MenuItem = ({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) => (
  <button onClick={onClick} className="game-card flex items-center gap-3 text-left">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
      <Icon name={icon} size={24} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-black text-white truncate">{title}</div>
      <div className="text-xs text-white/75 font-semibold truncate">{subtitle}</div>
    </div>
    <Icon name="ChevronRight" size={22} className="text-white/60 shrink-0" />
  </button>
);

export default GameScreen;
