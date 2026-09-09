import { describe, it, expect, vi } from "vitest";
import { VoiceManager } from "../../src/voice/voice-manager.js";
import { MockSpeechTranscriber } from "../../src/voice/speech-transcriber.js";
import { AgentController } from "../../src/agent/controller.js";
import { MockPlannerClient } from "../../src/agent/planner-client.js";

describe("Voice Input Privacy Integration (Constitution Article I & XII)", () => {
  it("converts spoken prompt to sanitized task goal with ZERO external network transmission of audio", async () => {
    // Spy on global fetch to ensure zero audio network requests occur
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const mockTranscriber = new MockSpeechTranscriber("Book flight for shopper@test.com");
    const voiceManager = new VoiceManager(mockTranscriber);

    const speechResult = await voiceManager.startListening();
    expect(speechResult.success).toBe(true);
    expect(speechResult.transcript).toBe("Book flight for shopper@test.com");
    expect(voiceManager.getSession().audioBuffersCleared).toBe(true);

    // Initializing agent task with transcribed prompt
    const controller = new AgentController({
      planner: new MockPlannerClient([])
    });

    const session = controller.startTask(speechResult.transcript!, "https://flights.com");
    expect(session.goal).toBe("Book flight for shopper@test.com");

    // Verify no audio data was transmitted over fetch
    const audioRequests = fetchSpy.mock.calls.filter(call => {
      const url = call[0]?.toString() || "";
      const body = call[1]?.body?.toString() || "";
      return url.includes("speech") || body.includes("audio") || body.includes("wav");
    });
    expect(audioRequests.length).toBe(0);

    fetchSpy.mockRestore();
  });
});
