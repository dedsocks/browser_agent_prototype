/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { extractShadowSubtree, resolveElementInShadowRoots } from "../../../src/content/shadow-dom-extractor.js";
import { extractDomSnapshot } from "../../../src/content/dom-extractor.js";

describe("Shadow DOM Subtree Extraction & Target Resolution", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="host-element">
        <p>Light DOM paragraph</p>
      </div>
    `;

    const host = document.getElementById("host-element")!;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <div id="shadow-container">
        <label for="shadow-card">Secret Card</label>
        <input type="text" id="shadow-card" value="4532 1111 2222 3333" />
        <button id="shadow-submit">Pay Inside Shadow</button>
      </div>
    `;
  });

  it("recursively extracts elements inside open Shadow DOM roots", () => {
    const host = document.getElementById("host-element")!;
    const nodes = extractShadowSubtree(host.shadowRoot!, "host-element");

    expect(nodes.length).toBeGreaterThan(0);
    const cardNode = nodes.find(n => n.node_id === "shadow-card");
    expect(cardNode).toBeDefined();
    expect(cardNode?.value).toBe("4532 1111 2222 3333");
    expect(cardNode?.shadow_host_id).toBe("host-element");
  });

  it("extractDomSnapshot includes shadow DOM nodes in global snapshot", () => {
    const snapshot = extractDomSnapshot(document.body);
    const shadowNode = snapshot.nodes.find(n => n.node_id === "shadow-card");

    expect(shadowNode).toBeDefined();
    expect(shadowNode?.is_shadow_root).toBe(true);
  });

  it("locates and resolves elements nested inside shadow roots", () => {
    const foundEl = resolveElementInShadowRoots("shadow-submit");
    expect(foundEl).not.toBeNull();
    expect(foundEl?.id).toBe("shadow-submit");
    expect(foundEl?.tagName.toLowerCase()).toBe("button");
  });
});
