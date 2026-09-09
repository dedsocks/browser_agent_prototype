/**
 * Voice Manager
 * Coordinates microphone lifecycle, zero raw audio guarantees,
 * immediate audio buffer disposal, and typed text fallback.
 * Implements Constitution Article I & XII.
 */

import { VoiceSession, VoiceState } from "../common/types.js";
import { ISpeechTranscriber, WebSpeechTranscriber } from "./speech-transcriber.js";

export class VoiceManager {
  private transcriber: ISpeechTranscriber;
  private session: VoiceSession;

  constructor(transcriber?: ISpeechTranscriber) {
    this.transcriber = transcriber || new WebSpeechTranscriber();
    this.session = {
      state: VoiceState.INACTIVE,
      transcript: "",
      isFinal: false,
      audioBuffersCleared: true
    };
  }

  public getSession(): VoiceSession {
    return this.session;
  }

  public async startListening(): Promise<{
    success: boolean;
    transcript?: string;
    fallbackToText?: boolean;
    error?: string;
  }> {
    if (!this.transcriber.isSupported()) {
      this.session.state = VoiceState.UNAVAILABLE;
      this.session.errorMessage = "Voice input unsupported on this platform";
      return {
        success: false,
        fallbackToText: true,
        error: this.session.errorMessage
      };
    }

    this.session.state = VoiceState.LISTENING;
    this.session.transcript = "";
    this.session.isFinal = false;
    this.session.audioBuffersCleared = false;

    return new Promise((resolve) => {
      this.transcriber.startListening(
        (interim) => {
          this.session.transcript = interim;
        },
        (finalText) => {
          this.session.transcript = finalText;
          this.session.isFinal = true;
          this.session.state = VoiceState.SUCCESS;
          this.session.audioBuffersCleared = true;
          resolve({
            success: true,
            transcript: finalText
          });
        },
        (errorMsg) => {
          this.session.state = VoiceState.UNAVAILABLE;
          this.session.errorMessage = errorMsg;
          this.session.audioBuffersCleared = true;
          resolve({
            success: false,
            fallbackToText: true,
            error: errorMsg
          });
        }
      );
    });
  }

  public stopListening(): void {
    this.transcriber.stopListening();
    this.session.audioBuffersCleared = true;
    if (this.session.state === VoiceState.LISTENING) {
      this.session.state = VoiceState.INACTIVE;
    }
  }
}
