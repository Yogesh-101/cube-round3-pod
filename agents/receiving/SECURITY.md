# Security Model

This document outlines the security mechanisms implemented in the InboundShield Receiving Manager.

## Authentication and Roles
- **API Keys**: All endpoints (except `/health`) require an `X-API-Key` header.
- **Roles**: Keys are mapped to roles (`operator`, `approver`). Operators can create and analyze inspections. Only `approver` roles can override an inspection to `PASS`.

## Tenant Isolation
- **Strict Enforcement**: The API key determines the `organization_id`. This ID is injected into every database query to ensure operators can only access their organization's facilities, purchase orders, metrics, and inspections.
- **No Cross-Tenant Access**: Trying to access a different organization's inspection returns a 404 (preventing existence leakage).

## Upload Validation
- Files are validated against configured allowed MIME types and extensions.
- Uploads are capped at a max size defined in the environment.
- Filenames are sanitized and randomized upon storage to prevent path traversal attacks.

## Evidence Sealing (HMAC)
- All inspection decisions and overrides generate an immutable record.
- These records are sealed with an HMAC SHA-256 digest using a highly secure `RECEIVING_SEAL_KEY`. 
- Verification endpoints re-compute the hash chain to ensure no record has been tampered with in the database.

## Secrets Handling
- Secrets are stored exclusively in `.env` files.
- Keys are dynamically generated using secure random bytes (`secrets.token_urlsafe`).
- No secrets are ever committed to source control (ignored via `.gitignore`).

## Planned
- **Strict Image Decoding:** Integrating Pillow for deep-level image decode validation to prevent malicious payloads embedded in image blobs.
- **Rate Limiting:** Integrating `slowapi` to protect against brute-force attacks and abuse on all endpoints.
