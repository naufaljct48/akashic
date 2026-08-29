import { cn } from '@/lib/utils/cn';

interface TropePillProps {
  name: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function TropePill({ name, onClick, active = false, className }: TropePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-xs px-2.5 py-1 rounded-md transition-all duration-150 border cursor-pointer select-none text-left',
        active
          ? 'bg-violet-950/80 text-violet-200 border-violet-600 shadow-sm shadow-violet-950'
          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/80',
        className
      )}
    >
      #{name}
    </button>
  );
}
