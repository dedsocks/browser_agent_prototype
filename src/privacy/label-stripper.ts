/**
 * VLM Contextual Blindness - Adjacent Label Stripper
 * Detects and scrubs adjacent identifying labels and descriptors to prevent
 * remote VLMs from deducing redacted values from nearby context.
 * Enforces Constitution Principle VIII (VLM Contextual Blindness).
 */

import { DomSnapshotNode, SimpleBounds } from "../common/types.js";
import { SENSITIVE_LABEL_DENYLIST, SPATIAL_PROXIMITY_THRESHOLD_PX } from "../common/constants.js";
import { normalizeAdversarial } from "./normalizer.js";

/**
 * Checks whether a given string contains sensitive descriptor terms.
 */
export function isSensitiveDescriptorText(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeAdversarial(text).toLowerCase();

  return SENSITIVE_LABEL_DENYLIST.some(pattern => {
    // Escape special regex characters in pattern
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i");
    return regex.test(normalized);
  });
}

/**
 * Calculates Euclidean distance between two bounding rectangles in pixels.
 */
export function calculateRectDistance(r1: SimpleBounds, r2: SimpleBounds): number {
  const dx = Math.max(0, Math.max(r1.x - (r2.x + r2.width), r2.x - (r1.x + r1.width)));
  const dy = Math.max(0, Math.max(r1.y - (r2.y + r2.height), r2.y - (r1.y + r1.height)));
  return Math.hypot(dx, dy);
}

/**
 * Discovers all associated descriptor and label elements for a sensitive form element
 * via HTML relationships (label 'for'), ARIA attributes, and spatial proximity.
 */
export function findAssociatedLabels(
  sensitiveNode: DomSnapshotNode,
  allNodes: DomSnapshotNode[],
  thresholdPx = SPATIAL_PROXIMITY_THRESHOLD_PX
): DomSnapshotNode[] {
  const associated: DomSnapshotNode[] = [];
  const sensitiveId = sensitiveNode.attributes["id"] || sensitiveNode.node_id;
  const ariaLabelledBy = sensitiveNode.attributes["aria-labelledby"];

  for (const node of allNodes) {
    if (node.node_id === sensitiveNode.node_id) continue;

    // 1. Explicit HTML <label for="..."> match
    if (node.tag === "label" && (node.attributes["for"] === sensitiveId || node.attributes["for"] === sensitiveNode.node_id)) {
      associated.push(node);
      continue;
    }

    // 2. ARIA labeledby association
    if (ariaLabelledBy && (node.node_id === ariaLabelledBy || node.attributes["id"] === ariaLabelledBy)) {
      associated.push(node);
      continue;
    }

    // 3. Spatial Proximity check: Near sensitive element AND contains sensitive descriptor keywords
    const text = node.text || node.value || "";
    if (isSensitiveDescriptorText(text)) {
      const dist = calculateRectDistance(sensitiveNode.bounds, node.bounds);
      if (dist <= thresholdPx) {
        associated.push(node);
      }
    }
  }

  return associated;
}
