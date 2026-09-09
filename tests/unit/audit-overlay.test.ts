import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuditOverlayManager } from "../../src/content/audit-overlay.js";
import { AuditOverlayMarker, RedactionCategory } from "../../src/common/types.js";
import { CATEGORY_COLOR_MAP } from "../../src/common/constants.js";

describe("Real-Time Non-Destructive Audit Overlay", () => {
  let overlayManager: AuditOverlayManager;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <input id="card" style="position: absolute; left: 100px; top: 100px; width: 200px; height: 30px;" />
      </div>
    `;
    overlayManager = new AuditOverlayManager();
  });

  afterEach(() => {
    overlayManager.destroy();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("injects a pointer-events:none overlay container into document root", () => {
    const container = document.getElementById("__privacy_audit_overlay");
    expect(container).toBeDefined();
    expect(container?.style.pointerEvents).toBe("none");
    expect(container?.style.position).toBe("fixed");
    expect(container?.style.zIndex).toBe("2147483647");
  });

  it("renders non-destructive bounding box markers matching element coordinates and colors", () => {
    const markers: AuditOverlayMarker[] = [
      {
        entity_id: "ent-1",
        category: RedactionCategory.FINANCIAL,
        color: CATEGORY_COLOR_MAP[RedactionCategory.FINANCIAL],
        bounds: { x: 100, y: 100, width: 200, height: 30 },
        label: "Protected: Financial"
      }
    ];

    overlayManager.renderMarkersImmediate(markers);

    const markerEl = document.querySelector(".privacy-overlay-marker") as HTMLElement;
    expect(markerEl).toBeDefined();
    expect(markerEl.style.left).toBe("100px");
    expect(markerEl.style.top).toBe("100px");
    expect(markerEl.style.width).toBe("200px");
    expect(markerEl.style.height).toBe("30px");
    expect(markerEl.textContent).toContain("Protected: Financial");
  });

  it("completes overlay rendering well within the <50ms performance budget", () => {
    const bulkMarkers: AuditOverlayMarker[] = Array.from({ length: 10 }, (_, i) => ({
      entity_id: `ent-${i}`,
      category: RedactionCategory.IDENTITY,
      color: CATEGORY_COLOR_MAP[RedactionCategory.IDENTITY],
      bounds: { x: i * 10, y: i * 15, width: 120, height: 25 },
      label: "Protected: Identity"
    }));

    const start = performance.now();
    overlayManager.renderMarkersImmediate(bulkMarkers);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // <50ms paint budget requirement
    const renderedElements = document.querySelectorAll(".privacy-overlay-marker");
    expect(renderedElements.length).toBe(10);
  });

  it("clears markers cleanly on demand", () => {
    overlayManager.renderMarkersImmediate([
      {
        entity_id: "ent-1",
        category: RedactionCategory.CONTACT,
        color: CATEGORY_COLOR_MAP[RedactionCategory.CONTACT],
        bounds: { x: 10, y: 10, width: 50, height: 20 },
        label: "Protected: Contact"
      }
    ]);

    expect(document.querySelectorAll(".privacy-overlay-marker").length).toBe(1);
    overlayManager.clear();
    expect(document.querySelectorAll(".privacy-overlay-marker").length).toBe(0);
  });
});
