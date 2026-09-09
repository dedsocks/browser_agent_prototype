import { describe, it, expect } from "vitest";
import { VoiceManager } from "../../../src/voice/voice-manager.js";
import { MockSpeechTranscriber } from "../../../src/voice/speech-transcriber.js";
import { VoiceState } from "../../../src/common/types.js";

describe("Voice Manager (Constitution Article I & XII)", () => {
  it("transitions states during speech transcription and records audio buffers cleared", async () => {
    const mockTranscriber = new MockSpeechTranscriber("Search flights to New York");
    const voiceManager = new VoiceManager(mockTranscriber);

    expect(voiceManager.getSession().state).toBe(VoiceState.INACTIVE);

    const promise = voiceManager.startListening();
    expect(voiceManager.getSession().state).toBe(VoiceState.LISTENING);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.transcript).toBe("Search flights to New York");
    expect(voiceManager.getSession().state).toBe(VoiceState.SUCCESS);
    expect(voiceManager.getSession().audioBuffersCleared).toBe(true);
  });

  it("gracefully falls back to typed input state when microphone permission fails", async () => {
    const errorTranscriber = new MockSpeechTranscriber("", true, "not-allowed");
    const voiceManager = new VoiceManager(errorTranscriber);

    const result = await voiceManager.startListening();
    expect(result.success).toBe(false);
    expect(result.fallbackToText).toBe(true);
    expect(voiceManager.getSession().state).toBe(VoiceState.UNAVAILABLE);
    expect(voiceManager.getSession().errorMessage).toContain("not-allowed");
  });
});
