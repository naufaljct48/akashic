export type ReadingStatus = 'PLAN_TO_READ' | 'READING' | 'COMPLETED';

export interface BookmarkItem {
  comicId: string;
  status: ReadingStatus;
  progressChapter?: number;
  updatedAt: string;
}

export type BookmarkMap = Record<string, BookmarkItem>;

const BOOKMARKS_STORAGE_KEY = 'akashic_user_bookmarks_v2';
const LEGACY_STORAGE_KEY = 'akashic_bookmarks';

export function loadStoredBookmarks(): BookmarkMap {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Migrate legacy bookmarks if available
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const ids: string[] = JSON.parse(legacy);
      const migrated: BookmarkMap = {};
      const now = new Date().toISOString();
      ids.forEach((id) => {
        migrated[id] = {
          comicId: id,
          status: 'PLAN_TO_READ',
          updatedAt: now,
        };
      });
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (err) {
    console.error('Failed to load bookmarks from storage:', err);
  }
  return {};
}

export function saveStoredBookmarks(map: BookmarkMap): void {
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save bookmarks to storage:', err);
  }
}

const VALID_STATUS = new Set<ReadingStatus>(['PLAN_TO_READ', 'READING', 'COMPLETED']);

/**
 * Local-first storage is a stated feature, not an accident — but it means one
 * "clear site data" wipes the whole library with nothing to restore from. A
 * file the user holds covers that, and cross-device, without adding an account.
 */
export function exportBookmarks(map: BookmarkMap): void {
  const payload = JSON.stringify(
    { app: 'akashic-dex', version: 2, exportedAt: new Date().toISOString(), bookmarks: map },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `akashic-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Merge, never replace: importing on a device that already has a library must
 * not silently delete it. Per title, the newer `updatedAt` wins.
 *
 * The file came from outside the app, so every field is validated rather than
 * spread in — a malformed status would otherwise sit in localStorage forever
 * and match no filter tab.
 */
export async function importBookmarks(file: File, current: BookmarkMap): Promise<BookmarkMap> {
  const parsed = JSON.parse(await file.text());
  const incoming = parsed?.bookmarks ?? parsed;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new Error('Not an Akashic bookmark export');
  }

  const merged: BookmarkMap = { ...current };
  let imported = 0;

  for (const [comicId, raw] of Object.entries(incoming as Record<string, unknown>)) {
    const item = raw as Partial<BookmarkItem> | null;
    if (!comicId || !item || typeof item !== 'object') continue;
    if (!VALID_STATUS.has(item.status as ReadingStatus)) continue;

    const candidate: BookmarkItem = {
      comicId,
      status: item.status as ReadingStatus,
      progressChapter:
        typeof item.progressChapter === 'number' && item.progressChapter >= 0
          ? item.progressChapter
          : undefined,
      updatedAt:
        typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
    };

    const existing = merged[comicId];
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      merged[comicId] = candidate;
      imported++;
    }
  }

  if (imported === 0 && Object.keys(incoming).length > 0) {
    throw new Error('Nothing importable in that file');
  }

  saveStoredBookmarks(merged);
  return merged;
}
