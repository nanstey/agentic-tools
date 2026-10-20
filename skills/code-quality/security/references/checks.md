# Security check catalog

Use as a lead list. Select rows by the code's effects. Each hit needs a traced source and sink before it becomes a finding.
Rows name dangerous patterns, not exhaustive APIs. Apply the same idea to the language and framework in use.

## Secrets

- Hardcoded keys, tokens, passwords, private keys (`-----BEGIN ... PRIVATE KEY-----`), connection strings with credentials, cloud keys (`AKIA...`, service-account JSON), vendor tokens (`ghp_`, `sk-`, `xox`, `sk_live_`), JWT signing secrets.
- Tracked `.env` or credential files, secrets in CI config, Dockerfile `ARG`/`ENV`, IaC state, test fixtures, comments, logs, and git history when readable.
- Server-only secrets exposed to client bundles (for example `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_` prefixes on a service key).
- Ignore obvious placeholders (`changeme`, `<token>`, `example`), and test keys documented as such. Record them as non-findings if material.

## Injection and execution

- SQL/NoSQL/LDAP/XPath built by string concatenation or interpolation. Safe: parameterized queries and ORM binding. Check raw-query escape hatches and dynamic identifiers (`ORDER BY`, table names).
- OS command: `exec`, `system`, `popen`, `shell=True`, backticks with input. Safe: argument arrays with no shell and allowlisted values.
- Code/template injection: `eval`, `Function`, dynamic `require`/`import`, server-side template strings built from input.
- Insecure deserialization: `pickle`, `yaml.load`, Java `ObjectInputStream`, `unserialize`, `Marshal.load`, untrusted `JSON` revivers that instantiate types.
- XXE: XML parsers with external entities or DTDs enabled.
- Header, log, and email injection through unsanitized CR/LF.

## Web output and browser

- XSS: `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `mark_safe`, `|safe`, unescaped template output, `javascript:` URLs, unsafe DOM sinks. Safe: framework auto-escaping, sanitization with an allowlist, a strict CSP.
- Open redirect and `postMessage` without origin checks.
- CSRF on state-changing cookie-authenticated routes. Safe: SameSite plus token or custom-header checks.
- CORS: reflected origin with credentials, wildcard with credentials.
- Missing security headers matter only where they remove a real defense (CSP, frame protection on sensitive pages, HSTS). Treat as Low unless chained.
- Cookies: missing `HttpOnly`/`Secure`/`SameSite` on session cookies. Tokens in `localStorage` where XSS is plausible.

## Authentication and authorization

- Missing authentication on sensitive routes, admin functions, webhooks, and internal endpoints exposed externally.
- Broken object-level authorization (IDOR): object fetched by client-supplied ID without an ownership or tenant check. Broken function-level authorization: role checks only in the UI.
- Mass assignment: request bodies bound straight to models (`role`, `isAdmin`, `tenantId`).
- Sessions and tokens: JWT `alg: none` or algorithm confusion, missing signature/expiry/audience checks, weak or default secrets, long-lived tokens without revocation, session fixation, predictable reset tokens.
- Password handling: plain, fast-hash, or unsalted storage. Safe: argon2/bcrypt/scrypt with sane cost. Non-constant-time secret comparison. No lockout or throttling on login and reset.
- Privilege escalation through confused deputy, trust of client-supplied identity headers, or unvalidated impersonation.

## Files, network, and paths

- Path traversal: input in file paths, archive extraction (zip slip), symlink following. Safe: resolve, then verify the result stays inside an allowed root.
- Upload: trust in client MIME or extension, no size limit, files stored under the web root, executable content.
- SSRF: server-side fetches of user-supplied URLs without allowlist, DNS-rebinding and redirect handling, access to cloud metadata addresses and internal ranges. Config-supplied URLs are not user input.
- Insecure transport: disabled TLS verification, plaintext credentials, HTTP for sensitive calls.

## Cryptography

- MD5/SHA-1/DES/RC4/ECB for security purposes, hardcoded IVs or salts, nonce reuse, home-made crypto.
- Non-cryptographic randomness (`Math.random`, `rand()`, `random`) for tokens, IDs, or secrets.
- Keys derived from low-entropy input without a KDF. Missing integrity (encryption without authentication).

## Data, logging, and errors

- Secrets, tokens, credentials, or personal data in logs, error responses, analytics, URLs, and client-visible stack traces.
- Over-broad API responses that return full records, internal fields, or other users' data.
- Sensitive data stored or sent without encryption where policy requires it. Missing retention and deletion paths for personal data when regulation applies.

## Concurrency and business logic

- Check-then-act races (TOCTOU) on balances, quotas, coupons, uniqueness, and file operations. Safe: atomic operations, transactions, locks, unique constraints.
- Integer overflow, rounding, and negative values in money and quantity. Client-trusted prices.
- Missing rate limits and abuse controls on login, reset, signup, search, expensive endpoints, and enumeration surfaces. Predictable identifiers where authorization is weak.

## Dependencies, build, and deployment

- Known-vulnerable or deprecated packages visible in lockfiles. Unpinned versions, `latest` tags, install/postinstall scripts, typosquats, dependency confusion on private names.
- CI: untrusted PR code with secrets (`pull_request_target`), script injection through `${{ github.event... }}` in `run:`, unpinned third-party actions, broad `permissions`, secrets echoed to logs.
- Containers and IaC: running as root, privileged mode, host mounts, secrets in layers, public buckets or databases, wildcard IAM, open security groups, debug modes in production.

## LLM and agent code

- Prompt injection: untrusted content (web, files, tool output, user text) placed into prompts that control tools, with no separation or confirmation.
- Excessive agency: tools with write, shell, network, or credential access beyond the task. Missing human approval for destructive or external actions.
- Model output used unsafely: fed to shell, SQL, `eval`, HTML, or file paths without validation.
- Secrets or private data in prompts, logs, or traces sent to third parties. Skill and agent files that grant broad tool permissions or hide instructions.

## Common false positives

- Values from server configuration or constants treated as user input.
- Parameterized queries, ORM filters, and framework auto-escaping that the pattern search misses.
- Test, fixture, and example code that is not packaged or deployed (note when it could be copied into production).
- Authorization enforced by middleware, a gateway, or a policy layer outside the viewed file. Check before flagging, and cite what you checked.
