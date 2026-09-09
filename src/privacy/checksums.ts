/**
 * Checksum verification algorithms for PII detection.
 * Luhn: Payment cards (Visa, Mastercard, Amex, Discover, etc.)
 * Verhoeff: Indian Aadhaar numbers and other national IDs
 */

/**
 * Validates a number string using the Luhn (Mod 10) algorithm.
 * Automatically ignores formatting characters (spaces, hyphens).
 */
export function validateLuhn(input: string): boolean {
  const sanitized = input.replace(/\D/g, "");
  if (sanitized.length < 13 || sanitized.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// Verhoeff multiplication table (d)
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Verhoeff permutation table (p)
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

// Verhoeff inverse table (inv)
const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validates a number string using the Verhoeff dihedral algorithm.
 * Commonly used for Indian Aadhaar 12-digit numbers.
 */
export function validateVerhoeff(input: string): boolean {
  const sanitized = input.replace(/\D/g, "");
  if (sanitized.length === 0) return false;

  let c = 0;
  // Reverse the string and iterate
  for (let i = 0; i < sanitized.length; i++) {
    const digit = parseInt(sanitized.charAt(sanitized.length - 1 - i), 10);
    if (isNaN(digit)) return false;
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]];
  }

  return c === 0;
}

/**
 * Computes the Verhoeff check digit for a given base number string.
 */
export function computeVerhoeffCheckDigit(base: string): number {
  const sanitized = base.replace(/\D/g, "");
  let c = 0;
  for (let i = 0; i < sanitized.length; i++) {
    const digit = parseInt(sanitized.charAt(sanitized.length - 1 - i), 10);
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][digit]];
  }
  return VERHOEFF_INV[c];
}
