import { describe, it, expect } from "vitest";
import { extractDomSnapshot } from "../../src/content/dom-extractor.js";
import { handleDomSnapshotRequest } from "../../src/background/index.js";
import { RedactionCategory } from "../../src/common/types.js";

describe("Real-World Forms & Empty Credential Detection", () => {
  it("detects empty login form inputs (password, email, username) via attribute heuristics", async () => {
    document.body.innerHTML = `
      <form id="login">
        <label for="username">Username or Email</label>
        <input id="username" name="email" type="email" placeholder="you@domain.com" />

        <label for="password">Password</label>
        <input id="password" name="pwd" type="password" placeholder="Password" />

        <input type="hidden" name="csrf_token" value="abc123secret" />
      </form>
    `;

    const snapshot = extractDomSnapshot(document.body);
    const response = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: "test-login-real-world",
      url: "https://example.com/login",
      timestamp: Date.now(),
      dom_snapshot: snapshot
    });

    expect(response.type).toBe("DOM_SANITIZATION_SUCCESS");
    if (response.type !== "DOM_SANITIZATION_SUCCESS") return;

    // Both email (CONTACT) and password (CREDENTIAL) should be marked
    const categories = response.overlay_markers.map(m => m.category);
    expect(categories).toContain(RedactionCategory.CONTACT);
    expect(categories).toContain(RedactionCategory.CREDENTIAL);

    // Hidden CSRF token should NOT create an overlay marker
    const hasHiddenMarker = response.overlay_markers.some(m => m.entity_id.includes("csrf_token"));
    expect(hasHiddenMarker).toBe(false);
  });

  it("detects 2FA OTP codes, API tokens, and credit card checkout fields even when empty", async () => {
    document.body.innerHTML = `
      <div id="checkout">
        <input id="otp" name="otp_code" placeholder="Enter 6-digit OTP" />
        <input id="api" name="api_key" placeholder="Bearer Token / Secret" />
        <input id="cc" autocomplete="cc-number" placeholder="Card Number" />
      </div>
    `;

    const snapshot = extractDomSnapshot(document.body);
    const response = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: "test-checkout-real-world",
      url: "https://example.com/checkout",
      timestamp: Date.now(),
      dom_snapshot: snapshot
    });

    expect(response.type).toBe("DOM_SANITIZATION_SUCCESS");
    if (response.type !== "DOM_SANITIZATION_SUCCESS") return;

    const categories = response.overlay_markers.map(m => m.category);
    expect(categories).toContain(RedactionCategory.CREDENTIAL); // OTP & API Key
    expect(categories).toContain(RedactionCategory.FINANCIAL);  // CC number
  });
});
