# Research: Local Vision Processing & Shadow DOM Privacy Engine

**Feature**: `004-local-vision-processing`  
**Date**: 2026-09-09  

---

## 1. Two-Tier Local Vision Architecture (WebGPU -> WASM)

### Decision
Implement `LocalVisionEngine`:
- Tier 1: Queries `navigator.gpu.requestAdapter()` and `adapter.requestDevice()`. If successful, sets active tier to `TIER_1_WEBGPU`.
- Tier 2: If WebGPU is null, fails, or throws device loss, initializes the WebAssembly / CPU SIMD runtime (`TIER_2_WASM_CPU`).
- Fail-Closed: If both runtimes fail to initialize or throw during inference, marks status `UNAVAILABLE` and halts the task session per Constitution Article V.

### Rationale
- Constitution Article II requires WebGPU execution first with mandatory graceful degradation to WebAssembly CPU execution.
- Prevents silent fallback to cloud vision services.

---

## 2. Shadow DOM Subtree Traversal

### Decision
Recursively traverse DOM nodes:
- Check `node.shadowRoot`.
- If a shadow root is attached, extract its child nodes, marking them with `isShadowRoot: true` and `shadowHostId: host.node_id`.
- Re-target resolution is updated to traverse `host.shadowRoot.querySelector(...)` or `shadowRoot.getElementById(...)`.

### Rationale
- Standard `document.querySelector` fails across Shadow DOM boundaries.
- Web components and isolated micro-frontends hide inputs in Shadow DOM; without recursive traversal, the agent is blind to shadow controls.
