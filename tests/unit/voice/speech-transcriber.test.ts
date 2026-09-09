import { describe, it, expect } from "vitest";
import { MockSpeechTranscriber } from "../../../src/voice/speech-transcriber.js";

describe("Speech Transcriber (Constitution Article XII)", () => {
  it("MockSpeechTranscriber simulates local transcription and disposes audio buffers", async () => {
    const transcriber = new MockSpeechTranscriber("Book flight to Seattle");
    expect(transcriber.isSupported()).toBe(true);

    let interimResult = "";
    let finalResult = "";

    await transcriber.startListening(
      (text) => { interimResult = text; },
      (text) => { finalResult = text; },
      (err) => { throw new Error(err); }
    );

    expect(interimResult).toBe("Book flight to Seattle");
    expect(finalResult).toBe("Book flight to Seattle");
    expect(transcriber.areBuffersDisposed()).toBe(true);
  });

  it("handles speech errors cleanly and alerts callback", async () => {
    const transcriber = new MockSpeechTranscriber("Some text", true, "permission-denied");
    let receivedError = "";

    await transcriber.startListening(
      () => {},
      () => {},
      (err) => { receivedError = err; }
    );

    expect(receivedError).toBe("permission-denied");
  });
});
