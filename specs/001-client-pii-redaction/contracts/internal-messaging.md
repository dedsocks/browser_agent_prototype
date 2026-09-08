# Internal Messaging Contract: Content Script <-> Background Privacy Boundary

**Feature**: Client-Side PII Redaction Pipeline (`001-client-pii-redaction`)  
**Status**: Completed  
**Alignment**: Constitution v1.5.0 (Principles IV, IX, XIV)

---

## Overview
All heavy DOM processing, regex evaluation, checksum validation, and pre-transmission verification execute in the background extension worker (or `chrome.offscreen` context). The content script interacts with the privacy boundary using asynchronous message channels.

---

## Message Schemas

### 1. Request: `PROCESS_DOM_SNAPSHOT`
Sent from Content Script to Background Worker.

```typescript
export interface ProcessDomSnapshotRequest {
  type: "PROCESS_DOM_SNAPSHOT";
  cycle_id: string;
  url: string;
  timestamp: number;
  dom_snapshot: {
    root_node_id: string;
    nodes: Array<{
      node_id: string;
      tag: string;
      role?: string;
      text?: string;
      value?: string;
      placeholder?: string;
      attributes: Record<string, string>;
      bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      parent_id?: string;
      children_ids: string[];
    }>;
  };
}
```

---

### 2. Response: `DOM_SANITIZATION_SUCCESS`
Sent from Background Worker to Content Script upon successful verification.

```typescript
export interface DomSanitizationSuccessResponse {
  type: "DOM_SANITIZATION_SUCCESS";
  cycle_id: string;
  overlay_markers: Array<{
    entity_id: string;
    category: "FINANCIAL" | "IDENTITY" | "CONTACT" | "CREDENTIAL" | "BIOMETRIC_VISUAL";
    color: string;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    label: string;
  }>;
  status: "VERIFIED";
}
```

---

### 3. Response: `DOM_SANITIZATION_FAILURE`
Sent from Background Worker to Content Script if verification fails.

```typescript
export interface DomSanitizationFailureResponse {
  type: "DOM_SANITIZATION_FAILURE";
  cycle_id: string;
  error_code: "LEAK_DETECTED" | "VERIFICATION_TIMEOUT" | "INTERNAL_FAULT";
  diagnostic_message: string;
  action: "HALT_TASK_SESSION";
}
```
