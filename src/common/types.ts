/**
 * Core type definitions and data models for Client-Side PII Redaction Pipeline.
 * Complies with Constitution v1.5.0 and data-model.md.
 */

export enum RedactionCategory {
  FINANCIAL = "FINANCIAL",
  IDENTITY = "IDENTITY",
  CONTACT = "CONTACT",
  CREDENTIAL = "CREDENTIAL",
  BIOMETRIC_VISUAL = "BIOMETRIC_VISUAL"
}

export enum SemanticToken {
  FINANCIAL = "<REDACTED_FINANCIAL>",
  IDENTITY = "<REDACTED_IDENTITY>",
  CONTACT = "<REDACTED_CONTACT>",
  CREDENTIAL = "<REDACTED_CREDENTIAL>"
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SimpleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedEntity {
  id: string;
  category: RedactionCategory;
  token: SemanticToken;
  nodeId: string;
  selector?: string;
  bounds: BoundingBox;
  associatedLabelNodeIds: string[];
  confidence: number;
  verified: boolean;
}

export type ScopeTier = "TIER_1_CORE_EXTENDED" | "TIER_2_CORE_ONLY";

export type VerificationStatus = "PENDING" | "VERIFIED" | "FAILED";

export interface RedactionManifest {
  cycleId: string;
  timestamp: string;
  scopeTier: ScopeTier;
  entities: DetectedEntity[];
  totalDetected: number;
  labelsScrubbedCount: number;
  verificationStatus: VerificationStatus;
  checksum: string;
}

export interface SanitizedDomNode {
  node_id: string;
  tag: string;
  role?: string;
  bounds: SimpleBounds;
  text?: string;
  attributes?: Record<string, string>;
  children?: SanitizedDomNode[];
}

export interface SanitizedPayloadEnvelope {
  schema_version: "1.5.0";
  cycle_id: string;
  token_manifest: SemanticToken[];
  sanitized_dom_tree: SanitizedDomNode;
  metrics: {
    sanitization_duration_ms: number;
    entities_redacted_count: number;
  };
}

export interface AuditOverlayMarker {
  entity_id: string;
  bounds: SimpleBounds;
  category: RedactionCategory;
  color: string;
  label: string;
}

export interface PrivacyAbortEvent {
  eventType: "PRIVACY_ABORT";
  cycleId: string;
  timestamp: string;
  reason: string;
  failedStage: "DETECTION" | "TOKENIZATION" | "VERIFICATION" | "TIMEOUT";
  actionRequired: "HALT_TASK_SESSION";
}

// Internal Messaging
export interface DomSnapshotNode {
  node_id: string;
  tag: string;
  role?: string;
  text?: string;
  value?: string;
  placeholder?: string;
  attributes: Record<string, string>;
  bounds: SimpleBounds;
  parent_id?: string;
  children_ids: string[];
}

export interface DomSnapshot {
  root_node_id: string;
  nodes: DomSnapshotNode[];
}

export interface ProcessDomSnapshotRequest {
  type: "PROCESS_DOM_SNAPSHOT";
  cycle_id: string;
  url: string;
  timestamp: number;
  dom_snapshot: DomSnapshot;
}

export interface DomSanitizationSuccessResponse {
  type: "DOM_SANITIZATION_SUCCESS";
  cycle_id: string;
  overlay_markers: AuditOverlayMarker[];
  status: "VERIFIED";
}

export interface DomSanitizationFailureResponse {
  type: "DOM_SANITIZATION_FAILURE";
  cycle_id: string;
  error_code: "LEAK_DETECTED" | "VERIFICATION_TIMEOUT" | "INTERNAL_FAULT";
  diagnostic_message: string;
  action: "HALT_TASK_SESSION";
}

export type ExtensionInternalMessage =
  | ProcessDomSnapshotRequest
  | DomSanitizationSuccessResponse
  | DomSanitizationFailureResponse
  | ExecuteActionMessage
  | ExecuteActionResponse
  | TriggerInterventionUiMessage
  | TriggerInterventionUiResponse
  | ClearInterventionUiMessage
  | ResolveTargetElementMessage
  | ResolveTargetElementResponse;

// Agent Controller & Lifecycle (Constitution Articles XIII, XIV, XV, XVI)
export enum TaskState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  SANITIZING = "SANITIZING",
  AWAITING_REASONING = "AWAITING_REASONING",
  VALIDATING_ACTION = "VALIDATING_ACTION",
  EXECUTING_ACTION = "EXECUTING_ACTION",
  PAUSED = "PAUSED",
  INTERVENTION_REQUIRED = "INTERVENTION_REQUIRED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export type ActionType = "click" | "type" | "scroll" | "navigate";

export interface TargetSelector {
  nodeId?: string;
  cssSelector?: string;
  xpath?: string;
  expectedText?: string;
  expectedBounds?: SimpleBounds;
}

export interface AgentAction {
  id: string;
  type: ActionType;
  target?: TargetSelector;
  value?: string;
  scrollOffset?: { x: number; y: number };
  thought?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorCode?: "UNSUPPORTED_ACTION" | "TARGET_NOT_FOUND" | "TARGET_NOT_VISIBLE" | "GEOMETRIC_MISMATCH" | "SENSITIVE_TARGET_BLOCKED" | "VALIDATION_FAULT";
  diagnosticMessage?: string;
  requiresIntervention?: boolean;
  interventionReason?: string;
  targetElementBounds?: SimpleBounds;
}

export interface HumanInterventionContext {
  cycleId: string;
  targetFieldId?: string;
  targetFieldName?: string;
  secretType: "PASSWORD" | "CREDENTIAL" | "PAYMENT_CARD" | "MFA_CODE" | "MANUAL_CAPTCHA";
  promptMessage: string;
  timestamp: string;
}

export interface StepLogEntry {
  stepIndex: number;
  cycleId: string;
  timestamp: string;
  state: TaskState;
  actionProposed?: AgentAction;
  validationResult?: ValidationResult;
  executionOutcome?: {
    success: boolean;
    error?: string;
    durationMs: number;
  };
  pageUrl: string;
}

export interface TaskSession {
  sessionId: string;
  goal: string;
  state: TaskState;
  activeUrl: string;
  pausedUrl?: string;
  urlMismatchWarning?: boolean;
  currentCycleId?: string;
  interventionContext?: HumanInterventionContext;
  stepHistory: StepLogEntry[];
  totalCyclesCompleted: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

// Internal Action Execution Contracts
export interface ExecuteActionMessage {
  type: "EXECUTE_ACTION";
  cycleId: string;
  action: AgentAction;
  validationResult: ValidationResult;
}

export interface ExecuteActionResponse {
  type: "EXECUTE_ACTION_RESULT";
  cycleId: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface TriggerInterventionUiMessage {
  type: "TRIGGER_INTERVENTION_UI";
  context: HumanInterventionContext;
}

export interface TriggerInterventionUiResponse {
  type: "INTERVENTION_UI_ACK";
  acknowledged: boolean;
}

export interface ClearInterventionUiMessage {
  type: "CLEAR_INTERVENTION_UI";
}

export interface ResolveTargetElementMessage {
  type: "RESOLVE_TARGET_ELEMENT";
  target: TargetSelector;
}

export interface ResolveTargetElementResponse {
  type?: "RESOLVE_TARGET_ELEMENT_RESPONSE";
  found: boolean;
  isInteractive: boolean;
  isVisible: boolean;
  isCredentialField: boolean;
  currentBounds?: SimpleBounds;
  nodeId?: string;
  tagName?: string;
  error?: string;
}
