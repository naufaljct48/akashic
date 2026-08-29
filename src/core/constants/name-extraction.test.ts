import {
  extractNameCandidates,
  characterSearchTerms,
  transpositions,
  namesResemble,
} from './name-extraction';

const fail = (label: string, detail: string) => {
  throw new Error(`${label}\n  ${detail}`);
};

const includes = (actual: string[], expected: string, label: string) => {
  if (!actual.includes(expected)) {
    fail(label, `expected "${expected}" in [${actual.join(', ')}]`);
  }
};

const excludes = (actual: string[], unexpected: string, label: string) => {
  if (actual.includes(unexpected)) {
    fail(label, `did NOT expect "${unexpected}" in [${actual.join(', ')}]`);
  }
};

// The query that regressed: a single name, lowercase, behind Indonesian
// particles. The previous heuristic required two surviving tokens and returned
// nothing, so the character lookup never ran at all.
const llyod = extractNameCandidates('manhwa yg mc nya llyod?');
includes(llyod, 'llyod', 'single name behind "mc nya" is extracted');
excludes(llyod, 'manhwa', 'the medium word is not treated as a name');

// AniList character search is exact-prefix, so the typo must be repaired.
includes(transpositions('llyod'), 'lloyd', 'adjacent transposition repairs llyod');
includes(characterSearchTerms('manhwa yg mc nya llyod?'), 'lloyd', 'search terms include the repair');

// Transposition is bounded and never returns no-op swaps.
if (transpositions('abc').length !== 0) fail('too short', 'words under 4 chars get no variants');
if (transpositions('aab').length !== 0) fail('too short', 'words under 4 chars get no variants');
excludes(transpositions('lloyd'), 'lloyd', 'a word is not its own variant');

// Capitalised runs still win, and stay whole.
includes(
  extractNameCandidates('Cariin manhwa yang MC-nya licik mirip Lloyd Frontera'),
  'Lloyd Frontera',
  'capitalised two-word name is kept intact'
);

// Marker-driven extraction across both languages.
includes(extractNameCandidates('who is the protagonist Johan'), 'johan', 'English marker');
includes(extractNameCandidates('tokoh utama namanya Guts'), 'Guts', 'Indonesian marker');

// Indonesian glues the possessive onto the marker: "tokohnya", "karakternya".
// These are markers, not names, and must not consume a lookup slot.
const glued = extractNameCandidates('komik yang tokohnya kim dokja');
excludes(glued, 'tokohnya', 'glued possessive marker is not a name');
includes(glued, 'kim dokja', 'the name after the glued marker is found');
excludes(extractNameCandidates('cari manhwa karakternya vikir'), 'karakternya', 'karakternya is a marker');
includes(extractNameCandidates('cari manhwa karakternya vikir'), 'vikir', 'name after karakternya');

// A trope query must yield NO name at all. "mc nya jenius" put "jenius" right
// after a name marker, AniList matched Maximilian *Jenius*, and five Macross
// volumes landed on top of a murim search.
const tropeQuery = extractNameCandidates('manhwa murim yang mc nya jenius bukan regresi, minim romance');
if (tropeQuery.length !== 0) {
  fail('trope query yields no name', `expected no names, got [${tropeQuery.join(', ')}]`);
}
excludes(extractNameCandidates('mc nya licik dan cunning'), 'licik', 'trope adjectives are not names');
excludes(extractNameCandidates('manhwa dengan romance dan action'), 'romance', 'genre words are not names');

// ...but a real name after the same marker still comes through.
includes(extractNameCandidates('manhwa murim mc nya Chung Myung'), 'Chung Myung', 'real name survives trope filtering');

// A query with no name at all must not invent one from filler.
const noName = extractNameCandidates('rekomendasi manhwa yang bagus dong');
excludes(noName, 'manhwa', 'medium word rejected');
excludes(noName, 'rekomendasi', 'filler word rejected');
excludes(noName, 'yang', 'particle rejected');

// namesResemble: tolerate romanisation, reject coincidence.
const resembles = [
  ['lloyd', 'Lloyd Frontera', true],
  ['chung', 'Cheong-Myeong', true],
  ['myung', 'Cheong-Myeong', true],
  ['jinwoo', 'Jin-U Seong', true],
  ['kim dokja', 'Dok-Ja Kim', true],
  ['dokja', 'Dok-Ja Kim', true],
  ['guts', 'Guts', true],
  ['vikir', 'Vikir van Baskerville', true],
  // Korean syllables romanise to four letters; rejecting this loses Solo Leveling.
  ['sung', 'Jin-U Seong', true],
  ['building', 'Akitaru Oubi', false],
  ['level', 'Nagito Komaeda', false],
  ['tamat', 'Matama Akoya', false],
  ['system', 'Ryuunosuke Akutagawa', false],
];
// Aliases are matched strictly: many per character means a fuzzy threshold
// applied to each multiplies coincidence.
if (namesResemble('eren', 'Green Beast', true)) fail('strict alias', 'eren must not match Green Beast');
if (!namesResemble('kirito', 'Kirito (キリト)', true)) fail('strict alias', 'kirito must match its own alias');

// Consecutive-word joining only — a plain substring test pulls Ouran High
// School Host Club into a Naruto query.
if (namesResemble('itachi', 'Hikaru Hitachiin')) fail('substring leak', 'itachi must not match Hitachiin');
if (!namesResemble('dokja', 'Dok-Ja Kim')) fail('spacing variance', 'dokja must match Dok-Ja Kim');

// Ordinary vocabulary that IS one edit from a real character ('plot'/'Splot',
// 'tamat'/'Tamate') is stopped by NAME_NOISE before it ever reaches the
// validator — string distance cannot separate those two cases.
for (const word of ['plot', 'twist', 'tamat', 'chapter', 'rating']) {
  const got = extractNameCandidates(`manga yang mc nya ${word}`);
  if (got.length !== 0) fail('meta vocabulary blocked upstream', `"${word}" produced [${got.join(', ')}]`);
}
for (const [term, name, expected] of resembles) {
  const actual = namesResemble(term as string, name as string);
  if (actual !== expected) {
    fail('namesResemble', `"${term}" vs "${name}": expected ${expected}, got ${actual}`);
  }
}

// Story-meta vocabulary is never a character name.
const meta = extractNameCandidates('manga psychological thriller yang udah tamat plot twist');
if (meta.length !== 0) fail('meta words are not names', `got [${meta.join(', ')}]`);

// Terms stay bounded — the batched lookup aliases them into one request.
const many = characterSearchTerms('Lloyd Frontera Chung Myung Sung Jinwoo Kim Dokja');
if (many.length > 5) fail('term cap', `expected <= 5 terms, got ${many.length}`);

console.log('name-extraction: all assertions passed');
