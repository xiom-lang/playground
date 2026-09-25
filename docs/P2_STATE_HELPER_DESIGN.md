# P2 design: host-side sessions and progress store (2026-09-25)

Purpose: the playground container must hold no long-lived session secret and
no multi-tenant data. After P1 (AUDIT section 29) user code cannot reach
`/data` or the server environment; P2 removes the assets from the container
altogether so a compromise of the server process itself does not expose a
signing key or every account's progress.

Ops hosts the service. The recommendation is to extend the existing
`playground-auth` helper (same systemd unit, bind, port and helper key) with
the state endpoints below, and to store state on the host at
`/opt/xiom/playground-state/`. One service, one key, no second firewall
exception: the egress guard already allows the container to reach the Docker
gateway on tcp/3400.

## Why this shape

- **Opaque session tokens, created only by a completed OAuth exchange.** The
  helper mints a token after it has successfully exchanged a GitHub code.
  The container can therefore not mint sessions for arbitrary users; it only
  relays a token from the helper to a cookie.
- **No signing secret in the container.** Cookie verification is a lookup at
  the helper (with a short container-side cache), so an attacker with the
  container cannot forge identities offline. The old HMAC path
  (`SESSION_SECRET`) goes away entirely.
- **Progress docs never enter the container.** `GET/PUT/DELETE /progress`
  proxy to the helper, authenticated by the session token, so the container
  (and user code) can never read another account's document, and no
  multi-tenant volume is mounted.
- **The OAuth `state` no longer needs the session secret.** It is signed
  with a random key generated at container start; it only needs to live for
  the 10 minutes between redirect and callback, and a restart simply
  invalidates a pending sign-in.

## Helper API (JSON; extends the existing auth helper on gateway:3400)

Existing key rules: `X-Auth-Helper-Key` on `/exchange`. Session endpoints use
`Authorization: Bearer <token>`. Bodies are capped (64 KiB for `/exchange`,
1 MiB for progress). Errors are `{"ok":false,"error":"..."}` with 400, 401,
409, 413 or 502. Key comparison stays constant-time.

- `GET /health` -> `{"ok":true}` (no secrets, no counters needed).
- `POST /exchange` (key) `{"code","redirect_uri"}` -> validates with GitHub
  (existing behaviour), creates a session, returns
  `{"ok":true,"token":"<64 hex>","expiresAt":"<ISO>","user":{"id","login","avatar_url"}}`.
  The GitHub token is still discarded; `409` semantics unchanged otherwise.
- `GET /session` (Bearer) -> `{"ok":true,"user":{...},"expiresAt":"..."}`;
  `401 {"ok":false,"error":"invalid session"}` when unknown or expired.
- `POST /session/logout` (Bearer) -> `{"ok":true}`; idempotent.
- `GET /progress` (Bearer) ->
  `{"ok":true,"found":true,"revision":"<uuid>","updated":"<ISO>","document":{...}}`
  or `{"ok":true,"found":false}` when the account has no document.
- `PUT /progress` (Bearer) `{"document":{...},"baseRevision":"<uuid|null>"}` ->
  `{"ok":true,"revision":"<uuid>","updated":"<ISO>"}`, or
  `409 {"ok":false,"error":"revision mismatch","revision":"<uuid>","updated":"<ISO>","document":{...}}`
  when the stored revision moved on (the container mirrors this into the
  existing 409 response so the client merge flow is unchanged).
- `DELETE /progress` (Bearer) -> `{"ok":true}`; idempotent.

Sessions: 32 random bytes (64 hex), TTL 30 days (matching the current
cookie), stored with `{user, created, expiresAt}`. Expired tokens are pruned.
`GET /session` may refresh `expiresAt` (sliding window, capped at 90 days) or
leave it absolute; the container only copies the returned `expiresAt` into
the cookie. Recommendation: absolute 30 days for simplicity.

Storage on the host:

- `/opt/xiom/playground-state/accounts/<github-id>.json`
  (`{"revision","updated","document"}`, mode 0600, atomic tmp+rename);
- `/opt/xiom/playground-state/sessions.json`
  (`{token: {user, expiresAt}}`, mode 0600, atomic writes, rewritten on
  create/logout/expiry);
- directory owned by the helper's service user, mode 0700. The helper is the
  only writer; nothing mounts this directory into the container.

## Container changes (playground repo, after the helper is live)

- `lib/auth.js`:
  - `authConfigured()` = `GITHUB_CLIENT_ID` + `OAUTH_CALLBACK_URL` +
    `AUTH_HELPER_URL` + `AUTH_HELPER_KEY` (no `SESSION_SECRET`).
  - `makeState`/`verifyState` sign with a per-boot random key
    (`crypto.randomBytes(32)`); nothing persisted.
  - `exchangeCode()` returns the helper's `{token, expiresAt, user}`; the
    callback sets `xiom_session` to the opaque token (same flags).
  - `userFromRequest(req)` becomes async: cookie token -> helper
    `GET /session`, with a 60 s positive cache and a 10 s negative cache keyed
    by token. Server routes (`/api/me`, `/api/progress`, callback) `await` it.
  - `logout` calls `POST /session/logout` before clearing the cookie.
- `lib/progress-store.js` becomes a thin helper client with the same
  function names and return shapes (`readProgress` -> `{revision, updated,
  document}|null`, `writeProgress` -> `{conflict,...}`, `deleteProgress` ->
  boolean); sanitization stays in the container, the helper re-validates size
  and shape defensively.
- `docker-compose.yml`: remove the `/data` volume, `PLAYGROUND_DATA_DIR` and
  `SESSION_SECRET`; keep `AUTH_HELPER_URL` and `AUTH_HELPER_KEY`.
- Failure behaviour: helper unreachable -> sign-in returns 503, `/api/me`
  returns 401 after the positive cache expires, progress endpoints return 503
  with a clear JSON error; lessons and compilation are unaffected.
- `tools/test-server.js`: the existing mock helper grows the endpoints above
  (in-memory sessions + docs) so the whole flow is covered: authorize ->
  callback -> cookie -> `/api/me` -> progress PUT/GET/409/DELETE -> logout ->
  401, plus "forged cookie rejected" and "helper down behaves as documented".

## Cutover and migration

1. Owner picks a short window; snapshot `/data` on the VPS.
2. Stop the container (or put the playground in read-only mode), copy
   `/data/accounts/*.json` to `/opt/xiom/playground-state/accounts/`, chown
   to the helper's service user, start the helper with the new endpoints.
3. Deploy the container update (compose without `/data` and without
   `SESSION_SECRET`); users sign in again once (old signed cookies are
   invalid by design).
4. Verify: `/api/health` unchanged; sign-in round-trip; progress
   PUT/GET/409/DELETE through the public API; `docker inspect` shows no
   `/data` mount and no `SESSION_SECRET`; `ls -l
   /opt/xiom/playground-state` is service-owned 0600/0700.
5. Update the privacy facts: progress documents are stored by the host-side
   service, not inside the web container (website page sync needed).

## Acceptance (P2)

- A container compromise cannot: verify or forge session cookies (no secret),
  read any stored document without the corresponding live token, or mint a
  session for a user id (only a completed OAuth exchange can).
- The container environment has no `SESSION_SECRET`; `/data` is not mounted.
- Progress revision/conflict semantics and sanitization are unchanged from
  the client's point of view (`docs/PROGRESS_SYNC.md` remains accurate).
- Helper outage degrades only the account features, with clear errors.

Rollback: restart the container with the old compose (session secret + data
volume) and the previous helper version; documents remain on the host and
the pre-cutover snapshot restores the old store.
