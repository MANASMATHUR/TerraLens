# Security & Vulnerability Audit

## 1. Key Verification Checks

| Vulnerability Vector | Test Description | Finding / Status | Risk Level |
| :--- | :--- | :--- | :--- |
| **Ground Truth Exposure** | Inspect client responses for benchmark IDs | **Remediated** (DEF-01) — Removed from payload | **P0 (Resolved)** |
| **Supabase Service Key Leakage** | Scan client bundle for service role keys | Verified: Not present in `NEXT_PUBLIC_` namespace | **Pass (Safe)** |
| **Flagsmith Server Key Leakage** | Scan client bundle for server write keys | Verified: Kept in server-only `FLAGSMITH_SERVER_KEY` | **Pass (Safe)** |
| **SQL Injection (SQLi)** | Submit malicious string in `participant_id` | Sanitized; treated as literal string; no query execution | **Pass (Safe)** |
| **Path Traversal** | Submit `../../etc/passwd` in `scenario_id` | Safely handled by parameter binding; no disk escape | **Pass (Safe)** |
| **Variant Manipulation** | Injected invalid arm strings in session create | **Remediated** (DEF-04) — Strict enum check (HTTP 400) | **P2 (Resolved)** |
| **Client Success Spoofing** | Submit `success: true` for bad incident picks | Server independently evaluates picks and rejects spoof | **Pass (Safe)** |
| **Cross-Participant Snooping** | Attempt to read other participant records | No participant-level GET API exists; only aggregates | **Pass (Safe)** |
| **Direct Database Download** | Probe `/terralens.sqlite` / `/sessions.db` | HTTP 404 Not Found; stored in hidden `.data/` folder | **Pass (Safe)** |
| **Dataset Contamination** | Synthetic load polluting human records | Strict separation using `testMarker` and `is_simulated` | **Pass (Safe)** |

---

## 2. Recommendations for Long-Term Hardening
1. **UUIDv4 Format Validation:** Add regex validation `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` to reject non-UUID strings.
2. **Rate Limiting:** Implement IP/token based rate limiting (e.g. `@upstash/ratelimit`) on `/api/sessions` to prevent denial-of-service attempts.
3. **Strict Content Security Policy (CSP):** Enforce strict headers in `next.config.ts` restricting script execution to self and trusted MapLibre CDNs.
