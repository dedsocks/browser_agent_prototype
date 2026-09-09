# Internal Contract: Action Execution & Content Script Protocol

**Feature**: `002-perception-action-loop`  
**Date**: 2026-09-09  

---

## Overview

Defines the message exchange protocol between the **Agent Controller** (running in the background service worker) and the **Content Script Action Executor** (running in the active webpage context).

---

## Message Schemas

### 1. Execute Validated Action (`EXECUTE_ACTION`)

**Direction**: Background Service Worker → Content Script

```typescript
export interface ExecuteActionMessage {
  type: "EXECUTE_ACTION";
  cycleId: string;
  action: AgentAction;
  validationResult: ValidationResult;
}
```

**Response**: Content Script → Background Service Worker

```typescript
export interface ExecuteActionResponse {
  type: "EXECUTE_ACTION_RESULT";
  cycleId: string;
  success: boolean;
  error?: string;
  durationMs: number;
}
```

### 2. Request Human Intervention (`TRIGGER_INTERVENTION_UI`)

**Direction**: Background Service Worker → Content Script

```typescript
export interface TriggerInterventionUiMessage {
  type: "TRIGGER_INTERVENTION_UI";
  context: HumanInterventionContext;
}
```

**Response**:

```typescript
export interface TriggerInterventionUiResponse {
  type: "INTERVENTION_UI_ACK";
  acknowledged: boolean;
}
```

### 3. Clear Human Intervention UI (`CLEAR_INTERVENTION_UI`)

**Direction**: Background Service Worker → Content Script

```typescript
export interface ClearInterventionUiMessage {
  type: "CLEAR_INTERVENTION_UI";
}
```

### 4. Query Live Target Element (`RESOLVE_TARGET_ELEMENT`)

**Direction**: Background Service Worker → Content Script

```typescript
export interface ResolveTargetElementMessage {
  type: "RESOLVE_TARGET_ELEMENT";
  target: TargetSelector;
}

export interface ResolveTargetElementResponse {
  found: boolean;
  isInteractive: boolean;
  isVisible: boolean;
  isCredentialField: boolean;
  currentBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nodeId?: string;
  tagName?: string;
  error?: string;
}
```
