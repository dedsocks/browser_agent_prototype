import { VoiceManager } from "../voice/voice-manager.js";

declare const chrome: any;

const voiceManager = new VoiceManager();

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("btn-scan") as HTMLButtonElement;
  const clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
  const demoBtn = document.getElementById("btn-demo") as HTMLButtonElement;
  const statusEl = document.getElementById("status-text") as HTMLElement;

  const taskInput = document.getElementById("task-input") as HTMLInputElement;
  const voiceBtn = document.getElementById("btn-voice-input") as HTMLButtonElement;
  const startTaskBtn = document.getElementById("btn-start-task") as HTMLButtonElement;
  const pauseTaskBtn = document.getElementById("btn-pause-task") as HTMLButtonElement;
  const resumeTaskBtn = document.getElementById("btn-resume-task") as HTMLButtonElement;
  const abortTaskBtn = document.getElementById("btn-abort-task") as HTMLButtonElement;
  const runStepBtn = document.getElementById("btn-run-step") as HTMLButtonElement;

  if (voiceBtn) {
    voiceBtn.addEventListener("click", async () => {
      statusEl.textContent = "Listening for task goal (Local Speech-to-Text)...";
      voiceBtn.style.background = "#E53E3E";
      voiceBtn.textContent = "🔴";

      const res = await voiceManager.startListening();
      voiceBtn.style.background = "";
      voiceBtn.textContent = "🎤";

      if (res.success && res.transcript) {
        if (taskInput) {
          taskInput.value = res.transcript;
        }
        statusEl.textContent = "Spoken goal transcribed locally!";
      } else if (res.fallbackToText) {
        statusEl.textContent = `Voice unavailable (${res.error || "error"}). Please type task.`;
        if (taskInput) {
          taskInput.focus();
        }
      }
    });
  }

  // Poll current agent status on popup open
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "GET_TASK_STATE" }, (res: any) => {
      if (res?.state) {
        statusEl.textContent = `Agent Status: ${res.state}`;
        if (res.session?.goal && taskInput) {
          taskInput.value = res.session.goal;
        }
      }
    });
  }

  if (startTaskBtn) {
    startTaskBtn.addEventListener("click", async () => {
      const goal = (taskInput?.value || "").trim();
      if (!goal) {
        statusEl.textContent = "Please enter a task goal!";
        return;
      }

      statusEl.textContent = "Starting autonomous task...";
      let currentUrl = "";
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || "";
      }

      chrome.runtime.sendMessage({ type: "START_TASK", goal, url: currentUrl }, (res: any) => {
        statusEl.textContent = "Task Started: OBSERVING";
      });
    });
  }

  if (pauseTaskBtn) {
    pauseTaskBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "PAUSE_TASK" }, (res: any) => {
        statusEl.textContent = "Agent Status: PAUSED";
      });
    });
  }

  if (resumeTaskBtn) {
    resumeTaskBtn.addEventListener("click", async () => {
      let currentUrl = "";
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || "";
      }
      chrome.runtime.sendMessage({ type: "RESUME_TASK", currentUrl }, (res: any) => {
        if (res?.requiresConfirmation) {
          const proceed = confirm(res.warning);
          if (proceed) {
            chrome.runtime.sendMessage({ type: "RESUME_TASK", currentUrl, confirmedDivergence: true }, () => {
              statusEl.textContent = "Agent Resumed: OBSERVING";
            });
          }
        } else {
          statusEl.textContent = "Agent Resumed: OBSERVING";
        }
      });
    });
  }

  if (abortTaskBtn) {
    abortTaskBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "ABORT_TASK" }, () => {
        statusEl.textContent = "Agent Status: IDLE";
      });
    });
  }

  if (runStepBtn) {
    runStepBtn.addEventListener("click", () => {
      statusEl.textContent = "Executing cycle step...";
      chrome.runtime.sendMessage({ type: "RUN_NEXT_CYCLE" }, (res: any) => {
        if (res?.isTerminal) {
          statusEl.textContent = "Task COMPLETED!";
        } else if (res?.requiresIntervention) {
          statusEl.textContent = "⚠️ Human Intervention Required!";
        } else if (res?.success) {
          statusEl.textContent = "Step completed. Ready for next.";
        } else {
          statusEl.textContent = `Error: ${res?.error || "Cycle failed"}`;
        }
      });
    });
  }

  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      statusEl.textContent = "Scanning active tab...";
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "TRIGGER_PERCEPTION_CYCLE", cycle_id: `manual-scan-${Date.now()}` },
            () => {
              statusEl.textContent = "Protection active. Overlay refreshed!";
              setTimeout(() => {
                statusEl.textContent = "Privacy Boundary Armed (Fail-Closed)";
              }, 2000);
            }
          );
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAYS" }, () => {
            statusEl.textContent = "Overlays cleared.";
          });
        }
      }
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
      }
    });
  }
});
