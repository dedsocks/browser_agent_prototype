import { describe, it, expect } from "vitest";
import { detectPiiInText } from "../../../src/privacy/regex-engine.js";
import { RedactionCategory } from "../../../src/common/types.js";

interface BenchmarkSample {
  text: string;
  expectedCategory?: RedactionCategory;
  isPii: boolean;
}

const BENCHMARK_DATASET: BenchmarkSample[] = [
  // Financial - True Positives
  { text: "Visa payment card 4532015112830366", expectedCategory: RedactionCategory.FINANCIAL, isPii: true },
  { text: "Mastercard test 5425233430109903", expectedCategory: RedactionCategory.FINANCIAL, isPii: true },
  { text: "Amex card 378282246310005", expectedCategory: RedactionCategory.FINANCIAL, isPii: true },
  { text: "Discover card 6011000990139424", expectedCategory: RedactionCategory.FINANCIAL, isPii: true },
  { text: "Formatted card 4532-0151-1283-0366", expectedCategory: RedactionCategory.FINANCIAL, isPii: true },

  // Identity - True Positives
  { text: "US SSN 123-45-6789", expectedCategory: RedactionCategory.IDENTITY, isPii: true },
  { text: "Indian PAN ABCDE1234F", expectedCategory: RedactionCategory.IDENTITY, isPii: true },
  { text: "Indian PAN BNZPK4921L", expectedCategory: RedactionCategory.IDENTITY, isPii: true },

  // Contact - True Positives
  { text: "Email test user.name+tag@sub.domain.org", expectedCategory: RedactionCategory.CONTACT, isPii: true },
  { text: "Officer email: privacy@governance.eu", expectedCategory: RedactionCategory.CONTACT, isPii: true },
  { text: "Phone +1 (555) 234-5678", expectedCategory: RedactionCategory.CONTACT, isPii: true },

  // Credentials - True Positives
  { text: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ90123456789", expectedCategory: RedactionCategory.CREDENTIAL, isPii: true },
  { text: "sk-live98765432101234567890abcdef", expectedCategory: RedactionCategory.CREDENTIAL, isPii: true },

  // Negative Controls (Should NOT be detected as PII)
  { text: "Product SKU: SKU-9876-XYZ", isPii: false },
  { text: "Order confirmation #98721345", isPii: false },
  { text: "Page count: 453 items in catalog", isPii: false },
  { text: "Invalid card 4532015112830367 failing Luhn", isPii: false },
  { text: "Bogus SSN 000-12-3456", isPii: false },
  { text: "Zip code 90210-1234", isPii: false },
  { text: "HTTP status code 200 OK", isPii: false }
];

describe("Demographic & Pattern Parity Benchmark", () => {
  it("achieves >= 95% Precision and Recall across benchmarked PII categories", () => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let trueNegatives = 0;

    for (const sample of BENCHMARK_DATASET) {
      const detections = detectPiiInText(sample.text);
      const detected = detections.length > 0;

      if (sample.isPii) {
        if (detected) {
          truePositives++;
          if (sample.expectedCategory) {
            expect(detections[0].category).toBe(sample.expectedCategory);
          }
        } else {
          falseNegatives++;
        }
      } else {
        if (detected) {
          falsePositives++;
        } else {
          trueNegatives++;
        }
      }
    }

    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / (truePositives + falseNegatives);
    const fnr = falseNegatives / (truePositives + falseNegatives);

    console.log(`[Benchmark] Precision: ${(precision * 100).toFixed(2)}% | Recall: ${(recall * 100).toFixed(2)}% | FNR: ${(fnr * 100).toFixed(2)}%`);

    expect(precision).toBeGreaterThanOrEqual(0.95);
    expect(recall).toBeGreaterThanOrEqual(0.95);
    expect(fnr).toBeLessThanOrEqual(0.05);
  });
});
