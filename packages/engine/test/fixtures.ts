import { buildDictionary } from '../src/wordrush/trie';

/** A small word list for tests. Production uses the full list in data/words.txt. */
export const TEST_WORDS = [
  'cat', 'cats', 'act', 'acts', 'scat', 'tea', 'teas', 'eat', 'eats', 'ate', 'seat', 'east', 'sate',
  'rat', 'rats', 'art', 'arts', 'star', 'tars', 'tar', 'set', 'sea', 'sear', 'rest', 'tears', 'stare',
  'rate', 'rates', 'treat', 'trees', 'tree', 'steer', 'reset', 'aster', 'crate', 'crates', 'caster',
  'react', 'reacts', 'trace', 'traces', 'cast', 'case', 'race', 'races', 'care', 'cares', 'scare',
  'queen', 'quit', 'quite',
];

export const testDict = buildDictionary(TEST_WORDS);
