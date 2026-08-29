import {
  chunkByBudget,
  parseContextOverflow,
  partsNeeded,
  MAX_BATCH_CHARS,
  MAX_BATCH_ROWS,
} from './workers-ai';

/**
 * The batcher is the piece that broke: a fixed 100 rows sent 92,000 tokens at a
 * 60,000-token ceiling. These pin the two bounds it now has to respect and the
 * one case that could loop forever.
 */

const size = (s: string) => s.length;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

console.log('chunkByBudget');

// Character budget
{
  const items = Array.from({ length: 20 }, () => 'x'.repeat(5_000)); // 100,000 chars
  const batches = chunkByBudget(items, size);
  const over = batches.filter((b) => b.reduce((n, s) => n + s.length, 0) > MAX_BATCH_CHARS);
  assert(over.length === 0, 'no batch exceeds the character budget');
  assert(batches.flat().length === 20, 'every item survives batching');
}

// Row cap, when items are far too small to reach the character budget
{
  const items = Array.from({ length: 250 }, () => 'x');
  const batches = chunkByBudget(items, size);
  assert(
    batches.every((b) => b.length <= MAX_BATCH_ROWS),
    'no batch exceeds the row cap'
  );
  assert(batches.flat().length === 250, 'every tiny item survives batching');
}

// Order is preserved — vectors are matched back to comics by index.
{
  const items = ['a', 'b', 'c', 'd'];
  assert(
    chunkByBudget(items, size).flat().join('') === 'abcd',
    'order is preserved across batches'
  );
}

// A single item larger than the whole budget must still be emitted, alone,
// rather than spinning. MAX_TEXT_CHARS is what keeps it actually sendable.
{
  const huge = 'x'.repeat(MAX_BATCH_CHARS * 2);
  const batches = chunkByBudget([huge, 'small'], size);
  assert(batches.length === 2, 'an oversized item gets its own batch');
  assert(batches[0][0] === huge, 'the oversized item is not dropped');
}

// Empty input
assert(chunkByBudget([], size).length === 0, 'empty input yields no batches');

console.log('\n✅ workers-ai batching checks passed');

console.log('\npartsNeeded');
{
  assert(partsNeeded(65_900) === 2, 'a small overflow splits in two');
  assert(partsNeeded(135_630) === 3, 'a 2.3x overflow splits into three');
  assert(partsNeeded(79_764) === 2, 'a 1.3x overflow splits in two');
  assert(partsNeeded(600_000) === 13, 'a 10x overflow splits far enough in one step');
  assert(partsNeeded(60_001) >= 2, 'a one-token overflow still splits');
}

console.log('\nparseContextOverflow');
{
  const real =
    'Workers AI returned status 400: {"errors":[{"message":"AiError: AiError: ' +
    'Max context reached 135630 tokens but model supports only 60000 (938154d0)","code":3030}]}';
  assert(parseContextOverflow(real) === 135630, 'reads the token count from a real error');
  assert(parseContextOverflow('Workers AI returned status 429: slow down') === null, 'ignores unrelated errors');
}

console.log('\n✅ overflow-splitting checks passed');
