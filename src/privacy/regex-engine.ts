/**
 * High-Precision Regex & Algorithmic Detection Engine
 * Detects financial, identity, contact, and credential PII.
 * Enforces Luhn and Verhoeff validation and adversarial normalization.
 */

import { RedactionCategory } from "../common/types.js";
import { validateLuhn, validateVerhoeff } from "./checksums.js";
import { normalizeAdversarial } from "./normalizer.js";

export interface TextPiiMatch {
  text: string;
  category: RedactionCategory;
  index: number;
  length: number;
  confidence: number;
}

export interface ElementPiiMatch {
  category: RedactionCategory;
  confidence: number;
  reason: string;
}

// Regex Patterns
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const US_SSN_REGEX = /\b(?!000|666|9\d{2})(\d{3})[- ]?(?!00)(\d{2})[- ]?(?!0000)(\d{4})\b/g;
const INDIAN_PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const AADHAAR_CANDIDATE_REGEX = /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g;
const CARD_CANDIDATE_REGEX = /\b(?:\d[ -]?){13,19}\b/g;
// Phone regex: International with + or formatted North American with separators (e.g. +1 555-234-5678, (555) 234-5678)
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s][2-9]\d{2}[-.\s]\d{4}\b|(?:\+\d{1,4}[-.\s]?)?\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b|\+\d{1,4}[-.\s]?\d{6,14}\b/g;
const SECRET_TOKEN_REGEX = /\b(?:bearer\s+[a-zA-Z0-9_.~+/-]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36})\b/gi;
const ZIP_PLUS_FOUR_REGEX = /\b\d{5}-\d{4}\b/;

/**
 * Detects all instances of PII in free text with normalization and checksum validation.
 */
export function detectPiiInText(rawText: string): TextPiiMatch[] {
  if (!rawText) return [];

  const text = normalizeAdversarial(rawText);
  const matches: TextPiiMatch[] = [];
  const rejectedLongSequences: Array<{ start: number; end: number }> = [];

  // 1. Payment Cards (with Luhn)
  let cardMatch: RegExpExecArray | null;
  CARD_CANDIDATE_REGEX.lastIndex = 0;
  while ((cardMatch = CARD_CANDIDATE_REGEX.exec(text)) !== null) {
    const candidate = cardMatch[0].trim();
    const digitsOnly = candidate.replace(/\D/g, "");
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      if (validateLuhn(digitsOnly)) {
        matches.push({
          text: candidate,
          category: RedactionCategory.FINANCIAL,
          index: cardMatch.index,
          length: candidate.length,
          confidence: 0.99
        });
      } else {
        // Track rejected long sequences so phone regex doesn't falsely match sub-slices of failed cards
        rejectedLongSequences.push({
          start: cardMatch.index,
          end: cardMatch.index + candidate.length
        });
      }
    }
  }

  // 2. US SSN
  let ssnMatch: RegExpExecArray | null;
  US_SSN_REGEX.lastIndex = 0;
  while ((ssnMatch = US_SSN_REGEX.exec(text)) !== null) {
    const candidate = ssnMatch[0].trim();
    if (!matches.some(m => m.index <= ssnMatch!.index && ssnMatch!.index < m.index + m.length)) {
      matches.push({
        text: candidate,
        category: RedactionCategory.IDENTITY,
        index: ssnMatch.index,
        length: candidate.length,
        confidence: 0.95
      });
    }
  }

  // 3. Indian PAN
  let panMatch: RegExpExecArray | null;
  INDIAN_PAN_REGEX.lastIndex = 0;
  while ((panMatch = INDIAN_PAN_REGEX.exec(text)) !== null) {
    const candidate = panMatch[0];
    matches.push({
      text: candidate,
      category: RedactionCategory.IDENTITY,
      index: panMatch.index,
      length: candidate.length,
      confidence: 0.98
    });
  }

  // 4. Indian Aadhaar (with Verhoeff)
  let aadhaarMatch: RegExpExecArray | null;
  AADHAAR_CANDIDATE_REGEX.lastIndex = 0;
  while ((aadhaarMatch = AADHAAR_CANDIDATE_REGEX.exec(text)) !== null) {
    const candidate = aadhaarMatch[0].trim();
    const digitsOnly = candidate.replace(/\D/g, "");
    if (digitsOnly.length === 12 && validateVerhoeff(digitsOnly)) {
      if (!matches.some(m => m.index <= aadhaarMatch!.index && aadhaarMatch!.index < m.index + m.length)) {
        matches.push({
          text: candidate,
          category: RedactionCategory.IDENTITY,
          index: aadhaarMatch.index,
          length: candidate.length,
          confidence: 0.95
        });
      }
    }
  }

  // 5. Email Addresses
  let emailMatch: RegExpExecArray | null;
  EMAIL_REGEX.lastIndex = 0;
  while ((emailMatch = EMAIL_REGEX.exec(text)) !== null) {
    const candidate = emailMatch[0];
    matches.push({
      text: candidate,
      category: RedactionCategory.CONTACT,
      index: emailMatch.index,
      length: candidate.length,
      confidence: 0.99
    });
  }

  // 6. Secret Tokens & Credentials
  let secretMatch: RegExpExecArray | null;
  SECRET_TOKEN_REGEX.lastIndex = 0;
  while ((secretMatch = SECRET_TOKEN_REGEX.exec(text)) !== null) {
    const candidate = secretMatch[0];
    matches.push({
      text: candidate,
      category: RedactionCategory.CREDENTIAL,
      index: secretMatch.index,
      length: candidate.length,
      confidence: 0.95
    });
  }

  // 7. Phone Numbers
  let phoneMatch: RegExpExecArray | null;
  PHONE_REGEX.lastIndex = 0;
  while ((phoneMatch = PHONE_REGEX.exec(text)) !== null) {
    const candidate = phoneMatch[0].trim();
    const idx = phoneMatch.index;

    // Discard if it is a standard US Zip+4 code (e.g. 90210-1234)
    if (ZIP_PLUS_FOUR_REGEX.test(candidate)) {
      continue;
    }

    // Discard if overlapping with any rejected card sequence
    const insideRejectedCard = rejectedLongSequences.some(
      r => (idx >= r.start && idx < r.end) || (r.start >= idx && r.start < idx + candidate.length)
    );
    if (insideRejectedCard) continue;

    const digitsOnly = candidate.replace(/\D/g, "");
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      const overlaps = matches.some(
        m => (idx >= m.index && idx < m.index + m.length) || (m.index >= idx && m.index < idx + candidate.length)
      );
      if (!overlaps) {
        matches.push({
          text: candidate,
          category: RedactionCategory.CONTACT,
          index: idx,
          length: candidate.length,
          confidence: 0.90
        });
      }
    }
  }

  return matches;
}

/**
 * Inspects a DOM element (inputs, textareas, etc.) for credential and financial signals.
 */
export function detectPiiInElement(el: HTMLElement): ElementPiiMatch | null {
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const autocomplete = (el.autocomplete || "").toLowerCase();
    const placeholder = (el.placeholder || "").toLowerCase();

    // Credential checks
    if (type === "password" || autocomplete.includes("password") || name.includes("pass") || id.includes("pass")) {
      return {
        category: RedactionCategory.CREDENTIAL,
        confidence: 0.99,
        reason: "password_input"
      };
    }

    // Financial inputs (e.g. cc-number, cc-exp, cc-csc)
    if (
      autocomplete.includes("cc-") ||
      name.includes("card") ||
      name.includes("cvv") ||
      name.includes("cvc") ||
      id.includes("card") ||
      placeholder.includes("card number")
    ) {
      return {
        category: RedactionCategory.FINANCIAL,
        confidence: 0.95,
        reason: "credit_card_input"
      };
    }

    // SSN / Identity inputs
    if (name.includes("ssn") || id.includes("ssn") || placeholder.includes("ssn")) {
      return {
        category: RedactionCategory.IDENTITY,
        confidence: 0.95,
        reason: "ssn_input"
      };
    }
  }

  return null;
}
