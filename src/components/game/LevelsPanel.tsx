import Icon from '@/components/ui/icon';
import { LEVELS, isLevelRequirementMet, getLevelProgress, type LevelStats } from '@/lib/gameLogic';

interface Props {
  playerLevel: number;
  claimedLevel: number;
  stats: LevelStats;
  onClaim: (level: number) => void;
}

const LevelsPanel = ({ playerLevel, claimedLevel, stats, onClaim }: Props) => {
  return (
    <div className="grid gap-3">
      <p className="text-center text-white/85 text-sm font-bold">
        Выполняй условия и повышай уровень. Забирай награды за каждый уровень по порядку.
      </p>
      {LEVELS.map((conf) => {
        const reached = playerLevel >= conf.level;
        const claimed = claimedLevel >= conf.level;
        const ready = isLevelRequirementMet(stats, conf.level);
        const prog = getLevelProgress(stats, conf.level);
        const canClaim = reached && !claimed && conf.level === claimedLevel + 1 && conf.level > 0;
        const pct = prog.required > 0 ? (prog.current / prog.required) * 100 : 100;
        return (
          <div key={conf.level} className="game-card grid gap-2"
            style={claimed ? { background: 'linear-gradient(180deg,#34c759,#1e9e44)' } : {}}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-black text-[#0b2f68] shrink-0"
                  style={{ background: '#FFE38A', border: '2px solid #fff' }}>{conf.level}</span>
                <span className="font-black text-sm">{conf.action}</span>
              </div>
              {claimed ? (
                <Icon name="CircleCheck" size={26} className="text-white shrink-0" />
              ) : canClaim ? (
                <button onClick={() => onClaim(conf.level)}
                  className="px-3 py-1.5 rounded-lg font-black text-[#0b2f68] shrink-0"
                  style={{ background: '#34c759', boxShadow: 'inset 0 0 0 2px #0a5d2b' }}>
                  +{conf.rewardW} W
                </button>
              ) : (
                <span className="text-xs font-bold text-white/70 shrink-0">{conf.rewardW} W</span>
              )}
            </div>
            <p className="text-xs text-white/80 font-semibold">{conf.how}</p>
            {conf.unlocks.length > 0 && (
              <p className="text-[11px] text-[#ffe27a] font-bold">🔓 {conf.unlocks.join(', ')}</p>
            )}
            {!claimed && conf.level > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[#0b2f68]/50 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(100, pct)}%`, background: ready ? '#34c759' : 'linear-gradient(90deg,#34c759,#ffd23a)' }} />
                </div>
                <span className="text-[11px] font-bold text-white/80">{prog.text}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LevelsPanel;
