/**
 * Network Transmission Gatekeeper
 * Intercepts outbound requests to cloud reasoning models and enforces pre-transmission verification.
 * Implements Constitution Principle I & Principle V (Fail-Closed Protocol).
 */

import {
  SanitizedPayloadEnvelope,
  RedactionManifest,
  PrivacyAbortEvent
} from "../common/types.js";
import { verifyPreTransmission } from "../privacy/verifier.js";

export interface GatekeeperOptions {
  fetchImpl?: typeof fetch;
  vlmEndpoint?: string;
  timeoutMs?: number;
  onPrivacyAbort?: (event: PrivacyAbortEvent) => void;
}

export class NetworkTransmissionGatekeeper {
  private fetchImpl: typeof fetch;
  private vlmEndpoint: string;
  private timeoutMs: number;
  private onPrivacyAbort?: (event: PrivacyAbortEvent) => void;

  constructor(options: GatekeeperOptions = {}) {
    this.fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (undefined as any));
    this.vlmEndpoint = options.vlmEndpoint || "https://api.reasoning-agent.local/v1/perception";
    this.timeoutMs = options.timeoutMs || 2000;
    this.onPrivacyAbort = options.onPrivacyAbort;
  }

  /**
   * Transmits a sanitized envelope to the reasoning service only if verification passes.
   * If verification fails, blocks transmission, emits PRIVACY_ABORT, and throws an error.
   */
  async transmit(
    payload: SanitizedPayloadEnvelope,
    manifest: RedactionManifest
  ): Promise<any> {
    // 1. Run Pre-Transmission Zero-Leakage Verification
    const verification = verifyPreTransmission(payload, manifest);

    if (!verification.valid) {
      const abortEvent: PrivacyAbortEvent = {
        eventType: "PRIVACY_ABORT",
        cycleId: payload.cycle_id,
        timestamp: new Date().toISOString(),
        reason: verification.diagnosticMessage || "Pre-transmission verification failed",
        failedStage: "VERIFICATION",
        actionRequired: "HALT_TASK_SESSION"
      };

      if (this.onPrivacyAbort) {
        this.onPrivacyAbort(abortEvent);
      }

      throw new Error(`PRIVACY_ABORT: ${abortEvent.reason} (stage: ${abortEvent.failedStage})`);
    }

    // 2. Perform Network Transmission to VLM Reasoning Service
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.vlmEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Schema-Version": payload.schema_version,
          "X-Cycle-Id": payload.cycle_id
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Remote reasoning service error: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === "AbortError") {
        const timeoutAbort: PrivacyAbortEvent = {
          eventType: "PRIVACY_ABORT",
          cycleId: payload.cycle_id,
          timestamp: new Date().toISOString(),
          reason: "Network transmission timed out",
          failedStage: "TIMEOUT",
          actionRequired: "HALT_TASK_SESSION"
        };
        if (this.onPrivacyAbort) {
          this.onPrivacyAbort(timeoutAbort);
        }
        throw new Error(`PRIVACY_ABORT: ${timeoutAbort.reason}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
