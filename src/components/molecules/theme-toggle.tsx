import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/core/theme/theme-context';
import { useI18n } from '@/core/i18n/context';

/**
 * Day edition or night edition. The label is the point: this is not a
 * brightness switch, it is which press run you are reading.
 */
export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="stamp flex items-center gap-1.5 px-2 py-1.5 text-[10px] border border-[var(--rule)] bg-[var(--paper-sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors cursor-pointer"
      title={isDark ? t.press.toDay : t.press.toNight}
      aria-label="Toggle edition"
    >
      {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      <span className="hidden lg:inline">{isDark ? t.press.night : t.press.day}</span>
    </button>
  );
}
