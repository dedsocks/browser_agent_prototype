/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resolveTargetElement, isElementVisible } from "../../../src/content/target-resolver.js";
import { TargetSelector } from "../../../src/common/types.js";

describe("Target Element Resolver & Geometric Verification", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container" style="width: 800px; height: 600px;">
        <h1 id="title">Flight Search</h1>
        <form id="search-form">
          <input type="text" id="origin" name="origin" value="SFO" style="width: 200px; height: 40px;" />
          <input type="password" id="secret-pin" name="pin" style="width: 100px; height: 40px;" />
          <button type="submit" id="submit-btn" style="width: 120px; height: 45px;">Find Flights</button>
        </form>
        <div id="hidden-el" style="display: none;">Invisible</div>
      </div>
    `;
  });

  it("resolves element by nodeId / id attribute", () => {
    const target: TargetSelector = { nodeId: "origin" };
    const res = resolveTargetElement(target);

    expect(res.found).toBe(true);
    expect(res.tagName).toBe("input");
    expect(res.isCredentialField).toBe(false);
  });

  it("resolves element by CSS selector", () => {
    const target: TargetSelector = { cssSelector: "button[type='submit']" };
    const res = resolveTargetElement(target);

    expect(res.found).toBe(true);
    expect(res.nodeId).toBe("submit-btn");
    expect(res.isInteractive).toBe(true);
  });

  it("identifies credential / password fields", () => {
    const target: TargetSelector = { cssSelector: "#secret-pin" };
    const res = resolveTargetElement(target);

    expect(res.found).toBe(true);
    expect(res.isCredentialField).toBe(true);
  });

  it("reports target not found if selector does not match", () => {
    const target: TargetSelector = { cssSelector: "#nonexistent" };
    const res = resolveTargetElement(target);

    expect(res.found).toBe(false);
    expect(res.error).toContain("Element not found");
  });

  it("reports target not visible for hidden elements", () => {
    const target: TargetSelector = { cssSelector: "#hidden-el" };
    const res = resolveTargetElement(target);

    expect(res.found).toBe(true);
    expect(res.isVisible).toBe(false);
  });
});
