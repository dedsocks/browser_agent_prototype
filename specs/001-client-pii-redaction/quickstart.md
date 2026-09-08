# Quickstart Validation Guide: Client-Side PII Redaction Pipeline

**Feature**: Client-Side PII Redaction Pipeline (`001-client-pii-redaction`)  
**Status**: Completed  
**Alignment**: Constitution v1.5.0 Quality Gates

This guide describes how to validate the client-side PII redaction pipeline end-to-end using automated contract tests, zero-leakage simulation tests, and benchmark scripts.

---

## 1. Prerequisites

- **Node.js**: >= 20.x LTS
- **Package Manager**: `npm` or `pnpm`
- **Modern Browser**: Chromium (with WebGPU support or `--enable-unsafe-webgpu`) or Firefox Developer Edition

---

## 2. Environment Setup

```bash
# Clone and enter workspace (already in repo)
cd /home/dedsocks/Projects/repos/browser_agent_prototype

# Install test runner & core dependencies
npm install --save-dev vitest @types/node jsdom
```

---

## 3. Validation Scenarios

### Scenario A: Deterministic PII Regex & Checksum Verification
Verifies that valid and invalid payment cards, SSNs, PANs, and Aadhaar numbers are correctly identified using algorithmic validation (Luhn and Verhoeff).

```bash
# Run unit tests for detection and checksum algorithms
npx vitest run tests/unit/detection
```
**Expected Outcome**:
- 100% detection on valid Visa, Mastercard, Amex, Discover, SSN, PAN, Aadhaar test vectors.
- Rejection of invalid Luhn/Verhoeff checksum inputs (avoids false-positive over-redaction).

---

### Scenario B: Zero Raw Data Transmission & Token Replacement
Verifies that mock HTML pages containing sensitive credentials produce outbound payloads where all sensitive text is replaced by semantic tokens (`<REDACTED_FINANCIAL>`, `<REDACTED_CREDENTIAL>`, etc.) and adjacent labels are scrubbed.

```bash
# Run contract and serialization gate tests
npx vitest run tests/contract/payload-serialization.test.ts
```
**Expected Outcome**:
- Serialized JSON matches [`payload-schema.json`](file:///home/dedsocks/Projects/repos/browser_agent_prototype/specs/001-client-pii-redaction/contracts/payload-schema.json).
- 0 raw credit card numbers, passwords, or emails present in output string.
- Header contains `"schema_version": "1.5.0"`.

---

### Scenario C: Fail-Closed Fault Injection Test
Simulates an engine timeout or corrupted manifest during the pre-transmission verification phase.

```bash
# Run fault-injection suite
npx vitest run tests/integration/fail-closed.test.ts
```
**Expected Outcome**:
- Network transmission is completely blocked.
- Pipeline emits `PRIVACY_ABORT` with `"actionRequired": "HALT_TASK_SESSION"`.
- Zero bytes transmitted to mock backend.

---

### Scenario D: Non-Destructive DOM & Audit Overlay Render Budget
Verifies that sanitization leaves the live DOM intact and overlay paints within the 50ms budget.

```bash
# Run DOM integrity and benchmark tests
npx vitest run tests/unit/audit-overlay.test.ts
```
**Expected Outcome**:
- `input.value` and live DOM nodes remain unmodified.
- Overlay renders within <50ms execution window.

---

## References
- Data Model: [`data-model.md`](file:///home/dedsocks/Projects/repos/browser_agent_prototype/specs/001-client-pii-redaction/data-model.md)
- Payload Contract: [`contracts/payload-schema.json`](file:///home/dedsocks/Projects/repos/browser_agent_prototype/specs/001-client-pii-redaction/contracts/payload-schema.json)
- Constitution: [`.specify/memory/constitution.md`](file:///home/dedsocks/Projects/repos/browser_agent_prototype/.specify/memory/constitution.md)
