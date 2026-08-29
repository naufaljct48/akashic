/**
 * Natural-language phrase -> real AniList tag names.
 *
 * Replaces the old `referenceKeywords` dictionary, which mapped queries onto
 * free-text words ("hunter", "cunning", "newbie") and then ILIKE'd them against
 * synopses. That matched on prose coincidence rather than on how a title is
 * actually classified, which is why trope queries came back irrelevant.
 *
 * Every value here is a tag that exists in the catalog — see POPULAR_TROPES for
 * occurrence counts. Keys are lowercase and matched as substrings, so Indonesian
 * and English phrasings for the same concept sit side by side.
 */
const TAG_HINTS: Record<string, string[]> = {
  // --- Murim / cultivation cluster -----------------------------------------
  murim: ['Cultivation', 'Wuxia', 'Martial Arts'],
  silat: ['Martial Arts', 'Cultivation'],
  cultivation: ['Cultivation', 'Wuxia'],
  wuxia: ['Wuxia', 'Cultivation'],
  xianxia: ['Cultivation', 'Wuxia'],
  'martial art': ['Martial Arts'],
  'bela diri': ['Martial Arts'],
  sect: ['Cultivation', 'Martial Arts'],
  sword: ['Swordplay'],
  pedang: ['Swordplay'],
  swordsman: ['Swordplay'],

  // --- Time / rebirth cluster ----------------------------------------------
  regresi: ['Age Regression', 'Time Loop', 'Time Manipulation'],
  regression: ['Age Regression', 'Time Loop', 'Time Manipulation'],
  'kembali ke masa lalu': ['Age Regression', 'Time Manipulation'],
  'time loop': ['Time Loop', 'Time Manipulation'],
  reinkarnasi: ['Reincarnation'],
  reincarnation: ['Reincarnation'],
  rebirth: ['Reincarnation', 'Age Regression'],
  isekai: ['Isekai'],
  transmigrasi: ['Isekai', 'Reincarnation'],
  transmigration: ['Isekai', 'Reincarnation'],

  // --- Hunter / gate / progression -----------------------------------------
  dungeon: ['Dungeon'],
  gate: ['Dungeon'],
  hunter: ['Dungeon', 'Super Power'],
  raid: ['Dungeon'],
  'level up': ['Dungeon', 'Super Power', 'Video Games'],
  leveling: ['Dungeon', 'Super Power', 'Video Games'],
  system: ['Video Games', 'Virtual World'],
  gacha: ['Video Games', 'Virtual World'],
  game: ['Video Games', 'Virtual World'],
  vrmmo: ['Virtual World', 'Video Games'],
  'virtual world': ['Virtual World'],

  // --- Power fantasy / character ------------------------------------------
  overpowered: ['Super Power', 'Anti-Hero'],
  op: ['Super Power'],
  'super power': ['Super Power'],
  kekuatan: ['Super Power'],
  licik: ['Anti-Hero', 'Politics', 'Conspiracy'],
  cunning: ['Anti-Hero', 'Politics', 'Conspiracy'],
  scheming: ['Politics', 'Conspiracy', 'Anti-Hero'],
  manipulat: ['Conspiracy', 'Politics', 'Anti-Hero'],
  jenius: ['Anti-Hero', 'Politics'],
  genius: ['Anti-Hero', 'Politics'],
  antihero: ['Anti-Hero'],
  'anti-hero': ['Anti-Hero'],
  villain: ['Anti-Hero', 'Villainess'],
  villainess: ['Villainess'],
  penjahat: ['Anti-Hero'],

  // --- Revenge / crime -----------------------------------------------------
  balas: ['Revenge'],
  dendam: ['Revenge'],
  revenge: ['Revenge'],
  assassin: ['Assassins'],
  pembunuh: ['Assassins', 'Crime'],
  mafia: ['Mafia', 'Crime', 'Gangs'],
  yakuza: ['Yakuza', 'Crime'],
  gangster: ['Gangs', 'Crime'],
  kriminal: ['Crime'],
  crime: ['Crime'],
  detektif: ['Detective', 'Crime'],
  detective: ['Detective'],
  konspirasi: ['Conspiracy'],
  conspiracy: ['Conspiracy'],
  spy: ['Espionage', 'Conspiracy'],
  'mata-mata': ['Espionage'],

  // --- Kingdom / politics --------------------------------------------------
  kingdom: ['Kingdom Management', 'Politics', 'Royal Affairs'],
  kerajaan: ['Kingdom Management', 'Royal Affairs', 'Politics'],
  politik: ['Politics', 'Royal Affairs'],
  politic: ['Politics', 'Royal Affairs'],
  bangsawan: ['Royal Affairs', 'Politics'],
  noble: ['Royal Affairs', 'Politics'],
  estate: ['Kingdom Management', 'Economics'],
  ekonomi: ['Economics', 'Kingdom Management'],
  economic: ['Economics'],
  merchant: ['Economics'],
  perang: ['War', 'Military'],
  war: ['War', 'Military'],
  militer: ['Military', 'War'],
  military: ['Military', 'War'],

  // --- Horror / dark -------------------------------------------------------
  horror: ['Gore', 'Body Horror', 'Cosmic Horror'],
  psychological: ['Philosophy', 'Tragedy'],
  psikologis: ['Philosophy', 'Tragedy'],
  thriller: ['Crime', 'Conspiracy', 'Detective'],
  gore: ['Gore', 'Body Horror'],
  sadis: ['Gore', 'Body Horror'],
  dark: ['Gore', 'Tragedy', 'Anti-Hero'],
  gelap: ['Gore', 'Tragedy'],
  tragedi: ['Tragedy'],
  tragedy: ['Tragedy'],
  survival: ['Survival', 'Death Game', 'Battle Royale'],
  bertahan: ['Survival'],
  'death game': ['Death Game', 'Battle Royale', 'Survival'],
  apocalypse: ['Post-Apocalyptic', 'Zombie', 'Survival'],
  apokalips: ['Post-Apocalyptic', 'Survival'],
  kiamat: ['Post-Apocalyptic', 'Survival'],
  zombie: ['Zombie', 'Post-Apocalyptic'],

  // --- Fantasy furniture ---------------------------------------------------
  sihir: ['Magic'],
  magic: ['Magic'],
  penyihir: ['Magic', 'Witch'],
  mage: ['Magic'],
  necromancer: ['Necromancy'],
  necromancy: ['Necromancy'],
  undead: ['Necromancy', 'Zombie'],
  dewa: ['Gods', 'Mythology'],
  god: ['Gods', 'Mythology'],
  iblis: ['Demons'],
  demon: ['Demons'],
  mitologi: ['Mythology', 'Gods'],
  mythology: ['Mythology', 'Gods'],
  naga: ['Dragons'],
  dragon: ['Dragons'],
  elf: ['Elf'],
  vampir: ['Vampire'],
  vampire: ['Vampire'],
  werewolf: ['Werewolf'],
  hantu: ['Ghost', 'Youkai'],
  ghost: ['Ghost'],
  exorcis: ['Exorcism', 'Ghost'],

  // --- Setting -------------------------------------------------------------
  sejarah: ['Historical', 'Medieval'],
  historical: ['Historical', 'Medieval'],
  medieval: ['Medieval', 'Historical'],
  'ancient china': ['Ancient China', 'Wuxia'],
  samurai: ['Samurai'],
  ninja: ['Ninja'],
  sekolah: ['School', 'Bullying'],
  school: ['School'],
  bully: ['Bullying', 'Delinquents'],
  perundungan: ['Bullying'],
  urban: ['Urban Fantasy', 'Urban'],
  cyberpunk: ['Cyberpunk', 'Artificial Intelligence'],
  robot: ['Robots', 'Artificial Intelligence'],
  ai: ['Artificial Intelligence'],
  'kecerdasan buatan': ['Artificial Intelligence'],

  // --- Misc ----------------------------------------------------------------
  masak: ['Food'],
  koki: ['Food'],
  kuliner: ['Food'],
  food: ['Food'],
  cooking: ['Food'],
  chef: ['Food'],
  idol: ['Idol', 'Music'],
  musik: ['Band', 'Idol'],
  music: ['Band', 'Idol'],
  olahraga: ['Athletics'],
  amnesia: ['Amnesia', 'Memory Manipulation'],
  'hilang ingatan': ['Amnesia', 'Memory Manipulation'],
  budak: ['Slavery'],
  slave: ['Slavery'],
  filosofi: ['Philosophy'],
  philosophy: ['Philosophy'],
  keluarga: ['Found Family', 'Family Life'],
  'found family': ['Found Family'],
};

/** All hint phrases, longest first, so "martial art" wins over "art". */
const HINT_KEYS = Object.keys(TAG_HINTS).sort((a, b) => b.length - a.length);

/**
 * Word-boundary matchers, precompiled once.
 *
 * A raw `includes()` made short keys fire inside longer words: "manhwa samurai"
 * matched the `ai` key and came back tagged Artificial Intelligence. The
 * optional trailing "s" keeps English plurals working ("martial arts", "gods").
 */
const HINT_MATCHERS: Array<[string, RegExp]> = HINT_KEYS.map((key) => [
  key,
  new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`),
]);

/**
 * True when a single word belongs to the trope vocabulary — i.e. it describes a
 * story element rather than naming a person.
 *
 * Matches whole words inside multi-word keys, so "level" is recognised via
 * "level up". Deliberately not substring matching: short keys like "ai" or
 * "god" would otherwise reject real names ("Goda") as trope words.
 */
export function isTropeWord(word: string): boolean {
  const w = word.toLowerCase().trim();
  if (!w) return false;
  return HINT_KEYS.some((key) => key === w || key.split(' ').includes(w));
}

/** Real AniList tag names implied by a lowercase natural-language query. */
export function queryTagHints(lowerQuery: string): string[] {
  const tags = new Set<string>();
  for (const [key, matcher] of HINT_MATCHERS) {
    if (matcher.test(lowerQuery)) {
      TAG_HINTS[key].forEach((t) => tags.add(t));
    }
  }
  // Keep the tag filter tight — a 20-tag overlap matches half the catalog.
  return [...tags].slice(0, 8);
}
