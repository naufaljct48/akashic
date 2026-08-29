import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface PrintedSelectOption<T extends string> {
  value: T;
  label: string;
}

interface PrintedSelectProps<T extends string> {
  /** Names the list in the popup's reversed head, the way the edition picker does. */
  label: string;
  value: T;
  options: PrintedSelectOption<T>[];
  onChange: (value: T) => void;
  /** Which edge the popup hangs from. Default right, for right-aligned controls. */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * A select the world can actually print.
 *
 * A native `<select>` only exposes its closed box to CSS — the open list is
 * drawn by the operating system, so it arrived as a white panel with a system
 * blue highlight in the middle of a pulp page, and no amount of styling reaches
 * it. This is the edition picker's own grammar generalised: ruled trigger,
 * reversed head naming the list, options separated by hairlines, the current
 * one washed in the view's spot and checked.
 *
 * Keyboard parity with the control it replaces: arrows move, Enter and Space
 * commit, Escape closes and returns focus to the trigger.
 */
export function PrintedSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  align = 'right',
  className,
}: PrintedSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const current = options[selectedIndex];

  useEffect(() => {
    if (isOpen) setActiveIndex(selectedIndex);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commit = (next: T) => {
    onChange(next);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const next = options[activeIndex];
      if (next) commit(next.value);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
        className={cn(
          'stamp flex items-center gap-1.5 py-1 pl-0.5 pr-0.5 text-[9px] border-b-2 transition-colors cursor-pointer w-full justify-between',
          isOpen
            ? 'border-[var(--spot)] text-[var(--ink)]'
            : 'border-[var(--rule)] text-[var(--ink)] hover:border-[var(--ink)]'
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 shrink-0 text-[var(--ink-soft)] transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className={cn(
            'absolute mt-1 min-w-full w-max max-w-[15rem] bg-[var(--paper-sheet)] border border-[var(--ink)] z-50 shadow-[var(--plate-shadow)]',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="stamp px-3 py-1.5 text-[9px] text-[var(--paper)] bg-[var(--ink)]">
            {label}
          </div>

          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(option.value)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors cursor-pointer border-t border-[var(--rule)]',
                  isSelected
                    ? 'bg-[var(--spot-wash)] text-[var(--ink)]'
                    : isActive
                      ? 'bg-[var(--paper-deep)] text-[var(--ink)]'
                      : 'text-[var(--ink-soft)]'
                )}
              >
                <span className="text-xs font-semibold">{option.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[var(--spot-text)] shrink-0" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
