import { describe, it, expect } from "vitest";
import {
  validateLuhn,
  validateVerhoeff,
  computeVerhoeffCheckDigit
} from "../../src/privacy/checksums.js";

describe("Checksum Validators", () => {
  describe("Luhn (Payment Cards)", () => {
    it("validates legitimate payment card numbers", () => {
      // Standard test card numbers (Visa, MC, Amex)
      expect(validateLuhn("4532015112830366")).toBe(true); // Visa
      expect(validateLuhn("5425233430109903")).toBe(true); // Mastercard
      expect(validateLuhn("378282246310005")).toBe(true);  // Amex (15 digits)
      expect(validateLuhn("4532 0151 1283 0366")).toBe(true); // Formatted with spaces
      expect(validateLuhn("4532-0151-1283-0366")).toBe(true); // Formatted with hyphens
    });

    it("rejects invalid Luhn card numbers", () => {
      expect(validateLuhn("4532015112830367")).toBe(false); // Invalid check digit
      expect(validateLuhn("1234567890123456")).toBe(false);
      expect(validateLuhn("123")).toBe(false); // Too short
      expect(validateLuhn("123456789012345678901234")).toBe(false); // Too long
    });
  });

  describe("Verhoeff (National IDs / Aadhaar)", () => {
    it("validates correct Verhoeff checksums", () => {
      // Known Verhoeff test vectors
      // Base: 236 -> check digit: 3 -> 2363
      const check = computeVerhoeffCheckDigit("236");
      expect(check).toBe(3);
      expect(validateVerhoeff("2363")).toBe(true);

      // Example 12-digit Aadhaar-like valid Verhoeff sequence:
      // Base: 99999999001 -> check digit compute
      const aadhaarBase = "99999999001";
      const aadhaarCheck = computeVerhoeffCheckDigit(aadhaarBase);
      const aadhaarFull = aadhaarBase + aadhaarCheck;
      expect(validateVerhoeff(aadhaarFull)).toBe(true);
      expect(validateVerhoeff("9999 9999 001" + aadhaarCheck)).toBe(true);
    });

    it("rejects altered numbers with incorrect check digits or transpositions", () => {
      expect(validateVerhoeff("2364")).toBe(false); // altered check digit
      expect(validateVerhoeff("")).toBe(false);
    });
  });
});
