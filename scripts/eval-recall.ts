import { supabase } from './supabase-admin';
import { embedAdaptive } from './workers-ai';

/**
 * Retrieval quality, measured.
 *
 * Retrieval is what was broken, so retrieval is what this measures. A ranking
 * model cannot choose a title it was never shown, which makes recall -- not the
 * final ordering, and certainly not how good the results look -- the number
 * that says whether the vector work paid off.
 *
 * Every query describes a story without naming it, the way a reader actually
 * asks. Most are Indonesian against an English-language catalog, because
 * cross-lingual retrieval is the hard case and the one this project depends on.
 *
 * Expected answers are pinned by AniList source_id, not by title text: title
 * matching silently passes on "Attack on Titan: Junior High".
 */

interface Case {
  sourceId: number;
  title: string;
  query: string;
}

const CASES: Case[] = [
  { sourceId: 53390, title: 'Attack on Titan', query: 'cerita tentang raksasa yang memakan manusia di balik tembok' },
  { sourceId: 53390, title: 'Attack on Titan', query: 'giants that devour humans behind enormous walls' },
  { sourceId: 105398, title: 'Solo Leveling', query: 'pemburu terlemah yang bisa naik level sendirian' },
  { sourceId: 105398, title: 'Solo Leveling', query: 'the weakest hunter who alone can grow stronger by leveling up' },
  { sourceId: 52993, title: 'Accel World', query: 'anak sekolah gendut yang dibully lalu masuk dunia game akselerasi' },
  { sourceId: 30021, title: 'Death Note', query: 'siswa jenius yang punya buku untuk membunuh orang lewat namanya' },
  { sourceId: 85364, title: 'One Punch Man', query: 'pahlawan botak yang mengalahkan semua musuh dengan satu pukulan' },
  { sourceId: 30642, title: 'Vinland Saga', query: 'anak yang ingin membalas dendam pada pembunuh ayahnya di era viking' },
  { sourceId: 105778, title: 'Chainsaw Man', query: 'pemuda miskin yang menyatu dengan iblis gergaji mesin' },
  { sourceId: 30656, title: 'Vagabond', query: 'pendekar pedang jepang yang mengembara mencari kesempurnaan' },
  { sourceId: 30002, title: 'Berserk', query: 'pendekar berpedang raksasa yang terus diburu iblis' },
  { sourceId: 85143, title: 'Tower of God', query: 'anak laki-laki yang memanjat menara penuh ujian demi seorang gadis' },
  { sourceId: 34632, title: 'Goodnight Punpun', query: 'kisah suram anak laki-laki yang tumbuh dewasa dengan depresi' },
  { sourceId: 46765, title: 'Kingdom', query: 'yatim piatu yang ingin jadi jenderal terhebat di tiongkok kuno' },
  { sourceId: 98416, title: 'Dr. STONE', query: 'dunia di mana semua manusia membatu lalu dibangun ulang dengan sains' },
  { sourceId: 108556, title: 'SPY x FAMILY', query: 'mata-mata yang membentuk keluarga palsu dengan pembunuh bayaran dan anak telepati' },
  { sourceId: 85189, title: 'Mob Psycho 100', query: 'anak smp dengan kekuatan psikis luar biasa yang ingin hidup normal' },
  { sourceId: 86551, title: 'Made in Abyss', query: 'anak-anak yang turun ke lubang raksasa penuh makhluk berbahaya' },
  { sourceId: 30025, title: 'Fullmetal Alchemist', query: 'dua saudara yang kehilangan tubuhnya karena alkimia terlarang' },
  { sourceId: 30651, title: 'Nausicaä', query: 'putri yang hidup di dunia beracun setelah peradaban runtuh' },
  { sourceId: 119257, title: 'Omniscient Reader', query: 'pembaca novel web yang tahu persis bagaimana dunia akan kiamat' },
];

/** Deep enough to show whether a miss is near or hopeless. */
const POOL = 50;

async function main() {
  // One request for every query: they are short, and the batch is trivial.
  const vectors = await embedAdaptive(CASES.map((c) => c.query));

  const ranks: (number | null)[] = [];

  for (const [i, c] of CASES.entries()) {
    const { data, error } = await (supabase.rpc as any)('match_comics_hybrid', {
      query_embedding: vectors[i],
      // Deliberately below the production default: a fixture that cannot see
      // near-misses cannot tell "ranked 30th" from "absent", and those call for
      // completely different fixes.
      match_threshold: 0.3,
      match_count: POOL,
    });

    if (error) throw new Error(`RPC failed: ${error.message}`);

    const at = (data as any[]).findIndex((r) => r.source_id === c.sourceId);
    ranks.push(at === -1 ? null : at + 1);
  }

  const at = (k: number) => ranks.filter((r) => r !== null && r <= k).length;
  const n = CASES.length;

  console.log(`\n${'query'.padEnd(62)} expected             rank`);
  console.log('-'.repeat(94));
  for (const [i, c] of CASES.entries()) {
    const r = ranks[i];
    const mark = r === null ? `not in top ${POOL}` : `#${r}`;
    console.log(`${c.query.slice(0, 60).padEnd(62)} ${c.title.padEnd(20)} ${mark}`);
  }

  console.log(`\nrecall@5  : ${at(5)}/${n}  (${((100 * at(5)) / n).toFixed(0)}%)`);
  console.log(`recall@10 : ${at(10)}/${n}  (${((100 * at(10)) / n).toFixed(0)}%)`);
  console.log(`recall@20 : ${at(20)}/${n}  (${((100 * at(20)) / n).toFixed(0)}%)`);
  console.log(`recall@${POOL} : ${at(POOL)}/${n}  (${((100 * at(POOL)) / n).toFixed(0)}%)`);

  // recall@20 is the number that matters: that is roughly the pool the AI
  // curator re-ranks, and it cannot pick what retrieval never surfaced.
  const missed = CASES.filter((_, i) => ranks[i] === null || ranks[i]! > 20);
  if (missed.length > 0) {
    console.log(`\nOutside the curator's pool (${missed.length}):`);
    for (const c of missed) console.log(`  - ${c.title}: "${c.query}"`);
  }
}

main().catch((err) => {
  console.error(`❌ ${err}`);
  process.exit(1);
});
