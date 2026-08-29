import { useI18n } from '@/core/i18n/context';
import { isoWeek } from '@/core/constants/issue';

interface FolioProps {
  /** The section this page belongs to, as the reader would name it. */
  section: string;
  /** What the page is holding — an entry count, a filter tally. */
  tally?: string;
}

/**
 * The running foot.
 *
 * A periodical never omits it: publication, issue, section, extent. Without
 * one, a short view ends in blank stock rather than at the bottom of a page,
 * which is exactly how the saved-library view read before this existed.
 */
export function Folio({ section, tally }: FolioProps) {
  const { t } = useI18n();
  const issueNo = isoWeek(new Date());

  return (
    <footer className="folio stamp figures flex items-center justify-between gap-4 mt-8 pt-2 text-[10px] text-[var(--ink-faint)]">
      <span className="truncate">
        Akashic Dex · {t.press.issue} {issueNo}
      </span>
      <span className="truncate text-[var(--ink-soft)]">{section}</span>
      <span className="truncate">{tally ?? t.press.titlesOnFile('')}</span>
    </footer>
  );
}
