import { describe, it, expect, vi } from "vitest";
import { extractDomSnapshot } from "../../src/content/dom-extractor.js";
import { handleDomSnapshotRequest } from "../../src/background/index.js";
import { NetworkTransmissionGatekeeper } from "../../src/background/network-interceptor.js";
import { buildSanitizedPayload } from "../../src/privacy/tokenizer.js";
import { snapshotToTree } from "../../src/content/dom-extractor.js";
import { buildRedactionManifest } from "../../src/privacy/manifest-builder.js";
import { AuditOverlayManager } from "../../src/content/audit-overlay.js";
import { SemanticToken } from "../../src/common/types.js";

describe("End-to-End Privacy Boundary Integration Pipeline", () => {
  it("executes the full observe -> detect -> sanitize -> verify -> overlay -> transmit cycle", async () => {
    // 1. Setup realistic mock webpage DOM
    document.body.innerHTML = `
      <div id="checkout-container">
        <h1>Payment & Security Verification</h1>
        <form id="billing-form">
          <label for="card_num">Card Number:</label>
          <input id="card_num" name="card_num" value="4532 0151 1283 0366" />

          <label for="ssn_val">Social Security Number:</label>
          <input id="ssn_val" name="ssn_val" value="123-45-6789" />

          <p id="contact-info">Confirmation will be sent to alice@company.org</p>

          <button id="submit-btn" type="submit">Submit Order</button>
        </form>
      </div>
    `;

    const cycleId = "e2e-cycle-98765";

    // 2. Observe & Extract DOM snapshot
    const domSnapshot = extractDomSnapshot(document.body);
    expect(domSnapshot.nodes.length).toBeGreaterThanOrEqual(5);

    // 3. Background Routing & Sanitization
    const response = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: cycleId,
      url: "https://shop.example.com/checkout",
      timestamp: Date.now(),
      dom_snapshot: domSnapshot
    });

    expect(response.type).toBe("DOM_SANITIZATION_SUCCESS");
    if (response.type !== "DOM_SANITIZATION_SUCCESS") return;

    expect(response.status).toBe("VERIFIED");
    expect(response.overlay_markers.length).toBeGreaterThanOrEqual(2);

    // 4. Non-Destructive Audit Overlay Painting
    const overlay = new AuditOverlayManager();
    overlay.ensureContainer();

    // Measure paint duration
    const paintStart = performance.now();
    overlay.renderMarkersImmediate(response.overlay_markers);
    const paintDuration = performance.now() - paintStart;

    // Allow reasonable threshold in simulated JSDOM environment
    expect(paintDuration).toBeLessThan(500);
    const renderedMarkers = document.querySelectorAll(".privacy-overlay-marker");
    expect(renderedMarkers.length).toBe(response.overlay_markers.length);

    // 5. Build Final Payload and Verify Pre-Transmission Gatekeeper
    const mockVlmFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ action: "click", target: "#submit-btn" })
    });

    const gatekeeper = new NetworkTransmissionGatekeeper({
      fetchImpl: mockVlmFetch as any
    });

    const entities = response.overlay_markers.map((m) => {
      const parts = m.entity_id.split("_");
      const nodeId = parts.slice(1, -1).join("_");
      return {
        id: m.entity_id,
        category: m.category,
        token: (m.category === "FINANCIAL"
          ? SemanticToken.FINANCIAL
          : m.category === "IDENTITY"
          ? SemanticToken.IDENTITY
          : SemanticToken.CONTACT) as SemanticToken,
        nodeId,
        bounds: { ...m.bounds, top: m.bounds.y, left: m.bounds.x, bottom: m.bounds.y + m.bounds.height, right: m.bounds.x + m.bounds.width },
        associatedLabelNodeIds: [],
        confidence: 0.99,
        verified: true
      };
    });

    const manifest = buildRedactionManifest({
      cycleId,
      entities
    });

    const payload = buildSanitizedPayload({
      cycleId,
      entities,
      domTree: snapshotToTree(domSnapshot),
      durationMs: 45
    });

    const vlmResponse = await gatekeeper.transmit(payload, manifest);
    expect(vlmResponse).toEqual({ action: "click", target: "#submit-btn" });

    // 6. Zero-Leakage & Live DOM Integrity Invariants
    const serializedCallBody = mockVlmFetch.mock.calls[0][1].body;
    expect(serializedCallBody).not.toContain("4532 0151 1283 0366");
    expect(serializedCallBody).not.toContain("123-45-6789");
    expect(serializedCallBody).toContain(SemanticToken.FINANCIAL);

    // Ensure live DOM input values are completely untouched
    const liveCardInput = document.getElementById("card_num") as HTMLInputElement;
    const liveSsnInput = document.getElementById("ssn_val") as HTMLInputElement;
    expect(liveCardInput.value).toBe("4532 0151 1283 0366");
    expect(liveSsnInput.value).toBe("123-45-6789");

    overlay.destroy();
  });
});
