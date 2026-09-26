# P2 cutover runbook: helper-backed sessions and progress (2026-09-26)

Paste-ready steps for the owner/ops, in the style of
`xiom-lang/ops/docs/PLAYGROUND_AUTH_HELPER.md`. Design and protocol:
`docs/P2_STATE_HELPER_DESIGN.md`. Client and tests are already landed
(commit `87a05b1`); this runbook only flips the deployment.

Preconditions (do not start until all are true):

- Ops has implemented `GET/POST /session`, `POST /session/logout` and
  `GET/PUT/DELETE /progress` on the existing auth helper, confirmed them
  live on the Docker gateway, and noted the ops repo commit.
- The playground repo is at `>= 87a05b1` on `main` and the container is
  healthy with P1 (`sandbox.mode=require`) and P3 (`abuse` field) live.
- A Contabo snapshot (or at least a volume copy) is taken, and the window
  is agreed: expect a one-time sign-in reset for users.
- Substitutions used below: `GW` = the helper's `AUTH_BIND`, i.e. the
  **default-bridge gateway** (`172.17.0.1` on the VPS) -- derive it with
  `docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'`;
  do not use the playground network gateway or the curls hit nothing.
  `AUTH_USER` = the helper's system user (`xiom-auth` in the current
  install).

## C1. Capture the pre-cutover state

```
docker volume ls | grep -i playground
VOL=$(docker volume inspect playground_playground-data --format '{{.Mountpoint}}')
echo "VOL=$VOL"
tar -tzf /dev/null 2>/dev/null; ls -l "$VOL/accounts" | head
curl -s http://127.0.0.1:3300/api/version; echo
docker inspect xiom-playground --format '{{range .Mounts}}{{.Destination}} {{end}}'; echo
grep -c '^SESSION_SECRET=' /opt/xiom/playground.env
grep -c '^AUTH_HELPER_KEY=' /opt/xiom/playground.env
```

Expected: the volume path, one JSON file per account, toolchain v0.61.3,
mounts including `/data`, and `1` for both secret lines.

## C2. Back up the documents (host-side)

```
install -d -m 0700 "/opt/xiom/backups/playground-$(date +%F)"
cp -a "$VOL/accounts" "/opt/xiom/backups/playground-$(date +%F)/accounts"
ls -l "/opt/xiom/backups/playground-$(date +%F)/accounts" | head
```

## C3. Seed the helper store

```
install -d -m 0700 -o "$AUTH_USER" -g "$AUTH_USER" /opt/xiom/playground-state
install -d -m 0700 -o "$AUTH_USER" -g "$AUTH_USER" /opt/xiom/playground-state/accounts
cp -a "$VOL/accounts/." /opt/xiom/playground-state/accounts/
chown -R "$AUTH_USER:$AUTH_USER" /opt/xiom/playground-state
chmod 700 /opt/xiom/playground-state /opt/xiom/playground-state/accounts
chmod 600 /opt/xiom/playground-state/accounts/*.json
ls -l /opt/xiom/playground-state/accounts | head
```

## C4. Install the helper update and confirm it live

```
GIT_SSH_COMMAND="ssh -i /root/.ssh/xiom_ops -o IdentitiesOnly=yes" \
  git -C /opt/xiom/ops pull --ff-only
install -m 0755 /opt/xiom/ops/services/playground-auth/server.py /opt/xiom/playground-auth/server.py
install -m 0644 /opt/xiom/ops/services/playground-auth/xiom-playground-auth.service /etc/systemd/system/xiom-playground-auth.service
# The shipped unit uses ReadWritePaths=-/opt/xiom/playground-state: the `-`
# prefix makes systemd tolerate an absent path. Keep it -- without the
# prefix the unit fails with 226/NAMESPACE when the directory is missing.
systemctl daemon-reload
systemctl restart xiom-playground-auth.service
sleep 1
# GW must be the default-bridge gateway (the helper's AUTH_BIND).
curl -s "http://$GW:3400/health"; echo
# Unauthenticated contract spot checks: session endpoints must 401,
# logout is idempotent, and the key stays required on /exchange.
curl -s -o /dev/null -w 'session/no-bearer:   %{http_code}\n' "http://$GW:3400/session"
curl -s -o /dev/null -w 'session/bad-bearer:  %{http_code}\n' -H 'Authorization: Bearer bogus' "http://$GW:3400/session"
curl -s -o /dev/null -w 'progress/no-bearer:  %{http_code}\n' "http://$GW:3400/progress"
curl -s -o /dev/null -w 'logout/no-bearer:    %{http_code}\n' -X POST "http://$GW:3400/session/logout"
curl -s -o /dev/null -w 'exchange/bad-key:    %{http_code}\n' -X POST "http://$GW:3400/exchange" \
  -H 'Content-Type: application/json' -H 'X-Auth-Helper-Key: wrong' -d '{"code":"x","redirect_uri":"https://playground.xiom-lang.org/auth/github/callback"}'
```

Expected: `{"ok":true}`; `401`, `401`, `401`, `200`, `401`.

## C5. Rotate the helper key and flip the mode (the actual cutover)

```
# Both files must carry the same new key; generate once.
NEW_KEY="$(openssl rand -hex 32)"
sed -i "s/^AUTH_HELPER_KEY=.*/AUTH_HELPER_KEY=$NEW_KEY/" /etc/xiom/playground-auth.env
sed -i "s/^AUTH_HELPER_KEY=.*/AUTH_HELPER_KEY=$NEW_KEY/" /opt/xiom/playground.env
# Helper mode: sessions/progress move host-side. Keep the old SESSION_SECRET
# value in the backup/password manager for rollback, then remove it here.
cp /opt/xiom/playground.env "/opt/xiom/backups/playground-$(date +%F)/playground.env.pre-p2"
sed -i '/^SESSION_SECRET=/d' /opt/xiom/playground.env
echo 'PLAYGROUND_STATE=helper' >> /opt/xiom/playground.env
systemctl restart xiom-playground-auth.service
docker compose -f /opt/xiom/playground/docker-compose.yml up -d --force-recreate
sleep 3
docker logs --tail 30 xiom-playground | grep -E 'State:|Accounts:'
curl -s https://playground.xiom-lang.org/api/version; echo
curl -s https://playground.xiom-lang.org/api/health; echo
```

Expected: the startup log prints `State: helper sessions/progress
(http://host.docker.internal:3400)`; `/api/version` still v0.61.3;
`/api/health` still `sandbox.mode=require` and `abuse:ok`. The `/data`
mount may still be present during phase 1 (unused); it is removed in C8.

## C6. Verify the flow end to end

```
# Forged cookie must not resolve.
curl -s -o /dev/null -w 'forged: %{http_code}\n' \
  -H 'Cookie: xiom_session=tok-deadbeef' https://playground.xiom-lang.org/api/me
```

Expected: `401`. Then in the browser: sign in (users sign in once), open
the dashboard, complete a lesson; check `/api/me`, and confirm sync by
reloading. Confirm the document landed host-side:

```
ls -l /opt/xiom/playground-state/accounts/ | tail -3
```

## C7. Phase-2 cleanup and privacy facts

After 24-48 h of stable helper mode:

- Land the playground cleanup commit: drop the `playground-data:/data`
  volume and `PLAYGROUND_DATA_DIR` from `docker-compose.yml` (the image no
  longer needs `/data`). The next hourly deploy applies it.
- Update the "User data and privacy facts" list in `DEPLOY.md` and the
  mirrored website page: progress documents are stored by the host-side
  playground service under `/opt/xiom/playground-state`, not on a volume
  inside the web container. (The website lane must be told.)
- Optionally delete `/opt/xiom/playground-data` afterwards; keep the C2
  backup and the pre-p2 `playground.env` copy until the owner is satisfied.

## C8. Rollback

```
# Restore the pre-P2 env (puts SESSION_SECRET and the local mode back) and
# drop the helper-mode line.
cp "/opt/xiom/backups/playground-$(date +%F)/playground.env.pre-p2" /opt/xiom/playground.env
docker compose -f /opt/xiom/playground/docker-compose.yml up -d --force-recreate
# Progress written during the window lives host-side only; copy it back so
# the local mode sees it too (additive, safe).
VOL=$(docker volume inspect playground_playground-data --format '{{.Mountpoint}}')
cp -a /opt/xiom/playground-state/accounts/. "$VOL/accounts/"
```

Notes: the helper store is additive, so nothing is lost on rollback; users
may need one more sign-in because the cookie formats differ. Do not restore
`SESSION_SECRET` from the old value if the owner prefers a fresh one - old
signed cookies simply stop verifying (users sign in again).
