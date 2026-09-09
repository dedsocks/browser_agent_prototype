import { describe, it, expect } from "vitest";
import {
  stripZeroWidth,
  mapHomoglyphs,
  normalizeUnicode,
  normalizeAdversarial
} from "../../src/privacy/normalizer.js";

describe("Adversarial Normalizer", () => {
  it("strips zero-width characters and invisible marks", () => {
    // 1234\u200B5678\uFEFF90
    const dirty = "1234\u200B5678\uFEFF90\u200D";
    expect(stripZeroWidth(dirty)).toBe("1234567890");
  });

  it("normalizes full-width Unicode characters via NFKC", () => {
    // Fullwidth digits: １２３４
    const fullWidth = "１２３４ ５６７８";
    expect(normalizeUnicode(fullWidth)).toBe("1234 5678");
  });

  it("maps Cyrillic homoglyphs to Latin equivalents", () => {
    // Cyrillic 'а', 'е', 'о', 'р', 'с'
    const cyrillicMixed = "p\u0430ssw\u043erd"; // p(а)ssw(о)rd
    expect(mapHomoglyphs(cyrillicMixed)).toBe("password");
  });

  it("handles complex adversarial evasions combining zero-width, full-width, and homoglyphs", () => {
    // Adversarial payment card or email
    const adversarialEmail = "u\u200Bs\u0435r@\uFF45xample.c\u043Em"; // user with zero-width, cyrillic e, fullwidth e, cyrillic o
    const normalized = normalizeAdversarial(adversarialEmail);
    expect(normalized).toBe("user@example.com");
  });

  it("handles empty or falsy inputs gracefully", () => {
    expect(normalizeAdversarial("")).toBe("");
    expect(stripZeroWidth("")).toBe("");
    expect(mapHomoglyphs("")).toBe("");
  });
});
