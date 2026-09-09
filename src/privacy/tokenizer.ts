/**
 * Structural Semantic Tokenizer & Payload Transformer
 * Replaces sensitive data with category-specific tokens (<REDACTED_*>)
 * in memory without altering the live DOM.
 * Enforces contracts/payload-schema.json and Constitution Principle III.
 */

import {
  SanitizedPayloadEnvelope,
  SanitizedDomNode,
  DetectedEntity,
  SemanticToken
} from "../common/types.js";
import { SCHEMA_VERSION } from "../common/constants.js";

export interface BuildPayloadOptions {
  cycleId: string;
  entities: DetectedEntity[];
  domTree: SanitizedDomNode;
  durationMs: number;
  scrubbedLabelNodeIds?: Set<string>;
}

/**
 * Recursively tokenizes a structural DOM tree by replacing sensitive node values
 * and scrubbing associated descriptor labels.
 */
export function sanitizeDomTree(
  node: SanitizedDomNode,
  entityByNodeId: Map<string, DetectedEntity>,
  scrubbedLabelIds: Set<string>
): SanitizedDomNode {
  const entity = entityByNodeId.get(node.node_id);
  const isLabelScrubbed = scrubbedLabelIds.has(node.node_id);

  let newText = node.text;

  if (isLabelScrubbed) {
    // Contextual blindness: Scrub adjacent identifying label
    newText = undefined;
  } else if (entity) {
    // Replace sensitive value with semantic token
    newText = entity.token;
  }

  // Clone non-sensitive attributes, scrubbing any sensitive value attributes
  let newAttributes: Record<string, string> | undefined;
  if (node.attributes) {
    newAttributes = { ...node.attributes };
    if (entity) {
      if ("value" in newAttributes) {
        newAttributes["value"] = entity.token;
      }
      if ("placeholder" in newAttributes) {
        newAttributes["placeholder"] = entity.token;
      }
    }
  }

  const sanitizedChildren = node.children
    ? node.children.map(child => sanitizeDomTree(child, entityByNodeId, scrubbedLabelIds))
    : undefined;

  return {
    node_id: node.node_id,
    tag: node.tag,
    role: node.role,
    bounds: {
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.width,
      height: node.bounds.height
    },
    ...(newText !== undefined ? { text: newText } : {}),
    ...(newAttributes ? { attributes: newAttributes } : {}),
    ...(sanitizedChildren && sanitizedChildren.length > 0 ? { children: sanitizedChildren } : {})
  };
}

/**
 * Builds the complete SanitizedPayloadEnvelope ready for verification and transmission.
 */
export function buildSanitizedPayload(options: BuildPayloadOptions): SanitizedPayloadEnvelope {
  const {
    cycleId,
    entities,
    domTree,
    durationMs,
    scrubbedLabelNodeIds = new Set<string>()
  } = options;

  const entityByNodeId = new Map<string, DetectedEntity>();
  const activeTokens = new Set<SemanticToken>();

  for (const entity of entities) {
    entityByNodeId.set(entity.nodeId, entity);
    activeTokens.add(entity.token);
    for (const labelId of entity.associatedLabelNodeIds) {
      scrubbedLabelNodeIds.add(labelId);
    }
  }

  const sanitizedTree = sanitizeDomTree(domTree, entityByNodeId, scrubbedLabelNodeIds);

  return {
    schema_version: SCHEMA_VERSION,
    cycle_id: cycleId,
    token_manifest: Array.from(activeTokens),
    sanitized_dom_tree: sanitizedTree,
    metrics: {
      sanitization_duration_ms: Math.min(durationMs, 500),
      entities_redacted_count: entities.length
    }
  };
}
