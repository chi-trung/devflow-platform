# DevFlow API

DevFlow exposes a REST API so your own tools — CLI scripts, bots, CI jobs,
dashboards — can read and write the same data the web app sees.

- **Base URL (production):** `https://devflow-api-vd5h.onrender.com/api/v1`
- **Interactive docs (Swagger UI):** `https://devflow-api-vd5h.onrender.com/swagger`
- **OpenAPI spec (JSON):** `https://devflow-api-vd5h.onrender.com/swagger/v1/swagger.json`

## Authentication

Every request (except `GET /ping` and `/health`) requires a bearer
credential in the `Authorization` header. Two kinds are accepted:

| Credential | Shape | Who it's for |
|---|---|---|
| JWT access token | issued by the login flow (`POST /auth/login`) | the web app itself |
| **Personal access token** | `df_` + 96 hex chars | your scripts and integrations |

```
Authorization: Bearer df_0f2dee...1070
```

### Creating a personal access token

1. Sign in to the web app and open **Settings → Security → Personal Access
   Tokens**.
2. **Generate Token**, give it a name, pick scopes, set an expiry (max 30
   days per token is recommended; the default is 30 days).
3. Copy the raw `df_...` token immediately — it is **never shown again**
   (only its SHA-256 hash is stored server-side).

### Scopes

A PAT's scopes decide what it may do:

| Scope | Allows |
|---|---|
| `read` | GET/HEAD calls only |
| `write` | any call, including state-changing methods |
| `tasks` | any call — intended for task-automation bots |
| `admin` | any call — workspace administration |

Read-only enforcement is server-side: a `read`-scoped token receives
**`403 Forbidden`** with a ProblemDetails body on any `POST`, `PUT`,
`PATCH` or `DELETE`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "This personal access token is read-only; write operations require a write scope."
}
```

### Token lifecycle

- **Last used** is stamped on every successful call and visible in Settings.
- **Revoke** from Settings → Security at any time; revoked and expired
  tokens fail with `401` immediately.
- A token that leaks? Revoke it — scripts that need continuity should mint
  a fresh token as part of their rotation.

### Quickstart

```bash
# Read your workspaces
curl -H "Authorization: Bearer $DEVFLOW_PAT" \
  https://devflow-api-vd5h.onrender.com/api/v1/workspaces

# Read a project's tasks
curl -H "Authorization: Bearer $DEVFLOW_PAT" \
  "https://devflow-api-vd5h.onrender.com/api/v1/workspaces/$WS/projects/$PROJECT/tasks"

# Create a task (requires a write/tasks/admin-scoped token)
curl -X POST \
  -H "Authorization: Bearer $DEVFLOW_PAT" \
  -H "Content-Type: application/json" \
  -d '{"title": "Ship the release notes", "status": "Todo"}' \
  https://devflow-api-vd5h.onrender.com/api/v1/workspaces/$WS/projects/$PROJECT/tasks
```

## Realtime (SignalR)

Browser sessions and realtime clients connect over SignalR hubs
(`/hubs/projects`, `/hubs/notifications`). To avoid putting a long-lived
credential in a WebSocket URL (which proxies log), the client first
exchanges its bearer credential for a **one-time, 90-second hub ticket**:

```bash
curl -X POST -H "Authorization: Bearer $DEVFLOW_PAT" \
  https://devflow-api-vd5h.onrender.com/api/v1/auth/hub-ticket
# -> {"ticket":"hbt_..."}
```

Then connect with `access_token=hbt_...` in the WebSocket query string.
Each ticket works exactly once.

## Webhooks

Project webhooks push events (task created/updated, sprint started, …) to
any HTTPS endpoint you register.

- **Signature:** every delivery carries an `X-Webhook-Signature` header —
  the HMAC-SHA256 of the raw request body, keyed with the webhook's
  secret. Verify it before trusting the payload.
- **Retries:** deliveries that fail are retried through a durable outbox
  with exponential backoff and dead-lettering after repeated failures.
- Manage webhooks in the app (**Workspace → Webhooks**) or via
  `POST /webhooks`, `GET /webhooks`, `POST /webhooks/{id}/test`,
  `DELETE /webhooks/{id}`.

Verification example (Node.js):

```js
import { createHmac, timingSafeEqual } from "node:crypto";

const expected = createHmac("sha256", webhookSecret)
  .update(rawBody) // exact bytes as received, before JSON parsing
  .digest("hex");

if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
  return res.status(401).end();
}
```

## Errors & limits

- Errors follow RFC 9110 ProblemDetails (`application/problem+json`).
- Requests are rate-limited per user (per IP when unauthenticated) with a
  sliding window; exceeding it returns `429 Too Many Requests`. Auth
  endpoints have a stricter quota to resist brute force.
- Invalid, expired or revoked credentials return `401`; valid credentials
  doing something their scopes forbid return `403`.
