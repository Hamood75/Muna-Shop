#!/usr/bin/env bash
# Retries `instant-cli push perms` — useful when GET …/perms/pull returns a transport error
# right after a schema push or on flaky networks.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
export INSTANT_PERMS_FILE_PATH="${INSTANT_PERMS_FILE_PATH:-src/instant.perms.ts}"
ATTEMPTS="${INSTANT_PUSH_PERMS_ATTEMPTS:-6}"
DELAY="${INSTANT_PUSH_PERMS_DELAY_SEC:-12}"
for ((i = 1; i <= ATTEMPTS; i++)); do
  echo "[instant] push perms attempt ${i}/${ATTEMPTS}"
  if instant-cli --yes push perms; then
    exit 0
  fi
  if [[ "$i" -lt "$ATTEMPTS" ]]; then
    echo "[instant] retry in ${DELAY}s (set INSTANT_PUSH_PERMS_DELAY_SEC / INSTANT_PUSH_PERMS_ATTEMPTS to tune)"
    sleep "$DELAY"
  fi
done
exit 1
