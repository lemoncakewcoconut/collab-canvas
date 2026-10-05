/**
 * Fractional Indexing Implementation
 * Deterministic string-based fractional index keys for concurrent z-ordering without collisions.
 */

const BASE_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SMALLEST_CHAR = BASE_DIGITS[0];
const LARGEST_CHAR = BASE_DIGITS[BASE_DIGITS.length - 1];
const MID_CHAR = BASE_DIGITS[Math.floor(BASE_DIGITS.length / 2)];

/**
 * Compare two fractional index strings
 */
export function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Generates a string key strictly between `a` and `b` in lexicographic order.
 * If a is null/undefined, generates a key before b.
 * If b is null/undefined, generates a key after a.
 * If both are null/undefined, returns a midpoint key.
 */
export function generateKeyBetween(a: string | null | undefined, b: string | null | undefined): string {
  const left = a ?? '';
  const right = b ?? '';

  if (left && right && left >= right) {
    throw new Error(`Invalid bounds: '${left}' must be strictly less than '${right}'`);
  }

  // Case 1: Both empty
  if (!left && !right) {
    return 'a0';
  }

  // Case 2: Left empty (prepend before right)
  if (!left && right) {
    for (let i = 0; i < right.length; i++) {
      const char = right[i];
      const charIdx = BASE_DIGITS.indexOf(char);
      if (charIdx > 0) {
        // Find midpoint between SMALLEST_CHAR and char
        const midIdx = Math.floor(charIdx / 2);
        return right.slice(0, i) + BASE_DIGITS[midIdx];
      }
    }
    return SMALLEST_CHAR + 'V';
  }

  // Case 3: Right empty (append after left)
  if (left && !right) {
    const lastChar = left[left.length - 1];
    const lastIdx = BASE_DIGITS.indexOf(lastChar);
    if (lastIdx < BASE_DIGITS.length - 1) {
      const midIdx = Math.floor((lastIdx + BASE_DIGITS.length) / 2);
      return left.slice(0, -1) + BASE_DIGITS[midIdx];
    }
    return left + 'V';
  }

  // Case 4: Both present (left < right)
  let prefix = '';
  let i = 0;
  while (i < left.length && i < right.length && left[i] === right[i]) {
    prefix += left[i];
    i++;
  }

  const leftChar = i < left.length ? left[i] : SMALLEST_CHAR;
  const rightChar = i < right.length ? right[i] : LARGEST_CHAR;

  const leftIdx = BASE_DIGITS.indexOf(leftChar);
  const rightIdx = BASE_DIGITS.indexOf(rightChar);

  if (rightIdx - leftIdx > 1) {
    const midIdx = Math.floor((leftIdx + rightIdx) / 2);
    return prefix + BASE_DIGITS[midIdx];
  }

  // If contiguous characters, extend using left's remainder or append
  if (i < left.length) {
    return left + 'V';
  }

  return prefix + leftChar + 'V';
}

/**
 * Generate N keys between `a` and `b`
 */
export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number
): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateKeyBetween(a, b)];

  const keys: string[] = [];
  let prev = a;
  for (let i = 0; i < n; i++) {
    // Generate key between prev and b
    const next = generateKeyBetween(prev, b);
    keys.push(next);
    prev = next;
  }
  return keys;
}
