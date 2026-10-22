# Security

## Reporting a vulnerability

Open a private report via GitHub Security Advisories ("Report a vulnerability" on the Security tab) rather than a public issue. Please include a reproduction and the affected version/commit. Expect an initial response within a week.

## Baseline

Scanned with [Trivy](https://github.com/aquasecurity/trivy) 0.76.1 on 2026-10-22:

| Target | Scanner | Result |
|---|---|---|
| `pnpm-lock.yaml` | vuln | 0 known vulnerabilities |
| repository | secret | 0 findings |
| `Dockerfile` | misconfig | 0 findings (was 2: `DS-0002`, `DS-0026`) |
| `xdiag:latest` (alpine 3.24.3, 72 OS packages) | vuln | 0 known vulnerabilities |

## Hardening in place

- Final image runs as the unprivileged `nginx` user; no root process at runtime.
- `HEALTHCHECK` on `/`, retried by Docker/orchestrators.
- Served files are `chmod a-w`, so a compromised worker cannot rewrite them.
- `server_tokens off` (no version banner), strict `Content-Security-Policy`
  (`default-src 'self'`, no third-party origins), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- No telemetry, no network calls at runtime: the app parses DBML entirely in the browser.

## Reproducing

```bash
trivy fs --scanners vuln,secret,misconfig --quiet .
docker build -t xdiag .
trivy image --quiet xdiag
```

Both are also enforced in CI (`.github/workflows/ci.yml`) with an exit-code gate on HIGH/CRITICAL findings, `--ignore-unfixed` so the gate stays on actionable issues. Unfixed findings are tracked in the Security tab instead of failing builds.
