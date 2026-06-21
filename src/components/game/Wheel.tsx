import { useMemo } from 'react';

const SEGMENT_COLORS = [
  '#7ED957', '#FFDE3A', '#FF9F1C', '#4CB944', '#5B8DEF',
  '#FFD23F', '#9B5DE5', '#00BBF9', '#F15BB5', '#E63946',
];

interface WheelProps {
  rotation: number;
  spinning: boolean;
  onSpin: () => void;
}

const Wheel = ({ rotation, spinning, onSpin }: WheelProps) => {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rNumbers = rOuter - 30;

  const outerSegments = useMemo(() => {
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
      return {
        path: `M${cx},${cy} L${x1},${y1} A${rOuter},${rOuter} 0 0,1 ${x2},${y2} Z`,
        color: SEGMENT_COLORS[i],
        label: String(i),
        tx, ty,
      };
    });
  }, [cx, cy, rOuter, rNumbers]);

  const innerSegments = useMemo(() => {
    const count = 12;
    const angle = 360 / count;
    const rIn = rOuter - 60;
    const rInLabel = rIn - 22;
    const innerColors = [
      '#5B8DEF', '#9B5DE5', '#E63946', '#4CB944', '#FF9F1C',
      '#00BBF9', '#F15BB5', '#FFD23F', '#7ED957', '#9B5DE5',
      '#E63946', '#5B8DEF',
    ];
    return Array.from({ length: count }, (_, i) => {
      const start = (i * angle - 90 - angle / 2) * (Math.PI / 180);
      const end = ((i + 1) * angle - 90 - angle / 2) * (Math.PI / 180);
      const x1 = cx + rIn * Math.cos(start);
      const y1 = cy + rIn * Math.sin(start);
      const x2 = cx + rIn * Math.cos(end);
      const y2 = cy + rIn * Math.sin(end);
      const midAngle = (i * angle - 90) * (Math.PI / 180);
      const tx = cx + rInLabel * Math.cos(midAngle);
      const ty = cy + rInLabel * Math.sin(midAngle);
      return {
        path: `M${cx},${cy} L${x1},${y1} A${rIn},${rIn} 0 0,1 ${x2},${y2} Z`,
        color: innerColors[i],
        tx, ty,
      };
    });
  }, [cx, cy, rOuter]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Стрелка-указатель */}
      <div className="absolute z-20" style={{ top: -6, right: -14 }}>
        <Arrow />
      </div>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-2xl"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4s cubic-bezier(0.15,0.6,0.2,1)' : 'none',
        }}
      >
        <circle cx={cx} cy={cy} r={rOuter - 2} fill="#FFDE3A" stroke="#1a1a1a" strokeWidth="6" />
        {outerSegments.map((s, i) => (
          <g key={`o${i}`}>
            <path d={s.path} fill={s.color} stroke="#1a1a1a" strokeWidth="2" />
            <text
              x={s.tx} y={s.ty}
              fontSize="26" fontWeight="900" fill="#fff"
              stroke="#1a1a1a" strokeWidth="1"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="Rubik"
            >{s.label}</text>
          </g>
        ))}
        {innerSegments.map((s, i) => (
          <g key={`i${i}`}>
            <path d={s.path} fill={s.color} stroke="#1a1a1a" strokeWidth="2" />
            <text
              x={s.tx} y={s.ty}
              fontSize="20" fontWeight="900" fill="#fff"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="Rubik"
            >?</text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={42} fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
      </svg>

      {/* Центральная кнопка START */}
      <button
        onClick={onSpin}
        disabled={spinning}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full flex items-center justify-center font-black text-white active:scale-95 transition-transform disabled:opacity-80"
        style={{
          width: 96, height: 96,
          background: 'radial-gradient(circle at 50% 35%, #ff5a3c 0%, #e63015 100%)',
          border: '4px solid #1a1a1a',
          boxShadow: '0 4px 0 #8a1c0a, 0 6px 12px rgba(0,0,0,0.4)',
          fontFamily: 'Rubik',
        }}
      >
        <span className="text-xl tracking-tight" style={{ textShadow: '0 2px 2px rgba(0,0,0,0.5)' }}>
          {spinning ? '...' : 'START'}
        </span>
      </button>
    </div>
  );
};

const Arrow = () => (
  <svg width="56" height="48" viewBox="0 0 56 48">
    <path d="M52 24 L8 4 L20 24 L8 44 Z" fill="#E63946" stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round" />
  </svg>
);

export default Wheel;
