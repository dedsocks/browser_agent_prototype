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
- Target Selection (CRITICAL):
  * nodeId: MUST strictly match an actual "node_id" present in the Sanitized DOM Tree above. DO NOT invent or guess node IDs.
  * expectedText: ALWAYS provide "expectedText" with the exact or partial visible text, aria-label, title, or alt text of the element (e.g. "Sign in with Google", "Google", or "Blank document").
  * coordinates (x, y): For click actions, ALWAYS include "x" and "y" matching the "cx" and "cy" properties provided on the target DOM node.
  * cssSelector: DO NOT hallucinate complex CSS classes (like "a.google.auth-link"). If you are not completely sure of an exact HTML id or name attribute, omit cssSelector or provide a simple generic selector like "button", "a", or "[role='button']".

Canvas-based editors (CRITICAL - Google Docs, Sheets, Slides, Figma, Excalidraw, etc.):
- These apps render their editor inside a <canvas> element, NOT a standard <input> or <textarea>.
- You will see a "canvas" node in the DOM tree — this is the editor surface.
- Standard "type" actions DO NOT work on canvas editors. You MUST use "key_sequence" instead.
- The correct two-step pattern for typing in Google Docs (or any canvas editor):
  Step 1: "click" the canvas element to give it keyboard focus.
  Step 2: "key_sequence" with the text to type in the "value" field.
- For pressing special keys (Enter for new paragraph, Tab for indent, etc.), use the "keys" array with named keys:
  ["Enter"], ["Tab"], ["Backspace"], ["ArrowLeft"], ["ArrowRight"], ["ArrowUp"], ["ArrowDown"],
  ["Home"], ["End"], ["PageUp"], ["PageDown"], ["Control+a"], ["Control+c"], ["Control+v"], ["Control+z"]
- If you need to type text AND press Enter, use two separate actions (one key_sequence for text, one for Enter).

Permitted action types:
- "click": Click an interactive element (button, link, checkbox, radio, or canvas editor surface).
  IMPORTANT: Always include x and y (from the element's cx and cy fields in the DOM tree) in the
  target, so the browser can dispatch mouse events at the exact visual position:
  "target": { "nodeId": "...", "expectedText": "...", "x": <cx value>, "y": <cy value> }
  This is REQUIRED for Google Docs, Google Drive, and any app that uses mouse coordinates.
- "type": Enter text into a standard HTML input or textarea element.
- "key_sequence": Dispatch real keyboard events (keydown/keypress/keyup) on the focused element.
  Use this for canvas-based editors (Google Docs, Sheets, Slides, Figma) and any app that listens
  to keyboard events rather than input value changes.
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
    "type": "click" | "type" | "key_sequence" | "scroll" | "navigate",
    "target": {
      "nodeId": "<node_id from the DOM tree if available>",
      "expectedText": "<visible text, aria-label, or title of the element, e.g. 'Sign in with Google' or 'Blank document'>",
      "cssSelector": "<simple CSS selector if known, e.g. button or #id, or omit>",
      "x": <cx value from DOM node — center x coordinate in viewport pixels>,
      "y": <cy value from DOM node — center y coordinate in viewport pixels>
    },
    "value": "<text to type (for 'type' action) or text to keyboard-input (for 'key_sequence' action)>",
    "keys": ["<optional array of named special keys for key_sequence, e.g. ['Enter'] or ['Control+a']>"]
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
        act = parsed["action"]
        if "id" not in act:
            act["id"] = f"act_{int(time.time() * 1000)}"
        target = act.get("target")
        if isinstance(target, dict):
            if "node_id" in target and "nodeId" not in target:
                target["nodeId"] = target["node_id"]
            if "expected_text" in target and "expectedText" not in target:
                target["expectedText"] = target["expected_text"]
            if "css_selector" in target and "cssSelector" not in target:
                target["cssSelector"] = target["css_selector"]
    return parsed

def prune_dom_tree(node: dict) -> dict:
    """Recursively prunes empty non-interactive containers to reduce token count and latency."""
    if not isinstance(node, dict):
        return {}

    interactive_tags = {"a", "button", "input", "textarea", "select", "option", "form", "dialog",
                        "h1", "h2", "h3", "h4", "h5", "h6",
                        # Canvas-based editors (Google Docs, Sheets, Slides) and rich-text surfaces
                        "canvas"}
    tag = node.get("tag", "").lower()
    text = (node.get("text") or "").strip()
    role = node.get("role")
    attrs = node.get("attributes") or {}
    has_meaningful_attrs = any(k in attrs for k in ("id", "name", "type", "href", "placeholder", "aria-label", "value"))

    # Preserve contenteditable divs (rich-text editors, Notion, Coda, etc.)
    is_contenteditable = attrs.get("contenteditable") in ("true", "")

    pruned_children = []
    for c in node.get("children", []):
        p = prune_dom_tree(c)
        if p:
            pruned_children.append(p)

    is_leaf_container = not text and not pruned_children and not has_meaningful_attrs and not is_contenteditable
    if is_leaf_container and tag not in interactive_tags:
        return {}

    clean_node = {
        "node_id": node.get("node_id"),
        "tag": tag,
    }
    if role:
        clean_node["role"] = role
    if text:
        clean_node["text"] = text[:150]
    if attrs:
        filtered_attrs = {k: v for k, v in attrs.items() if k in ("id", "name", "type", "href", "placeholder", "aria-label", "value", "title", "role", "contenteditable")}
        if filtered_attrs:
            clean_node["attributes"] = filtered_attrs
    # Include bounding box so the planner can compute click coordinates.
    # cx/cy are the element center in viewport pixels — always use these in click targets.
    bounds = node.get("bounds")
    if bounds and isinstance(bounds, dict):
        w = bounds.get("width", 0)
        h = bounds.get("height", 0)
        x = bounds.get("x", 0)
        y = bounds.get("y", 0)
        if w > 0 and h > 0:
            clean_node["bounds"] = {"x": x, "y": y, "width": w, "height": h}
            clean_node["cx"] = round(x + w / 2)
            clean_node["cy"] = round(y + h / 2)
    if pruned_children:
        clean_node["children"] = pruned_children

    return clean_node

def call_gemini(request_payload: dict) -> dict:
    """Invokes Google Gemini API with structured thinking instructions and retry logic."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    
    cycle_id = request_payload.get("cycle_id", "cycle_0")
    raw_dom = request_payload.get("sanitized_payload", {}).get("sanitized_dom_tree", {})
    optimized_dom = prune_dom_tree(raw_dom)

    user_prompt = f"""
Current Perception-Action Cycle:
Session ID: {request_payload.get('session_id')}
Cycle ID: {cycle_id}
Step Index: {request_payload.get('step_index', 0)}
Goal: {request_payload.get('goal')}
Active URL: {request_payload.get('active_url', 'N/A')}
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(optimized_dom, indent=2)}

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
    raw_dom = request_payload.get("sanitized_payload", {}).get("sanitized_dom_tree", {})
    optimized_dom = prune_dom_tree(raw_dom)
    
    user_prompt = f"""
Current Perception-Action Cycle:
Session ID: {request_payload.get('session_id')}
Cycle ID: {cycle_id}
Step Index: {request_payload.get('step_index', 0)}
Goal: {request_payload.get('goal')}
Active URL: {request_payload.get('active_url', 'N/A')}
Active Token Manifest: {json.dumps(request_payload.get('token_manifest', []))}

Sanitized DOM Tree:
{json.dumps(optimized_dom, indent=2)}

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
