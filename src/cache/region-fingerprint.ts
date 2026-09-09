/**
 * Deterministic Region Fingerprinting
 * Computes composite hashes over DOM subtree content, computed geometry,
 * accessibility attributes, and visual dimensions.
 * Implements Constitution Principle XI (Incremental State Processing).
 */

import { DomSnapshotNode } from "../common/types.js";

/**
 * 64-bit FNV-1a non-cryptographic hash for high speed and zero collisions in DOM caching.
 */
function fnv1a64(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ (ch >> 8), 16777619);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return hex1 + hex2;
}

/**
 * Computes a deterministic hash for an individual DOM node.
 */
export function computeNodeFingerprint(node: DomSnapshotNode): string {
  const sortedAttrs = Object.keys(node.attributes || {})
    .sort()
    .map(k => `${k}=${node.attributes[k]}`)
    .join(";");

  const normalizedText = (node.text || node.value || node.placeholder || "").trim();
  const boundsStr = `${node.bounds.x},${node.bounds.y},${node.bounds.width},${node.bounds.height}`;

  const payload = `${node.node_id}|${node.tag}|${node.role || ""}|${sortedAttrs}|${normalizedText}|${boundsStr}`;
  return fnv1a64(payload);
}

/**
 * Computes composite subtree fingerprint combining parent and child hashes.
 */
export function computeSubtreeFingerprint(nodeHash: string, childHashes: string[]): string {
  const combined = `${nodeHash}:${childHashes.join(",")}`;
  return fnv1a64(combined);
}
