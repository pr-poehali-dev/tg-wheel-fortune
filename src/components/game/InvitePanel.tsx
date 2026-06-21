import Icon from '@/components/ui/icon';

interface Friend {
  id: number;
  name: string;
  photo?: string | null;
  level: number;
  coins: number;
}

interface InvitePanelProps {
  friends: Friend[];
  inviteUrl: string;
  onShare: () => void;
}

const formatCoins = (coins: number) =>
  coins >= 1000 ? `${(coins / 1000).toFixed(1)}K` : String(coins);

const InvitePanel = ({ friends, inviteUrl, onShare }: InvitePanelProps) => {
  return (
    <div className="flex flex-col gap-4 px-3 pt-2 pb-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <Icon name="Users" size={48} className="text-[#FFE38A]" />
        <h2 className="text-2xl font-black game-title">Пригласите друзей</h2>
        <p className="text-sm font-semibold text-white/80">
          Вы и друг получите +5000 W
        </p>
      </div>

      <button
        onClick={onShare}
        data-invite-url={inviteUrl}
        className="game-pill w-full rounded-xl py-3 px-4 gap-2 text-base"
        style={{
          background: 'linear-gradient(180deg,#3ddb6a 0%, #34c759 100%)',
          borderColor: '#5be089',
        }}
      >
        <Icon name="Coins" size={20} className="text-[#FFE38A]" />
        +5000 для вас и друга
      </button>

      <div
        className="game-card flex items-center justify-center gap-2 font-black text-[#0b2f68]"
        style={{ background: 'linear-gradient(180deg,#FFE38A 0%, #ffd23a 100%)' }}
      >
        {'\uD83C\uDFC6'} {friends.length} друзей приглашено
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-black text-white game-title">Список друзей</h3>
        {friends.length === 0 ? (
          <div className="game-card text-center font-semibold text-white/70">Пока пусто</div>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="game-card flex items-center gap-3">
              {f.photo ? (
                <img
                  src={f.photo}
                  alt={f.name}
                  className="shrink-0 w-11 h-11 rounded-full object-cover border-2 border-[#6ba6f2]"
                />
              ) : (
                <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-black/20 text-lg font-black text-white">
                  {f.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1">
                <div className="text-[15px] font-bold text-white">{f.name}</div>
                <div className="text-sm font-semibold text-white/70">{'\u2B50'} lvl {f.level}</div>
              </div>
              <span className="flex items-center gap-1 font-black text-[#FFE38A]">
                <Icon name="Coins" size={16} />
                {formatCoins(f.coins)}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default InvitePanel;
