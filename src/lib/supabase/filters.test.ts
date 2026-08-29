import { ilikePattern, csArray, pgArrayLiteral } from './filters';

const B = String.fromCharCode(92); // one literal backslash

const eq = (actual: string, expected: string, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
};

// A comma would otherwise start a new OR branch; a quote would end the value.
eq(ilikePattern('Dr. Stone'), '"%Dr. Stone%"', 'plain title is left intact');
eq(ilikePattern('a,b'), '"%a,b%"', 'comma stays inside the quoted value');
eq(ilikePattern('say "hi"'), `"%say ${B}"hi${B}"%"`, 'double quotes get one backslash');

// Wildcards need two backslashes to survive PostgREST's quote unescaping.
eq(ilikePattern('100%'), `"%100${B}${B}%%"`, 'LIKE wildcard % gets two backslashes');
eq(ilikePattern('a_b'), `"%a${B}${B}_b%"`, 'LIKE wildcard _ gets two backslashes');
eq(ilikePattern(`C:${B}path`), `"%C:${B.repeat(4)}path%"`, 'literal backslash gets four');

eq(csArray('One Piece'), '{"One Piece"}', 'array literal is quoted');
eq(csArray('a,b'), '{"a,b"}', 'comma stays inside the array element');

// pgArrayLiteral feeds .not('genres', 'ov', ...), where supabase-js does no
// escaping of its own — an unquoted comma there would split one genre into two.
eq(pgArrayLiteral(['Romance']), '{"Romance"}', 'single element is quoted');
eq(
  pgArrayLiteral(['Romance', 'Ecchi', 'Hentai']),
  '{"Romance","Ecchi","Hentai"}',
  'multiple elements are comma-joined'
);
eq(pgArrayLiteral(['Slice of Life, Etc']), '{"Slice of Life, Etc"}', 'comma stays inside one element');
eq(pgArrayLiteral(['say "hi"']), '{"say ' + B + '"hi' + B + '""}', 'quotes are escaped');
eq(pgArrayLiteral([]), '{}', 'empty list is an empty literal');

console.log('filters: all assertions passed');
