import Icon from '@/components/ui/icon';

const items = [
  { icon: 'Wallet', text: 'Подключай свой кошелек TON', color: '#FF8A3D' },
  { icon: 'Users', text: 'Приглашай друзей и поднимай свой уровень в игре', color: '#4CB944' },
  { icon: 'CalendarCheck', text: 'Заходи каждый день и получай дополнительные бонусы', color: '#FFD23F' },
  { icon: 'TrendingUp', text: 'Отслеживай свой рейтинг', color: '#FF6B35' },
  { icon: 'ShoppingCart', text: 'Мои покупки и бонусы в игре', color: '#FFD23F' },
  { icon: 'Send', text: 'Официальная группа в Telegram', color: '#fff' },
];

const ProfileScreen = () => {
  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-4 animate-fade-in">
      {items.map((it, i) => (
        <button
          key={i}
          className="game-tile flex items-center gap-3 text-left"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.18)' }}
          >
            <Icon name={it.icon} size={26} style={{ color: it.color }} />
          </span>
          <span className="flex-1 text-[15px] leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {it.text}
          </span>
          <Icon name="ChevronRight" size={22} className="shrink-0 text-white/80" />
        </button>
      ))}
    </div>
  );
};

export default ProfileScreen;
