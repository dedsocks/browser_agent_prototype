import { describe, it, expect } from "vitest";
import { extractDomSnapshot } from "../../src/content/dom-extractor.js";
import { buildSanitizedPayload } from "../../src/privacy/tokenizer.js";
import { RedactionCategory, SemanticToken, DetectedEntity } from "../../src/common/types.js";

describe("Live DOM Integrity Guarantee", () => {
  it("never mutates live input values, text nodes, or DOM structure during extraction and tokenization", () => {
    // Setup mock DOM tree
    document.body.innerHTML = `
      <form id="checkout-form">
        <label for="cc">Card Number:</label>
        <input type="text" id="cc" name="card_number" value="4532015112830366" />
        <label for="ssn">SSN:</label>
        <input type="text" id="ssn" name="ssn" value="123-45-6789" />
        <p id="info-note">Customer note with email support@example.com</p>
      </form>
    `;

    const ccInput = document.getElementById("cc") as HTMLInputElement;
    const ssnInput = document.getElementById("ssn") as HTMLInputElement;
    const infoNote = document.getElementById("info-note") as HTMLParagraphElement;

    // Snapshot before
    const rawCcValue = ccInput.value;
    const rawSsnValue = ssnInput.value;
    const rawNoteText = infoNote.textContent;

    // 1. Extract DOM snapshot
    const snapshot = extractDomSnapshot(document.body);
    expect(snapshot.nodes.length).toBeGreaterThan(0);

    // Assert DOM is still unchanged after extraction
    expect(ccInput.value).toBe(rawCcValue);
    expect(ssnInput.value).toBe(rawSsnValue);
    expect(infoNote.textContent).toBe(rawNoteText);

    // 2. Simulate detection & tokenization
    const mockEntities: DetectedEntity[] = [
      {
        id: "ent-cc",
        category: RedactionCategory.FINANCIAL,
        token: SemanticToken.FINANCIAL,
        nodeId: "cc",
        bounds: { x: 0, y: 0, width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 },
        associatedLabelNodeIds: [],
        confidence: 0.99,
        verified: true
      },
      {
        id: "ent-ssn",
        category: RedactionCategory.IDENTITY,
        token: SemanticToken.IDENTITY,
        nodeId: "ssn",
        bounds: { x: 0, y: 30, width: 100, height: 20, top: 30, left: 0, bottom: 50, right: 100 },
        associatedLabelNodeIds: [],
        confidence: 0.99,
        verified: true
      }
    ];

    const payload = buildSanitizedPayload({
      cycleId: "c1234567-89ab-cdef-0123-456789abcdef",
      entities: mockEntities,
      domTree: {
        node_id: "root",
        tag: "body",
        bounds: { x: 0, y: 0, width: 1000, height: 800 },
        children: snapshot.nodes.map(n => ({
          node_id: n.node_id,
          tag: n.tag,
          text: n.value || n.text,
          bounds: n.bounds,
          attributes: n.attributes
        }))
      },
      durationMs: 15
    });

    // 3. Absolute Assertion: Live DOM inputs and text MUST remain unmutated
    expect(ccInput.value).toBe("4532015112830366");
    expect(ssnInput.value).toBe("123-45-6789");
    expect(infoNote.textContent).toBe("Customer note with email support@example.com");

    // Whereas the serialized payload contains the redacted tokens
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain(SemanticToken.FINANCIAL);
    expect(serialized).toContain(SemanticToken.IDENTITY);
    expect(serialized).not.toContain("4532015112830366");
    expect(serialized).not.toContain("123-45-6789");
  });
});
