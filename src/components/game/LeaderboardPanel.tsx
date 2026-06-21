import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { getLeaderboard, type LeaderEntry } from '@/lib/gameApi';

interface LeaderboardPanelProps {
  userId: number | null;
}

const formatCoins = (coins: number) =>
  coins >= 1000 ? `${(coins / 1000).toFixed(1)}K` : String(coins);

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

const LeaderboardPanel = ({ userId }: LeaderboardPanelProps) => {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getLeaderboard(100).then((items) => {
      if (!active) return;
      setEntries(items);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-4">
      <div className="flex flex-col items-center gap-1">
        <Icon name="Trophy" size={48} className="text-[#FFE38A]" />
        <h2 className="text-2xl font-black game-title">Рейтинг</h2>
      </div>

      {loading ? (
        <div className="game-card text-center font-semibold text-white/80">Загрузка...</div>
      ) : (
        entries.map((entry, idx) => {
          const place = idx + 1;
          const isMe = entry.id === userId;
          return (
            <div
              key={entry.id}
              className="game-card flex items-center gap-3"
              style={{
                outline: isMe ? '3px solid #ffd23a' : undefined,
                outlineOffset: isMe ? '-1px' : undefined,
              }}
            >
              <span className="shrink-0 w-8 text-center text-lg font-black text-white">
                {place <= 3 ? medals[place - 1] : place}
              </span>
              {entry.photo ? (
                <img
                  src={entry.photo}
                  alt={entry.name}
                  className="shrink-0 w-10 h-10 rounded-full object-cover border-2 border-[#6ba6f2]"
                />
              ) : (
                <span className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-black/20 text-base font-black text-white">
                  {entry.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1">
                <div className="text-[15px] font-bold text-white">{entry.name}</div>
                <div className="text-sm font-semibold text-white/70">lvl {entry.level}</div>
              </div>
              <span className="flex items-center gap-1 font-black text-[#FFE38A]">
                <Icon name="Coins" size={16} />
                {formatCoins(entry.coins)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export default LeaderboardPanel;
