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
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8000"))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.environ.get("MODEL_NAME", "gemini-2.5-flash" if GEMINI_API_KEY else "gpt-4o")

SYSTEM_INSTRUCTION = """You are an autonomous web browser agent planner adhering to Constitution v1.5.0.
You will receive:
1. User Goal: Natural language task intent.
2. Token Manifest: List of semantic privacy tokens (e.g. <REDACTED_CREDENTIAL>, <REDACTED_CONTACT>, <REDACTED_FINANCIAL>).
   These tokens represent sensitive values pre-redacted locally by the browser extension's fail-closed privacy boundary.
   NEVER attempt to guess, reconstruct, or output sensitive data.
3. Sanitized DOM Tree: The structural hierarchy of interactive and visible elements on the active webpage.

Your task:
Analyze the page structure and determine the single next optimal action to advance the user's goal.
Permitted action types:
- "click": Click an interactive element (button, link, checkbox, radio).
- "type": Enter non-sensitive text into an input or textarea. For password or credential fields, target the field with an arbitrary placeholder; the client-side ActionValidator will automatically halt and prompt the human user.
- "scroll": Scroll the page viewport if required to reveal elements.
- "navigate": Navigate to a specific URL if starting a fresh task.

You MUST respond strictly in valid JSON matching this schema:
{
  "cycle_id": "<echo the cycle_id from the request>",
  "thought": "<your step-by-step reasoning explaining why you selected this action>",
  "is_terminal": <true if the overall goal has been completed or cannot proceed, false otherwise>,
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

def call_gemini(request_payload: dict) -> dict:
    """Invokes Google Gemini API with structured thinking instructions."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    
    cycle_id = request_payload.get("cycle_id", "cycle_0")
    user_prompt = f"""
Current Perception-Action Cycle:
Session ID: {request_payload.get('session_id')}
Cycle ID: {cycle_id}
Step Index: {request_payload.get('step_index', 0)}
Goal: {request_payload.get('goal')}
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(request_payload.get('sanitized_payload', {}).get('sanitized_dom_tree', {}), indent=2)}

Determine the next step. Return strictly JSON adhering to the schema.
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
    
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        parsed["cycle_id"] = cycle_id
        return parsed

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
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(request_payload.get('sanitized_payload', {}).get('sanitized_dom_tree', {}), indent=2)}

Determine the next step. Return strictly JSON.
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
        parsed = json.loads(raw_text)
        parsed["cycle_id"] = cycle_id
        return parsed

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
