import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

interface DailyBonusProps {
  userId: number | null;
  onClaim: (amount: number) => void;
}

const rewards = [250, 500, 1000, 2500, 5000, 7500, 10000];

const DailyBonus = ({ userId, onClaim }: DailyBonusProps) => {
  const suffix = userId !== null ? `_${userId}` : '';
  const lastKey = `daily_last${suffix}`;
  const streakKey = `daily_streak${suffix}`;

  const [last, setLast] = useState('');
  const [streak, setStreak] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [current, setCurrent] = useState(1);

  const todayStr = () => new Date().toDateString();
  const yesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toDateString();
  };

  const compute = () => {
    const storedLast = localStorage.getItem(lastKey) || '';
    const storedStreak = parseInt(localStorage.getItem(streakKey) || '0', 10) || 0;
    const today = todayStr();
    const yesterday = yesterdayStr();
    const isClaimedToday = storedLast === today;

    let cur: number;
    if (isClaimedToday) {
      cur = Math.min(7, storedStreak);
    } else if (storedLast === yesterday) {
      cur = Math.min(7, storedStreak + 1);
    } else {
      cur = 1;
    }

    setLast(storedLast);
    setStreak(storedStreak);
    setClaimedToday(isClaimedToday);
    setCurrent(cur < 1 ? 1 : cur);
  };

  useEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleClaim = (day: number) => {
    if (claimedToday) return;
    const today = todayStr();
    const yesterday = yesterdayStr();
    const newStreak = Math.min(7, last === yesterday ? streak + 1 : 1);

    onClaim(rewards[day - 1]);

    localStorage.setItem(lastKey, today);
    localStorage.setItem(streakKey, String(newStreak));

    setLast(today);
    setStreak(newStreak);
    setClaimedToday(true);
    setCurrent(Math.min(7, newStreak));
  };

  const isCollected = (day: number) =>
    claimedToday ? day <= current : day < current;

  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-4">
      <div className="flex flex-col items-center gap-1">
        <Icon name="Gift" size={48} className="text-[#FFE38A]" />
        <h2 className="text-2xl font-black game-title">Ежедневная награда</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {rewards.map((amount, idx) => {
          const day = idx + 1;
          const collected = isCollected(day);
          const isCurrent = day === current && !collected;
          const fullWidth = day === 7;

          return (
            <div
              key={day}
              className={`game-card flex flex-col items-center justify-center gap-1 py-3 ${
                fullWidth ? 'col-span-3' : ''
              }`}
              style={{
                background: collected
                  ? 'linear-gradient(180deg,#8a99ad 0%, #5a6678 100%)'
                  : undefined,
                outline: isCurrent ? '3px solid #ffd23a' : undefined,
                outlineOffset: isCurrent ? '-1px' : undefined,
              }}
            >
              <span className="text-sm font-bold text-white/90">День {day}</span>
              {collected ? (
                <Icon name="Check" size={28} className="text-[#34c759]" />
              ) : (
                <span className="flex items-center gap-1 text-base font-black text-[#FFE38A]">
                  <Icon name="Coins" size={16} />
                  {amount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => handleClaim(current)}
        disabled={claimedToday}
        className="rounded-xl py-3 font-black text-white text-lg game-pill"
        style={{
          background: claimedToday
            ? 'linear-gradient(180deg,#8a99ad 0%, #5a6678 100%)'
            : 'linear-gradient(180deg,#3ddb6a 0%, #34c759 100%)',
          borderColor: claimedToday ? '#7a879b' : '#5be089',
          cursor: claimedToday ? 'not-allowed' : 'pointer',
        }}
      >
        {claimedToday ? 'Уже забрано' : 'Забрать'}
      </button>
    </div>
  );
};

export default DailyBonus;
