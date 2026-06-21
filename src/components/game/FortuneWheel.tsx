import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';

const SEGMENT_COLORS = [
  '#7ED957', '#FFDE3A', '#FF9F1C', '#4CB944', '#5B8DEF',
  '#FFD23F', '#9B5DE5', '#00BBF9', '#F15BB5', '#E63946',
];

export interface FortuneWheelRef {
  spin: (forcedIndex?: number) => void;
}

interface Props {
  size?: number;
  spinning: boolean;
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onBeforeSpin: () => boolean | number;
  onResult: (index: number, label: string) => void;
  onSpinningChange: (v: boolean) => void;
  sectorBonusEmojis?: (string | null)[];
  disableSelection?: boolean;
  hideCenterButton?: boolean;
}

const FortuneWheel = forwardRef<FortuneWheelRef, Props>(function FortuneWheel(
  { size = 300, spinning, selectedIndex, onSelectIndex, onBeforeSpin, onResult,
    onSpinningChange, sectorBonusEmojis = [], disableSelection, hideCenterButton },
  ref,
) {
  const [rotation, setRotation] = useState(0);
  const [anim, setAnim] = useState(false);
  const rotationRef = useRef(0);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rNumbers = rOuter - size * 0.1;

  const segments = useMemo(() => {
    const count = 10;
    const angle = 360 / count;
    return Array.from({ length: count }, (_, i) => {
      const start = (i * angle - 90 - angle / 2) * (Math.PI / 180);
      const end = ((i + 1) * angle - 90 - angle / 2) * (Math.PI / 180);
      const x1 = cx + rOuter * Math.cos(start);
      const y1 = cy + rOuter * Math.sin(start);
      const x2 = cx + rOuter * Math.cos(end);
      const y2 = cy + rOuter * Math.sin(end);
      const midAngle = (i * angle - 90) * (Math.PI / 180);
      const tx = cx + rNumbers * Math.cos(midAngle);
      const ty = cy + rNumbers * Math.sin(midAngle);
      const ex = cx + (rNumbers - size * 0.13) * Math.cos(midAngle);
      const ey = cy + (rNumbers - size * 0.13) * Math.sin(midAngle);
      return {
        path: `M${cx},${cy} L${x1},${y1} A${rOuter},${rOuter} 0 0,1 ${x2},${y2} Z`,
        color: SEGMENT_COLORS[i],
        label: String(i),
        tx, ty, ex, ey,
      };
    });
  }, [cx, cy, rOuter, rNumbers, size]);

  const doSpin = (forcedIndex?: number) => {
    if (anim) return;
    const pre = onBeforeSpin();
    if (pre === false) return;
    let target = typeof forcedIndex === 'number' ? forcedIndex
      : typeof pre === 'number' ? pre
      : Math.floor(Math.random() * 10);
    target = ((target % 10) + 10) % 10;

    onSpinningChange(true);
    setAnim(true);

    const anglePer = 36;
    const targetAngle = 360 - target * anglePer;
    const current = rotationRef.current % 360;
    const delta = (targetAngle - current + 360) % 360;
    const next = rotationRef.current + 360 * 5 + delta;
    rotationRef.current = next;
    setRotation(next);

    setTimeout(() => {
      setAnim(false);
      onResult(target, String(target));
      onSpinningChange(false);
    }, 4100);
  };

  useImperativeHandle(ref, () => ({ spin: (i?: number) => doSpin(i) }), [anim]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute z-20" style={{ top: -2, right: size * 0.02 }}>
        <svg width={size * 0.16} height={size * 0.14} viewBox="0 0 56 48">
          <path d="M52 24 L8 4 L20 24 L8 44 Z" fill="#E63946" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </div>

      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: anim ? 'transform 4s cubic-bezier(0.15,0.6,0.2,1)' : 'none',
          filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.4))',
        }}
      >
        <circle cx={cx} cy={cy} r={rOuter - 2} fill="#FFDE3A" stroke="#0b2f68" strokeWidth="6" />
        {segments.map((s, i) => (
          <g key={i}
            onClick={() => { if (!disableSelection && !anim) onSelectIndex(i); }}
            style={{ cursor: disableSelection ? 'default' : 'pointer' }}>
            <path d={s.path} fill={s.color} stroke="#0b2f68" strokeWidth="2"
              opacity={selectedIndex === i ? 1 : 0.92} />
            {selectedIndex === i && (
              <path d={s.path} fill="none" stroke="#fff" strokeWidth="4" />
            )}
            <text x={s.tx} y={s.ty} fontSize={size * 0.085} fontWeight="900" fill="#fff"
              stroke="#0b2f68" strokeWidth="1" textAnchor="middle" dominantBaseline="central"
              fontFamily="Rubik" style={{ pointerEvents: 'none' }}>{s.label}</text>
            {sectorBonusEmojis[i] && (
              <text x={s.ex} y={s.ey} fontSize={size * 0.05} textAnchor="middle"
                dominantBaseline="central" style={{ pointerEvents: 'none' }}>{sectorBonusEmojis[i]}</text>
            )}
          </g>
        ))}
        <circle cx={cx} cy={cy} r={size * 0.14} fill="#fff" stroke="#0b2f68" strokeWidth="3" />
      </svg>

      {!hideCenterButton && (
        <button
          onClick={() => doSpin()}
          disabled={anim || spinning}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full flex items-center justify-center font-black text-white active:scale-95 transition-transform disabled:opacity-80"
          style={{
            width: size * 0.3, height: size * 0.3,
            background: 'radial-gradient(circle at 50% 35%, #ff5a3c 0%, #e63015 100%)',
            border: '4px solid #0b2f68',
            boxShadow: '0 4px 0 #8a1c0a, 0 6px 12px rgba(0,0,0,0.4)',
            fontFamily: 'Rubik',
          }}
        >
          <span style={{ fontSize: size * 0.06, textShadow: '0 2px 2px rgba(0,0,0,0.5)' }}>
            {anim || spinning ? '...' : 'START'}
          </span>
        </button>
      )}
    </div>
  );
});

export default FortuneWheel;
