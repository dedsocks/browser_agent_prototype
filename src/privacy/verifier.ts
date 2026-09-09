/**
 * Pre-Transmission Zero-Leakage Verifier
 * Scans outbound serialized payload trees and validates manifests
 * Enforces Constitution Principle I (Zero Raw Data) & Principle V (Fail-Closed Protocol).
 */

import {
  SanitizedPayloadEnvelope,
  RedactionManifest,
  VerificationStatus
} from "../common/types.js";
import { SCHEMA_VERSION } from "../common/constants.js";
import { detectPiiInText } from "./regex-engine.js";
import { updateManifestVerification } from "./manifest-builder.js";

export type VerificationErrorCode =
  | "LEAK_DETECTED"
  | "INVALID_SCHEMA"
  | "CYCLE_MISMATCH"
  | "BINARY_DATA_DETECTED"
  | "VERIFICATION_TIMEOUT"
  | "INTERNAL_FAULT";

export interface VerificationResult {
  valid: boolean;
  errorCode?: VerificationErrorCode;
  diagnosticMessage?: string;
  manifest: RedactionManifest;
}

/**
 * Scans an outbound payload before network transmission.
 */
export function verifyPreTransmission(
  payload: SanitizedPayloadEnvelope,
  manifest: RedactionManifest
): VerificationResult {
  // 1. Schema version verification
  if (payload.schema_version !== SCHEMA_VERSION) {
    return {
      valid: false,
      errorCode: "INVALID_SCHEMA",
      diagnosticMessage: `Invalid schema version: received ${payload.schema_version}, expected ${SCHEMA_VERSION}`,
      manifest: updateManifestVerification(manifest, "FAILED")
    };
  }

  // 2. Cycle ID alignment
  if (payload.cycle_id !== manifest.cycleId) {
    return {
      valid: false,
      errorCode: "CYCLE_MISMATCH",
      diagnosticMessage: `Cycle mismatch: envelope has ${payload.cycle_id}, manifest has ${manifest.cycleId}`,
      manifest: updateManifestVerification(manifest, "FAILED")
    };
  }

  // 3. Serialize DOM tree representation to inspect for residual plaintext PII
  const serializedTree = JSON.stringify(payload.sanitized_dom_tree);

  // Check for raw binary pixel data
  if (serializedTree.includes("data:image/") || serializedTree.includes(";base64,")) {
    return {
      valid: false,
      errorCode: "BINARY_DATA_DETECTED",
      diagnosticMessage: "Unmasked image/pixel buffer detected in serialized tree",
      manifest: updateManifestVerification(manifest, "FAILED")
    };
  }

  // 4. Run regex detection scanner on serialized tree string
  const detectedResidual = detectPiiInText(serializedTree);
  if (detectedResidual.length > 0) {
    const leakCategories = Array.from(new Set(detectedResidual.map(r => r.category))).join(", ");
    return {
      valid: false,
      errorCode: "LEAK_DETECTED",
      diagnosticMessage: `Residual plaintext PII detected in serialized payload: ${leakCategories}`,
      manifest: updateManifestVerification(manifest, "FAILED")
    };
  }

  // All checks pass: Mark manifest as VERIFIED
  return {
    valid: true,
    manifest: updateManifestVerification(manifest, "VERIFIED")
  };
}
