# Security Policy

EVIA Office is a local-first, experimental project. It is an independent adaptation of [Pixel Office](https://github.com/basriayaz/pixel-office), distributed under the MIT license. Publishing source code does **not** mean it is safe to expose the running server on the internet or use it with sensitive client data.

## Supported scope

- The repository currently documents a local-only application, with no finished production authentication, project/tenant isolation, or uniform per-action authorization.
- Use separate local data directories and credentials. Do not commit files under `.pixel-office/`, client records, conversation histories, environment secrets or backups.
- Provider/API access and charges belong to each operator and require their own accounts and permissions.
- The F1 Task OS backend is incremental; it is not yet wired into a complete Director IA workflow.

## Reporting security issues

Please do not paste exploitable details, private credentials, customer records, or confidential logs into a public GitHub issue. Contact EVIA privately through [iaconsultoresvitales.mx](https://iaconsultoresvitales.mx) to coordinate a security report. We will review reports before disclosing actionable details.

## Deployment warning

Never set `PIXEL_OFFICE_ALLOW_REMOTE=1` without a separate review covering authentication, authorization, isolation, CSRF/CORS/WebSocket boundaries, and security testing. See [docs/EVIA_SECURITY.md](docs/EVIA_SECURITY.md).
