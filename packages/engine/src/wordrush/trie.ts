/**
 * A compact prefix tree over lowercase a-z words, stored in typed arrays so a
 * full ~170k-word dictionary fits in a few megabytes on a phone.
 *
 * Each node has a letter, a first-child pointer and a next-sibling pointer.
 */

export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 16;

const NONE = -1;
const A = 97;
const Z = 122;

export interface Dictionary {
  /** Index of the root node. */
  readonly root: number;
  /** Number of distinct words. */
  readonly size: number;
  /** Child of `node` for one letter, or -1. */
  child(node: number, letter: string): number;
  isWord(node: number): boolean;
  has(word: string): boolean;
}

class CompactTrie implements Dictionary {
  readonly root = 0;
  size = 0;
  private count = 1;
  private letter: Uint8Array;
  private first: Int32Array;
  private next: Int32Array;
  private word: Uint8Array;

  constructor(capacity = 1 << 16) {
    this.letter = new Uint8Array(capacity);
    this.first = new Int32Array(capacity).fill(NONE);
    this.next = new Int32Array(capacity).fill(NONE);
    this.word = new Uint8Array(capacity);
  }

  private grow(): void {
    const cap = this.letter.length * 2;
    const letter = new Uint8Array(cap);
    letter.set(this.letter);
    const first = new Int32Array(cap).fill(NONE);
    first.set(this.first);
    const next = new Int32Array(cap).fill(NONE);
    next.set(this.next);
    const word = new Uint8Array(cap);
    word.set(this.word);
    this.letter = letter;
    this.first = first;
    this.next = next;
    this.word = word;
  }

  private childCode(node: number, code: number): number {
    let c = this.first[node] ?? NONE;
    while (c !== NONE) {
      if (this.letter[c] === code) return c;
      c = this.next[c] ?? NONE;
    }
    return NONE;
  }

  /** Insert a word already known to be lowercase a-z. Returns true if it was new. */
  insert(word: string): boolean {
    let node = this.root;
    for (let i = 0; i < word.length; i++) {
      const code = word.charCodeAt(i);
      let c = this.childCode(node, code);
      if (c === NONE) {
        if (this.count >= this.letter.length) this.grow();
        c = this.count++;
        this.letter[c] = code;
        this.next[c] = this.first[node] ?? NONE;
        this.first[node] = c;
      }
      node = c;
    }
    if (this.word[node]) return false;
    this.word[node] = 1;
    this.size++;
    return true;
  }

  child(node: number, letter: string): number {
    if (node === NONE) return NONE;
    let cur = node;
    for (let i = 0; i < letter.length; i++) {
      cur = this.childCode(cur, letter.charCodeAt(i));
      if (cur === NONE) return NONE;
    }
    return cur;
  }

  isWord(node: number): boolean {
    return node !== NONE && this.word[node] === 1;
  }

  has(word: string): boolean {
    return this.isWord(this.child(this.root, word.toLowerCase()));
  }

  /** Approximate memory used, in bytes. */
  get bytes(): number {
    return this.count * 10;
  }
}

function isPlainWord(w: string): boolean {
  if (w.length < MIN_WORD_LENGTH || w.length > MAX_WORD_LENGTH) return false;
  for (let i = 0; i < w.length; i++) {
    const c = w.charCodeAt(i);
    if (c < A || c > Z) return false;
  }
  return true;
}

/**
 * Build a dictionary from raw words (an iterable, or a newline-separated string).
 * Words are lower-cased; anything outside a-z or outside 3–16 letters is dropped.
 * Words in `blocklist` (e.g. slurs) are excluded.
 */
export function buildDictionary(source: string | Iterable<string>, blocklist?: Iterable<string>): Dictionary {
  const words = typeof source === 'string' ? source.split(/\r?\n/) : source;
  const blocked = new Set<string>();
  if (blocklist) for (const b of blocklist) blocked.add(b.trim().toLowerCase());
  const trie = new CompactTrie();
  for (const raw of words) {
    const w = raw.trim().toLowerCase();
    if (!isPlainWord(w) || blocked.has(w)) continue;
    trie.insert(w);
  }
  return trie;
}

/** Walk from `node` along `letters`; returns the node reached, or -1. */
export function walk(dict: Dictionary, node: number, letters: string): number {
  return dict.child(node, letters);
}
