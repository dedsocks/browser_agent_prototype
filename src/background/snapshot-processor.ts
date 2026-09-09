/**
 * Background DOM Snapshot Processor & PII Redaction Pipeline
 * Coordinates DOM snapshot processing, PII detection, manifest generation,
 * fail-closed verification, and overlay marker dispatch.
 * Implements Constitution Principle IV (Background Isolation) & Principle V (Fail-Closed).
 */

import {
  ProcessDomSnapshotRequest,
  DomSanitizationSuccessResponse,
  DomSanitizationFailureResponse,
  DetectedEntity,
  RedactionCategory,
  AuditOverlayMarker,
  BoundingBox
} from "../common/types.js";
import { CATEGORY_COLOR_MAP, CATEGORY_LABEL_MAP, CATEGORY_TOKEN_MAP } from "../common/constants.js";
import { snapshotToTree } from "../content/dom-extractor.js";
import { detectPiiInText } from "../privacy/regex-engine.js";
import { buildRedactionManifest } from "../privacy/manifest-builder.js";
import { buildSanitizedPayload } from "../privacy/tokenizer.js";
import { verifyPreTransmission } from "../privacy/verifier.js";
import { computeNodeFingerprint } from "../cache/region-fingerprint.js";
import { IncrementalStateCache } from "../cache/state-cache.js";

let globalIncrementalCache: IncrementalStateCache | null = new IncrementalStateCache();

export function setIncrementalCache(cache: IncrementalStateCache | null): void {
  globalIncrementalCache = cache;
}

export function getIncrementalCache(): IncrementalStateCache | null {
  return globalIncrementalCache;
}

/**
 * Core processing routine for DOM snapshots received from content scripts.
 */
export async function handleDomSnapshotRequest(
  request: ProcessDomSnapshotRequest
): Promise<DomSanitizationSuccessResponse | DomSanitizationFailureResponse> {
  const startTime = Date.now();
  const { cycle_id, dom_snapshot } = request;

  try {
    const entities: DetectedEntity[] = [];
    const scrubbedLabelIds = new Set<string>();

    // 1. Identify sensitive elements and text nodes in snapshot
    for (const node of dom_snapshot.nodes) {
      const fingerprint = computeNodeFingerprint(node);

      if (globalIncrementalCache && globalIncrementalCache.has(fingerprint)) {
        const cached = globalIncrementalCache.get(fingerprint);
        if (cached && cached.entities) {
          for (const ent of cached.entities) {
            entities.push(ent);
          }
        }
        continue;
      }

      const nodeEntities: DetectedEntity[] = [];
      const textToScan = node.value || node.text || "";
      const matches = detectPiiInText(textToScan);

      let primaryCategory: RedactionCategory | null = matches.length > 0 ? matches[0].category : null;
      let primaryConfidence = matches.length > 0 ? matches[0].confidence : 0;

      // Attribute inspection for password, credential, and sensitive fields
      const type = (node.attributes.type || "").toLowerCase();
      const name = (node.attributes.name || "").toLowerCase();
      const id = (node.attributes.id || node.node_id || "").toLowerCase();
      const autocomplete = (node.attributes.autocomplete || "").toLowerCase();
      const placeholder = (node.placeholder || node.attributes.placeholder || "").toLowerCase();
      const ariaLabel = (node.attributes["aria-label"] || "").toLowerCase();
      const title = (node.attributes.title || "").toLowerCase();

      const combinedMeta = `${name} ${id} ${placeholder} ${ariaLabel} ${title} ${autocomplete}`;

      if (!primaryCategory) {
        if (
          type === "password" ||
          autocomplete.includes("password") ||
          autocomplete.includes("one-time-code") ||
          /pass|pwd|passwd|secret|token|apikey|api_key|api-key|auth|pin|otp|access_token|private_key|credential/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.CREDENTIAL;
          primaryConfidence = 0.99;
        } else if (
          autocomplete.includes("cc-") ||
          /card|cvv|cvc|expir|credit|debit|account_num/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.FINANCIAL;
          primaryConfidence = 0.95;
        } else if (
          /ssn|pan|tax_id|social_sec|identity_num|national_id/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.IDENTITY;
          primaryConfidence = 0.95;
        } else if (
          type === "email" ||
          autocomplete.includes("email") ||
          /\bemail\b|\bmail\b/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.CONTACT;
          primaryConfidence = 0.90;
        }
      }

      if (primaryCategory) {
        const token = CATEGORY_TOKEN_MAP[primaryCategory as keyof typeof CATEGORY_TOKEN_MAP];

        const bounds: BoundingBox = {
          x: node.bounds.x,
          y: node.bounds.y,
          width: node.bounds.width,
          height: node.bounds.height,
          top: node.bounds.y,
          left: node.bounds.x,
          bottom: node.bounds.y + node.bounds.height,
          right: node.bounds.x + node.bounds.width
        };

        const associatedLabels: string[] = [];
        // Match label with for attribute or aria-labelledby
        for (const otherNode of dom_snapshot.nodes) {
          if (otherNode.tag === "label" && otherNode.attributes["for"] === node.node_id) {
            associatedLabels.push(otherNode.node_id);
            scrubbedLabelIds.add(otherNode.node_id);
          }
        }

        const entity: DetectedEntity = {
          id: `ent_${node.node_id}_${entities.length + 1}`,
          category: primaryCategory,
          token,
          nodeId: node.node_id,
          bounds,
          associatedLabelNodeIds: associatedLabels,
          confidence: primaryConfidence,
          verified: false
        };

        entities.push(entity);
        nodeEntities.push(entity);
      }

      if (globalIncrementalCache) {
        globalIncrementalCache.set(fingerprint, {
          fingerprintHash: fingerprint,
          entities: nodeEntities,
          sanitizedNode: {
            node_id: node.node_id,
            tag: node.tag,
            bounds: node.bounds
          },
          verifiedAt: Date.now()
        });
      }
    }

    // 2. Build RedactionManifest
    const manifest = buildRedactionManifest({
      cycleId: cycle_id,
      entities,
      labelsScrubbedCount: scrubbedLabelIds.size
    });

    // 3. Structural Tokenization
    const domTree = snapshotToTree(dom_snapshot);
    const durationMs = Date.now() - startTime;
    const payload = buildSanitizedPayload({
      cycleId: cycle_id,
      entities,
      domTree,
      durationMs,
      scrubbedLabelNodeIds: scrubbedLabelIds
    });

    // 4. Pre-Transmission Zero-Leakage Verification
    const verification = verifyPreTransmission(payload, manifest);

    if (!verification.valid) {
      return {
        type: "DOM_SANITIZATION_FAILURE",
        cycle_id,
        error_code: verification.errorCode === "LEAK_DETECTED" ? "LEAK_DETECTED" : "INTERNAL_FAULT",
        diagnostic_message: verification.diagnosticMessage || "Verification failed",
        action: "HALT_TASK_SESSION"
      };
    }

    // Record verified transmission in Vault
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const vaultRecord = {
        id: cycle_id,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        url: request.url || "Active Tab",
        goal: (request as any).goal || "DOM Snapshot Sanitization",
        schemaVersion: "1.5.0",
        tokenManifest: manifest.entities.map(e => e.token),
        entitiesRedactedCount: manifest.entities.length,
        entities: manifest.entities.map(e => ({
          category: e.category,
          token: e.token,
          nodeId: e.nodeId
        })),
        sanitizedDomSample: JSON.stringify(payload.sanitized_dom_tree, null, 2),
        durationMs
      };

      chrome.storage.local.get(["vault_transmissions"], (res: any) => {
        const list = res?.vault_transmissions || [];
        list.unshift(vaultRecord);
        if (list.length > 50) list.pop();
        chrome.storage.local.set({ vault_transmissions: list });
      });
    }

    // 5. Construct Overlay Markers (skip hidden inputs)
    const overlayMarkers: AuditOverlayMarker[] = entities
      .filter(e => {
        const node = dom_snapshot.nodes.find(n => n.node_id === e.nodeId);
        return node?.attributes?.type !== "hidden";
      })
      .map(e => ({
        entity_id: e.id,
        category: e.category,
        color: CATEGORY_COLOR_MAP[e.category] || "#FF0000",
        bounds: {
          x: e.bounds.x,
          y: e.bounds.y,
          width: e.bounds.width,
          height: e.bounds.height
        },
        label: CATEGORY_LABEL_MAP[e.category] || "Protected"
      }));

    return {
      type: "DOM_SANITIZATION_SUCCESS",
      cycle_id,
      overlay_markers: overlayMarkers,
      status: "VERIFIED"
    };
  } catch (err: any) {
    return {
      type: "DOM_SANITIZATION_FAILURE",
      cycle_id,
      error_code: "INTERNAL_FAULT",
      diagnostic_message: err?.message || "Internal sanitization error",
      action: "HALT_TASK_SESSION"
    };
  }
}
