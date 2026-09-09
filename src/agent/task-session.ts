/**
 * Task Session Manager
 * Manages active task lifecycle, audit history, and state transitions.
 * Implements Constitution Article XIV, XV & XVI.
 */

import { TaskSession, TaskState, StepLogEntry } from "../common/types.js";

export class TaskSessionManager {
  private currentSession: TaskSession | null = null;

  public createSession(goal: string, activeUrl: string): TaskSession {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.currentSession = {
      sessionId,
      goal,
      state: TaskState.IDLE,
      activeUrl,
      stepHistory: [],
      totalCyclesCompleted: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.currentSession;
  }

  public getSession(): TaskSession | null {
    return this.currentSession;
  }

  public transitionTo(state: TaskState): void {
    if (!this.currentSession) return;
    this.currentSession.state = state;
    this.currentSession.updatedAt = new Date().toISOString();
  }

  public recordStep(entry: StepLogEntry): void {
    if (!this.currentSession) return;
    this.currentSession.stepHistory.push(entry);
    this.currentSession.totalCyclesCompleted += 1;
    this.currentSession.updatedAt = new Date().toISOString();
  }

  public pause(): void {
    if (!this.currentSession) return;
    this.currentSession.pausedUrl = this.currentSession.activeUrl;
    this.transitionTo(TaskState.PAUSED);
  }

  public checkUrlDivergence(currentLiveUrl: string): boolean {
    if (!this.currentSession || !this.currentSession.pausedUrl) return false;

    const pausedUrlObj = new URL(this.currentSession.pausedUrl);
    const currentUrlObj = new URL(currentLiveUrl);

    // Mismatch if origin or pathname changes
    const isMismatch = pausedUrlObj.origin !== currentUrlObj.origin || pausedUrlObj.pathname !== currentUrlObj.pathname;
    if (isMismatch) {
      this.currentSession.urlMismatchWarning = true;
    }
    return isMismatch;
  }

  public resume(confirmedUrl?: string): void {
    if (!this.currentSession) return;
    if (confirmedUrl) {
      this.currentSession.activeUrl = confirmedUrl;
    }
    this.currentSession.pausedUrl = undefined;
    this.currentSession.urlMismatchWarning = false;
    this.transitionTo(TaskState.OBSERVING);
  }

  public complete(): void {
    if (!this.currentSession) return;
    this.currentSession.completedAt = new Date().toISOString();
    this.transitionTo(TaskState.COMPLETED);
  }

  public fail(errorMessage: string): void {
    if (!this.currentSession) return;
    this.currentSession.error = errorMessage;
    this.transitionTo(TaskState.FAILED);
  }

  public abort(): void {
    if (!this.currentSession) return;
    this.transitionTo(TaskState.IDLE);
    this.currentSession = null;
  }
}
