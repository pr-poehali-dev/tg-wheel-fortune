import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

interface TasksPanelProps {
  userId: number | null;
  onReward: (rw: { W?: number; B?: number }) => void;
  onShare: () => void;
}

interface TaskDef {
  name: string;
  title: string;
  progressKey: string;
  target: number;
  reward: { W?: number; B?: number };
  share?: boolean;
}

const TasksPanel = ({ userId, onReward, onShare }: TasksPanelProps) => {
  const suffix = userId !== null ? `_${userId}` : '';

  const tasks: TaskDef[] = [
    {
      name: 'spin50',
      title: '50 прокрутов — 1000 W',
      progressKey: `task_spins${suffix}`,
      target: 50,
      reward: { W: 1000 },
    },
    {
      name: 'spin100',
      title: '100 прокрутов — 1 B',
      progressKey: `task_spins${suffix}`,
      target: 100,
      reward: { B: 1 },
    },
    {
      name: 'streak7',
      title: 'Заходи 7 дней подряд — 1 B',
      progressKey: `task_streak${suffix}`,
      target: 7,
      reward: { B: 1 },
    },
    {
      name: 'share5',
      title: 'Поделись с 5 друзьями — 5000 W',
      progressKey: `task_shared${suffix}`,
      target: 5,
      reward: { W: 5000 },
      share: true,
    },
  ];

  const doneKey = (name: string) => `task_done_${name}${suffix}`;

  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  const refresh = () => {
    const d: Record<string, boolean> = {};
    const p: Record<string, number> = {};
    tasks.forEach((t) => {
      d[t.name] = localStorage.getItem(doneKey(t.name)) === '1';
      p[t.name] = parseInt(localStorage.getItem(t.progressKey) || '0', 10) || 0;
    });
    setDoneMap(d);
    setProgressMap(p);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const claim = (task: TaskDef) => {
    if (doneMap[task.name]) return;
    onReward(task.reward);
    if (task.share) onShare();
    localStorage.setItem(doneKey(task.name), '1');
    setDoneMap((prev) => ({ ...prev, [task.name]: true }));
  };

  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-4">
      <div className="flex flex-col items-center gap-1">
        <Icon name="ListChecks" size={48} className="text-[#FFE38A]" />
        <h2 className="text-2xl font-black game-title">Задания</h2>
      </div>

      {tasks.map((task) => {
        const isDone = !!doneMap[task.name];
        const progress = Math.min(progressMap[task.name] || 0, task.target);
        const available = (progressMap[task.name] || 0) >= task.target && !isDone;

        return (
          <div key={task.name} className="game-card flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[15px] font-bold text-white">{task.title}</div>
              <div className="text-sm font-semibold text-white/70">
                {progress}/{task.target}
              </div>
            </div>

            {isDone ? (
              <span className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-black/20">
                <Icon name="Check" size={26} className="text-[#34c759]" />
              </span>
            ) : (
              <button
                onClick={() => claim(task)}
                disabled={!available}
                className="shrink-0 rounded-xl px-4 py-2 font-black text-white"
                style={{
                  background: available
                    ? 'linear-gradient(180deg,#3ddb6a 0%, #34c759 100%)'
                    : 'linear-gradient(180deg,#8a99ad 0%, #5a6678 100%)',
                  border: `2px solid ${available ? '#5be089' : '#7a879b'}`,
                  cursor: available ? 'pointer' : 'not-allowed',
                }}
              >
                Забрать
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TasksPanel;
