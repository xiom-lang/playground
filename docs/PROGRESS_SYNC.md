# Progress sync contract (B4)

Status: adapter only. The registry session decided (2026-09-19) that the
registry is not an identity provider and will have no accounts at beta, so
there is no registry progress API to call. Cross-device sync is therefore a
playground-backend concern or waits for a future accounts service; the
contract below stays internal and applies to whichever backend eventually
implements it. Publishing artifacts uses the registry's public API plus a
publisher token issued to CI, never user accounts.

## Local data (the source of truth today)

- `xiom_lessons_completed` (localStorage): JSON array of completed lesson ids.
- `xiom_history_v1` (localStorage): `{ version, updated, last, lessons }`.
  `lessons[lessonId]` is a newest-first array of run records:
  `{ t: epoch ms, ok: boolean, timeout: boolean, ms: number, out: string }`.
  `out` is truncated to 400 characters and no source code is stored.

`buildProgressExport()` produces the portable document:

```json
{
  "app": "xiom-playground",
  "version": 1,
  "exported": "2026-09-19T00:00:00.000Z",
  "progress": { "completed": ["L0-01", "L0-02"] },
  "last": { "id": "L0-03", "file": "L0-first-steps/L0-03.json", "title": "Math is Easy", "t": 0 },
  "history": {
    "version": 1,
    "updated": "2026-09-19T00:00:00.000Z",
    "lessons": { "L0-01": [ { "t": 0, "ok": true, "timeout": false, "ms": 1200, "out": "Hello, XIOM!" } ] }
  }
}
```

## Future registry endpoints

```
GET /api/v1/progress
Authorization: Bearer <token>

200 { "ok": true, "revision": "<opaque>", "document": { ...export document... } }
404 { "ok": true, "revision": null, "document": null }        # first sync

PUT /api/v1/progress
Authorization: Bearer <token>
Content-Type: application/json

{ "baseRevision": "<opaque or null>", "document": { ...export document... } }

200 { "ok": true, "revision": "<opaque>" }
409 { "ok": false, "error": "revision_conflict", "revision": "<opaque>" }
```

The server stores the document opaquely per account. It must not interpret
lesson ids; validation is limited to schema, size caps (1 MiB), and auth.
A 409 means the client re-fetches, re-merges, and retries once.

## Conflict policy (deterministic, client-side)

- `progress.completed`: union of both lists.
- `history.lessons`: merge by timestamp, deduplicate on `t`, newest first,
  cap 20 runs per lesson and 400 runs total (same rules as the local store).
- `last`: the record with the greater `t` wins.
- Import and sync use the same merge code (`mergeHistory`), so an export
  round-trips exactly.

## Adapter behaviour

`window.syncProgress()` returns a Promise resolving to
`{ ok: boolean, synced: boolean, reason: string }`. Today it always resolves
`{ ok: false, synced: false, reason: "No account yet. Progress stays in this
browser." }`, and the landing shows that message without changing any other UI.

When accounts exist, the implementation will:

1. Resolve the no-op result when no token is present (the UI stays identical).
2. `GET` the remote document, merge it into local storage, then `PUT` the
   merged document.
3. Retry once on `revision_conflict`, and never delete local data when a
   request fails.

## Privacy

Only lesson ids, timestamps, pass/fail, durations, and truncated program
output are uploaded. Source code, free-play programs, and raw localStorage
keys are never sent. Export/import uses the same payload, so users can
inspect exactly what sync would transfer.
