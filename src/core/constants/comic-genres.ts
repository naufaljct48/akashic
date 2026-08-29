export const POPULAR_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Ecchi',
] as const;

/**
 * Trope pills, each backed by the AniList tag names that actually appear in the
 * catalog. The previous list was hand-invented ("Murim", "System / Level Up",
 * "Overpowered MC", "Dungeon / Gate", "Mind Games", "No Romance"): those strings
 * exist in zero of the 6,628 catalog rows, so selecting them returned nothing —
 * or, worse, fell through to an unfiltered popularity list that looked random.
 *
 * `tags` are OR'd (a title matching any of them matches the pill).
 * `excludeGenres` drives a negative filter for pills that describe an absence.
 *
 * Counts in the comments are catalog occurrences at the time of writing; keep
 * new entries above ~30 or the pill returns a near-empty grid.
 */
export interface TropeDefinition {
  label: string;
  tags?: string[];
  excludeGenres?: string[];
}

export const POPULAR_TROPES: TropeDefinition[] = [
  { label: 'Murim / Cultivation', tags: ['Cultivation', 'Wuxia', 'Martial Arts'] }, // 195 / 109 / 274
  { label: 'Swordplay', tags: ['Swordplay'] }, // 193
  { label: 'Regression / Time Loop', tags: ['Age Regression', 'Time Loop', 'Time Manipulation'] }, // 161 / 31 / 233
  { label: 'Reincarnation', tags: ['Reincarnation'] }, // 469
  { label: 'Isekai', tags: ['Isekai'] }, // 592
  { label: 'Dungeon Raid', tags: ['Dungeon'] }, // 84
  { label: 'Revenge', tags: ['Revenge'] }, // 335
  { label: 'Anti-Hero', tags: ['Anti-Hero'] }, // 222
  { label: 'Kingdom & Politics', tags: ['Kingdom Management', 'Politics', 'Royal Affairs'] }, // 34 / 168 / 216
  { label: 'Villainess', tags: ['Villainess'] }, // 108
  { label: 'Survival / Death Game', tags: ['Survival', 'Death Game', 'Battle Royale'] }, // 144 / 51 / 22
  { label: 'Post-Apocalyptic', tags: ['Post-Apocalyptic', 'Zombie'] }, // 108 / 56
  { label: 'Magic', tags: ['Magic'] }, // 619
  { label: 'Super Power', tags: ['Super Power'] }, // 274
  { label: 'Assassins', tags: ['Assassins'] }, // 60
  { label: 'Necromancy', tags: ['Necromancy'] }, // 37
  { label: 'Gods & Demons', tags: ['Gods', 'Demons', 'Mythology'] }, // 152 / 293 / 72
  { label: 'War & Military', tags: ['War', 'Military'] }, // 128 / 84
  { label: 'Historical', tags: ['Historical', 'Medieval', 'Ancient China'] }, // 284 / 49 / 15
  { label: 'Crime & Mafia', tags: ['Crime', 'Mafia', 'Yakuza', 'Gangs'] }, // 161 / 46 / 39 / 73
  { label: 'Conspiracy & Spies', tags: ['Conspiracy', 'Espionage'] }, // 107 / 24
  { label: 'Detective', tags: ['Detective'] }, // 68
  { label: 'Gore & Body Horror', tags: ['Gore', 'Body Horror', 'Cosmic Horror'] }, // 182 / 83 / 42
  { label: 'Tragedy', tags: ['Tragedy'] }, // 519
  { label: 'Philosophy', tags: ['Philosophy'] }, // 132
  { label: 'Virtual World / Game', tags: ['Video Games', 'Virtual World'] }, // 121 / 77
  { label: 'AI & Cyberpunk', tags: ['Artificial Intelligence', 'Robots', 'Cyberpunk'] }, // 48 / 38 / 15
  { label: 'Urban Fantasy', tags: ['Urban Fantasy'] }, // 215
  { label: 'Dragons & Elves', tags: ['Dragons', 'Elf'] }, // 85 / 41
  { label: 'School & Bullying', tags: ['School', 'Bullying', 'Delinquents'] }, // 821 / 211 / 96
  { label: 'Economics', tags: ['Economics'] }, // 39
  { label: 'Amnesia & Memory', tags: ['Amnesia', 'Memory Manipulation'] }, // 103 / 47
  { label: 'Found Family', tags: ['Found Family'] }, // 81
  { label: 'Coming of Age', tags: ['Coming of Age'] }, // 272
  { label: 'Vampire & Werewolf', tags: ['Vampire', 'Werewolf'] }, // 95 / 29
  { label: 'Ghost & Exorcism', tags: ['Ghost', 'Exorcism', 'Youkai'] }, // 114 / 11 / 52
  { label: 'Samurai & Ninja', tags: ['Samurai', 'Ninja'] }, // 16 / 15
  { label: 'No Romance', excludeGenres: ['Romance', 'Ecchi', 'Hentai'] },
];

const TROPE_BY_LABEL = new Map(POPULAR_TROPES.map((tr) => [tr.label, tr]));

/** Turn selected pill labels into the tag / genre filters the catalog query needs. */
export function resolveTropeFilters(labels: string[]): {
  tags: string[];
  excludeGenres: string[];
} {
  const tags = new Set<string>();
  const excludeGenres = new Set<string>();

  for (const label of labels) {
    const trope = TROPE_BY_LABEL.get(label);
    if (!trope) {
      // Unknown label (e.g. a tag clicked straight off the inspector) — pass through.
      tags.add(label);
      continue;
    }
    trope.tags?.forEach((t) => tags.add(t));
    trope.excludeGenres?.forEach((g) => excludeGenres.add(g));
  }

  return { tags: [...tags], excludeGenres: [...excludeGenres] };
}

export const STARTER_PROMPTS = [
  {
    title: 'Cunning MC like Lloyd',
    prompt: 'Cariin manhwa yang MC-nya licik, jenius, dan komedinya pecah mirip The Greatest Estate Developer.',
    category: 'Vibe Match',
  },
  {
    title: 'Authentic Murim non-Regresi',
    prompt: 'Rekomendasi manhwa murim yang MC-nya beneran jenius dari kecil, bukan regresi/isekai, dan minim romance.',
    category: 'Murim Tropes',
  },
  {
    title: 'Dark Psychological Horror',
    prompt: 'Pengen manga psychological thriller/horror yang udah tamat, chapter di bawah 60, dan plot twist-nya mindblowing.',
    category: 'Fast Read',
  },
  {
    title: 'Underrated Kingdom Building',
    prompt: 'Kasih 3 rekomendasi manhwa/manga kingdom building realistis berorientasi ekonomi & politik yang underrated.',
    category: 'Hidden Gems',
  },
] as const;
