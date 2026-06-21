import Icon from '@/components/ui/icon';

type BoosterName = 'Heart' | 'Battery' | 'Rocket';

interface ShopPanelProps {
  balanceW: number;
  onBuyBooster: (name: BoosterName) => void;
  onBuyStars: (stars: number, toB: number) => void;
  boosterCount: (name: BoosterName) => number;
}

const boosters: Array<{
  name: BoosterName;
  emoji: string;
  title: string;
  desc: string;
}> = [
  { name: 'Heart', emoji: '\u2764\uFE0F', title: 'Сердце', desc: 'Возвращает ставку при проигрыше' },
  { name: 'Battery', emoji: '\uD83D\uDD0B', title: 'Батарейка', desc: 'Доп. вращение' },
  { name: 'Rocket', emoji: '\uD83D\uDE80', title: 'Ракета', desc: 'Удваивает выигрыш' },
];

const starPacks = [
  { stars: 10, toB: 1 },
  { stars: 30, toB: 3 },
  { stars: 100, toB: 10 },
];

const ShopPanel = ({ balanceW, onBuyBooster, onBuyStars, boosterCount }: ShopPanelProps) => {
  const canBuy = balanceW >= 1000;

  return (
    <div className="flex flex-col gap-4 px-3 pt-2 pb-4">
      <div className="flex flex-col items-center gap-1">
        <Icon name="ShoppingBag" size={48} className="text-[#FFE38A]" />
        <h2 className="text-2xl font-black game-title">Магазин</h2>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-black text-white game-title">Бустеры</h3>
        {boosters.map((b) => (
          <div key={b.name} className="game-card flex items-center gap-3">
            <span className="text-3xl shrink-0 w-12 text-center">{b.emoji}</span>
            <div className="flex-1">
              <div className="text-[15px] font-bold text-white">{b.title}</div>
              <div className="text-sm font-semibold text-white/70">{b.desc}</div>
              <div className="text-sm font-black text-[#FFE38A]">x{boosterCount(b.name)}</div>
            </div>
            <button
              onClick={() => onBuyBooster(b.name)}
              disabled={!canBuy}
              className="shrink-0 rounded-xl px-3 py-2 font-black text-white text-sm"
              style={{
                background: canBuy
                  ? 'linear-gradient(180deg,#3ddb6a 0%, #34c759 100%)'
                  : 'linear-gradient(180deg,#8a99ad 0%, #5a6678 100%)',
                border: `2px solid ${canBuy ? '#5be089' : '#7a879b'}`,
                cursor: canBuy ? 'pointer' : 'not-allowed',
              }}
            >
              Купить 1000 W
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-black text-white game-title">Пополнить за {'\u2B50'}</h3>
        <p className="text-sm font-semibold text-white/70">10{'\u2B50'} = 1 B</p>
        <div className="grid grid-cols-3 gap-2">
          {starPacks.map((p) => (
            <button
              key={p.stars}
              onClick={() => onBuyStars(p.stars, Math.floor(p.stars / 10))}
              className="game-tile flex flex-col items-center justify-center gap-1 py-3"
            >
              <span className="text-base font-black">{p.stars}{'\u2B50'}</span>
              <span className="text-sm font-bold text-[#FFE38A]">{p.toB} B</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ShopPanel;
