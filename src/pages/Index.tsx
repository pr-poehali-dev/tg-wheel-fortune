import { useState } from 'react';
import Icon from '@/components/ui/icon';
import Wheel from '@/components/game/Wheel';
import ProfileScreen from '@/components/game/ProfileScreen';
import ShopScreen from '@/components/game/ShopScreen';

type Tab = 'profile' | 'wheel' | 'shop';

const MAX_SPINS = 5;

const Index = () => {
  const [tab, setTab] = useState<Tab>('wheel');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('0.00');

  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS);
  const [wcoin, setWcoin] = useState(111050);
  const [bcoin] = useState(436001);

  const [multiplier, setMultiplier] = useState(2);
  const [side, setSide] = useState<'W' | 'B'>('W');
  const [bet, setBet] = useState(100);

  const spin = () => {
    if (spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setSpinsLeft((s) => s - 1);
    const extra = 360 * 5 + Math.floor(Math.random() * 360);
    const next = rotation + extra;
    setRotation(next);

    setTimeout(() => {
      const landed = Math.floor(Math.random() * 10);
      const win = landed * bet * multiplier;
      setResult(win.toFixed(2));
      setWcoin((c) => c + win);
      setSpinning(false);
    }, 4100);
  };

  return (
    <div className="min-h-screen w-full flex justify-center wheel-bg">
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        {/* Шапка: профиль + балансы */}
        <header className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white shrink-0"
            style={{ background: 'linear-gradient(180deg,#8b9dff,#6a5af9)', border: '3px solid #fff' }}
          >
            R
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="game-title text-2xl font-black text-white truncate">bananet_support</h1>
            <span
              className="inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-black text-[#244a96]"
              style={{ background: '#FFE38A', border: '2px solid #fff' }}
            >
              3 lvl
            </span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Balance icon="🪙" value={wcoin} />
            <Balance icon="₿" value={bcoin} />
          </div>
        </header>

        {/* Контент по вкладкам */}
        <main className="flex-1 overflow-y-auto">
          {tab === 'wheel' && (
            <div
              className="mx-3 mt-2 rounded-3xl p-4 animate-fade-in"
              style={{ background: 'rgba(0,0,0,0.12)', border: '2px solid rgba(255,255,255,0.25)' }}
            >
              {/* Множитель */}
              <div className="flex items-center gap-2 mb-2.5 relative">
                <button onClick={() => setMultiplier((m) => Math.max(1, m - 1))} className="game-pill w-12 h-11 text-xl">
                  <Icon name="ChevronLeft" size={22} className="text-[#FF6B35]" />
                </button>
                <div className="game-pill flex-1 h-11 text-lg" style={{ background: 'linear-gradient(180deg,#cfe1ff,#a9caff)', color: '#244a96' }}>
                  x{multiplier}
                </div>
                <button onClick={() => setMultiplier((m) => m + 1)} className="game-pill w-12 h-11 text-xl">
                  <Icon name="ChevronRight" size={22} className="text-[#FF6B35]" />
                </button>
                <button className="absolute -right-1 -top-12 w-11 h-11 flex items-center justify-center">
                  <Icon name="Settings" size={34} className="text-white drop-shadow" />
                </button>
              </div>

              {/* W / B */}
              <div className="flex gap-2 mb-2.5">
                <button
                  onClick={() => setSide('W')}
                  className="game-pill flex-1 h-11 text-lg"
                  style={side === 'W' ? { background: '#fff', color: '#244a96' } : {}}
                >
                  W
                </button>
                <button
                  onClick={() => setSide('B')}
                  className="game-pill flex-1 h-11 text-lg"
                  style={side === 'B' ? { background: '#fff', color: '#244a96' } : {}}
                >
                  B
                </button>
              </div>

              {/* Ставка */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setBet((b) => Math.max(0, b - 50))} className="game-pill w-12 h-11 text-2xl text-[#FF6B35]">
                  −
                </button>
                <div className="game-pill flex-1 h-11 text-lg" style={{ background: 'linear-gradient(180deg,#cfe1ff,#a9caff)', color: '#244a96' }}>
                  {bet}
                </div>
                <button onClick={() => setBet((b) => b + 50)} className="game-pill w-12 h-11 text-2xl text-[#4CB944]">
                  +
                </button>
              </div>

              {/* Результат */}
              <div className="flex items-center justify-center gap-3 mb-1">
                <span className="text-3xl">🪙</span>
                <span
                  key={result}
                  className="game-title text-5xl font-black text-white animate-coin-pop"
                >
                  {result}
                </span>
              </div>

              {/* Колесо */}
              <div className="flex justify-center mt-2 relative">
                <Wheel rotation={rotation} spinning={spinning} onSpin={spin} />
                {/* доп. попытки */}
                <button
                  className="absolute left-1 bottom-1 w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle,#4CD964,#2faa48)', border: '3px solid #fff' }}
                  title="Купить попытки"
                >
                  <Icon name="Plus" size={28} className="text-white" />
                </button>
              </div>

              {/* Попытки */}
              <div className="mt-3 text-center">
                <span className="game-pill inline-flex px-4 h-9 text-sm">
                  Попыток: {spinsLeft} / {MAX_SPINS}
                </span>
                {spinsLeft === 0 && (
                  <p className="mt-2 text-white/90 text-sm font-bold">
                    Попытки закончились — обновятся через время или купи бустер ➕
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'profile' && <ProfileScreen />}
          {tab === 'shop' && <ShopScreen />}
        </main>

        {/* Нижняя навигация */}
        <nav className="sticky bottom-0 flex gap-2 px-3 py-3" style={{ background: 'rgba(20,50,110,0.4)', backdropFilter: 'blur(6px)' }}>
          <NavBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon="UserRound" />
          <NavBtn active={tab === 'wheel'} onClick={() => setTab('wheel')} icon="Landmark" />
          <NavBtn active={tab === 'shop'} onClick={() => setTab('shop')} icon="Store" />
        </nav>
        <div className="absolute left-2 bottom-1 text-white/50 text-xs font-bold">v0.1.6</div>
      </div>
    </div>
  );
};

const Balance = ({ icon, value }: { icon: string; value: number }) => (
  <div className="game-coin px-3 h-9 min-w-[120px] justify-start">
    <span className="text-lg">{icon}</span>
    <span className="text-base tabular-nums" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>
      {value.toLocaleString('ru-RU')}
    </span>
  </div>
);

const NavBtn = ({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: string }) => (
  <button
    onClick={onClick}
    className="game-tile flex-1 h-14 flex items-center justify-center"
    style={active ? { background: 'linear-gradient(180deg,#5b9bf0,#3f7fe0)', borderColor: '#bcd8ff' } : {}}
  >
    <Icon name={icon} size={28} className="text-white" />
  </button>
);

export default Index;
