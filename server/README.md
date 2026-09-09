# Cloud Thinking Model Planner Server

Adheres to **Constitution Principle III (Server Awareness & Schema 1.5.0 Contract)** and **Principle XIV (Browser Agent Architecture & Trust Boundaries)**.

This server acts as the untrusted external reasoning service. It receives sanitized DOM payloads from the browser agent extension, prompts a thinking model (e.g., Google Gemini 2.0 Thinking / 1.5 Flash / Pro, or OpenAI / DeepSeek), and returns structured JSON actions (`click`, `type`, `scroll`, `navigate`) back to the browser extension's local `ActionValidator`.

---

## Quick Start (Running Locally)

The server uses Python 3 standard library with **zero external pip dependencies**.

### Option A: Google Gemini (Recommended)
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export MODEL_NAME="gemini-2.0-flash"  # or gemini-2.0-flash-thinking-exp / gemini-1.5-pro
python3 server/cloud_planner_server.py
```

### Option B: OpenAI / Local Ollama / DeepSeek
```bash
export OPENAI_API_KEY="your-openai-api-key"
export MODEL_NAME="gpt-4o"
python3 server/cloud_planner_server.py
```

*For local Ollama (e.g. DeepSeek-R1, Llama 3.3):*
```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export MODEL_NAME="deepseek-r1:latest"
python3 server/cloud_planner_server.py
```

---

## Verifying the Server

Test the server health:
```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "status": "online",
  "schema_version": "1.5.0",
  "model": "gemini-2.0-flash",
  "backend": "gemini"
}
```

Test a planning request:
```bash
curl -X POST http://localhost:8000/v1/plan \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.5.0",
    "session_id": "test-sess",
    "cycle_id": "test-cycle",
    "goal": "Click sign up",
    "step_index": 0,
    "token_manifest": ["<REDACTED_CREDENTIAL>"],
    "sanitized_payload": {
      "schema_version": "1.5.0",
      "cycle_id": "test-cycle",
      "token_manifest": ["<REDACTED_CREDENTIAL>"],
      "sanitized_dom_tree": {
        "node_id": "btn_1",
        "tag": "button",
        "text": "Sign Up",
        "bounds": {"x": 100, "y": 200, "width": 80, "height": 30}
      }
    }
  }'
```

---

## Connecting with the Browser Agent Extension

1. Open the browser extension popup.
2. Click the **Gear icon** in the top header to reveal **Cloud Reasoning Server** settings.
3. Verify or enter the endpoint URL: `http://127.0.0.1:8000/v1/plan`.
4. Click **Save**.
5. Enter your task (e.g., *"Create an account on ilovepdf"*) and click **Run**.

---

## Deploying to Cloud (Cloud Run / Modal / AWS / Render)

To deploy as a standalone microservice:

### Google Cloud Run
```bash
# Deploy directly from source
gcloud run deploy browser-agent-planner \
  --source . \
  --port 8000 \
  --set-env-vars GEMINI_API_KEY="your-key",MODEL_NAME="gemini-2.0-flash" \
  --allow-unauthenticated
```
Then copy the Cloud Run URL (e.g. `https://browser-agent-planner-xyz.a.run.app/v1/plan`) and paste it into the extension's Cloud Reasoning Settings.
