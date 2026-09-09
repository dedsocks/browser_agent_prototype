/**
 * Redaction Manifest Generator
 * Tracks identified sensitive entities and verification status per perception cycle
 * per Constitution Principle V and data-model.md.
 */

import {
  RedactionManifest,
  DetectedEntity,
  ScopeTier,
  VerificationStatus
} from "../common/types.js";

/**
 * Computes a deterministic checksum of the manifest entities.
 */
export function computeManifestChecksum(entities: DetectedEntity[]): string {
  const content = entities
    .map(e => `${e.id}:${e.category}:${e.token}:${e.nodeId}`)
    .sort()
    .join("|");

  // Simple, fast 32-bit FNV-1a hash formatted as hex
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface BuildManifestOptions {
  cycleId: string;
  entities: DetectedEntity[];
  scopeTier?: ScopeTier;
  labelsScrubbedCount?: number;
}

/**
 * Builds a fresh RedactionManifest for a perception cycle.
 */
export function buildRedactionManifest(options: BuildManifestOptions): RedactionManifest {
  const {
    cycleId,
    entities,
    scopeTier = "TIER_1_CORE_EXTENDED",
    labelsScrubbedCount = 0
  } = options;

  const checksum = computeManifestChecksum(entities);

  return {
    cycleId,
    timestamp: new Date().toISOString(),
    scopeTier,
    entities,
    totalDetected: entities.length,
    labelsScrubbedCount,
    verificationStatus: "PENDING",
    checksum
  };
}

/**
 * Updates the verification status of a manifest.
 */
export function updateManifestVerification(
  manifest: RedactionManifest,
  status: VerificationStatus
): RedactionManifest {
  return {
    ...manifest,
    verificationStatus: status
  };
}
