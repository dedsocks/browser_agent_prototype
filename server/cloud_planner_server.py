#!/usr/bin/env python3
"""
Cloud Thinking Model Planner Server (Constitution v1.5.0 Adherent)
-----------------------------------------------------------------
Acts as the external reasoning service for the Browser Agent.
Receives Schema v1.5.0 sanitized payload envelopes, prompts a thinking model
(Google Gemini or OpenAI-compatible LLM/VLM), and outputs structured agent actions.

Principle III: Ingests schema_version and token_manifest.
Principle XIV: External untrusted planner returning allowlisted actions.
Principle XV: Observe -> Detect -> Sanitize -> Verify -> Transmit -> Reason -> Validate -> Execute.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

def load_dotenv():
    """Loads key-value pairs from .env into os.environ if not already set."""
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "../.env")
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'").strip('"')
                        os.environ[k] = v
            break

load_dotenv()

PORT = int(os.environ.get("PORT", "8000"))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.environ.get("MODEL_NAME", "gemini-3.5-flash-lite" if GEMINI_API_KEY else "gpt-4o")

def extract_json(raw: str) -> dict:
    """Safely extracts JSON object from raw LLM text, handling markdown fences and lists."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    data = json.loads(cleaned)
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object from model, got: {type(data)}")
    return data

SYSTEM_INSTRUCTION = """You are an autonomous web browser agent planner adhering to Constitution v1.5.0.
You will receive:
1. User Goal: Natural language task intent.
2. Active URL: The live web page URL currently open in the user's browser.
3. Token Manifest: List of semantic privacy tokens (e.g. <REDACTED_CREDENTIAL>, <REDACTED_CONTACT>, <REDACTED_FINANCIAL>).
   These tokens represent sensitive values pre-redacted locally by the browser extension's fail-closed privacy boundary.
   NEVER attempt to guess, reconstruct, or output sensitive data.
4. Sanitized DOM Tree: The structural hierarchy of interactive and visible elements on the active webpage.

Your task:
Analyze the page structure and determine the SINGLE NEXT ACTION to advance the user's goal on the real webpage.

Guidelines for real-world sites:
- Form inputs: If user specified names/emails in their prompt, use them. Otherwise, provide realistic user test values (e.g. "Alex Morgan", "alex.morgan@example.com").
- Password fields: For any password or credential field, target the field with "type" and value "<USER_PASSWORD_PLACEHOLDER>". The client-side ActionValidator will automatically halt and prompt the human user to enter their secret securely.
- Submissions & Buttons: Once required form fields are populated, click the submit, sign up, or continue button.
- Selectors: Prefer clean, unambiguous selectors: ID (e.g. #name), name (e.g. input[name="email"]), type (e.g. button[type="submit"]), or text-matching classes.

Permitted action types:
- "click": Click an interactive element (button, link, checkbox, radio).
- "type": Enter text into an input or textarea.
- "scroll": Scroll the page viewport if required to reveal elements.
- "navigate": Navigate to a specific URL if starting a fresh task.

You MUST respond strictly in valid JSON matching this schema:
{
  "cycle_id": "<echo the cycle_id from the request>",
  "thought": "<your step-by-step reasoning explaining what you observe and why you selected this action>",
  "is_terminal": <true ONLY if the overall goal has been completely achieved or cannot proceed, false otherwise>,
  "result_summary": "<optional summary if is_terminal is true>",
  "action": {
    "id": "act_<timestamp>",
    "type": "click" | "type" | "scroll" | "navigate",
    "target": {
      "cssSelector": "<precise CSS selector for the target element>",
      "nodeId": "<node_id from the DOM tree if available>"
    },
    "value": "<text to type, if type action>"
  }
}
Output only the JSON object, without markdown code fences or conversational prose.
"""

def normalize_planner_response(parsed: dict, cycle_id: str) -> dict:
    """Normalizes output dictionary to strictly satisfy Constitution Schema 1.5.0."""
    parsed["cycle_id"] = cycle_id
    if "is_terminal" not in parsed:
        parsed["is_terminal"] = False
    if "thought" not in parsed:
        parsed["thought"] = "Action evaluated by reasoning model"
    if "action" in parsed and isinstance(parsed["action"], dict):
        if "id" not in parsed["action"]:
            parsed["action"]["id"] = f"act_{int(time.time() * 1000)}"
    return parsed

def call_gemini(request_payload: dict) -> dict:
    """Invokes Google Gemini API with structured thinking instructions and retry logic."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    
    cycle_id = request_payload.get("cycle_id", "cycle_0")
    user_prompt = f"""
Current Perception-Action Cycle:
Session ID: {request_payload.get('session_id')}
Cycle ID: {cycle_id}
Step Index: {request_payload.get('step_index', 0)}
Goal: {request_payload.get('goal')}
Active URL: {request_payload.get('active_url', 'N/A')}
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(request_payload.get('sanitized_payload', {}).get('sanitized_dom_tree', {}), indent=2)}

Determine the single next action. Return strictly JSON adhering to the schema.
"""
    body = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_INSTRUCTION + "\n\n" + user_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    
    req_data = json.dumps(body).encode("utf-8")
    retryable_codes = {429, 500, 502, 503}
    max_retries = 3
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if not candidates:
                    raise ValueError(f"Gemini returned no candidates: {res_data}")
                parts = candidates[0].get("content", {}).get("parts", [])
                raw_text = ""
                for p in parts:
                    if "text" in p and p["text"]:
                        raw_text += p["text"]
                if not raw_text:
                    raise ValueError(f"No text parts returned in Gemini candidate: {candidates[0]}")
                parsed = extract_json(raw_text)
                return normalize_planner_response(parsed, cycle_id)
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace")
            if he.code in retryable_codes and attempt < max_retries:
                wait = 2 ** (attempt + 1)  # 2s, 4s, 8s
                sys.stderr.write(f"[CloudPlannerServer] Gemini HTTP {he.code} (attempt {attempt + 1}/{max_retries + 1}), retrying in {wait}s...\n")
                time.sleep(wait)
                last_error = RuntimeError(f"Gemini API returned HTTP {he.code}: {err_body}")
                continue
            sys.stderr.write(f"[CloudPlannerServer] Gemini HTTP Error {he.code}: {err_body}\n")
            raise RuntimeError(f"Gemini API returned HTTP {he.code}: {err_body}") from he
        except (TimeoutError, urllib.error.URLError) as te:
            if attempt < max_retries:
                wait = 2 ** (attempt + 1)
                sys.stderr.write(f"[CloudPlannerServer] Gemini Network/Timeout error ({te}), retrying in {wait}s (attempt {attempt + 1}/{max_retries + 1})...\n")
                time.sleep(wait)
                last_error = te
                continue
            sys.stderr.write(f"[CloudPlannerServer] Gemini reasoning timeout/network error: {te}\n")
            raise
        except Exception as e:
            sys.stderr.write(f"[CloudPlannerServer] Gemini reasoning error: {e}\n")
            raise

    raise last_error or RuntimeError("Gemini API call failed after all retries")

def call_openai_compatible(request_payload: dict) -> dict:
    """Invokes OpenAI-compatible endpoint (OpenAI, Claude proxy, DeepSeek, Ollama)."""
    url = f"{OPENAI_BASE_URL.rstrip('/')}/chat/completions"
    cycle_id = request_payload.get("cycle_id", "cycle_0")
    
    user_prompt = f"""
Current Perception-Action Cycle:
Session ID: {request_payload.get('session_id')}
Cycle ID: {cycle_id}
Step Index: {request_payload.get('step_index', 0)}
Goal: {request_payload.get('goal')}
Active URL: {request_payload.get('active_url', 'N/A')}
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(request_payload.get('sanitized_payload', {}).get('sanitized_dom_tree', {}), indent=2)}

Determine the single next action. Return strictly JSON.
"""
    body = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        raw_text = res_data["choices"][0]["message"]["content"]
        parsed = extract_json(raw_text)
        return normalize_planner_response(parsed, cycle_id)

def plan_with_model(request_payload: dict) -> dict:
    """Dispatches to the configured model backend."""
    if GEMINI_API_KEY:
        return call_gemini(request_payload)
    elif OPENAI_API_KEY or "localhost" in OPENAI_BASE_URL:
        return call_openai_compatible(request_payload)
    else:
        raise ValueError(
            "No Cloud Model API key configured on server. "
            "Please export GEMINI_API_KEY or OPENAI_API_KEY before starting the server."
        )

class PlannerRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Schema-Version")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        status_info = {
            "status": "online",
            "schema_version": "1.5.0",
            "model": MODEL_NAME,
            "backend": "gemini" if GEMINI_API_KEY else ("openai" if OPENAI_API_KEY else "unconfigured")
        }
        self.wfile.write(json.dumps(status_info, indent=2).encode("utf-8"))

    def do_POST(self):
        if self.path != "/v1/plan":
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error":"Endpoint not found. Use POST /v1/plan"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            req_json = json.loads(post_data.decode("utf-8"))
            
            # Verify Schema Version per Constitution Principle III
            schema_version = req_json.get("schema_version")
            if schema_version != "1.5.0":
                self.send_response(400)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                err_msg = json.dumps({
                    "error": f"Invalid schema_version: expected '1.5.0', got '{schema_version}'"
                })
                self.wfile.write(err_msg.encode("utf-8"))
                return

            # Execute Model Reasoning
            planner_response = plan_with_model(req_json)

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(planner_response).encode("utf-8"))

        except Exception as e:
            import traceback
            sys.stderr.write(f"[CloudPlannerServer] Internal Error handling POST /v1/plan: {e}\n")
            traceback.print_exc(file=sys.stderr)
            self.send_response(500)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            err_obj = {"error": f"Planner server reasoning error: {str(e)}"}
            self.wfile.write(json.dumps(err_obj).encode("utf-8"))

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[CloudPlannerServer] {args[0]} - {args[1]} {args[2]}\n")

def run_server():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, PlannerRequestHandler)
    backend_name = "Google Gemini" if GEMINI_API_KEY else ("OpenAI / Custom LLM" if OPENAI_API_KEY else "NO KEY SET (export GEMINI_API_KEY or OPENAI_API_KEY)")
    print(f"================================================================")
    print(f" Cloud Reasoning Planner Server listening on http://0.0.0.0:{PORT}")
    print(f" Schema Version: 1.5.0 | Model: {MODEL_NAME}")
    print(f" Active Backend: {backend_name}")
    print(f" Endpoint: POST http://localhost:{PORT}/v1/plan")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
