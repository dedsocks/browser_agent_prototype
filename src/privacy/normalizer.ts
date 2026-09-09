/**
 * Adversarial Input Normalizer
 * Enforces NFKC normalization, homoglyph mapping, and zero-width character stripping
 * per Constitution Principle VI (Bias Mitigation & Adversarial Robustness).
 */

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F\u202A-\u202E\u180E]/g;

// Common Cyrillic & Greek homoglyphs used in evasion attacks
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lowercase
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w",
  // Cyrillic uppercase
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
  "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I", "Ј": "J", "Ѕ": "S",
  // Greek lowercase
  "α": "a", "β": "b", "ε": "e", "ι": "i", "κ": "k", "ο": "o", "ρ": "p",
  "τ": "t", "υ": "u", "ν": "v", "χ": "x",
  // Greek uppercase
  "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K",
  "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X"
};

const HOMOGLYPH_REGEX = new RegExp(Object.keys(HOMOGLYPH_MAP).join("|"), "g");

/**
 * Strips zero-width and invisible control characters.
 */
export function stripZeroWidth(input: string): string {
  if (!input) return "";
  return input.replace(ZERO_WIDTH_REGEX, "");
}

/**
 * Replaces known homoglyphs (Cyrillic, Greek) with their Latin equivalents.
 */
export function mapHomoglyphs(input: string): string {
  if (!input) return "";
  return input.replace(HOMOGLYPH_REGEX, (match) => HOMOGLYPH_MAP[match] || match);
}

/**
 * Applies Unicode NFKC normalization.
 */
export function normalizeUnicode(input: string): string {
  if (!input) return "";
  return input.normalize("NFKC");
}

/**
 * Full adversarial normalization pipeline:
 * 1. Unicode NFKC normalization
 * 2. Zero-width character stripping
 * 3. Homoglyph mapping
 */
export function normalizeAdversarial(input: string): string {
  if (!input) return "";
  const nfkc = normalizeUnicode(input);
  const stripped = stripZeroWidth(nfkc);
  return mapHomoglyphs(stripped);
}
