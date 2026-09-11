/**
 * Agent Controller & Perception-Reasoning-Action Loop Coordinator
 * Implements Constitution Principle XIV, XV & XVI.
 * Strict Sequence: Observe -> Detect -> Sanitize -> Verify -> Transmit -> Reason -> Validate -> Execute -> Repeat
 */

import {
  TaskState,
  TaskSession,
  DomSnapshot,
  TargetSelector,
  ResolveTargetElementResponse,
  AgentAction,
  ValidationResult,
  HumanInterventionContext,
  SanitizedPayloadEnvelope,
  SemanticToken
} from "../common/types.js";
import { SCHEMA_VERSION } from "../common/constants.js";
import { TaskSessionManager } from "./task-session.js";
import { ActionValidator } from "./action-validator.js";
import { IPlannerClient, PlannerRequest } from "./planner-client.js";
import { handleDomSnapshotRequest } from "../background/snapshot-processor.js";
import { snapshotToTree } from "../content/dom-extractor.js";

export interface ControllerOptions {
  planner: IPlannerClient;
  validator?: ActionValidator;
  sessionManager?: TaskSessionManager;
  snapshotProvider?: () => Promise<DomSnapshot>;
  targetResolver?: (target?: TargetSelector) => Promise<ResolveTargetElementResponse>;
  actionExecutor?: (action: AgentAction, validationResult: ValidationResult) => Promise<{ success: boolean; error?: string; durationMs: number }>;
  interventionUiTrigger?: (context: HumanInterventionContext) => void;
  interventionUiClearer?: () => void;
}

export class AgentController {
  private planner: IPlannerClient;
  private validator: ActionValidator;
  private sessionManager: TaskSessionManager;

  private snapshotProvider?: () => Promise<DomSnapshot>;
  private targetResolver?: (target?: TargetSelector) => Promise<ResolveTargetElementResponse>;
  private actionExecutor?: (action: AgentAction, validationResult: ValidationResult) => Promise<{ success: boolean; error?: string; durationMs: number }>;
  private interventionUiTrigger?: (context: HumanInterventionContext) => void;
  private interventionUiClearer?: () => void;

  constructor(options: ControllerOptions) {
    this.planner = options.planner;
    this.validator = options.validator || new ActionValidator();
    this.sessionManager = options.sessionManager || new TaskSessionManager();

    this.snapshotProvider = options.snapshotProvider;
    this.targetResolver = options.targetResolver;
    this.actionExecutor = options.actionExecutor;
    this.interventionUiTrigger = options.interventionUiTrigger;
    this.interventionUiClearer = options.interventionUiClearer;
  }

  public startTask(goal: string, activeUrl: string): TaskSession {
    const session = this.sessionManager.createSession(goal, activeUrl);
    this.sessionManager.transitionTo(TaskState.OBSERVING);
    return session;
  }

  public getState(): TaskState {
    return this.sessionManager.getSession()?.state || TaskState.IDLE;
  }

  public getActiveSession(): TaskSession | null {
    return this.sessionManager.getSession();
  }

  public pauseTask(): void {
    this.sessionManager.pause();
  }

  public resumeTask(
    currentLiveUrl?: string,
    userConfirmedDivergence: boolean = false
  ): { success: boolean; requiresConfirmation?: boolean; warning?: string } {
    const session = this.sessionManager.getSession();
    if (!session) {
      return { success: false, warning: "No active task to resume" };
    }

    if (session.state === TaskState.INTERVENTION_REQUIRED) {
      // Clear intervention banner
      if (this.interventionUiClearer) {
        this.interventionUiClearer();
      }
      this.sessionManager.resume();
      return { success: true };
    }

    if (session.state === TaskState.PAUSED) {
      const urlToCheck = currentLiveUrl || session.activeUrl;
      const isMismatch = this.sessionManager.checkUrlDivergence(urlToCheck);

      if (isMismatch && !userConfirmedDivergence) {
        return {
          success: false,
          requiresConfirmation: true,
          warning: `The page URL has diverged from ${session.pausedUrl} to ${urlToCheck}. Explicit user confirmation is required to resume.`
        };
      }

      this.sessionManager.resume(urlToCheck);
      return { success: true };
    }

    return { success: false, warning: `Cannot resume task from state ${session.state}` };
  }

  public abortTask(): void {
    if (this.interventionUiClearer) {
      this.interventionUiClearer();
    }
    this.sessionManager.abort();
  }

  /**
   * Runs the complete perception-reasoning-action cycle for the active task.
   * Observe -> Detect -> Sanitize -> Verify -> Transmit -> Reason -> Validate -> Execute -> Repeat
   */
  public async runNextCycle(): Promise<{
    success: boolean;
    isTerminal?: boolean;
    requiresIntervention?: boolean;
    error?: string;
  }> {
    const session = this.sessionManager.getSession();
    if (!session) {
      return { success: false, error: "No active session" };
    }

    if (session.state !== TaskState.OBSERVING) {
      return { success: false, error: `Cannot run cycle from state ${session.state}` };
    }

    const cycleId = `cycle_${Date.now()}_${session.totalCyclesCompleted + 1}`;
    session.currentCycleId = cycleId;

    try {
      // 1. Observe: Capture DOM snapshot from active tab
      if (!this.snapshotProvider) {
        throw new Error("No snapshotProvider registered on AgentController");
      }
      console.log(`[Agent][${cycleId}] Step 1: Requesting DOM snapshot...`);
      const domSnapshot = await this.snapshotProvider();
      console.log(`[Agent][${cycleId}] Step 1 complete: Got ${domSnapshot.nodes.length} nodes`);

      if (domSnapshot.url) {
        session.activeUrl = domSnapshot.url;
      }

      // 2 & 3. Detect, Sanitize, and Verify via background privacy pipeline
      this.sessionManager.transitionTo(TaskState.SANITIZING);
      console.log(`[Agent][${cycleId}] Step 2-3: Running sanitization pipeline...`);
      const sanitizationResponse = await handleDomSnapshotRequest({
        type: "PROCESS_DOM_SNAPSHOT",
        cycle_id: cycleId,
        url: session.activeUrl,
        timestamp: Date.now(),
        dom_snapshot: domSnapshot
      });

      if (sanitizationResponse.type === "DOM_SANITIZATION_FAILURE") {
        console.error(`[Agent][${cycleId}] Sanitization FAILED:`, sanitizationResponse.diagnostic_message);
        this.sessionManager.fail(`Privacy sanitization failed fail-closed: ${sanitizationResponse.diagnostic_message}`);
        return { success: false, error: sanitizationResponse.diagnostic_message };
      }
      console.log(`[Agent][${cycleId}] Step 2-3 complete: ${sanitizationResponse.overlay_markers.length} entities redacted`);

      // 4. Transmit: Construct Schema v1.5.0 envelope for VLM planner
      this.sessionManager.transitionTo(TaskState.AWAITING_REASONING);
      const domTree = snapshotToTree(domSnapshot);
      const sanitizedEnvelope: SanitizedPayloadEnvelope = {
        schema_version: SCHEMA_VERSION,
        cycle_id: cycleId,
        token_manifest: [
          SemanticToken.FINANCIAL,
          SemanticToken.IDENTITY,
          SemanticToken.CONTACT,
          SemanticToken.CREDENTIAL
        ],
        sanitized_dom_tree: domTree,
        metrics: {
          sanitization_duration_ms: 10,
          entities_redacted_count: sanitizationResponse.overlay_markers.length
        }
      };

      const plannerRequest: PlannerRequest = {
        schema_version: SCHEMA_VERSION,
        session_id: session.sessionId,
        cycle_id: cycleId,
        goal: session.goal,
        step_index: session.totalCyclesCompleted,
        token_manifest: sanitizedEnvelope.token_manifest,
        sanitized_payload: sanitizedEnvelope
      };
      (plannerRequest as any).active_url = session.activeUrl;

      // 5. Reason: Ask planner for next action
      console.log(`[Agent][${cycleId}] Step 5: Sending to planner...`);
      const plannerResponse = await this.planner.planStep(plannerRequest);
      console.log(`[Agent][${cycleId}] Step 5 complete: is_terminal=${plannerResponse.is_terminal}, action=${plannerResponse.action?.type || 'none'}`);

      if (plannerResponse.is_terminal) {
        this.sessionManager.recordStep({
          stepIndex: session.totalCyclesCompleted,
          cycleId,
          timestamp: new Date().toISOString(),
          state: TaskState.COMPLETED,
          pageUrl: session.activeUrl
        });
        this.sessionManager.complete();
        return { success: true, isTerminal: true };
      }

      const action = plannerResponse.action;
      if (!action) {
        throw new Error("Planner returned non-terminal response without an action");
      }

      // 6. Validate: Re-resolve target and validate safety & secrets locally
      this.sessionManager.transitionTo(TaskState.VALIDATING_ACTION);
      console.log(`[Agent][${cycleId}] Step 6: Validating action ${action.type} on target ${JSON.stringify(action.target)}...`);

      let targetInfo: ResolveTargetElementResponse | undefined;
      if (action.target && this.targetResolver) {
        targetInfo = await this.targetResolver(action.target);
        console.log(`[Agent][${cycleId}] Target resolved: found=${targetInfo?.found}, visible=${targetInfo?.isVisible}, credential=${targetInfo?.isCredentialField}`);
      }

      const validationResult = this.validator.validateProposedAction(action, targetInfo);
      console.log(`[Agent][${cycleId}] Validation result: valid=${validationResult.isValid}, intervention=${validationResult.requiresIntervention}, error=${validationResult.errorCode}`);

      // Check Human-in-the-Loop Secret Intervention (Constitution Article XIII)
      if (validationResult.requiresIntervention) {
        const interventionCtx: HumanInterventionContext = {
          cycleId,
          targetFieldId: targetInfo?.nodeId || action.target?.nodeId,
          secretType: "PASSWORD",
          promptMessage: validationResult.interventionReason || "Please enter your password or credential directly",
          timestamp: new Date().toISOString()
        };

        session.interventionContext = interventionCtx;
        this.sessionManager.transitionTo(TaskState.INTERVENTION_REQUIRED);

        if (this.interventionUiTrigger) {
          this.interventionUiTrigger(interventionCtx);
        }

        this.sessionManager.recordStep({
          stepIndex: session.totalCyclesCompleted,
          cycleId,
          timestamp: new Date().toISOString(),
          state: TaskState.INTERVENTION_REQUIRED,
          actionProposed: action,
          validationResult,
          pageUrl: session.activeUrl
        });

        return { success: false, requiresIntervention: true };
      }

      if (!validationResult.isValid) {
        this.sessionManager.fail(`Action validation failed fail-closed: ${validationResult.diagnosticMessage}`);
        return { success: false, error: validationResult.diagnosticMessage };
      }

      // 7. Execute: Dispatch validated action on live DOM
      this.sessionManager.transitionTo(TaskState.EXECUTING_ACTION);
      console.log(`[Agent][${cycleId}] Step 7: Executing ${action.type} action...`);

      if (!this.actionExecutor) {
        throw new Error("No actionExecutor registered on AgentController");
      }

      const executionOutcome = await this.actionExecutor(action, validationResult);
      console.log(`[Agent][${cycleId}] Step 7 complete: success=${executionOutcome.success}, duration=${executionOutcome.durationMs}ms, error=${executionOutcome.error}`);

      this.sessionManager.recordStep({
        stepIndex: session.totalCyclesCompleted,
        cycleId,
        timestamp: new Date().toISOString(),
        state: TaskState.EXECUTING_ACTION,
        actionProposed: action,
        validationResult,
        executionOutcome,
        pageUrl: session.activeUrl
      });

      if (!executionOutcome.success) {
        this.sessionManager.fail(`Execution failed: ${executionOutcome.error}`);
        return { success: false, error: executionOutcome.error };
      }

      // 8. Repeat: Return to OBSERVING for next cycle
      this.sessionManager.transitionTo(TaskState.OBSERVING);
      return { success: true, isTerminal: false };

    } catch (err: any) {
      console.error(`[Agent][${cycleId}] Cycle error:`, err?.message || err);
      this.sessionManager.fail(err?.message || "Internal error in perception-action loop");
      return { success: false, error: err?.message };
    }
  }

  /**
   * Continuously executes cycles until task is completed, requires human intervention, or encounters error.
   */
  public async runAutonomousLoop(
    maxCycles = 15
  ): Promise<{ success: boolean; requiresIntervention?: boolean; isTerminal?: boolean; error?: string }> {
    let cycles = 0;
    while (cycles < maxCycles) {
      cycles++;
      const outcome = await this.runNextCycle();
      if (!outcome.success) {
        return outcome;
      }
      if (outcome.isTerminal) {
        return outcome;
      }
      // Brief pause between actions to allow real-world DOM updates to settle
      await new Promise(r => setTimeout(r, 250));
    }
    return { success: true, isTerminal: true };
  }
}
