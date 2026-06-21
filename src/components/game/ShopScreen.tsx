import Icon from '@/components/ui/icon';

const items = [
  { icon: 'ShoppingCart', title: 'WHEEL SHOP', sub: 'прокачай удачу', color: '#F15BB5' },
  { icon: 'ArrowLeftRight', title: 'WHEEL конвертер', sub: 'покупка и обмен игровой волюты', color: '#4CB944' },
  { icon: 'CircleDollarSign', title: 'Получай WCOIN', sub: 'выполняя задания', color: '#FFD23F' },
  { icon: 'Rocket', title: 'Повысил уровень?', sub: 'Забирай бонусы!', color: '#FF6B35' },
  { icon: 'Newspaper', title: 'WCOIN новости', sub: 'будь в курсе всех событий', color: '#00BBF9' },
];

const ShopScreen = () => {
  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-4 animate-fade-in">
      {items.map((it, i) => (
        <button
          key={i}
          className="game-tile flex items-center gap-3 text-left"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span
            className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.18)' }}
          >
            <Icon name={it.icon} size={30} style={{ color: it.color }} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-black game-title" style={{ WebkitTextStroke: '0.5px #1a3d80' }}>
              {it.title}
            </span>
            <span className="block text-[13px] font-semibold text-white/70">{it.sub}</span>
          </span>
          <Icon name="ChevronRight" size={22} className="shrink-0 text-white/80" />
        </button>
      ))}
    </div>
  );
};

export default ShopScreen;
