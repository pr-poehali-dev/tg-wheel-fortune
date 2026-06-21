import { ReactNode } from 'react';
import Icon from '@/components/ui/icon';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

const BottomSheet = ({ open, title, onClose, children }: Props) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-4 pb-6 max-h-[88vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg,#2a67b7 0%, #143778 100%)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(140,188,255,0.4)',
          animation: 'sheetUp 320ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-2">
          <div className="w-12 h-1.5 rounded-full bg-white/35" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="game-title text-xl font-black text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 text-white"
          >
            <Icon name="X" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
