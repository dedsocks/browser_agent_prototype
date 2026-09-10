import {
  SanitizedPayloadEnvelope,
  SanitizedDomNode,
  DetectedEntity,
  SemanticToken
} from "../common/types.js";
import { SCHEMA_VERSION, CATEGORY_TOKEN_MAP } from "../common/constants.js";
import { detectPiiInText } from "./regex-engine.js";

export interface BuildPayloadOptions {
  cycleId: string;
  entities: DetectedEntity[];
  domTree: SanitizedDomNode;
  durationMs: number;
  scrubbedLabelNodeIds?: Set<string>;
}

/**
 * Scrubs any residual PII patterns from a text string by replacing them
 * with the appropriate semantic token. This catches PII that appears in
 * nodes NOT directly detected as sensitive (e.g. mailto: hrefs, parent
 * text nodes containing emails, aria-labels, etc.).
 */
function scrubResidualPii(text: string): string {
  if (!text) return text;
  const matches = detectPiiInText(text);
  if (matches.length === 0) return text;

  // Sort matches by index in reverse order so replacements don't shift indices
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let result = text;
  for (const match of sorted) {
    const token = CATEGORY_TOKEN_MAP[match.category as keyof typeof CATEGORY_TOKEN_MAP] || "<REDACTED>";
    result = result.slice(0, match.index) + token + result.slice(match.index + match.length);
  }
  return result;
}

/**
 * Masks raw binary pixel buffers and base64 data URLs to prevent
 * unmasked binary payload transmission per Constitution Principle I & VI.
 */
export function maskBinaryBuffers(input: string): string {
  if (!input) return input;
  if (!input.includes("data:image/") && !input.includes(";base64,")) {
    return input;
  }
  return input
    .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/gi, "[IMAGE_BUFFER_REDACTED]")
    .replace(/data:image\/[^\s"'>)]+/gi, "[IMAGE_BUFFER_REDACTED]")
    .replace(/;base64,[a-zA-Z0-9+/=]+/gi, ";[BASE64_REDACTED]")
    .replace(/data:image\//gi, "[IMAGE_BUFFER_REDACTED]/")
    .replace(/;base64,/gi, ";[BASE64_REDACTED],");
}

/**
 * Recursively tokenizes a structural DOM tree by replacing sensitive node values
 * and scrubbing associated descriptor labels.
 * Also performs a global sweep to scrub any residual PII from all text and attributes
 * and masks raw binary image/pixel buffers.
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
  } else if (newText) {
    // Global sweep: scrub any residual PII in non-entity text nodes and mask binary data
    newText = maskBinaryBuffers(scrubResidualPii(newText));
  }

  // Clone non-sensitive attributes, scrubbing any sensitive value attributes
  let newAttributes: Record<string, string> | undefined;
  if (node.attributes) {
    newAttributes = {};
    const attrs = { ...node.attributes };
    if (entity) {
      if ("value" in attrs) {
        attrs["value"] = entity.token;
      }
      if ("placeholder" in attrs) {
        attrs["placeholder"] = entity.token;
      }
    }
    // Global sweep: scrub residual PII and mask binary pixel buffers from ALL attribute values AND keys
    for (const key of Object.keys(attrs)) {
      const maskedKey = maskBinaryBuffers(key);
      if (attrs[key]) {
        newAttributes[maskedKey] = maskBinaryBuffers(scrubResidualPii(attrs[key]));
      } else {
        newAttributes[maskedKey] = attrs[key];
      }
    }
  }

  const sanitizedChildren = node.children
    ? node.children.map(child => sanitizeDomTree(child, entityByNodeId, scrubbedLabelIds))
    : undefined;

  return {
    node_id: maskBinaryBuffers(node.node_id),
    tag: maskBinaryBuffers(node.tag),
    role: node.role ? maskBinaryBuffers(node.role) : undefined,
    bounds: {
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.width,
      height: node.bounds.height
    },
    ...(newText !== undefined ? { text: newText } : {}),
    ...(newAttributes && Object.keys(newAttributes).length > 0 ? { attributes: newAttributes } : {}),
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
