/**
 * Net Vision deterministic numeric taxonomy.
 *
 * The classifier is a pure function. Given a canonical decimal string and
 * a taxonomy version, it returns the same set of structural and cultural
 * traits every time. It cannot call an LLM, an external service, or a
 * mutable database during classification.
 *
 * Cultural collections (meme, lucky, year) are stored as versioned
 * curated lists, not buried in code, so they can be reviewed and updated
 * without changing classifier logic.
 */

export const CURRENT_TAXONOMY_VERSION = 1;

export type TraitFamily =
  | 'digits'
  | 'structure'
  | 'sequence'
  | 'cultural'
  | 'math';

export type NumberTrait = {
  slug: string;
  family: TraitFamily;
  label: string;
  strength?: number;
  metadata?: Record<string, unknown>;
};

export type ClassificationResult = {
  canonical: string;
  digitCount: number;
  traits: NumberTrait[];
  structuralScore: number;
  rarityInputs: Record<string, number | string | boolean>;
  taxonomyVersion: number;
};

// Versioned curated lists. Bump CULTURAL_VERSION when adding or removing
// numbers, and reclassify the collection. Never mutate a published version.
const CULTURAL_VERSION = 1;

const MEME_NUMBERS: ReadonlySet<string> = new Set([
  '69',
  '420',
  '666',
  '1337',
  '6969',
  '8008',
  '80085',
  '1234',
]);

const LUCKY_NUMBERS: ReadonlySet<string> = new Set([
  '7',
  '21',
  '28',
  '33',
  '44',
  '55',
  '77',
  '88',
  '99',
]);

const YEAR_RANGE = { min: 1900, max: 2099 } as const;

/**
 * Canonicalize the input. Strips leading whitespace and a single leading
 * '+'. Rejects scientific notation, hex, and any input that is not a
 * positive integer.
 */
export function canonicalize(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('canonicalize expects a string');
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('empty input');
  }
  if (!/^[+]?\d+$/.test(trimmed)) {
    throw new Error(`non-integer input: ${input}`);
  }
  const digits = trimmed.replace(/^[+]/, '');
  if (digits.length === 0 || /^0+$/.test(digits)) {
    throw new Error('zero or all-zero input is not a positive token number');
  }
  // No leading-zero normalization unless explicitly stored. We strip a
  // single leading zero so "07" and "7" classify identically, which is
  // the behavior the spec calls out as default.
  const stripped = digits.replace(/^0+(?=\d)/, '');
  return stripped;
}

function isPalindrome(s: string): boolean {
  return s === s.split('').reverse().join('');
}

function isRepdigit(s: string): boolean {
  return new Set(s.split('')).size === 1;
}

function uniqueDigitCount(s: string): number {
  return new Set(s.split('')).size;
}

function hasAtLeastKAdjacent(s: string, k: number): boolean {
  if (s.length < k) return false;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    const p = s[i - 1];
    if (c !== undefined && p !== undefined && c === p) {
      run += 1;
      if (run >= k) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function isAscendingSequence(s: string, minLength: number): boolean {
  if (s.length < minLength) return false;
  // The first minLength characters must be strictly +1.
  for (let i = 0; i < s.length - minLength + 1; i++) {
    const window = s.slice(i, i + minLength);
    let ok = true;
    for (let j = 1; j < window.length; j++) {
      const prev = window.charCodeAt(j - 1) - 48;
      const cur = window.charCodeAt(j) - 48;
      if (cur !== prev + 1) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function isDescendingSequence(s: string, minLength: number): boolean {
  if (s.length < minLength) return false;
  for (let i = 0; i < s.length - minLength + 1; i++) {
    const window = s.slice(i, i + minLength);
    let ok = true;
    for (let j = 1; j < window.length; j++) {
      const prev = window.charCodeAt(j - 1) - 48;
      const cur = window.charCodeAt(j) - 48;
      if (cur !== prev - 1) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function isAlternating(s: string): boolean {
  if (s.length < 4) return false;
  // ABAB or ABABA where A != B
  const isAbab = s.length % 2 === 0 && s[0] !== s[1];
  if (isAbab) {
    for (let i = 2; i < s.length; i++) {
      if (s[i] !== s[i - 2]) return false;
    }
    return true;
  }
  return false;
}

function isBookend(s: string): boolean {
  if (s.length < 3) return false;
  if (s[0] !== s[s.length - 1]) return false;
  // Repdigits are excluded; the spec example 7777 is not a bookend even
  // though the first and last digits match, because the structure is
  // already captured by repdigit/triple/quad. This rule matches the
  // spec fixture for 121, 12321, and 10001 while excluding 7777.
  if (isRepdigit(s)) return false;
  return true;
}

function isRound(s: string): boolean {
  // Round numbers end with meaningful trailing zeros. 10, 100, 1000, 10000
  // are round. 1000000 is round. 1001 is not (only one trailing zero preceded
  // by a non-zero). Numbers like 100 are round even if 0 is the only digit
  // aside from the leading 1.
  if (s.length < 2) return false;
  if (!/0+$/.test(s)) return false;
  const trailingZeros = s.match(/0+$/)?.[0].length ?? 0;
  // Require at least one significant digit before the zeros.
  const significant = s.slice(0, s.length - trailingZeros);
  if (significant.length === 0) return false;
  // For 2-digit numbers, require at least 1 trailing zero (so 10 is round, 11 isn't).
  // For longer numbers, require at least 2 trailing zeros to avoid classifying
  // any single-zero suffix as round.
  if (s.length <= 2) return trailingZeros >= 1;
  return trailingZeros >= 2;
}

function isBinaryStyle(s: string): boolean {
  return /^[01]+$/.test(s);
}

function isMirrorSequence(s: string): boolean {
  // A mirror sequence is palindromic and has a structured interior that
  // reverses around a center point (not just a repdigit).
  if (!isPalindrome(s)) return false;
  if (s.length < 4) return false;
  if (isRepdigit(s)) return false;
  return uniqueDigitCount(s) >= 2;
}

function numericValue(s: string): number | null {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function classifyNumber(
  input: string,
  taxonomyVersion: number = CURRENT_TAXONOMY_VERSION,
): ClassificationResult {
  if (taxonomyVersion !== CURRENT_TAXONOMY_VERSION) {
    throw new Error(
      `unsupported taxonomy version ${taxonomyVersion}; expected ${CURRENT_TAXONOMY_VERSION}`,
    );
  }
  const canonical = canonicalize(input);
  const digitCount = canonical.length;
  const traits: NumberTrait[] = [];

  // Digit count
  const digitSlug = `digits-${digitCount}`;
  traits.push({
    slug: digitSlug,
    family: 'digits',
    label: `${digitCount} Digit`,
    strength: 1,
  });

  // Structural
  if (isPalindrome(canonical)) {
    traits.push({ slug: 'palindrome', family: 'structure', label: 'Palindrome', strength: 1 });
  }
  if (isRepdigit(canonical)) {
    traits.push({ slug: 'repdigit', family: 'structure', label: 'Repeating Digits', strength: 1 });
  }
  if (hasAtLeastKAdjacent(canonical, 2) && canonical.length >= 2) {
    if (canonical.length === 2 && isRepdigit(canonical)) {
      traits.push({
        slug: 'double',
        family: 'structure',
        label: 'Doubles',
        strength: 1,
        metadata: { rule: 'exact 2-digit repdigit' },
      });
    } else if (canonical.length >= 3) {
      traits.push({ slug: 'double', family: 'structure', label: 'Doubles', strength: 1 });
    }
  }
  if (hasAtLeastKAdjacent(canonical, 3)) {
    traits.push({ slug: 'triple', family: 'structure', label: 'Triples', strength: 1 });
  }
  if (hasAtLeastKAdjacent(canonical, 4)) {
    traits.push({ slug: 'quad', family: 'structure', label: 'Quads', strength: 1 });
  }
  if (isAscendingSequence(canonical, 4)) {
    traits.push({
      slug: 'ascending',
      family: 'sequence',
      label: 'Ascending Sequence',
      strength: 1,
    });
  }
  if (isDescendingSequence(canonical, 4)) {
    traits.push({
      slug: 'descending',
      family: 'sequence',
      label: 'Descending Sequence',
      strength: 1,
    });
  }
  if (isAlternating(canonical)) {
    traits.push({
      slug: 'alternating',
      family: 'sequence',
      label: 'Alternating',
      strength: 1,
    });
  }
  if (isBookend(canonical)) {
    traits.push({ slug: 'bookend', family: 'structure', label: 'Bookends', strength: 1 });
  }
  if (isRound(canonical)) {
    traits.push({ slug: 'round', family: 'math', label: 'Round Number', strength: 1 });
  }
  if (isMirrorSequence(canonical)) {
    traits.push({
      slug: 'mirror-sequence',
      family: 'sequence',
      label: 'Mirror Sequence',
      strength: 1,
    });
  }
  if (isBinaryStyle(canonical)) {
    traits.push({ slug: 'binary-style', family: 'structure', label: 'Binary Style', strength: 1 });
  }

  // Cultural (versioned curated sets)
  if (MEME_NUMBERS.has(canonical)) {
    traits.push({
      slug: 'meme',
      family: 'cultural',
      label: 'Meme Number',
      strength: 1,
      metadata: { curatedVersion: CULTURAL_VERSION },
    });
  }
  if (LUCKY_NUMBERS.has(canonical)) {
    traits.push({
      slug: 'lucky',
      family: 'cultural',
      label: 'Lucky Number',
      strength: 1,
      metadata: { curatedVersion: CULTURAL_VERSION },
    });
  }

  const asNumber = numericValue(canonical);
  if (
    asNumber !== null &&
    asNumber >= YEAR_RANGE.min &&
    asNumber <= YEAR_RANGE.max &&
    // Only classify 3- and 4-digit years; 2-digit "25" is too ambiguous.
    (canonical.length === 3 || canonical.length === 4)
  ) {
    traits.push({
      slug: 'year',
      family: 'cultural',
      label: 'Year',
      strength: 1,
      metadata: { range: YEAR_RANGE },
    });
  }

  // Deduplicate trait slugs while preserving first occurrence.
  const seen = new Set<string>();
  const deduped: NumberTrait[] = [];
  for (const t of traits) {
    if (seen.has(t.slug)) continue;
    seen.add(t.slug);
    deduped.push(t);
  }

  const structuralScore = computeStructuralScore(deduped);

  return {
    canonical,
    digitCount,
    traits: deduped,
    structuralScore,
    rarityInputs: {
      digitCount,
      traitCount: deduped.length,
      isPalindrome: isPalindrome(canonical),
      isRepdigit: isRepdigit(canonical),
      isRound: isRound(canonical),
    },
    taxonomyVersion,
  };
}

function computeStructuralScore(traits: NumberTrait[]): number {
  // A simple weighted score so the UI has something meaningful to show.
  // The full rarity model uses empirical membership counts, which are
  // populated by the indexer and live in the database. The classifier
  // returns a trait-only baseline here.
  const weights: Record<string, number> = {
    'digits-1': 40,
    'digits-2': 20,
    'digits-3': 10,
    'digits-4': 5,
    'digits-5': 2,
    palindrome: 8,
    repdigit: 6,
    bookend: 4,
    round: 3,
    ascending: 5,
    descending: 5,
    alternating: 4,
    'mirror-sequence': 6,
    'binary-style': 3,
    meme: 2,
    lucky: 1,
    year: 1,
  };
  let score = 0;
  for (const t of traits) {
    const w = weights[t.slug] ?? 1;
    score += w;
  }
  return score;
}

export const VIRTUAL_COLLECTION_CATALOG = [
  { slug: 'digits-1', name: '1 Digit', family: 'digits' as const, description: 'Tokens numbered 1 through 9.' },
  { slug: 'digits-2', name: '2 Digit', family: 'digits' as const, description: 'Tokens numbered 10 through 99.' },
  { slug: 'digits-3', name: '3 Digit', family: 'digits' as const, description: 'Tokens numbered 100 through 999.' },
  { slug: 'digits-4', name: '4 Digit', family: 'digits' as const, description: 'Tokens numbered 1,000 through 9,999.' },
  { slug: 'digits-5', name: '5 Digit', family: 'digits' as const, description: 'Tokens numbered 10,000 through 99,999.' },
  { slug: 'palindrome', name: 'Palindromes', family: 'structure' as const, description: 'Numbers that read the same forwards and backwards.' },
  { slug: 'repdigit', name: 'Repeating Digits', family: 'structure' as const, description: 'Numbers made of one repeated digit (11, 222, 7777).' },
  { slug: 'double', name: 'Doubles', family: 'structure' as const, description: 'Two identical adjacent digits.' },
  { slug: 'triple', name: 'Triples', family: 'structure' as const, description: 'Three or more identical adjacent digits.' },
  { slug: 'quad', name: 'Quads', family: 'structure' as const, description: 'Four or more identical adjacent digits.' },
  { slug: 'ascending', name: 'Ascending Sequences', family: 'sequence' as const, description: 'Strictly ascending digit runs (1234, 6789).' },
  { slug: 'descending', name: 'Descending Sequences', family: 'sequence' as const, description: 'Strictly descending digit runs (4321, 9876).' },
  { slug: 'alternating', name: 'Alternating', family: 'sequence' as const, description: 'ABAB-style alternating patterns (6969, 1010).' },
  { slug: 'bookend', name: 'Bookends', family: 'structure' as const, description: 'First and last digits match with a nontrivial interior.' },
  { slug: 'round', name: 'Round Numbers', family: 'math' as const, description: 'Numbers with meaningful trailing zeros.' },
  { slug: 'meme', name: 'Meme Numbers', family: 'cultural' as const, description: 'Curated culturally resonant numbers (69, 420, 1337).' },
  { slug: 'lucky', name: 'Lucky Numbers', family: 'cultural' as const, description: 'Curated culturally lucky numbers.' },
  { slug: 'year', name: 'Years', family: 'cultural' as const, description: 'Numbers in the configured year range.' },
  { slug: 'binary-style', name: 'Binary Style', family: 'structure' as const, description: 'Numbers made up of only 0 and 1.' },
  { slug: 'mirror-sequence', name: 'Mirror Sequences', family: 'sequence' as const, description: 'Palindromes with structured interior variation.' },
] as const;

export type VirtualCollectionSlug = (typeof VIRTUAL_COLLECTION_CATALOG)[number]['slug'];

export function getVirtualCollection(slug: string) {
  return VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug) ?? null;
}
