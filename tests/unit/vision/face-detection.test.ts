import { describe, it, expect, vi, beforeEach } from "vitest";
import { findVisibleImageTargets, scanFacesOnPage } from "../../../src/content/face-scanner.js";
import { RedactionCategory, SemanticToken } from "../../../src/common/types.js";
import { CATEGORY_COLOR_MAP, CATEGORY_LABEL_MAP, CATEGORY_TOKEN_MAP } from "../../../src/common/constants.js";

describe("Face Detection & Biometric Visual Protection (Constitution Article X & IX)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("verifies SemanticToken and color mappings for BIOMETRIC_VISUAL", () => {
    expect(SemanticToken.BIOMETRIC_VISUAL).toBe("<REDACTED_BIOMETRIC_VISUAL>");
    expect(CATEGORY_TOKEN_MAP[RedactionCategory.BIOMETRIC_VISUAL]).toBe(SemanticToken.BIOMETRIC_VISUAL);
    expect(CATEGORY_COLOR_MAP[RedactionCategory.BIOMETRIC_VISUAL]).toBe("#805AD5"); // Purple
    expect(CATEGORY_LABEL_MAP[RedactionCategory.BIOMETRIC_VISUAL]).toBe("Protected: Biometric/Visual");
  });

  it("discovers visible image elements in the live DOM", () => {
    const img = document.createElement("img");
    img.id = "user_avatar";
    img.src = "https://example.com/avatar.jpg";
    img.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 120,
      height: 120,
      right: 220,
      bottom: 170,
      x: 100,
      y: 50,
      toJSON: () => {}
    });
    document.body.appendChild(img);

    const targets = findVisibleImageTargets();
    expect(targets.length).toBe(1);
    expect(targets[0].nodeId).toBe("user_avatar");
    expect(targets[0].bounds.width).toBe(120);
    expect(targets[0].bounds.height).toBe(120);
  });

  it("converts detected face coordinates into purple Audit Overlay markers", async () => {
    const img = document.createElement("img");
    img.id = "face_portrait";
    img.src = "https://example.com/portrait.jpg";
    img.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 120,
      height: 120,
      right: 220,
      bottom: 170,
      x: 100,
      y: 50,
      toJSON: () => {}
    });
    document.body.appendChild(img);

    // Mock chrome.runtime.sendMessage returning detected face box
    (globalThis as any).chrome = {
      runtime: {
        id: "mock_extension_id",
        sendMessage: vi.fn((msg, cb) => {
          if (msg.type === "DETECT_PAGE_FACES") {
            cb({
              success: true,
              results: [
                {
                  nodeId: "face_portrait",
                  faceBounds: [{ x: 120, y: 70, width: 60, height: 60 }]
                }
              ]
            });
          }
        })
      }
    };

    const markers = await scanFacesOnPage();
    expect(markers.length).toBe(1);
    expect(markers[0].category).toBe(RedactionCategory.BIOMETRIC_VISUAL);
    expect(markers[0].color).toBe("#805AD5");
    expect(markers[0].label).toBe("Protected: Biometric/Visual");
    expect(markers[0].bounds.x).toBe(120);
    expect(markers[0].bounds.width).toBe(60);
  });
});
