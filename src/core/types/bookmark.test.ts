// bun src/core/types/bookmark.test.ts
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

import { importBookmarks, type BookmarkMap } from './bookmark';

let failures = 0;
const fail = (name: string, detail: string) => {
  console.error(`FAIL ${name}: ${detail}`);
  failures++;
};
const file = (obj: unknown) => new File([JSON.stringify(obj)], 'b.json');

const current: BookmarkMap = {
  keep: { comicId: 'keep', status: 'READING', updatedAt: '2026-01-01T00:00:00.000Z' },
  older: { comicId: 'older', status: 'PLAN_TO_READ', updatedAt: '2026-01-01T00:00:00.000Z' },
  newer: { comicId: 'newer', status: 'COMPLETED', updatedAt: '2026-08-01T00:00:00.000Z' },
};

const merged = await importBookmarks(
  file({
    bookmarks: {
      older: { comicId: 'older', status: 'COMPLETED', updatedAt: '2026-08-01T00:00:00.000Z' },
      newer: { comicId: 'newer', status: 'READING', updatedAt: '2026-02-01T00:00:00.000Z' },
      fresh: { comicId: 'fresh', status: 'READING', progressChapter: 12, updatedAt: '2026-03-01T00:00:00.000Z' },
      junk: { comicId: 'junk', status: 'NOT_A_STATUS', updatedAt: '2026-03-01T00:00:00.000Z' },
    },
  }),
  current
);

// Merge, never replace — an import must not wipe what this device already had.
if (merged.keep?.status !== 'READING') fail('untouched entry survives', JSON.stringify(merged.keep));
// Newer updatedAt wins, in both directions.
if (merged.older?.status !== 'COMPLETED') fail('newer import wins', JSON.stringify(merged.older));
if (merged.newer?.status !== 'COMPLETED') fail('older import loses', JSON.stringify(merged.newer));
if (merged.fresh?.progressChapter !== 12) fail('new entry imported', JSON.stringify(merged.fresh));
// Trust boundary: the file is user-supplied, an invalid status must never land.
if ('junk' in merged) fail('invalid status rejected', 'junk was imported');

// A bare map (no envelope) is still a valid export shape.
const bare = await importBookmarks(
  file({ solo: { comicId: 'solo', status: 'READING', updatedAt: '2026-05-01T00:00:00.000Z' } }),
  {}
);
if (!bare.solo) fail('bare map accepted', JSON.stringify(bare));

for (const bad of [{ bookmarks: [] }, { bookmarks: { a: { status: 'NOPE' } } }]) {
  let threw = false;
  try { await importBookmarks(file(bad), {}); } catch { threw = true; }
  if (!threw) fail('garbage rejected', JSON.stringify(bad));
}

if (failures > 0) process.exit(1);
console.log('bookmark: all assertions passed');
