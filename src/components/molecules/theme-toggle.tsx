import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/core/theme/theme-context';
import { cn } from '@/lib/utils/cn';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'p-1.5 rounded-lg border font-mono-data text-xs transition-colors cursor-pointer flex items-center justify-center',
        'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]'
      )}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle color theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-500 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
