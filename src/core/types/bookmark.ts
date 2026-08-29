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
