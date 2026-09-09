import { describe, it, expect } from "vitest";
import { detectPiiInText, detectPiiInElement, TextPiiMatch } from "../../src/privacy/regex-engine.js";
import { validateVerhoeff } from "../../src/privacy/checksums.js";
import { RedactionCategory } from "../../src/common/types.js";

describe("PII Regex Engine", () => {
  describe("Financial PII (Cards & CVV)", () => {
    it("detects valid payment card numbers across major networks", () => {
      const text = "Please charge my Visa 4532-0151-1283-0366 or Amex 378282246310005 today.";
      const detections = detectPiiInText(text);

      const financialDetections = detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.FINANCIAL);
      expect(financialDetections.length).toBe(2);
      expect(financialDetections.map((d: TextPiiMatch) => d.text)).toContain("4532-0151-1283-0366");
      expect(financialDetections.map((d: TextPiiMatch) => d.text)).toContain("378282246310005");
    });

    it("rejects false-positive digit sequences failing Luhn check", () => {
      const text = "Reference number: 4532-0151-1283-0367 (invalid card)";
      const detections = detectPiiInText(text);
      expect(detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.FINANCIAL)).toHaveLength(0);
    });
  });

  describe("Identity PII (SSN, PAN, Aadhaar)", () => {
    it("detects valid US Social Security Numbers (SSN)", () => {
      const text = "Taxpayer SSN is 123-45-6789 or 987654321.";
      const detections = detectPiiInText(text);
      const identityDetections = detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.IDENTITY);
      expect(identityDetections.length).toBeGreaterThanOrEqual(1);
      expect(identityDetections.map((d: TextPiiMatch) => d.text)).toContain("123-45-6789");
    });

    it("rejects invalid SSN prefixes (000, 666, 900+)", () => {
      const text = "Bogus numbers: 000-12-3456 and 666-12-3456";
      const detections = detectPiiInText(text);
      expect(detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.IDENTITY)).toHaveLength(0);
    });

    it("detects valid Indian PAN numbers", () => {
      const text = "Client PAN is ABCDE1234F for filing.";
      const detections = detectPiiInText(text);
      const pan = detections.find((d: TextPiiMatch) => d.text === "ABCDE1234F");
      expect(pan).toBeDefined();
      expect(pan?.category).toBe(RedactionCategory.IDENTITY);
    });

    it("detects Indian Aadhaar with Verhoeff validation", () => {
      const base = "99999999001";
      const validAadhaar = `9999 9999 001${(base.length ? (validateVerhoeff(base + "3") ? "3" : "1") : "")}`;
      // Compute actual valid Aadhaar:
      let check = 0;
      for (let d = 0; d <= 9; d++) {
        if (validateVerhoeff(base + d)) {
          check = d;
          break;
        }
      }
      const testAadhaar = `9999 9999 001${check}`;
      const detections = detectPiiInText(`ID: ${testAadhaar}`);
      expect(detections.some((d: TextPiiMatch) => d.category === RedactionCategory.IDENTITY && d.text === testAadhaar)).toBe(true);

      const invalidAadhaar = `9999 9999 001${(check + 1) % 10}`;
      const invalidDetections = detectPiiInText(`ID: ${invalidAadhaar}`);
      expect(invalidDetections.filter((d: TextPiiMatch) => d.category === RedactionCategory.IDENTITY)).toHaveLength(0);
    });
  });

  describe("Contact PII (Email & Phone)", () => {
    it("detects email addresses", () => {
      const text = "Contact agent at privacy.officer@domain.co.uk or test_1@sub.org.";
      const detections = detectPiiInText(text);
      const contactDetections = detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.CONTACT);
      expect(contactDetections.length).toBe(2);
      expect(contactDetections.map((d: TextPiiMatch) => d.text)).toContain("privacy.officer@domain.co.uk");
      expect(contactDetections.map((d: TextPiiMatch) => d.text)).toContain("test_1@sub.org");
    });

    it("detects international and domestic phone numbers", () => {
      const text = "Call +1 (555) 234-5678 or +44 20 7946 0958.";
      const detections = detectPiiInText(text);
      const phones = detections.filter((d: TextPiiMatch) => d.category === RedactionCategory.CONTACT);
      expect(phones.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Credentials & Secrets", () => {
    it("detects credential input fields by attribute inspection", () => {
      const input = document.createElement("input");
      input.type = "password";
      input.value = "SuperSecret123!";
      input.name = "user_pass";

      const detection = detectPiiInElement(input);
      expect(detection).toBeDefined();
      expect(detection?.category).toBe(RedactionCategory.CREDENTIAL);
    });

    it("detects high entropy tokens and API keys in text", () => {
      const text = "Bearer sk-test98765432101234567890abcdef";
      const detections = detectPiiInText(text);
      const cred = detections.find((d: TextPiiMatch) => d.category === RedactionCategory.CREDENTIAL);
      expect(cred).toBeDefined();
    });
  });
});
