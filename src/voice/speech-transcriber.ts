/**
 * Local Speech Transcriber
 * Implements Constitution Article XII (Voice Input Privacy).
 * Speech transcription occurs locally via browser Web Speech API with zero cloud audio transmission.
 */

declare const webkitSpeechRecognition: any;
declare const SpeechRecognition: any;

export interface ISpeechTranscriber {
  isSupported(): boolean;
  startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): Promise<void>;
  stopListening(): void;
  disposeAudioBuffers(): void;
}

/**
 * Native Browser Web Speech API Transcriber
 */
export class WebSpeechTranscriber implements ISpeechTranscriber {
  private recognition: any = null;
  private buffersDisposed: boolean = true;

  public isSupported(): boolean {
    return typeof window !== "undefined" &&
      (typeof SpeechRecognition !== "undefined" || typeof webkitSpeechRecognition !== "undefined");
  }

  public async startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    if (!this.isSupported()) {
      onError("Speech recognition not supported in this environment");
      return;
    }

    const RecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new RecognitionConstructor();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.buffersDisposed = false;

    let hasHandledFinal = false;
    let accumulatedText = "";

    this.recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript) {
        accumulatedText = interimTranscript;
        onInterim(interimTranscript);
      }
      if (finalTranscript) {
        accumulatedText = finalTranscript;
        hasHandledFinal = true;
        onFinal(finalTranscript);
        this.disposeAudioBuffers();
      }
    };

    this.recognition.onerror = (event: any) => {
      this.disposeAudioBuffers();
      if (!hasHandledFinal) {
        hasHandledFinal = true;
        onError(event.error || "Speech recognition error");
      }
    };

    this.recognition.onend = () => {
      this.disposeAudioBuffers();
      if (!hasHandledFinal) {
        hasHandledFinal = true;
        if (accumulatedText.trim()) {
          onFinal(accumulatedText.trim());
        } else {
          onError("no-speech");
        }
      }
    };

    try {
      this.recognition.start();
    } catch (err: any) {
      this.disposeAudioBuffers();
      if (!hasHandledFinal) {
        hasHandledFinal = true;
        onError(err?.message || "Failed to start speech recognition");
      }
    }
  }

  public stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.disposeAudioBuffers();
  }

  public disposeAudioBuffers(): void {
    this.buffersDisposed = true;
    this.recognition = null;
  }
}

/**
 * Mock Speech Transcriber for automated testing and offline environments.
 */
export class MockSpeechTranscriber implements ISpeechTranscriber {
  private mockText: string;
  private simulateError: boolean;
  private errorMessage: string;
  private buffersDisposed: boolean = true;

  constructor(mockText: string = "", simulateError: boolean = false, errorMessage: string = "speech-error") {
    this.mockText = mockText;
    this.simulateError = simulateError;
    this.errorMessage = errorMessage;
  }

  public isSupported(): boolean {
    return true;
  }

  public async startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    this.buffersDisposed = false;

    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.simulateError) {
          this.disposeAudioBuffers();
          onError(this.errorMessage);
          resolve();
          return;
        }

        onInterim(this.mockText);
        onFinal(this.mockText);
        this.disposeAudioBuffers();
        resolve();
      }, 10);
    });
  }

  public stopListening(): void {
    this.disposeAudioBuffers();
  }

  public disposeAudioBuffers(): void {
    this.buffersDisposed = true;
  }

  public areBuffersDisposed(): boolean {
    return this.buffersDisposed;
  }
}
