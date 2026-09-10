/**
 * Client-Side Image & Face Scanner
 * Discovers visible images and canvases on the active page, submits them
 * to the background/offscreen local vision engine, and constructs
 * non-destructive purple Audit Overlay markers (#805AD5) per Article IX & X.
 */

import { AuditOverlayMarker, RedactionCategory, SimpleBounds } from "../common/types.js";
import { CATEGORY_COLOR_MAP, CATEGORY_LABEL_MAP } from "../common/constants.js";
import { getOrCreateNodeId } from "./dom-extractor.js";

declare const chrome: any;

export interface PageImageTarget {
  nodeId: string;
  src: string;
  bounds: SimpleBounds;
}

/**
 * Finds all visible images and canvases within or near the current viewport.
 */
export function findVisibleImageTargets(): PageImageTarget[] {
  if (typeof document === "undefined") return [];

  const targets: PageImageTarget[] = [];
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const scrollX = window.scrollX || window.pageXOffset || 0;

  // 1. Scan <img> elements
  const images = Array.from(document.querySelectorAll("img"));
  for (const img of images) {
    // Avoid our own UI elements
    if (img.closest("#__privacy_audit_overlay")) continue;

    const rect = img.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 30) continue;

    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:image/svg")) continue;

    const nodeId = getOrCreateNodeId(img);
    targets.push({
      nodeId,
      src,
      bounds: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  // 2. Scan <canvas> elements
  const canvases = Array.from(document.querySelectorAll("canvas"));
  for (const canvas of canvases) {
    if (canvas.closest("#__privacy_audit_overlay")) continue;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 30) continue;

    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const nodeId = getOrCreateNodeId(canvas);
      targets.push({
        nodeId,
        src: dataUrl,
        bounds: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });
    } catch {
      // Ignore cross-origin tainted canvas
    }
  }

  return targets;
}

/**
 * Dispatches image targets to the local vision engine and converts detections
 * into purple AuditOverlayMarker items.
 */
export async function scanFacesOnPage(): Promise<AuditOverlayMarker[]> {
  const targets = findVisibleImageTargets();
  if (targets.length === 0) return [];

  if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.sendMessage) {
    try {
      const response: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "DETECT_PAGE_FACES",
            payload: { images: targets }
          },
          (res: any) => {
            if (chrome.runtime?.lastError) {
              resolve(null);
            } else {
              resolve(res);
            }
          }
        );
      });

      if (response?.success && Array.isArray(response.results)) {
        const markers: AuditOverlayMarker[] = [];
        for (const item of response.results) {
          for (let i = 0; i < item.faceBounds.length; i++) {
            const fb = item.faceBounds[i];
            markers.push({
              entity_id: `face_${item.nodeId}_${i}`,
              category: RedactionCategory.BIOMETRIC_VISUAL,
              color: CATEGORY_COLOR_MAP[RedactionCategory.BIOMETRIC_VISUAL], // "#805AD5"
              label: CATEGORY_LABEL_MAP[RedactionCategory.BIOMETRIC_VISUAL], // "Protected: Biometric/Visual"
              bounds: {
                x: fb.x,
                y: fb.y,
                width: fb.width,
                height: fb.height
              }
            });
          }
        }
        return markers;
      }
    } catch {
      // Fallback
    }
  }

  return [];
}
