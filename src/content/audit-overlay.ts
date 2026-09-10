/**
 * Real-Time Non-Destructive Audit Overlay Manager
 * Injects and manages visual indicator overlays over protected DOM elements.
 * Adheres to Constitution Principle IX (<50ms render budget, coalesced updates, non-destructive DOM).
 */

import { AuditOverlayMarker } from "../common/types.js";
import { PERFORMANCE_BUDGETS } from "../common/constants.js";

export class AuditOverlayManager {
  private container: HTMLDivElement | null = null;
  private pendingMarkers: AuditOverlayMarker[] | null = null;
  private rafId: number | null = null;
  private lastRenderTimestamp = 0;

  constructor() {
    this.ensureContainer();
  }

  /**
   * Ensures the root overlay container exists and has pointer-events: none.
   */
  public ensureContainer(): HTMLDivElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    let existing = document.getElementById("__privacy_audit_overlay") as HTMLDivElement | null;
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "__privacy_audit_overlay";
      existing.style.position = "fixed";
      existing.style.top = "0";
      existing.style.left = "0";
      existing.style.width = "100%";
      existing.style.height = "100%";
      existing.style.pointerEvents = "none";
      existing.style.zIndex = "2147483647";
      existing.style.overflow = "hidden";
      document.body.appendChild(existing);
    }

    this.container = existing;
    return existing;
  }

  /**
   * Renders markers immediately within the <50ms performance budget.
   */
  public renderMarkersImmediate(markers: AuditOverlayMarker[]): void {
    const container = this.ensureContainer();

    const fragment = document.createDocumentFragment();
    for (const marker of markers) {
      const w = Math.max(marker.bounds.width, 10);
      const h = Math.max(marker.bounds.height, 10);
      
      const el = document.createElement("div");
      el.className = "privacy-overlay-marker";
      el.style.cssText = `position:absolute;left:${marker.bounds.x}px;top:${marker.bounds.y}px;width:${w}px;height:${h}px;border:2px solid ${marker.color};background-color:${marker.color}22;box-sizing:border-box;border-radius:3px;pointer-events:none;`;
      
      const badge = document.createElement("span");
      badge.className = "privacy-overlay-badge";
      badge.style.cssText = `position:absolute;top:-18px;left:-2px;background-color:${marker.color};color:#FFFFFF;font-size:10px;font-weight:bold;padding:1px 4px;border-radius:2px;white-space:nowrap;pointer-events:none;`;
      badge.textContent = marker.label;
      
      el.appendChild(badge);
      fragment.appendChild(el);
    }

    container.textContent = "";
    container.appendChild(fragment);
    this.lastRenderTimestamp = Date.now();
  }

  /**
   * Coalesced render loop: throttles rapid sequential DOM updates to <= 1 per 100ms
   * using requestAnimationFrame per Constitution Principle IX.
   */
  public renderMarkersCoalesced(markers: AuditOverlayMarker[]): void {
    this.pendingMarkers = markers;

    if (this.rafId !== null) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastRenderTimestamp;
    const delay = Math.max(0, PERFORMANCE_BUDGETS.OVERLAY_COALESCE_INTERVAL_MS - elapsed);

    setTimeout(() => {
      this.rafId = requestAnimationFrame(() => {
        if (this.pendingMarkers) {
          this.renderMarkersImmediate(this.pendingMarkers);
          this.pendingMarkers = null;
        }
        this.rafId = null;
      });
    }, delay);
  }

  /**
   * Clears all rendered overlay markers.
   */
  public clear(): void {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.pendingMarkers = null;
  }

  /**
   * Destroys the overlay container from the live document.
   */
  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.pendingMarkers = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const auditOverlayManager = new AuditOverlayManager();
