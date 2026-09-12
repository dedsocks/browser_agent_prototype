import { RedactionCategory, SemanticToken } from "./types.js";

export const SCHEMA_VERSION = "1.5.0" as const;

export const CATEGORY_TOKEN_MAP: Record<RedactionCategory, SemanticToken> = {
  [RedactionCategory.FINANCIAL]: SemanticToken.FINANCIAL,
  [RedactionCategory.IDENTITY]: SemanticToken.IDENTITY,
  [RedactionCategory.CONTACT]: SemanticToken.CONTACT,
  [RedactionCategory.CREDENTIAL]: SemanticToken.CREDENTIAL,
  [RedactionCategory.BIOMETRIC_VISUAL]: SemanticToken.BIOMETRIC_VISUAL
};

export const CATEGORY_COLOR_MAP: Record<RedactionCategory, string> = {
  [RedactionCategory.FINANCIAL]: "#E53E3E", // Red
  [RedactionCategory.IDENTITY]: "#ED8936",  // Orange
  [RedactionCategory.CREDENTIAL]: "#ECC94B", // Yellow
  [RedactionCategory.CONTACT]: "#3182CE",    // Blue
  [RedactionCategory.BIOMETRIC_VISUAL]: "#805AD5" // Purple
};

export const CATEGORY_LABEL_MAP: Record<RedactionCategory, string> = {
  [RedactionCategory.FINANCIAL]: "Protected: Financial",
  [RedactionCategory.IDENTITY]: "Protected: Identity",
  [RedactionCategory.CREDENTIAL]: "Protected: Credential",
  [RedactionCategory.CONTACT]: "Protected: Contact",
  [RedactionCategory.BIOMETRIC_VISUAL]: "Protected: Biometric/Visual"
};

export const SENSITIVE_LABEL_DENYLIST = [
  "ssn",
  "social security",
  "social security number",
  "card number",
  "credit card",
  "credit card number",
  "card #",
  "cc #",
  "cvv",
  "cvc",
  "security code",
  "exp date",
  "expiration date",
  "expiry",
  "password",
  "passcode",
  "pin",
  "secret",
  "pan",
  "pan number",
  "permanent account number",
  "aadhaar",
  "aadhaar number",
  "dob",
  "date of birth",
  "birth date",
  "account number",
  "routing number",
  "bank account",
  "auth token",
  "api key"
];

export const SPATIAL_PROXIMITY_THRESHOLD_PX = 50;

export const PERFORMANCE_BUDGETS = {
  MAX_CYCLE_LATENCY_MS: 2000,
  MAX_SANITIZATION_DURATION_MS: 500,
  MAX_OVERLAY_PAINT_MS: 50,
  OVERLAY_COALESCE_INTERVAL_MS: 100,
  MAX_ACTION_VALIDATION_MS: 50,
  MAX_ACTION_EXECUTION_MS: 100
};

// Action Allowlist & Execution Safeguards (Constitution Article XIV)
export const ALLOWED_ACTION_TYPES = ["click", "type", "scroll", "navigate", "key_sequence"] as const;

export const GEOMETRIC_TOLERANCE_RATIO = 0.25; // 25% margin for dynamic element shifts

export const CREDENTIAL_INPUT_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /one-time-code/i,
  /otp/i,
  /pin\b/i,
  /cvv/i,
  /cvc/i,
  /security-code/i,
  /card-number/i,
  /cc-number/i
];
