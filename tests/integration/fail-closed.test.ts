import { describe, it, expect, vi } from "vitest";
import { verifyPreTransmission } from "../../src/privacy/verifier.js";
import { NetworkTransmissionGatekeeper } from "../../src/background/network-interceptor.js";
import { buildRedactionManifest } from "../../src/privacy/manifest-builder.js";
import {
  SanitizedPayloadEnvelope,
  SemanticToken,
  RedactionCategory,
  PrivacyAbortEvent
} from "../../src/common/types.js";

describe("Fail-Closed Protocol & Pre-Transmission Verification", () => {
  const validEnvelope: SanitizedPayloadEnvelope = {
    schema_version: "1.5.0",
    cycle_id: "c-1234-5678",
    token_manifest: [SemanticToken.FINANCIAL],
    sanitized_dom_tree: {
      node_id: "root",
      tag: "div",
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      children: [
        {
          node_id: "card-input",
          tag: "input",
          text: SemanticToken.FINANCIAL,
          bounds: { x: 10, y: 10, width: 200, height: 30 }
        }
      ]
    },
    metrics: {
      sanitization_duration_ms: 35,
      entities_redacted_count: 1
    }
  };

  const validManifest = buildRedactionManifest({
    cycleId: "c-1234-5678",
    entities: [
      {
        id: "ent-1",
        category: RedactionCategory.FINANCIAL,
        token: SemanticToken.FINANCIAL,
        nodeId: "card-input",
        bounds: { x: 10, y: 10, width: 200, height: 30, top: 10, left: 10, bottom: 40, right: 210 },
        associatedLabelNodeIds: [],
        confidence: 0.99,
        verified: true
      }
    ]
  });

  it("passes verification when zero plaintext PII exists and tokens align", () => {
    const result = verifyPreTransmission(validEnvelope, validManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest.verificationStatus).toBe("VERIFIED");
  });

  it("fails verification and flags residual PII when plaintext credit card leaks into tree", () => {
    // Inject synthetic leak
    const leakedEnvelope: SanitizedPayloadEnvelope = {
      ...validEnvelope,
      sanitized_dom_tree: {
        ...validEnvelope.sanitized_dom_tree,
        text: "Accidental leak 4532015112830366"
      }
    };

    const result = verifyPreTransmission(leakedEnvelope, validManifest);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("LEAK_DETECTED");
    expect(result.manifest.verificationStatus).toBe("FAILED");
  });

  it("fails verification if schema version or token manifest is invalid", () => {
    const invalidEnvelope = {
      ...validEnvelope,
      schema_version: "0.9.0" as any
    };

    const result = verifyPreTransmission(invalidEnvelope, validManifest);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_SCHEMA");
  });

  it("fails verification when unmasked image/pixel buffer data URL leaks into tree", () => {
    const rawImageEnvelope: SanitizedPayloadEnvelope = {
      ...validEnvelope,
      sanitized_dom_tree: {
        ...validEnvelope.sanitized_dom_tree,
        attributes: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }
      }
    };

    const result = verifyPreTransmission(rawImageEnvelope, validManifest);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("BINARY_DATA_DETECTED");
    expect(result.diagnosticMessage).toBe("Unmasked image/pixel buffer detected in serialized tree");
    expect(result.manifest.verificationStatus).toBe("FAILED");
  });

  it("blocks network transmission and emits PRIVACY_ABORT upon verification failure", async () => {
    const abortListener = vi.fn((_event: PrivacyAbortEvent) => {});
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    const gatekeeper = new NetworkTransmissionGatekeeper({
      fetchImpl: mockFetch as any,
      onPrivacyAbort: abortListener
    });

    const leakedEnvelope: SanitizedPayloadEnvelope = {
      ...validEnvelope,
      sanitized_dom_tree: {
        ...validEnvelope.sanitized_dom_tree,
        text: "Leaked card: 4532015112830366"
      }
    };

    await expect(gatekeeper.transmit(leakedEnvelope, validManifest)).rejects.toThrow(/PRIVACY_ABORT/);

    // Verify fail-closed constraints
    expect(mockFetch).not.toHaveBeenCalled();
    expect(abortListener).toHaveBeenCalledTimes(1);
    const abortEvent = abortListener.mock.calls[0][0];
    expect(abortEvent.eventType).toBe("PRIVACY_ABORT");
    expect(abortEvent.actionRequired).toBe("HALT_TASK_SESSION");
    expect(abortEvent.cycleId).toBe("c-1234-5678");
  });
});
