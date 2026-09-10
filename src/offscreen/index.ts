import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { SimpleBounds, VisionTier } from "../common/types.js";

declare const chrome: any;

let faceDetectorGpu: FaceDetector | null = null;
let faceDetectorCpu: FaceDetector | null = null;
let initPromise: Promise<void> | null = null;

async function initDetectors(): Promise<void> {
  try {
    const wasmFileset = await FilesetResolver.forVisionTasks(
      chrome.runtime.getURL("dist/wasm")
    );

    const modelAssetPath = chrome.runtime.getURL("dist/models/blaze_face_short_range.tflite");

    try {
      faceDetectorGpu = await FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath,
          delegate: "GPU"
        },
        runningMode: "IMAGE"
      });
      console.log("[Offscreen] WebGPU FaceDetector initialized successfully");
    } catch (gpuErr: any) {
      console.warn("[Offscreen] WebGPU FaceDetector initialization failed, degrading to CPU WASM:", gpuErr?.message);
    }

    try {
      faceDetectorCpu = await FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath,
          delegate: "CPU"
        },
        runningMode: "IMAGE"
      });
      console.log("[Offscreen] CPU WASM FaceDetector initialized successfully");
    } catch (cpuErr: any) {
      console.warn("[Offscreen] CPU FaceDetector initialization failed:", cpuErr?.message);
    }
  } catch (err: any) {
    console.error("[Offscreen] Failed to load FilesetResolver:", err?.message);
  }
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initDetectors();
  }
  return initPromise;
}

/**
 * Robust image loader with fetch fallback for cross-origin extension permissions
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If direct load fails (e.g. CORS), fetch via extension host permissions
      fetch(src)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(fallbackImg);
          };
          fallbackImg.onerror = (e) => {
            URL.revokeObjectURL(objectUrl);
            reject(e);
          };
          fallbackImg.src = objectUrl;
        })
        .catch(reject);
    };
    img.src = src;
  });
}

/**
 * Fallback pixel-based face/skin region heuristic if neural models cannot be loaded.
 */
function fallbackSkinDetect(canvas: HTMLCanvasElement): SimpleBounds[] {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const w = canvas.width;
    const h = canvas.height;
    if (w < 20 || h < 20) return [];
    
    // Scale down for fast heuristic sampling
    const sw = Math.min(w, 120);
    const sh = Math.min(h, 120);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sctx = sampleCanvas.getContext("2d");
    if (!sctx) return [];
    sctx.drawImage(canvas, 0, 0, sw, sh);
    const imgData = sctx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    let minX = sw, maxX = 0, minY = sh, maxY = 0, skinPixels = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Standard normalized skin color detection heuristic
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - Math.min(g, b)) > 15 && Math.abs(r - g) > 15) {
          skinPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If skin pixels form a coherent central region (>12% of image)
    const totalPixels = sw * sh;
    if (skinPixels > totalPixels * 0.12 && maxX > minX && maxY > minY) {
      const scaleX = w / sw;
      const scaleY = h / sh;
      return [{
        x: Math.round(minX * scaleX),
        y: Math.round(minY * scaleY),
        width: Math.round((maxX - minX) * scaleX),
        height: Math.round((maxY - minY) * scaleY)
      }];
    }
  } catch {
    // Non-critical fallback
  }
  return [];
}

/**
 * Detects faces within an image or canvas element
 */
async function detectFacesFromElement(
  source: HTMLImageElement | HTMLCanvasElement,
  tier: VisionTier = VisionTier.TIER_1_WEBGPU
): Promise<SimpleBounds[]> {
  await ensureInitialized();

  const detector = tier === VisionTier.TIER_1_WEBGPU
    ? (faceDetectorGpu || faceDetectorCpu)
    : faceDetectorCpu;

  if (detector) {
    try {
      const results = detector.detect(source);
      const bounds: SimpleBounds[] = [];
      for (const detection of results.detections) {
        if (detection.boundingBox) {
          bounds.push({
            x: Math.round(detection.boundingBox.originX),
            y: Math.round(detection.boundingBox.originY),
            width: Math.round(detection.boundingBox.width),
            height: Math.round(detection.boundingBox.height)
          });
        }
      }
      if (bounds.length > 0) return bounds;
    } catch (e: any) {
      console.warn("[Offscreen] Detection error:", e?.message);
    }
  }

  // Fallback to canvas skin heuristic if neural detector produced no bounds
  if (source instanceof HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(source, 0, 0);
      return fallbackSkinDetect(canvas);
    }
  } else if (source instanceof HTMLCanvasElement) {
    return fallbackSkinDetect(source);
  }

  return [];
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (res: any) => void) => {
    // Direct single ImageData processing
    if (message?.type === "DETECT_FACES") {
      (async () => {
        try {
          const { width, height, data, tier } = message.payload;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not acquire 2D context");
          const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
          ctx.putImageData(imgData, 0, 0);

          const bounds = await detectFacesFromElement(canvas, tier);
          sendResponse({ success: true, bounds });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || "Detection failed" });
        }
      })();
      return true;
    }

    // Batch image scanning for live webpage images
    if (message?.type === "DETECT_PAGE_FACES") {
      (async () => {
        try {
          const { images, tier } = message.payload;
          const results: Array<{ nodeId: string; faceBounds: SimpleBounds[] }> = [];

          for (const item of images) {
            try {
              if (!item.src) continue;
              const img = await loadImage(item.src);
              const naturalW = img.naturalWidth || item.bounds.width;
              const naturalH = img.naturalHeight || item.bounds.height;
              if (naturalW === 0 || naturalH === 0) continue;

              const detectedBoxes = await detectFacesFromElement(img, tier);

              // Map face natural coordinates to page viewport coordinates
              const scaleX = item.bounds.width / naturalW;
              const scaleY = item.bounds.height / naturalH;

              const viewportFaceBounds: SimpleBounds[] = detectedBoxes.map((b) => ({
                x: Math.round(item.bounds.x + b.x * scaleX),
                y: Math.round(item.bounds.y + b.y * scaleY),
                width: Math.round(b.width * scaleX),
                height: Math.round(b.height * scaleY)
              }));

              if (viewportFaceBounds.length > 0) {
                results.push({
                  nodeId: item.nodeId,
                  faceBounds: viewportFaceBounds
                });
              }
            } catch (imgErr: any) {
              // Ignore single image failure, continue with remaining
              console.warn(`[Offscreen] Failed to process image ${item.nodeId}:`, imgErr?.message);
            }
          }

          sendResponse({ success: true, results });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || "Batch detection failed" });
        }
      })();
      return true;
    }
  });
}

// Kick off initialization immediately
ensureInitialized();
