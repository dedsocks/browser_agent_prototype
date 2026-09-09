import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildSanitizedPayload } from "../../src/privacy/tokenizer.js";
import { SemanticToken, RedactionCategory, DetectedEntity, SanitizedDomNode } from "../../src/common/types.js";

describe("Payload Serialization Contract Test", () => {
  const schemaPath = resolve(__dirname, "../../specs/001-client-pii-redaction/contracts/payload-schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

  it("serializes payload envelope strictly conforming to payload-schema.json", () => {
    const mockEntities: DetectedEntity[] = [
      {
        id: "ent-1",
        category: RedactionCategory.FINANCIAL,
        token: SemanticToken.FINANCIAL,
        nodeId: "node-input-card",
        bounds: { x: 10, y: 20, width: 200, height: 40, top: 20, left: 10, bottom: 60, right: 210 },
        associatedLabelNodeIds: ["node-label-card"],
        confidence: 0.99,
        verified: true
      }
    ];

    const mockDomTree: SanitizedDomNode = {
      node_id: "root",
      tag: "div",
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      children: [
        {
          node_id: "node-label-card",
          tag: "label",
          text: "Card Number:",
          bounds: { x: 10, y: 5, width: 100, height: 15 },
          attributes: {}
        },
        {
          node_id: "node-input-card",
          tag: "input",
          role: "textbox",
          text: "4532015112830366",
          bounds: { x: 10, y: 20, width: 200, height: 40 },
          attributes: { name: "cc_number" }
        }
      ]
    };

    const envelope = buildSanitizedPayload({
      cycleId: "123e4567-e89b-12d3-a456-426614174000",
      entities: mockEntities,
      domTree: mockDomTree,
      durationMs: 42
    });

    // Verify required fields
    for (const req of schema.required) {
      expect(envelope).toHaveProperty(req);
    }

    expect(envelope.schema_version).toBe("1.5.0");
    expect(envelope.cycle_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(envelope.token_manifest).toContain(SemanticToken.FINANCIAL);
    expect(envelope.metrics.sanitization_duration_ms).toBeLessThanOrEqual(500);
    expect(envelope.metrics.entities_redacted_count).toBe(1);

    // Serialization check: Ensure zero plaintext credit card numbers exist in serialized output
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain("4532015112830366");
    expect(serialized).toContain(SemanticToken.FINANCIAL);
  });
});
