import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useI18n, type Locale } from '@/core/i18n/context';
import { IndonesiaFlag, UKFlag } from '@/components/ui/flag-icons';
import { cn } from '@/lib/utils/cn';

interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  editionKey: 'editionId' | 'editionEn';
  flagComponent: React.ComponentType<{ size?: number; className?: string }>;
}

const LANGUAGES: LanguageOption[] = [
  {
    code: 'id',
    label: 'ID',
    nativeName: 'Bahasa Indonesia',
    editionKey: 'editionId' as const,
    flagComponent: IndonesiaFlag,
  },
  {
    code: 'en',
    label: 'EN',
    nativeName: 'English',
    editionKey: 'editionEn' as const,
    flagComponent: UKFlag,
  },
];

export function LanguageDropdown() {
  const { t, locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];
  const CurrentFlag = currentLanguage.flagComponent;

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
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'stamp flex items-center gap-1.5 px-2 py-1.5 text-[10px] border bg-[var(--paper-sheet)] transition-colors cursor-pointer',
          isOpen
            ? 'border-[var(--ink)] text-[var(--ink)]'
            : 'border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)]'
        )}
        aria-expanded={isOpen}
        aria-label="Select edition language"
      >
        <CurrentFlag size={16} />
        <span>{currentLanguage.label}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-52 bg-[var(--paper-sheet)] border border-[var(--ink)] z-50 shadow-[var(--plate-shadow)]">
          <div className="stamp px-3 py-1.5 text-[9px] text-[var(--paper)] bg-[var(--ink)]">
            {t.press.edition}
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
                  'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors cursor-pointer border-t border-[var(--rule)]',
                  isSelected
                    ? 'bg-[var(--spot-wash)] text-[var(--ink)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Flag size={18} className="shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-[var(--ink)]">
                      {lang.nativeName}
                    </span>
                    <span className="stamp text-[9px] text-[var(--ink-faint)] mt-0.5">
                      {t.press[lang.editionKey]}
                    </span>
                  </div>
                </div>

                {isSelected && <Check className="w-3.5 h-3.5 text-[var(--spot-text)] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
