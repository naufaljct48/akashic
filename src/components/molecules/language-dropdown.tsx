import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n, type Locale } from '@/core/i18n/context';
import { IndonesiaFlag, UKFlag } from '@/components/ui/flag-icons';
import { cn } from '@/lib/utils/cn';

interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  flagComponent: React.ComponentType<{ size?: number; className?: string }>;
}

const LANGUAGES: LanguageOption[] = [
  {
    code: 'id',
    label: 'ID',
    nativeName: 'Bahasa Indonesia',
    flagComponent: IndonesiaFlag,
  },
  {
    code: 'en',
    label: 'EN',
    nativeName: 'English',
    flagComponent: UKFlag,
  },
];

export function LanguageDropdown() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];
  const CurrentFlag = currentLanguage.flagComponent;

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono-data text-xs transition-colors cursor-pointer',
          'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-muted)]',
          isOpen && 'border-[var(--border-muted)]'
        )}
        aria-expanded={isOpen}
      >
        <CurrentFlag size={18} className="shadow-xs" />
        <span className="font-semibold">{currentLanguage.label}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-[var(--text-muted)] transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl shadow-black/40 py-1 z-50 animate-in fade-in duration-100">
          <div className="px-3 py-1.5 text-[10px] uppercase font-mono-data text-[var(--text-muted)] font-semibold border-b border-[var(--border-subtle)]">
            Select Language
          </div>

          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === locale;
            const Flag = lang.flagComponent;

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLocale(lang.code);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-xs font-mono-data text-left transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Flag size={18} className="shadow-xs shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
                      {lang.nativeName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">
                      {lang.code === 'id' ? 'Indonesia' : 'United Kingdom'}
                    </span>
                  </div>
                </div>

                {isSelected && <Check className="w-3.5 h-3.5 text-[#ff334b] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
